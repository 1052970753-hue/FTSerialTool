const { app, BrowserWindow, Menu, dialog, ipcMain, session, shell, net: electronNet } = require("electron");
const fs = require("fs");
const path = require("path");
const nodeNet = require("net");
let SerialPort;

app.commandLine.appendSwitch("js-flags", "--max-old-space-size=256");
app.commandLine.appendSwitch("renderer-process-limit", "1");
app.commandLine.appendSwitch("disable-features", "AutofillServerCommunication,MediaRouter,OptimizationHints,Translate");
app.disableHardwareAcceleration();

let mainWindow;
let tcpSocket = null;
let usbPort = null;
let updateSettings = { repository: "", mirrorUrl: "", autoCheck: true };
let updateTimer = null;
let updateChecking = false;
let downloadedUpdatePath = "";
let pendingUpdateAsset = null;
let workspaceView = "general";

function getSerialPort() {
  SerialPort ??= require("serialport").SerialPort;
  return SerialPort;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    title: "FTSerialTool",
    backgroundColor: "#eef2f4",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      experimentalFeatures: true,
      enableBlinkFeatures: "Serial,WebBluetooth",
      backgroundThrottling: true,
      spellcheck: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
}

function switchMode(mode) {
  mainWindow?.webContents.send("app:mode", mode);
}

function switchWorkspaceView(view) {
  workspaceView = view;
  buildApplicationMenu();
  mainWindow?.webContents.send("app:workspace-view", view);
}

let appLanguage = "zh";

function setAppLanguage(language) {
  appLanguage = language === "en" ? "en" : "zh";
  buildApplicationMenu();
  mainWindow?.webContents.send("app:language", appLanguage);
}

function buildApplicationMenu() {
  const en = appLanguage === "en";
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: en ? "File" : "文件",
      submenu: [{ role: "quit", label: en ? "Exit" : "退出" }],
    },
    {
      label: en ? "Edit" : "编辑",
      submenu: [
        { role: "undo", label: en ? "Undo" : "撤销" },
        { role: "redo", label: en ? "Redo" : "重做" },
        { type: "separator" },
        { role: "cut", label: en ? "Cut" : "剪切" },
        { role: "copy", label: en ? "Copy" : "复制" },
        { role: "paste", label: en ? "Paste" : "粘贴" },
        { role: "selectAll", label: en ? "Select All" : "全选" },
        { type: "separator" },
        { label: en ? "Protocol Analysis" : "协议解析", click: () => mainWindow?.webContents.send("app:protocol-analysis") },
      ],
    },
    {
      label: en ? "View" : "视图",
      submenu: [
        { label: en ? "Workbench" : "工作台", click: () => switchMode("workbench") },
        { label: en ? "Terminal" : "命令行", click: () => switchMode("terminal") },
        { type: "separator" },
        { label: en ? "General" : "通用", type: "radio", checked: workspaceView === "general", click: () => switchWorkspaceView("general") },
        { label: en ? "Vacuum Cleaner" : "吸尘器", type: "radio", checked: workspaceView === "vacuum", click: () => switchWorkspaceView("vacuum") },
        { label: en ? "ECM Fan" : "ECM风机", type: "radio", checked: workspaceView === "ecm", click: () => switchWorkspaceView("ecm") },
        { label: en ? "Compressor" : "压缩机", type: "radio", checked: workspaceView === "compressor", click: () => switchWorkspaceView("compressor") },
        { type: "separator" },
        { role: "reload", label: en ? "Reload" : "刷新" },
        { role: "togglefullscreen", label: en ? "Full Screen" : "全屏" },
      ],
    },
    {
      label: en ? "Settings" : "设置",
      submenu: [
        { label: en ? "Tool Settings" : "工具设置", click: () => mainWindow?.webContents.send("app:settings") },
        { type: "separator" },
        { label: "中文", type: "radio", checked: !en, click: () => setAppLanguage("zh") },
        { label: "English", type: "radio", checked: en, click: () => setAppLanguage("en") },
      ],
    },
    {
      label: en ? "Help" : "帮助",
      submenu: [
        { label: en ? "Help" : "帮助", click: () => mainWindow?.webContents.send("app:help") },
        { type: "separator" },
        { label: en ? "Check for Updates" : "检查更新", click: () => checkForUpdates(true) },
      ],
    },
  ]));
}

