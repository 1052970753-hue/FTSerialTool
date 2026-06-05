const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");

function localAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((item) => item && item.family === "IPv4" && !item.internal)
    .map((item) => item.address);
}

function createUpdateServer(options) {
  const port = Number(options.port) || 8765;
  const basePath = `/${String(options.basePath || "FTSerialTool").replace(/^\/+|\/+$/g, "")}`;
  const getRelease = options.getRelease;
  const onStats = options.onStats || (() => {});
  const stats = { requests: 0, downloads: 0, active: 0, bytes: 0, startedAt: Date.now() };

  function report() {
    onStats({ ...stats });
  }

  function sendJson(response, status, value) {
    const body = Buffer.from(JSON.stringify(value));
    response.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": body.length,
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*",
    });
    response.end(body);
  }

  function sendFile(request, response, release) {
    const stat = fs.statSync(release.filePath);
    const range = request.headers.range;
    const commonHeaders = {
      "Accept-Ranges": "bytes",
      "Content-Type": release.contentType || "application/octet-stream",
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*",
    };
    let start = 0;
    let end = stat.size - 1;
    let status = 200;

    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      if (!match) {
        response.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
        response.end();
        return;
      }
      start = Number(match[1]);
      end = match[2] ? Math.min(Number(match[2]), stat.size - 1) : stat.size - 1;
      if (start > end || start >= stat.size) {
        response.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
        response.end();
        return;
      }
      status = 206;
      commonHeaders["Content-Range"] = `bytes ${start}-${end}/${stat.size}`;
    }

    response.writeHead(status, { ...commonHeaders, "Content-Length": end - start + 1 });
    if (request.method === "HEAD") return response.end();

    stats.downloads += 1;
    stats.active += 1;
    report();
    const input = fs.createReadStream(release.filePath, { start, end });
    input.on("data", (chunk) => {
      stats.bytes += chunk.length;
    });
    const finish = () => {
      stats.active = Math.max(0, stats.active - 1);
      report();
    };
    input.on("close", finish);
    input.on("error", finish);
    input.pipe(response);
  }

  const server = http.createServer((request, response) => {
    stats.requests += 1;
    report();
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      response.writeHead(405);
      response.end();
      return;
    }
    if (request.method === "OPTIONS") {
      response.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS" });
      response.end();
      return;
    }

    const release = getRelease();
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    if (pathname === `${basePath}/api/latest`) {
      if (!release?.filePath || !fs.existsSync(release.filePath)) {
        sendJson(response, 503, { error: "尚未发布可用更新" });
        return;
      }
      const file = path.basename(release.filePath);
      const size = fs.statSync(release.filePath).size;
      sendJson(response, 200, {
        version: release.version,
        notes: release.notes || "",
        publishedAt: release.publishedAt || new Date().toISOString(),
        asset: { name: file, size, url: `${basePath}/files/${encodeURIComponent(file)}` },
      });
      return;
    }
    if (release?.filePath && pathname === `${basePath}/files/${encodeURIComponent(path.basename(release.filePath))}`) {
      sendFile(request, response, release);
      return;
    }
    if (pathname === "/" || pathname === basePath || pathname === `${basePath}/`) {
      sendJson(response, 200, {
        service: "FTUpdateServer",
        version: release?.version || "",
        file: release?.filePath ? path.basename(release.filePath) : "",
      });
      return;
    }
    response.writeHead(404);
    response.end("Not found");
  });

  return {
    port,
    basePath,
    addresses: () => localAddresses().map((address) => `http://${address}:${port}${basePath}`),
    listen: () => new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, "0.0.0.0", () => {
        server.removeListener("error", reject);
        resolve();
      });
    }),
    close: () => new Promise((resolve) => server.close(resolve)),
    stats: () => ({ ...stats }),
  };
}

module.exports = { createUpdateServer, localAddresses };
