const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ftTcpSerial", {
  connect: ({ host, port }) => ipcRenderer.invoke("tcp:connect", { host, port }),
  write: (bytes) => ipcRenderer.invoke("tcp:write", bytes),
  disconnect: () => ipcRenderer.invoke("tcp:disconnect"),
  onData: (callback) => ipcRenderer.on("tcp:data", (_event, bytes) => callback(bytes)),
  onClose: (callback) => ipcRenderer.on("tcp:close", callback),
  onError: (callback) => ipcRenderer.on("tcp:error", (_event, message) => callback(message)),
});

contextBridge.exposeInMainWorld("ftUsbSerial", {
  list: () => ipcRenderer.invoke("usb:list"),
  connect: ({ path, baudRate }) => ipcRenderer.invoke("usb:connect", { path, baudRate }),
  write: (bytes) => ipcRenderer.invoke("usb:write", bytes),
  disconnect: () => ipcRenderer.invoke("usb:disconnect"),
  onData: (callback) => ipcRenderer.on("usb:data", (_event, bytes) => callback(bytes)),
  onClose: (callback) => ipcRenderer.on("usb:close", callback),
  onError: (callback) => ipcRenderer.on("usb:error", (_event, message) => callback(message)),
});

contextBridge.exposeInMainWorld("ftApp", {
  onMode: (callback) => ipcRenderer.on("app:mode", (_event, mode) => callback(mode)),
  onSettings: (callback) => ipcRenderer.on("app:settings", callback),
  onHelp: (callback) => ipcRenderer.on("app:help", callback),
  onProtocolAnalysis: (callback) => ipcRenderer.on("app:protocol-analysis", callback),
  setLanguage: (language) => ipcRenderer.invoke("app:set-language", language),
  onLanguage: (callback) => ipcRenderer.on("app:language", (_event, language) => callback(language)),
  configureUpdates: (settings) => ipcRenderer.invoke("app:configure-updates", settings),
  checkUpdates: () => ipcRenderer.invoke("app:check-updates"),
  downloadUpdate: () => ipcRenderer.invoke("app:download-update"),
  installUpdate: () => ipcRenderer.invoke("app:install-update"),
  onUpdateStatus: (callback) => ipcRenderer.on("app:update-status", (_event, status) => callback(status)),
});