app.whenReady().then(() => {
  buildApplicationMenu();
  session.defaultSession.setPermissionCheckHandler(() => true);
  session.defaultSession.setDevicePermissionHandler(() => true);
  session.defaultSession.on("select-serial-port", (event, portList, webContents, callback) => {
    event.preventDefault();
    if (!portList.length) {
      callback("");
      return;
    }
    if (portList.length === 1) {
      callback(portList[0].portId);
      return;
    }
    const buttons = portList.map((port) => port.displayName || port.portName || port.portId);
    buttons.push("取消");
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: "question",
      title: "选择串口",
      message: "请选择要打开的串口",
      buttons,
      cancelId: buttons.length - 1,
      noLink: true,
    });
    callback(choice >= 0 && choice < portList.length ? portList[choice].portId : "");
  });
  session.defaultSession.on("select-bluetooth-device", (event, deviceList, callback) => {
    event.preventDefault();
    if (!deviceList.length) {
      callback("");
      return;
    }
    const buttons = deviceList.map((device) => device.deviceName || device.deviceId);
    buttons.push("取消");
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: "question",
      title: "选择蓝牙设备",
      message: "请选择 BLE 串口设备",
      buttons,
      cancelId: buttons.length - 1,
      noLink: true,
    });
    callback(choice >= 0 && choice < deviceList.length ? deviceList[choice].deviceId : "");
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  closeTcpSocket();
  closeUsbPort();
  if (process.platform !== "darwin") app.quit();
});

function serialPortLabel(port) {
  const name = port.friendlyName || port.displayName || port.manufacturer || port.pnpId || "USB串口";
  return `${port.path} - ${name}`;
}

function closeUsbPort() {
  if (!usbPort) return;
  const port = usbPort;
  usbPort = null;
  port.removeAllListeners();
  if (port.isOpen) {
    try {
      port.close();
    } catch {}
  }
}

function closeTcpSocket() {
  if (!tcpSocket) return;
  tcpSocket.removeAllListeners();
  tcpSocket.destroy();
  tcpSocket = null;
}

function parseGitHubRepository(value) {
  const text = String(value || "").trim().replace(/\.git$/i, "").replace(/\/+$/, "");
  const match = text.match(/github\.com[/:]([^/]+)\/([^/]+)$/i) || text.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (!match) throw new Error("请在工具设置中填写有效的 GitHub 仓库地址");
  return { owner: match[1], repo: match[2] };
}

function versionParts(value) {
  return String(value || "").replace(/^v/i, "").split(/[.-]/).map((part) => Number(part) || 0);
}

function isNewerVersion(latest, current) {
  const a = versionParts(latest);
  const b = versionParts(current);
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    if ((a[index] || 0) !== (b[index] || 0)) return (a[index] || 0) > (b[index] || 0);
  }
  return false;
}

function sendUpdateStatus(status) {
  mainWindow?.webContents.send("app:update-status", status);
}

async function fetchLatestRelease() {
  const { owner, repo } = parseGitHubRepository(updateSettings.repository);
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": `FTSerialTool/${app.getVersion()}` },
  });
  if (!response.ok) throw new Error(response.status === 404 ? "没有找到 GitHub Release，请确认仓库地址并发布 Release" : `GitHub 请求失败 (${response.status})`);
  return response.json();
}

function selectReleaseAsset(release) {
  const assets = Array.isArray(release.assets) ? release.assets : [];
  return assets.find((asset) => /FTSerialTool.*portable.*\.exe$/i.test(asset.name))
    || assets.find((asset) => /FTSerialTool.*\.exe$/i.test(asset.name))
    || assets.find((asset) => /\.exe$/i.test(asset.name))
    || assets.find((asset) => /\.zip$/i.test(asset.name));
}

