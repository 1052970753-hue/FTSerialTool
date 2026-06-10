/**
 * Tauri Bridge - 把 Tauri 的 invoke/listen 包装成和 Electron preload.js 一样的 API
 */
(function () {
  "use strict";

  const core = window.__TAURI__?.core;
  if (!core) {
    console.warn("Tauri API not available. Running in browser mode.");
    return;
  }

  const { invoke } = core;

  // ── USB 串口 ──
  window.ftUsbSerial = {
    list: () => invoke("usb_list"),
    connect: ({ path, baudRate }) => invoke("usb_connect", { path, baudRate }),
    write: (bytes) => invoke("usb_write", { bytes: Array.from(bytes) }),
    disconnect: () => invoke("usb_disconnect"),
    onData: (cb) => window.__TAURI__.event.listen("usb-data", (e) => cb(new Uint8Array(e.payload))),
    onClose: (cb) => window.__TAURI__.event.listen("usb-close", () => cb()),
    onError: (cb) => window.__TAURI__.event.listen("usb-error", (e) => cb(e.payload)),
  };

  // ── TCP 网络串口 ──
  window.ftTcpSerial = {
    connect: ({ host, port }) => invoke("tcp_connect", { host, port }),
    write: (bytes) => invoke("tcp_write", { bytes: Array.from(bytes) }),
    disconnect: () => invoke("tcp_disconnect"),
    onData: (cb) => window.__TAURI__.event.listen("tcp-data", (e) => cb(new Uint8Array(e.payload))),
    onClose: (cb) => window.__TAURI__.event.listen("tcp-close", () => cb()),
    onError: (cb) => window.__TAURI__.event.listen("tcp-error", (e) => cb(e.payload)),
  };

  // ── 应用 ──
  window.ftApp = {
    getVersion: () => invoke("get_app_version"),
    setLanguage: (lang) => invoke("app_set_language", { language: lang }),
    setWorkspaceView: () => Promise.resolve(),

    // 更新系统 — check 和 download 由前端 JS 完成，Rust 只做文件操作
    configureUpdates: (s) => invoke("configure_updates", {
      repository: s.repository || "",
      mirrorUrl: s.mirrorUrl || "",
      autoCheck: s.autoCheck !== false,
    }),
    getUpdateConfig: () => invoke("get_update_config"),
    saveUpdateFile: (filename, data) => invoke("save_update_file", { filename, data: Array.from(data) }),
    openDownloadsFolder: () => invoke("open_downloads_folder"),
    installUpdate: () => invoke("install_update"),
    applyUpdate: (zipPath) => invoke("apply_update", { zipPath }),

    // checkUpdates 和 downloadUpdate 已移到 app.js 中用 JS fetch 实现
    checkUpdates: () => window._ftCheckUpdates ? window._ftCheckUpdates() : Promise.reject(new Error("更新检查未初始化")),
    downloadUpdate: () => window._ftDownloadUpdate ? window._ftDownloadUpdate() : Promise.reject(new Error("更新下载未初始化")),
    onUpdateStatus: (cb) => window.__TAURI__.event.listen("update-status", (e) => cb(e.payload)),
  };
})();
