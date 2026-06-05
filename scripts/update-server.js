const fs = require("fs");
const path = require("path");
const { createUpdateServer } = require("./update-server-core");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const port = Number(process.env.FT_UPDATE_PORT) || 8765;
const candidates = ["FTSerialTool-win32-x64.zip", "FTSerialTool-portable-x64.exe"];
const fileName = candidates.find((name) => fs.existsSync(path.join(dist, name)));
if (!fileName) {
  console.error(`No update files found in: ${dist}`);
  console.error("Build or download an update file first.");
  process.exit(1);
}
const packageInfo = require("../package.json");
const updateServer = createUpdateServer({
  port,
  getRelease: () => ({
    version: packageInfo.version,
    notes: "FTSerialTool 局域网更新",
    filePath: path.join(dist, fileName),
    contentType: fileName.endsWith(".zip") ? "application/zip" : "application/vnd.microsoft.portable-executable",
  }),
});

updateServer.listen().then(() => {
  console.log(`Local update server is running on port ${port}`);
  for (const address of updateServer.addresses()) console.log(`Update mirror: ${address}`);
  console.log(`Serving: ${fileName}`);
  console.log("Press Ctrl+C to stop.");
});