async function checkForUpdates(manual = false) {
  if (updateChecking) return;
  updateChecking = true;
  sendUpdateStatus({ state: "checking", message: "正在检查 GitHub 更新..." });
  try {
    const release = await fetchLatestRelease();
    const latest = release.tag_name || release.name;
    if (!latest) throw new Error("最新 Release 缺少版本号");
    if (!isNewerVersion(latest, app.getVersion())) {
      sendUpdateStatus({ state: "current", message: `当前已是最新版本 ${app.getVersion()}` });
      if (manual) dialog.showMessageBox(mainWindow, { type: "info", title: "检查更新", message: "当前已是最新版本", detail: `当前版本：${app.getVersion()}` });
      return;
    }
    pendingUpdateAsset = selectReleaseAsset(release);
    sendUpdateStatus({
      state: "available",
      message: `发现新版本 ${latest}`,
      latest,
      current: app.getVersion(),
      notes: release.body || "暂无更新说明",
      size: pendingUpdateAsset?.size || 0,
      releaseUrl: release.html_url,
    });
  } catch (error) {
    mainWindow?.setProgressBar(-1);
    sendUpdateStatus({ state: "error", message: error.message });
    if (manual) dialog.showErrorBox("检查更新失败", error.message);
  } finally {
    updateChecking = false;
  }
}

function downloadReleaseAsset(asset) {
  return new Promise((resolve, reject) => {
    const target = path.join(app.getPath("downloads"), asset.name);
    const output = fs.createWriteStream(target);
    const request = electronNet.request({ url: asset.url || asset.browser_download_url });
    request.setHeader("User-Agent", `FTSerialTool/${app.getVersion()}`);
    if (asset.url) request.setHeader("Accept", "application/octet-stream");
    request.on("response", (response) => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        output.close();
        fs.rm(target, { force: true }, () => {});
        reject(new Error(`更新下载失败 (${response.statusCode})`));
        return;
      }
      const total = Number(response.headers["content-length"]) || Number(asset.size) || 0;
      let received = 0;
      response.on("data", (chunk) => {
        received += chunk.length;
        const progress = total ? received / total : 0;
        mainWindow?.setProgressBar(progress || -1);
        sendUpdateStatus({ state: "downloading", message: `正在下载 ${asset.name} ${total ? Math.round(progress * 100) : ""}%`, progress });
      });
      response.pipe(output);
      response.on("error", reject);
      output.on("finish", async () => {
        output.close();
        mainWindow?.setProgressBar(-1);
        sendUpdateStatus({ state: "downloaded", message: `更新已下载：${target}` });
        const choice = await dialog.showMessageBox(mainWindow, {
          type: "info",
          title: "更新下载完成",
          message: "新版已下载完成",
          detail: target,
          buttons: ["打开文件位置", "稍后"],
          defaultId: 0,
          cancelId: 1,
        });
        if (choice.response === 0) shell.showItemInFolder(target);
        resolve(target);
      });
    });
    output.on("error", (error) => {
      mainWindow?.setProgressBar(-1);
      reject(error);
    });
    request.on("error", (error) => {
      mainWindow?.setProgressBar(-1);
      output.close();
      fs.rm(target, { force: true }, () => {});
      reject(error);
    });
    request.end();
  });
}

function requestAssetRange(url, start, end, destination, onProgress) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(destination);
    const request = electronNet.request({ url });
    request.setHeader("User-Agent", `FTSerialTool/${app.getVersion()}`);
    request.setHeader("Accept", "application/octet-stream");
    request.setHeader("Range", `bytes=${start}-${end}`);
    request.on("response", (response) => {
      if (response.statusCode !== 206) {
        response.resume();
        output.close();
        reject(Object.assign(new Error(`服务器不支持分段下载 (${response.statusCode})`), { code: "RANGE_UNSUPPORTED" }));
        return;
      }
      response.on("data", (chunk) => onProgress(chunk.length));
      response.on("error", reject);
      response.pipe(output);
      output.on("finish", () => {
        output.close();
        resolve();
      });
    });
    output.on("error", reject);
    request.on("error", reject);
    request.end();
  });
}

