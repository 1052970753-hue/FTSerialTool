const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const allowedFiles = new Map([
  ["FTSerialTool-win32-x64.zip", "application/zip"],
  ["FTSerialTool-portable-x64.exe", "application/vnd.microsoft.portable-executable"],
]);
const port = Number(process.env.FT_UPDATE_PORT) || 8765;

function localAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((item) => item && item.family === "IPv4" && !item.internal)
    .map((item) => item.address);
}

function sendFile(request, response, fileName) {
  const filePath = path.join(dist, fileName);
  const stat = fs.statSync(filePath);
  const range = request.headers.range;
  const commonHeaders = {
    "Accept-Ranges": "bytes",
    "Content-Type": allowedFiles.get(fileName),
    "Cache-Control": "no-cache",
  };

  if (!range) {
    response.writeHead(200, { ...commonHeaders, "Content-Length": stat.size });
    if (request.method === "HEAD") return response.end();
    fs.createReadStream(filePath).pipe(response);
    return;
  }

  const match = /^bytes=(\d+)-(\d*)$/.exec(range);
  if (!match) {
    response.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
    response.end();
    return;
  }

  const start = Number(match[1]);
  const end = match[2] ? Math.min(Number(match[2]), stat.size - 1) : stat.size - 1;
  if (start > end || start >= stat.size) {
    response.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
    response.end();
    return;
  }

  response.writeHead(206, {
    ...commonHeaders,
    "Content-Length": end - start + 1,
    "Content-Range": `bytes ${start}-${end}/${stat.size}`,
  });
  if (request.method === "HEAD") return response.end();
  fs.createReadStream(filePath, { start, end }).pipe(response);
}

const availableFiles = [...allowedFiles.keys()].filter((fileName) => fs.existsSync(path.join(dist, fileName)));
if (!availableFiles.length) {
  console.error(`No update files found in: ${dist}`);
  console.error("Build or download an update file first.");
  process.exit(1);
}

const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  if (!["GET", "HEAD"].includes(request.method)) {
    response.writeHead(405);
    response.end();
    return;
  }
  const fileName = pathname.startsWith("/FTSerialTool/") ? pathname.slice("/FTSerialTool/".length) : "";
  if (availableFiles.includes(fileName)) {
    sendFile(request, response, fileName);
    return;
  }
  if (pathname === "/" || pathname === "/FTSerialTool" || pathname === "/FTSerialTool/") {
    response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(`FTSerialTool local update server\n${availableFiles.join("\n")}\n`);
    return;
  }
  response.writeHead(404);
  response.end("Not found");
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Local update server is running on port ${port}`);
  for (const address of localAddresses()) console.log(`Update mirror: http://${address}:${port}/FTSerialTool`);
  for (const fileName of availableFiles) console.log(`Serving: ${fileName}`);
  console.log("Press Ctrl+C to stop.");
});
