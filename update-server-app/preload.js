const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ftUpdateServer", {
  getState: () => ipcRenderer.invoke("server:get-state"),
  chooseFile: () => ipcRenderer.invoke("server:choose-file"),
  save: (config) => ipcRenderer.invoke("server:save", config),
  start: () => ipcRenderer.invoke("server:start"),
  stop: () => ipcRenderer.invoke("server:stop"),
  openFile: () => ipcRenderer.invoke("server:open-file"),
  onState: (callback) => ipcRenderer.on("server:state", (_event, state) => callback(state)),
});