function probeRangeSupport(url) {
  return new Promise((resolve) => {
    const request = electronNet.request({ url });
    request.setHeader("User-Agent", `FTSerialTool/${app.getVersion()}`);
    request.setHeader("Accept", "application/octet-stream");
    request.setHeader("Range", "bytes=0-0");
    request.on("response", (response) => {
      const supported = response.statusCode === 206;
      response.resume();
      response.on("end", () => resolve(supported));
    });
    request.on("error", () => resolve(false));
    request.end();
  });
}

async function mergeDownloadParts(parts, target) {
  const output = await fs.promises.open(target, "w");
  try {
    for (const part of parts) {
      for await (const chunk of fs.createReadStream(part)) await output.write(chunk);
    }
  } finally {
    await output.close();
  }
}

async function downloadReleaseAssetFast(asset) {
  const total = Number(asset.size) || 0;
  const url = asset.url || asset.browser_download_url;
  if (!total || !url || !(await probeRangeSupport(url))) return downloadReleaseAssetWithProgress(asset);

  const target = path.join(app.getPath("downloads"), asset.name);
  const partDir = `${target}.parts`;
  const partCount = 4;
  const partSize = Math.ceil(total / partCount);
  const parts = Array.from({ length: partCount }, (_, index) => path.join(partDir, `part-${index}`));
  let received = 0;
  let speedReceived = 0;
  let speedTime = Date.now();
  let lastReport = 0;
  downloadedUpdatePath = "";
  fs.rmSync(partDir, { recursive: true, force: true });
  fs.mkdirSync(partDir, { recursive: true });

  const report = (length) => {
    received += length;
    const now = Date.now();
    if (now - lastReport < 150 && received < total) return;
    const elapsed = Math.max(1, now - speedTime);
    const speed = ((received - speedReceived) * 1000) / elapsed;
    if (elapsed >= 500) {
      speedReceived = received;
      speedTime = now;
    }
    lastReport = now;
    const progress = Math.min(1, received / total);
    mainWindow?.setProgressBar(progress);
    sendUpdateStatus({ state: "downloading", message: `正在多线程下载 ${asset.name}`, progress, received, total, speed });
  };

  try {
    await Promise.all(parts.map((part, index) => {
      const start = index * partSize;
      const end = Math.min(total - 1, start + partSize - 1);
      return requestAssetRange(url, start, end, part, report);
    }));
    await mergeDownloadParts(parts, target);
    sendUpdateStatus({ state: "verifying", message: "下载完成，正在校验更新文件", progress: 1, updateProgress: 0 });
    await verifyUpdateFile(target, total);
    downloadedUpdatePath = target;
    mainWindow?.setProgressBar(1);
    sendUpdateStatus({ state: "ready", message: "更新准备完成，可以立即更新", progress: 1, updateProgress: 1, target });
    return target;
  } catch (error) {
    fs.rmSync(target, { force: true });
    if (error.code === "RANGE_UNSUPPORTED") return downloadReleaseAssetWithProgress(asset);
    throw error;
  } finally {
    fs.rmSync(partDir, { recursive: true, force: true });
  }
}

function mirroredAsset(asset) {
  const mirrorUrl = String(updateSettings.mirrorUrl || "").trim().replace(/\/+$/, "");
  if (!mirrorUrl) return asset;
  return { ...asset, url: `${mirrorUrl}/${encodeURIComponent(asset.name)}`, browser_download_url: `${mirrorUrl}/${encodeURIComponent(asset.name)}` };
}

async function downloadPendingUpdate() {
  if (!pendingUpdateAsset) throw new Error("没有待下载的新版本，请重新检查更新");
  const mirrorUrl = String(updateSettings.mirrorUrl || "").trim();
  if (!mirrorUrl) return downloadReleaseAssetFast(pendingUpdateAsset);
  try {
    sendUpdateStatus({ state: "downloading", message: "正在连接更新加速服务器", progress: 0, received: 0, total: pendingUpdateAsset.size || 0 });
    return await downloadReleaseAssetFast(mirroredAsset(pendingUpdateAsset));
  } catch {
    sendUpdateStatus({ state: "downloading", message: "加速服务器不可用，正在切换 GitHub", progress: 0, received: 0, total: pendingUpdateAsset.size || 0 });
    return downloadReleaseAssetFast(pendingUpdateAsset);
  }
}

