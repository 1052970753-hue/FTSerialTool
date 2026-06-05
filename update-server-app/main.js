const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const fs = require("fs");
const path = require("path");
const { createUpdateServer } = require("../scripts/update-server-core");

let mainWindow;
let updateServer;
let config;

function configPath() {
  return path.join(app.getPath("userData"), "server-config.json");
}

function defaultConfig() {
  const nearbyFile = path.resolve(path.dirname(process.execPath), "..", "FTSerialTool-win32-x64.zip");
  return {
    port: 8765,
    version: app.getVersion(),
    notes: "",
    filePath: fs.existsSync(nearbyFile) ? nearbyFile : "",
    autoStart: true,
    publishedAt: "",
  };
}

function loadConfig() {
  try {
    return { ...defaultConfig(), ...JSON.parse(fs.readFileSync(configPath(), "utf8")) };
  } catch {
    return defaultConfig();
  }
}

function saveConfig(next) {
  config = { ...config, ...next };
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(config, null, 2));
  return config;
}

function releaseInfo() {
  if (!config.filePath || !fs.existsSync(config.filePath)) return null;
  return {
    version: config.version,
    notes: config.notes,
    publishedAt: config.publishedAt,
    filePath: config.filePath,
    contentType: config.filePath.toLowerCase().endsWith(".zip") ? "application/zip" : "application/vnd.microsoft.portable-executable",
  };
}

function sendState(extra = {}) {
  mainWindow?.webContents.send("server:state", {
    running: Boolean(updateServer),
    addresses: updateServer?.addresses() || [],
    stats: updateServer?.stats() || { requests: 0, downloads: 0, active: 0, bytes: 0 },
    config,
    ...extra,
  });
}

async function startServer() {
  if (updateServer) return sendState();
  if (!releaseInfo()) throw new Error("请先选择更新文件");
  updateServer = createUpdateServer({
    port: config.port,
    getRelease: releaseInfo,
    onStats: () => sendState(),
  });
  try {
    await updateServer.listen();
    sendState({ message: "更新服务已启动" });
  } catch (error) {
    updateServer = null;
    throw error;
  }
}

async function stopServer() {
  if (!updateServer) return sendState();
  const server = updateServer;
  updateServer = null;
  await server.close();
  sendState({ message: "更新服务已停止" });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 920,
    height: 680,
    minWidth: 780,
    minHeight: 580,
    title: "FTUpdateServer",
    backgroundColor: "#eef2f4",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, "index.html"));
  mainWindow.webContents.once("did-finish-load", () => sendState());
}

app.whenReady().then(() => {
  config = loadConfig();
  createWindow();
  if (config.autoStart && releaseInfo()) startServer().catch((error) => sendState({ error: error.message }));
});

app.on("before-quit", () => updateServer?.close());
app.on("window-all-closed", () => app.quit());

ipcMain.handle("server:get-state", () => ({
  running: Boolean(updateServer),
  addresses: updateServer?.addresses() || [],
  stats: updateServer?.stats() || { requests: 0, downloads: 0, active: 0, bytes: 0 },
  config,
}));
ipcMain.handle("server:choose-file", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "选择更新文件",
    properties: ["openFile"],
    filters: [{ name: "FTSerialTool 更新文件", extensions: ["zip", "exe"] }],
  });
  if (result.canceled || !result.filePaths[0]) return config;
  return saveConfig({ filePath: result.filePaths[0] });
});
ipcMain.handle("server:save", (_event, next) => {
  const wasRunning = Boolean(updateServer);
  saveConfig({ ...next, port: Math.max(1, Math.min(65535, Number(next.port) || 8765)) });
  if (wasRunning) return stopServer().then(startServer).then(() => config);
  sendState({ message: "发布配置已保存" });
  return config;
});
ipcMain.handle("server:start", () => startServer());
ipcMain.handle("server:stop", () => stopServer());
ipcMain.handle("server:open-file", () => config.filePath && shell.showItemInFolder(config.filePath));
