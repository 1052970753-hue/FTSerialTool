const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");

const root = path.resolve(__dirname, "..");
const fileName = "FTSerialTool-portable-x64.exe";
const filePath = path.join(root, "dist", fileName);
const port = Number(process.env.FT_UPDATE_PORT) || 8765;

function localAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((item) => item && item.family === "IPv4" && !item.internal)
    .map((item) => item.address);
}

function sendFile(request, response) {
  const stat = fs.statSync(filePath);
  const range = request.headers.range;
  const commonHeaders = {
    "Accept-Ranges": "bytes",
    "Content-Type": "application/vnd.microsoft.portable-executable",
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

if (!fs.existsSync(filePath)) {
  console.error(`Update file not found: ${filePath}`);
  console.error("Run npm run pack:portable first.");
  process.exit(1);
}

const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  if (!["GET", "HEAD"].includes(request.method)) {
    response.writeHead(405);
    response.end();
    return;
  }
  if (pathname === `/FTSerialTool/${fileName}`) {
    sendFile(request, response);
    return;
  }
  if (pathname === "/" || pathname === "/FTSerialTool" || pathname === "/FTSerialTool/") {
    response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(`FTSerialTool local update server\n${fileName}\n`);
    return;
  }
  response.writeHead(404);
  response.end("Not found");
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Local update server is running on port ${port}`);
  for (const address of localAddresses()) console.log(`Update mirror: http://${address}:${port}/FTSerialTool`);
  console.log("Press Ctrl+C to stop.");
});