function downloadReleaseAssetWithProgress(asset) {
  return new Promise((resolve, reject) => {
    const target = path.join(app.getPath("downloads"), asset.name);
    downloadedUpdatePath = "";
    const output = fs.createWriteStream(target);
    const request = electronNet.request({ url: asset.url || asset.browser_download_url });
    request.setHeader("User-Agent", `FTSerialTool/${app.getVersion()}`);
    if (asset.url) request.setHeader("Accept", "application/octet-stream");
    request.on("response", (response) => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        output.close();
        fs.rm(target, { force: true }, () => {});
        reject(new Error(`更新下载失败 (${response.statusCode})`));
        return;
      }
      const total = Number(response.headers["content-length"]) || Number(asset.size) || 0;
      let received = 0;
      let speedReceived = 0;
      let speedTime = Date.now();
      response.on("data", (chunk) => {
        received += chunk.length;
        const progress = total ? received / total : 0;
        const now = Date.now();
        const elapsed = Math.max(1, now - speedTime);
        const speed = ((received - speedReceived) * 1000) / elapsed;
        if (elapsed >= 500) {
          speedReceived = received;
          speedTime = now;
        }
        mainWindow?.setProgressBar(progress || -1);
        sendUpdateStatus({ state: "downloading", message: `正在下载 ${asset.name}`, progress, received, total, speed });
      });
      response.pipe(output);
      response.on("error", reject);
      output.on("finish", async () => {
        output.close();
        sendUpdateStatus({ state: "verifying", message: "下载完成，正在校验更新文件", progress: 1, updateProgress: 0 });
        try {
          await verifyUpdateFile(target, total);
          downloadedUpdatePath = target;
          mainWindow?.setProgressBar(1);
          sendUpdateStatus({ state: "ready", message: "更新准备完成，可以立即更新", progress: 1, updateProgress: 1, target });
          resolve(target);
        } catch (error) {
          fs.rm(target, { force: true }, () => {});
          reject(error);
        }
      });
    });
    output.on("error", reject);
    request.on("error", (error) => {
      mainWindow?.setProgressBar(-1);
      output.close();
      fs.rm(target, { force: true }, () => {});
      reject(error);
    });
    request.end();
  });
}

function verifyUpdateFile(target, expectedSize) {
  return new Promise((resolve, reject) => {
    const actualSize = fs.statSync(target).size;
    if (expectedSize && actualSize !== expectedSize) {
      reject(new Error(`更新文件大小不完整：${actualSize}/${expectedSize}`));
      return;
    }
    let checked = 0;
    const input = fs.createReadStream(target);
    input.on("data", (chunk) => {
      checked += chunk.length;
      const updateProgress = actualSize ? checked / actualSize : 0;
      mainWindow?.setProgressBar(updateProgress);
      sendUpdateStatus({ state: "verifying", message: "正在校验并准备更新", progress: 1, updateProgress, checked, total: actualSize });
    });
    input.on("end", resolve);
    input.on("error", reject);
  });
}

async function installDownloadedUpdate() {
  if (!downloadedUpdatePath || !fs.existsSync(downloadedUpdatePath)) {
    throw new Error("没有可安装的更新文件，请重新检查更新");
  }
  sendUpdateStatus({ state: "installing", message: "正在启动新版本，旧版本即将关闭", progress: 1, updateProgress: 1 });
  const error = await shell.openPath(downloadedUpdatePath);
  if (error) throw new Error(error);
  setTimeout(() => app.quit(), 800);
  return true;
}

function configureUpdates(settings) {
  updateSettings = {
    repository: String(settings?.repository || "").trim(),
    mirrorUrl: String(settings?.mirrorUrl || "").trim(),
    autoCheck: settings?.autoCheck !== false,
  };
  if (updateTimer) clearInterval(updateTimer);
  updateTimer = null;
  if (updateSettings.autoCheck && updateSettings.repository) {
    setTimeout(() => checkForUpdates(false), 2500);
    updateTimer = setInterval(() => checkForUpdates(false), 6 * 60 * 60 * 1000);
  }
  return updateSettings;
}

ipcMain.handle("usb:list", async () => {
  const ports = await getSerialPort().list();
  return ports.map((port) => ({
    path: port.path,
    label: serialPortLabel(port),
    manufacturer: port.manufacturer || "",
    friendlyName: port.friendlyName || port.displayName || "",
    pnpId: port.pnpId || "",
    vendorId: port.vendorId || "",
    productId: port.productId || "",
  }));
});

ipcMain.handle("usb:connect", async (event, { path: portPath, baudRate }) => {
  closeUsbPort();
  if (!portPath) throw new Error("请选择 USB 串口");

  return new Promise((resolve, reject) => {
    const port = new (getSerialPort())({
      path: portPath,
      baudRate: Number(baudRate) || 115200,
      autoOpen: false,
    });
    usbPort = port;

    const fail = (err) => {
      closeUsbPort();
      reject(err);
    };

    port.once("error", fail);
    port.open((err) => {
      if (err) {
        fail(err);
        return;
      }
      port.removeListener("error", fail);
      port.on("data", (buffer) => event.sender.send("usb:data", buffer));
      port.on("close", () => {
        usbPort = null;
        event.sender.send("usb:close");
      });
      port.on("error", (error) => event.sender.send("usb:error", error.message));
      resolve(true);
    });
  });
});

ipcMain.handle("usb:write", async (_event, bytes) => {
  if (!usbPort?.isOpen) throw new Error("USB串口未连接");
  return new Promise((resolve, reject) => {
    usbPort.write(Buffer.from(bytes), (err) => {
      if (err) {
        reject(err);
        return;
      }
      usbPort.drain((drainErr) => (drainErr ? reject(drainErr) : resolve(true)));
    });
  });
});

ipcMain.handle("usb:disconnect", async () => {
  closeUsbPort();
  return true;
});

ipcMain.handle("app:set-language", async (_event, language) => {
  setAppLanguage(language);
  return appLanguage;
});

ipcMain.handle("app:get-version", async () => app.getVersion());
ipcMain.handle("app:set-workspace-view", async (_event, view) => {
  workspaceView = ["general", "vacuum", "ecm", "compressor"].includes(view) ? view : "general";
  buildApplicationMenu();
  return workspaceView;
});
ipcMain.handle("app:configure-updates", async (_event, settings) => configureUpdates(settings));
ipcMain.handle("app:check-updates", async () => checkForUpdates(true));
ipcMain.handle("app:download-update", async () => downloadPendingUpdate());
ipcMain.handle("app:install-update", async () => installDownloadedUpdate());

ipcMain.handle("tcp:connect", async (event, { host, port }) => {
  closeTcpSocket();
  tcpSocket = new nodeNet.Socket();

  return new Promise((resolve, reject) => {
    const fail = (err) => {
      closeTcpSocket();
      reject(err);
    };

    tcpSocket.once("error", fail);
    tcpSocket.connect(port, host, () => {
      tcpSocket.removeListener("error", fail);
  tcpSocket.on("data", (buffer) => event.sender.send("tcp:data", buffer));
      tcpSocket.on("close", () => {
        tcpSocket = null;
        event.sender.send("tcp:close");
      });
      tcpSocket.on("error", (err) => event.sender.send("tcp:error", err.message));
      resolve(true);
    });
  });
});

ipcMain.handle("tcp:write", async (event, bytes) => {
  if (!tcpSocket) throw new Error("网络串口未连接");
  tcpSocket.write(Buffer.from(bytes));
  return true;
});

ipcMain.handle("tcp:disconnect", async () => {
  closeTcpSocket();
  return true;
});
