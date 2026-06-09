const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

// ── 前端 HTTP 更新检查和下载（避免 Rust async 问题）──
function compareVersions(a, b) {
  const pa = String(a).replace(/^v/i, "").split(/[.-]/).map(Number);
  const pb = String(b).replace(/^v/i, "").split(/[.-]/).map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  return 0;
}

let _pendingAsset = null;

window._ftCheckUpdates = async function () {
  const config = await window.ftApp.getUpdateConfig();
  const currentVer = await window.ftApp.getVersion();
  renderUpdateProgress({ state: "checking", message: "正在检查更新..." });

  // 尝试局域网更新服务器
  if (config.mirror_url) {
    try {
      const resp = await fetch(config.mirror_url.replace(/\/+$/, "") + "/api/latest", {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.version && compareVersions(data.version, currentVer) > 0) {
          const assetUrl = config.mirror_url.replace(/\/+$/, "") + "/files/" + encodeURIComponent(data.asset?.name || "");
          _pendingAsset = { name: data.asset?.name || "", url: assetUrl, size: data.asset?.size || 0 };
          renderUpdateProgress({
            state: "available",
            message: "发现新版本 " + data.version,
            latest: data.version,
            current: currentVer,
            size: data.asset?.size || 0,
            notes: data.notes || "",
          });
          return;
        } else {
          renderUpdateProgress({ state: "current", message: "当前已是最新版本 " + currentVer });
          return;
        }
      }
    } catch (e) { /* fall through to GitHub */ }
  }

  // 尝试 GitHub
  if (config.repository) {
    try {
      const m = config.repository.match(/github\.com[/:]([^/]+)\/([^/]+)$/i) || config.repository.match(/^([^/\s]+)\/([^/\s]+)$/);
      if (!m) { renderUpdateProgress({ state: "error", message: "无效的 GitHub 仓库地址" }); return; }
      const resp = await fetch("https://api.github.com/repos/" + m[1] + "/" + m[2] + "/releases/latest", {
        headers: { Accept: "application/vnd.github+json" },
        signal: AbortSignal.timeout(15000),
      });
      if (resp.ok) {
        const data = await resp.json();
        const ver = (data.tag_name || data.name || "").replace(/^v/i, "");
        if (compareVersions(ver, currentVer) > 0) {
          const assets = data.assets || [];
          const asset = assets.find(a => /portable.*\.exe$/i.test(a.name)) || assets.find(a => /\.exe$/i.test(a.name)) || assets.find(a => /\.zip$/i.test(a.name));
          _pendingAsset = asset ? { name: asset.name, url: asset.browser_download_url, size: asset.size } : null;
          renderUpdateProgress({
            state: "available",
            message: "发现新版本 " + ver,
            latest: ver,
            current: currentVer,
            size: asset?.size || 0,
            notes: data.body || "",
          });
        } else {
          renderUpdateProgress({ state: "current", message: "当前已是最新版本 " + currentVer });
        }
      } else {
        renderUpdateProgress({ state: "error", message: "GitHub 请求失败 (" + resp.status + ")" });
      }
    } catch (e) {
      renderUpdateProgress({ state: "error", message: "网络错误: " + e.message });
    }
  } else {
    renderUpdateProgress({ state: "current", message: "当前已是最新版本 " + currentVer });
  }
};

window._ftDownloadUpdate = async function () {
  if (!_pendingAsset) { renderUpdateProgress({ state: "error", message: "没有待下载的更新" }); return; }
  const asset = _pendingAsset;
  renderUpdateProgress({ state: "downloading", message: "正在下载 " + asset.name, progress: 0 });

  try {
    const resp = await fetch(asset.url);
    if (!resp.ok) throw new Error("下载失败 (" + resp.status + ")");
    const total = Number(resp.headers.get("content-length")) || asset.size || 0;
    const reader = resp.body.getReader();
    const chunks = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      const progress = total ? received / total : 0;
      renderUpdateProgress({
        state: "downloading",
        message: "正在下载 " + asset.name,
        progress,
        received,
        total,
      });
    }

    // 合并 chunks
    const blob = new Blob(chunks);
    const data = new Uint8Array(await blob.arrayBuffer());

    // 保存到文件
    const savedPath = await window.ftApp.saveUpdateFile(asset.name, data);
    renderUpdateProgress({
      state: "ready",
      message: "下载完成: " + savedPath,
      progress: 1,
      target: savedPath,
    });
    _pendingAsset = null;
  } catch (e) {
    renderUpdateProgress({ state: "error", message: "下载失败: " + e.message });
  }
};

const els = {
  linkType: $("#linkType"),
  portSelect: $("#portSelect"),
  tcpHost: $("#tcpHost"),
  tcpPort: $("#tcpPort"),
  baudRate: $("#baudRate"),
  customBaudLabel: $("#customBaudLabel"),
  customBaudRate: $("#customBaudRate"),
  connectBtn: $("#connectBtn"),
  demoBtn: $("#demoBtn"),
  statusText: $("#statusText"),
  browserSupport: $("#browserSupport"),
  logView: $("#logView"),
  hexView: $("#hexView"),
  autoScroll: $("#autoScroll"),
  pauseReceive: $("#pauseReceive"),
  sendText: $("#sendText"),
  sendHex: $("#sendHex"),
  cycleSend: $("#cycleSend"),
  cycleMs: $("#cycleMs"),
  appendNewline: $("#appendNewline"),
  terminalView: $("#terminalView"),
  terminalInput: $("#terminalInput"),
  packetList: $("#packetList"),
  packetFields: $("#packetFields"),
  parserList: $("#parserList"),
  parserFields: $("#parserFields"),
  metricGrid: $("#metricGrid"),
  sendControlGrid: $("#sendControlGrid"),
  dataPacketCycleControls: $("#dataPacketCycleControls"),
  curvePacketCycleControls: $("#curvePacketCycleControls"),
  curveCanvas: $("#curveCanvas"),
  curveLegend: $("#curveLegend"),
  curveChannelList: $("#curveChannelList"),
  pauseCurveBtn: $("#pauseCurveBtn"),
  measureCurveBtn: $("#measureCurveBtn"),
  expandCurveBtn: $("#expandCurveBtn"),
  logCsv: $("#logCsv"),
  dashboardSkin: $("#dashboardSkin"),
  helpLanguage: $("#helpLanguage"),
  helpContent: $("#helpContent"),
  helpModal: $("#helpModal"),
  protocolAnalysisModal: $("#protocolAnalysisModal"),
  protocolAnalysisName: $("#protocolAnalysisName"),
  protocolAnalysisSource: $("#protocolAnalysisSource"),
  protocolAnalysisStatus: $("#protocolAnalysisStatus"),
  protocolAnalysisResult: $("#protocolAnalysisResult"),
  protocolAnalysisImport: $("#protocolAnalysisImport"),
  settingsModal: $("#settingsModal"),
  settingsModalTitle: $("#settingsModalTitle"),
  settingsModalInput: $("#settingsModalInput"),
  toolSettingsModal: $("#toolSettingsModal"),
  profileSelect: $("#profileSelect"),
  profileMode: $("#profileMode"),
  importFile: $("#importFile"),
  rxCount: $("#rxCount"),
  txCount: $("#txCount"),
  appVersion: $("#appVersion"),
  toolLanguage: $("#toolLanguage"),
  maxLogLines: $("#maxLogLines"),
  maxCurvePoints: $("#maxCurvePoints"),
  timeFormat: $("#timeFormat"),
  githubRepository: $("#githubRepository"),
  updateMirrorUrl: $("#updateMirrorUrl"),
  autoCheckUpdates: $("#autoCheckUpdates"),
  updateStatus: $("#updateStatus"),
  updateProgressModal: $("#updateProgressModal"),
  updateDownloadProgress: $("#updateDownloadProgress"),
  updateDownloadPercent: $("#updateDownloadPercent"),
  updateDownloadDetail: $("#updateDownloadDetail"),
  updateInstallProgress: $("#updateInstallProgress"),
  updateInstallPercent: $("#updateInstallPercent"),
  updateInstallDetail: $("#updateInstallDetail"),
  updateProgressStatus: $("#updateProgressStatus"),
  updateActionBtn: $("#updateActionBtn"),
  updateAvailableInfo: $("#updateAvailableInfo"),
  updateAvailableTitle: $("#updateAvailableTitle"),
  updateVersionDetail: $("#updateVersionDetail"),
  updateReleaseNotes: $("#updateReleaseNotes"),
};

function getFieldTypeOptions() {
  return [
    ["const", t("typeConst")],
    ["uint8", "U8"],
    ["int8", "I8"],
    ["int16", "I16"],
    ["uint16", "U16"],
    ["uint32", "U32"],
    ["int32", "I32"],
    ["float", "Float"],
    ["checksum8", "SUM8"],
    ["crc16", "CRC16"],
    ["tail", t("typeTail")],
  ];
}

function getParserTypeOptions() {
  return [
    ["const", t("typeConst")],
    ["uint8", "U8"],
    ["int8", "I8"],
    ["uint16", "U16"],
    ["int16", "I16"],
    ["uint32", "U32"],
    ["int32", "I32"],
    ["float", "Float"],
    ["checksum8", "SUM8"],
    ["tail", t("typeTail")],
  ];
}

function getControlTypeOptions() {
  return [
    ["none", t("ctrlNone")],
    ["slider", t("ctrlSlider")],
    ["switch", t("ctrlSwitch")],
    ["number", t("ctrlNumber")],
  ];
}

function getSwitchModeOptions() {
  return [
    ["toggle", t("switchToggle")],
    ["momentary", t("switchMomentary")],
  ];
}

function getWidgetTypeOptions() {
  return [
    ["metric", t("widgetMetric")],
    ["gauge", t("widgetGauge")],
    ["lamp", t("widgetLamp")],
    ["slider", t("ctrlSlider")],
    ["switch", t("ctrlSwitch")],
  ];
}

const colors = ["#ff4d4f", "#20c997", "#46a3ff", "#f9c74f", "#b185ff", "#ff8f3d", "#5cd6d6", "#ef5da8"];
const MAX_RECEIVE_BUFFER_BYTES = 256 * 1024;
const MAX_CSV_ROWS = 20000;
const MAX_TERMINAL_CHARS = 200000;
const MAX_LOG_ROWS = 5000;
const MAX_CURVE_POINTS = 5000;
const UI_REFRESH_MS = 50;
const expressionCache = new Map();

const state = {
  port: null,
  reader: null,
  writer: null,
  transport: "usb",
  bleDevice: null,
  bleWriteCharacteristic: null,
  bleNotifyCharacteristic: null,
  connected: false,
  reading: false,
  receivePaused: false,
  rxBytes: 0,
  txBytes: 0,
  logRows: [],
  receiveBuffer: [],
  activePacket: 0,
  activeParser: 0,
  cycleTimer: null,
  demoTimer: null,
  curvePaused: false,
  csvRows: [],
  metrics: {},
  curveSeries: {},
  hiddenSeries: {},
  curveView: { xStart: null, xEnd: null, yMin: null, yMax: null },
  curveSelection: null,
  measuring: false,
  measurePoints: [],
  lastCurveDomain: null,
  lastCurvePlot: null,
  curveExpanded: false,
  dashboardSliderDrag: null,
  sendTimers: {},
  packetCycleTimers: {},
  cyclePacketIndex: 0,
  dashboardWidgets: [],
  dashboardSkin: "clean",
  logRenderTimer: null,
  runtimeRenderTimer: null,
  language: localStorage.getItem("ftToolLanguage") || "zh",
  modalResolver: null,
  protocolAnalysis: null,
  profile: createDefaultProfile(),
  profiles: [],
  activeProfileIndex: 0,
  workspaceView: localStorage.getItem("ftWorkspaceView") || "general",
  generalEditor: "data",
};

state.profiles = [state.profile];

function createDefaultProfile() {
  return {
    groupName: "FT Motor Demo",
    protocolMode: "custom",
    packets: [
      {
        name: "速度控制",
        enabled: true,
        delay: 50,
        trigger: true,
        fields: [
          { type: "const", name: "帧头", bytes: "AA" },
          { type: "uint8", name: "帧ID", value: 1 },
          { type: "uint16", name: "目标速度", value: 1200, endian: "little", control: "slider", min: 0, max: 5000, step: 100 },
          { type: "uint16", name: "预留1", value: 0, endian: "little", control: "none" },
          { type: "uint16", name: "预留2", value: 0, endian: "little", control: "none" },
          { type: "checksum8", name: "校验", rangeStart: 1, rangeEnd: 6 },
          { type: "tail", name: "结束", bytes: "0D" },
        ],
      },
      {
        name: "停机 Stop",
        enabled: true,
        delay: 50,
        trigger: false,
        fields: [
          { type: "const", name: "帧头", bytes: "AA" },
          { type: "uint8", name: "帧ID", value: 1 },
          { type: "uint16", name: "目标速度", value: 0, endian: "little", control: "none" },
          { type: "uint16", name: "预留1", value: 0, endian: "little", control: "none" },
          { type: "uint16", name: "预留2", value: 0, endian: "little", control: "none" },
          { type: "checksum8", name: "校验", rangeStart: 1, rangeEnd: 6 },
          { type: "tail", name: "结束", bytes: "0D" },
        ],
      },
    ],
    parsers: [
      {
        name: "电机遥测",
        enabled: true,
        fields: [
          { type: "const", name: "帧头", bytes: "AA", show: false, curve: false },
          { type: "uint8", name: "帧ID", value: 2, show: false, curve: false },
          { type: "uint16", name: "目标转速", endian: "big", show: true, curve: true, widget: "gauge", expr: "x" },
          { type: "uint16", name: "实际转速", endian: "big", show: true, curve: true, widget: "metric", expr: "x" },
          { type: "int16", name: "母线电流", endian: "big", show: true, curve: true, widget: "metric", expr: "x / 100" },
          { type: "uint16", name: "母线电压", endian: "big", show: true, curve: false, widget: "metric", expr: "x / 10" },
          { type: "checksum8", name: "校验", rangeStart: 1, rangeEnd: 9, show: false, curve: false },
          { type: "tail", name: "结束", bytes: "0D", show: false, curve: false },
        ],
      },
    ],
  };
}

function nowLabel() {
  const d = new Date();
  if (els.timeFormat.value === "iso") return d.toISOString();
  const pad = (n, size = 2) => String(n).padStart(size, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

function toHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join(" ");
}

function parseHex(text) {
  const clean = text.replace(/0x/gi, "").replace(/[^0-9a-fA-F]/g, "");
  if (clean.length % 2) throw new Error(t("hexOddLen"));
  const out = [];
  for (let i = 0; i < clean.length; i += 2) out.push(parseInt(clean.slice(i, i + 2), 16));
  return new Uint8Array(out);
}

function textBytes(text) {
  return new TextEncoder().encode(text);
}

function bytesText(bytes) {
  try {
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return [...bytes].map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : ".")).join("");
  }
}

function addLog(kind, payload, options = {}) {
  if (state.receivePaused && kind === "rx") return;
  const bytes = payload instanceof Uint8Array ? payload : null;
  const text = bytes ? (els.hexView.checked ? toHex(bytes) : bytesText(bytes)) : String(payload);
  const row = { kind, time: nowLabel(), text, css: options.css || "" };
  state.logRows.push(row);
  const max = Math.min(MAX_LOG_ROWS, Number(els.maxLogLines.value) || 2000);
  if (state.logRows.length > max) state.logRows.splice(0, state.logRows.length - max);
  scheduleLogRender();
  if (kind === "rx" && bytes) {
    state.rxBytes += bytes.length;
    els.rxCount.textContent = state.rxBytes;
  }
  if (kind === "tx" && bytes) {
    state.txBytes += bytes.length;
    els.txCount.textContent = state.txBytes;
  }
}

function scheduleLogRender() {
  if (state.logRenderTimer) return;
  state.logRenderTimer = setTimeout(() => {
    state.logRenderTimer = null;
    renderLog();
  }, UI_REFRESH_MS);
}

function renderLog() {
  const filter = $(".receive-tools button.active")?.dataset.filter || "all";
  els.logView.innerHTML = "";
  const frag = document.createDocumentFragment();
  for (const row of state.logRows) {
    if (filter !== "all" && row.kind !== filter) continue;
    const div = document.createElement("div");
    div.className = `log-row log-${row.css || row.kind}`;
    div.innerHTML = `<span>${row.time}</span><span class="log-kind">${row.kind.toUpperCase()}</span><span>${escapeHtml(row.text)}</span>`;
    frag.appendChild(div);
  }
  els.logView.appendChild(frag);
  if (els.autoScroll.checked) els.logView.scrollTop = els.logView.scrollHeight;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]));
}

function selectedBaudRate() {
  return Number(els.baudRate.value === "custom" ? els.customBaudRate.value : els.baudRate.value) || 115200;
}

async function connectSerial() {
  if (state.connected) {
    await disconnectSerial();
    return;
  }
  state.transport = els.linkType.value;
  if (state.transport === "tcp") {
    await connectTcpSerial();
    return;
  }
  if (state.transport === "ble") {
    await connectBleSerial();
    return;
  }
  if (window.ftUsbSerial) {
    await connectNativeUsbSerial();
    return;
  }
  if (!("serial" in navigator)) {
    addLog("error", t("noWebSerial"), { css: "error" });
    return;
  }
  try {
    state.port = await navigator.serial.requestPort();
    const baudRate = selectedBaudRate();
    await state.port.open({ baudRate });
    state.writer = state.port.writable.getWriter();
    state.connected = true;
    state.reading = true;
    els.connectBtn.textContent = t("close");
    els.statusText.textContent = t("usbConnected")(baudRate);
    readLoop();
  } catch (err) {
    addLog("error", err.message, { css: "error" });
  }
}

async function connectNativeUsbSerial() {
  const portPath = els.portSelect.value;
  const baudRate = selectedBaudRate();
  if (!portPath) {
    addLog("error", t("noUsbPort"), { css: "error" });
    await refreshUsbPorts();
    return;
  }
  try {
    await window.ftUsbSerial.connect({ path: portPath, baudRate });
    state.connected = true;
    state.transport = "usb";
    els.connectBtn.textContent = t("close");
    const selectedName = els.portSelect.selectedOptions[0]?.textContent || portPath;
    els.statusText.textContent = t("usbConnected")(`${selectedName} @ ${baudRate}`);
  } catch (err) {
    addLog("error", err.message, { css: "error" });
  }
}

async function connectTcpSerial() {
  const host = els.tcpHost.value.trim();
  const port = Number(els.tcpPort.value);
  if (!host || !port) {
    addLog("error", t("fillTcpInfo"), { css: "error" });
    return;
  }
  if (!window.ftTcpSerial) {
    addLog("error", t("tcpNeedExe"), { css: "error" });
    return;
  }
  try {
    await window.ftTcpSerial.connect({ host, port });
    state.connected = true;
    state.transport = "tcp";
    els.connectBtn.textContent = t("close");
    els.statusText.textContent = t("tcpConnected")(`${host}:${port}`);
  } catch (err) {
    addLog("error", err.message, { css: "error" });
  }
}

async function connectBleSerial() {
  if (!navigator.bluetooth) {
    addLog("error", t("noBle"), { css: "error" });
    return;
  }
  const nusService = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
  const nusRx = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
  const nusTx = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";
  try {
    state.bleDevice = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [nusService],
    });
    const server = await state.bleDevice.gatt.connect();
    const service = await server.getPrimaryService(nusService);
    state.bleWriteCharacteristic = await service.getCharacteristic(nusRx);
    state.bleNotifyCharacteristic = await service.getCharacteristic(nusTx);
    await state.bleNotifyCharacteristic.startNotifications();
    state.bleNotifyCharacteristic.addEventListener("characteristicvaluechanged", (event) => {
      const value = event.target.value;
      handleIncoming(new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)));
    });
    state.connected = true;
    state.transport = "ble";
    els.connectBtn.textContent = t("close");
    els.statusText.textContent = t("bleConnected")(state.bleDevice.name || "BLE UART");
  } catch (err) {
    addLog("error", err.message, { css: "error" });
  }
}

async function disconnectSerial() {
  state.reading = false;
  stopCycleSend();
  if (state.transport === "usb" && window.ftUsbSerial) {
    try {
      await window.ftUsbSerial.disconnect();
    } catch {}
  }
  if (state.transport === "tcp" && window.ftTcpSerial) {
    try {
      await window.ftTcpSerial.disconnect();
    } catch {}
  }
  if (state.bleDevice?.gatt?.connected) {
    try {
      state.bleDevice.gatt.disconnect();
    } catch {}
  }
  if (state.reader) {
    try {
      await state.reader.cancel();
    } catch {}
  }
  if (state.writer) {
    try {
      state.writer.releaseLock();
    } catch {}
  }
  if (state.port) {
    try {
      await state.port.close();
    } catch {}
  }
  state.reader = null;
  state.writer = null;
  state.port = null;
  state.bleDevice = null;
  state.bleWriteCharacteristic = null;
  state.bleNotifyCharacteristic = null;
  state.connected = false;
  els.connectBtn.textContent = t("open");
  els.statusText.textContent = t("disconnected");
}

async function readLoop() {
  while (state.port?.readable && state.reading) {
    state.reader = state.port.readable.getReader();
    try {
      while (state.reading) {
        const { value, done } = await state.reader.read();
        if (done) break;
        if (value) handleIncoming(value);
      }
    } catch (err) {
      if (state.reading) addLog("error", err.message, { css: "error" });
    } finally {
      state.reader.releaseLock();
    }
  }
}

function handleIncoming(bytes) {
  addLog("rx", bytes);
  appendTerminal(bytesText(bytes));
  state.receiveBuffer.push(...bytes);
  if (state.receiveBuffer.length > MAX_RECEIVE_BUFFER_BYTES) {
    state.receiveBuffer.splice(0, state.receiveBuffer.length - MAX_RECEIVE_BUFFER_BYTES);
  }
  runParsers();
}

function initTransports() {
  if (window.ftUsbSerial) {
    window.ftUsbSerial.onData((bytes) => handleIncoming(new Uint8Array(bytes)));
    window.ftUsbSerial.onClose(() => {
      if (state.transport === "usb" && state.connected) {
        state.connected = false;
        els.connectBtn.textContent = t("open");
        els.statusText.textContent = t("usbDisconnected");
      }
    });
    window.ftUsbSerial.onError((message) => addLog("error", message, { css: "error" }));
  }
  if (window.ftTcpSerial) {
    window.ftTcpSerial.onData((bytes) => handleIncoming(new Uint8Array(bytes)));
    window.ftTcpSerial.onClose(() => {
      if (state.transport === "tcp" && state.connected) {
        state.connected = false;
        els.connectBtn.textContent = t("open");
        els.statusText.textContent = t("tcpDisconnected");
      }
    });
    window.ftTcpSerial.onError((message) => addLog("error", message, { css: "error" }));
  }
  updateLinkTypeUi(false);
  setTimeout(refreshUsbPorts, 300);
}

async function refreshUsbPorts() {
  if (els.linkType.value !== "usb") return;
  if (!window.ftUsbSerial) {
    els.portSelect.innerHTML = `<option value="">${t("browserPort")}</option>`;
    return;
  }
  const previous = els.portSelect.value;
  els.portSelect.innerHTML = `<option value="">${t("searchingPort")}</option>`;
  try {
    const ports = await window.ftUsbSerial.list();
    if (!ports.length) {
      els.portSelect.innerHTML = `<option value="">${t("noPort")}</option>`;
      return;
    }
    els.portSelect.innerHTML = ports
      .map((port) => `<option value="${escapeHtml(port.path)}" ${port.path === previous ? "selected" : ""}>${escapeHtml(port.label)}</option>`)
      .join("");
  } catch (err) {
    els.portSelect.innerHTML = `<option value="">${t("portError")}</option>`;
    addLog("error", t("portEnumFail")(err.message), { css: "error" });
  }
}

function updateLinkTypeUi(refreshPorts = true) {
  const isTcp = els.linkType.value === "tcp";
  const isUsb = els.linkType.value === "usb";
  $$(".network-field").forEach((el) => el.classList.toggle("hidden", !isTcp));
  $("#portSelect").closest("label").classList.toggle("hidden", isTcp);
  els.baudRate.closest("label").classList.toggle("hidden", !isUsb);
  updateBaudRateUi();
  if (els.linkType.value === "ble") {
    els.portSelect.innerHTML = "<option>BLE UART / Nordic NUS</option>";
  } else if (els.linkType.value === "usb" && refreshPorts) {
    refreshUsbPorts();
  }
}

function updateBaudRateUi() {
  els.customBaudLabel?.classList.toggle("hidden", !(els.linkType.value === "usb" && els.baudRate.value === "custom"));
}

async function sendBytes(bytes, label = "") {
  if (!bytes?.length) return;
  if (state.connected && state.transport === "tcp" && window.ftTcpSerial) {
    await window.ftTcpSerial.write([...bytes]);
  } else if (state.connected && state.transport === "usb" && window.ftUsbSerial) {
    await window.ftUsbSerial.write([...bytes]);
  } else if (state.connected && state.transport === "ble" && state.bleWriteCharacteristic) {
    for (let i = 0; i < bytes.length; i += 20) {
      await state.bleWriteCharacteristic.writeValueWithoutResponse(bytes.slice(i, i + 20));
    }
  } else if (state.connected && state.writer) {
    await state.writer.write(bytes);
  }
  addLog("tx", bytes);
  if (label) appendTerminal(`\n> ${label}: ${toHex(bytes)}\n`);
}

async function sendRaw() {
  try {
    let bytes = els.sendHex.checked ? parseHex(els.sendText.value) : textBytes(els.sendText.value);
    if (els.appendNewline.checked) {
      const merged = new Uint8Array(bytes.length + 1);
      merged.set(bytes);
      merged[bytes.length] = 0x0d;
      bytes = merged;
    }
    await sendBytes(bytes, "RAW");
  } catch (err) {
    addLog("error", err.message, { css: "error" });
  }
}

function startCycleSend() {
  stopCycleSend(false);
  state.cycleTimer = setInterval(sendRaw, Math.max(10, Number(els.cycleMs.value) || 100));
  els.cycleSend.checked = true;
}

function stopCycleSend(updateCheckbox = true) {
  if (state.cycleTimer) clearInterval(state.cycleTimer);
  state.cycleTimer = null;
  if (updateCheckbox) els.cycleSend.checked = false;
}

function fieldLength(field) {
  if (field.type === "const" || field.type === "tail") return parseHex(field.bytes || "").length;
  if (field.type === "uint8" || field.type === "int8" || field.type === "checksum8") return 1;
  if (field.type === "uint16" || field.type === "int16" || field.type === "crc16") return 2;
  if (field.type === "uint32" || field.type === "int32" || field.type === "float") return 4;
  return 0;
}

function encodeNumber(field) {
  const len = fieldLength(field);
  const buf = new ArrayBuffer(len);
  const view = new DataView(buf);
  const little = field.endian !== "big";
  const value = Number(field.value) || 0;
  if (field.type === "uint8") view.setUint8(0, value);
  if (field.type === "int8") view.setInt8(0, value);
  if (field.type === "uint16") view.setUint16(0, value, little);
  if (field.type === "int16") view.setInt16(0, value, little);
  if (field.type === "uint32") view.setUint32(0, value, little);
  if (field.type === "int32") view.setInt32(0, value, little);
  if (field.type === "float") view.setFloat32(0, value, little);
  return [...new Uint8Array(buf)];
}

function buildPacket(packet) {
  const bytes = [];
  for (const field of packet.fields) {
    if (field.type === "const" || field.type === "tail") {
      bytes.push(...parseHex(field.bytes || ""));
    } else if (field.type === "checksum8") {
      const start = Math.max(0, Number(field.rangeStart) || 0);
      const end = Math.min(bytes.length - 1, Number(field.rangeEnd) || bytes.length - 1);
      let sum = 0;
      for (let i = start; i <= end; i++) sum = (sum + bytes[i]) & 0xff;
      bytes.push(sum);
    } else if (field.type === "crc16") {
      const start = Math.max(0, Number(field.rangeStart) || 0);
      const end = Math.min(bytes.length - 1, Number(field.rangeEnd) || bytes.length - 1);
      const crc = crc16Modbus(bytes.slice(start, end + 1));
      bytes.push(crc & 0xff, (crc >> 8) & 0xff);
    } else {
      bytes.push(...encodeNumber(field));
    }
  }
  return new Uint8Array(bytes);
}

function crc16Modbus(bytes) {
  let crc = 0xffff;
  for (const b of bytes) {
    crc ^= b;
    for (let i = 0; i < 8; i++) crc = crc & 1 ? (crc >> 1) ^ 0xa001 : crc >> 1;
  }
  return crc & 0xffff;
}

function readNumber(bytes, offset, field) {
  const len = fieldLength(field);
  const view = new DataView(new Uint8Array(bytes.slice(offset, offset + len)).buffer);
  const little = field.endian !== "big";
  if (field.type === "uint8") return view.getUint8(0);
  if (field.type === "int8") return view.getInt8(0);
  if (field.type === "uint16") return view.getUint16(0, little);
  if (field.type === "int16") return view.getInt16(0, little);
  if (field.type === "uint32") return view.getUint32(0, little);
  if (field.type === "int32") return view.getInt32(0, little);
  if (field.type === "float") return view.getFloat32(0, little);
  return null;
}

function frameLength(parser) {
  return parser.fields.reduce((sum, field) => sum + fieldLength(field), 0);
}

function runParsers() {
  let consumed = 0;
  let parsed = false;
  while (state.receiveBuffer.length) {
    let matched = false;
    const enabledParsers = state.profile.parsers.filter((p) => p.enabled);
    const minFrameLength = Math.min(...enabledParsers.map(frameLength));
    if (!enabledParsers.length || state.receiveBuffer.length < minFrameLength) break;
    let hasCompleteCandidate = false;
    for (const parser of enabledParsers) {
      const len = frameLength(parser);
      if (state.receiveBuffer.length < len) continue;
      hasCompleteCandidate = true;
      const frame = state.receiveBuffer.slice(0, len);
      const result = parseFrame(parser, frame);
      if (result.ok) {
        state.receiveBuffer.splice(0, len);
        consumed += len;
        matched = true;
        parsed = true;
        updateMetrics(result.values);
        addLog("parsed", Object.entries(result.values).map(([k, v]) => `${k}=${v}`).join(", "), { css: "parsed" });
        break;
      }
    }
    if (!hasCompleteCandidate) break;
    if (!matched) {
      state.receiveBuffer.shift();
      consumed += 1;
      if (consumed > 2048) break;
    }
  }
  if (parsed) {
    scheduleRuntimeRender();
  }
}

function parseFrame(parser, frame) {
  let offset = 0;
  const values = {};
  for (const field of parser.fields) {
    const len = fieldLength(field);
    const slice = frame.slice(offset, offset + len);
    if (field.type === "const" || field.type === "tail") {
      const expected = [...parseHex(field.bytes || "")];
      if (!arraysEqual(slice, expected)) return { ok: false };
    } else if (field.type === "checksum8") {
      const start = Math.max(0, Number(field.rangeStart) || 0);
      const end = Math.min(frame.length - 1, Number(field.rangeEnd) || offset - 1);
      let sum = 0;
      for (let i = start; i <= end; i++) sum = (sum + frame[i]) & 0xff;
      if (slice[0] !== sum) return { ok: false };
    } else {
      const raw = readNumber(frame, offset, field);
      if (typeof field.value === "number" && !field.show && !field.curve && raw !== field.value) return { ok: false };
      const value = applyExpression(raw, field.expr);
      if (field.show || field.curve) values[field.name || field.type] = value;
      if (field.curve) pushCurvePoint(field.name || field.type, value);
    }
    offset += len;
  }
  return { ok: true, values };
}

function applyExpression(x, expr) {
  if (!expr || expr.trim() === "" || expr.trim() === "x") return roundValue(x);
  try {
    const source = expr.trim();
    let fn = expressionCache.get(source);
    if (!fn) {
      fn = new Function("x", "Truncate", "Round", "Abs", "Min", "Max", `"use strict"; return (${source});`);
      if (expressionCache.size >= 100) expressionCache.delete(expressionCache.keys().next().value);
      expressionCache.set(source, fn);
    }
    return roundValue(fn(x, Math.trunc, Math.round, Math.abs, Math.min, Math.max));
  } catch {
    return roundValue(x);
  }
}

function roundValue(value) {
  return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : value;
}

function arraysEqual(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function moveItem(list, from, to) {
  if (from < 0 || from >= list.length || to < 0 || to >= list.length) return;
  const [item] = list.splice(from, 1);
  list.splice(to, 0, item);
}

function updateMetrics(values) {
  const time = Date.now();
  for (const [name, value] of Object.entries(values)) {
    state.metrics[name] = { value, time };
    if (els.logCsv.checked) {
      state.csvRows.push([new Date().toISOString(), name, value]);
      if (state.csvRows.length > MAX_CSV_ROWS) state.csvRows.splice(0, state.csvRows.length - MAX_CSV_ROWS);
    }
  }
}

function scheduleRuntimeRender() {
  if (state.runtimeRenderTimer) return;
  state.runtimeRenderTimer = setTimeout(() => {
    state.runtimeRenderTimer = null;
    renderMetrics();
    drawCurve();
  }, UI_REFRESH_MS);
}

function syncDashboardFromParserDefinitions() {
  state.dashboardWidgets = state.profile.parsers
    .filter((parser) => parser.enabled !== false)
    .flatMap((parser) => (parser.fields || [])
      .filter((field) => field.show)
      .map((field, idx) => createDashboardWidget(field.widget || "metric", field.name || field.type, `${parser.name}_${idx}`, field)));
}

function pushCurvePoint(name, value) {
  if (state.curvePaused) return;
  if (!state.curveSeries[name]) {
    state.curveSeries[name] = { color: colors[Object.keys(state.curveSeries).length % colors.length], points: [] };
    state.hiddenSeries[name] = false;
  }
  const points = state.curveSeries[name].points;
  points.push({ t: Date.now(), v: Number(value) || 0 });
  const max = Math.min(MAX_CURVE_POINTS, Number(els.maxCurvePoints.value) || 1200);
  if (points.length > max) points.splice(0, points.length - max);
}

function renderMetrics() {
  syncDashboardFromParserDefinitions();
  els.metricGrid.innerHTML = "";
  if (!state.dashboardWidgets.length) {
    els.metricGrid.innerHTML = `<div class=”dashboard-empty”>${t('emptyMetric')}</div>`;
    return;
  }
  const frag = document.createDocumentFragment();
  const now = Date.now();
  for (const widget of state.dashboardWidgets) {
    const metric = state.metrics[widget.metric] || { value: "--", time: 0 };
    const card = document.createElement("div");
    card.className = `metric-card metric-${widget.type} skin-${widget.skin || "clean"} ${now - metric.time < 500 ? "flash" : ""}`;
    card.dataset.widgetId = widget.id;
    card.innerHTML = renderDashboardWidget(widget, metric);
    frag.appendChild(card);
  }
  els.metricGrid.appendChild(frag);
}

function renderSendDashboardControls() {
  if (!els.sendControlGrid) return;
  const controls = state.profile.packets.flatMap((packet, packetIndex) =>
    (packet.fields || [])
      .map((field, fieldIndex) => ({ packet, packetIndex, field, fieldIndex }))
      .filter(({ field }) => field.control && field.control !== "none"));
  els.sendControlGrid.innerHTML = "";
  if (!controls.length) {
    els.sendControlGrid.innerHTML = `<div class=”dashboard-empty”>${t('emptySendCtrl')}</div>`;
    return;
  }
  const frag = document.createDocumentFragment();
  for (const item of controls) {
    const card = document.createElement("div");
    card.className = `metric-card metric-${item.field.control === "number" ? "metric" : item.field.control} skin-${state.dashboardSkin}`;
    card.innerHTML = renderSendDashboardControl(item);
    frag.appendChild(card);
  }
  els.sendControlGrid.appendChild(frag);
}

function renderPacketCycleControls() {
  const packets = state.profile.packets || [];
  state.cyclePacketIndex = Math.min(Math.max(0, state.cyclePacketIndex), Math.max(0, packets.length - 1));
  const packet = packets[state.cyclePacketIndex];
  const html = packet
    ? `<div class="packet-cycle-controls">
        <select data-cycle-packet-select>${packets.map((item, index) => `<option value="${index}" ${index === state.cyclePacketIndex ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select>
        <label class="check-inline"><input type="checkbox" data-packet-cycle-enabled="${state.cyclePacketIndex}" ${packet.cycleEnabled ? "checked" : ""}>${t('cycleSend')}</label>
        <label class="packet-cycle-period">${t('cycleMs')}<input type="number" min="10" step="10" value="${packet.cycleMs || 100}" data-packet-cycle-ms="${state.cyclePacketIndex}"></label>
        <button data-packet-cycle-send="${state.cyclePacketIndex}">${t('send')}</button>
      </div>`
    : `<span class="dashboard-hint">${t('noPacket')}</span>`;
  [els.dataPacketCycleControls, els.curvePacketCycleControls].forEach((container) => {
    if (container) container.innerHTML = html;
  });
}

function updatePauseReceiveButton() {
  if (!els.pauseReceive) return;
  const paused = state.receivePaused;
  els.pauseReceive.textContent = paused ? t('resume') : t('pause');
  els.pauseReceive.classList.toggle("active", paused);
  els.pauseReceive.setAttribute("aria-pressed", String(paused));
}

function stopPacketCycle(packetIndex, updatePacket = true) {
  const key = String(packetIndex);
  if (state.packetCycleTimers[key]) clearInterval(state.packetCycleTimers[key]);
  delete state.packetCycleTimers[key];
  if (updatePacket && state.profile.packets[packetIndex]) state.profile.packets[packetIndex].cycleEnabled = false;
}

function stopAllPacketCycles(updatePackets = true) {
  Object.keys(state.packetCycleTimers).forEach((key) => stopPacketCycle(Number(key), updatePackets));
}

function startPacketCycle(packetIndex) {
  const packet = state.profile.packets[packetIndex];
  if (!packet) return;
  stopPacketCycle(packetIndex, false);
  packet.cycleEnabled = true;
  packet.cycleMs = Math.max(10, Number(packet.cycleMs) || 100);
  sendBytes(buildPacket(packet), packet.name);
  state.packetCycleTimers[String(packetIndex)] = setInterval(() => {
    const current = state.profile.packets[packetIndex];
    if (!current?.cycleEnabled) {
      stopPacketCycle(packetIndex);
      renderPacketCycleControls();
      return;
    }
    sendBytes(buildPacket(current), current.name);
  }, packet.cycleMs);
}

function renderSendDashboardControl({ packet, packetIndex, field, fieldIndex }) {
  const key = `${packetIndex}:${fieldIndex}`;
  const label = `${packet.name} / ${field.name || t('field')}`;
  const value = Number(field.value) || 0;
  const common = `<div class="metric-name">${escapeHtml(label)}</div>`;
  if (field.control === "switch") {
    const mode = field.switchMode || "toggle";
    if (mode === "momentary") {
      return `${common}<button class="momentary-btn widget-switch" data-dashboard-send-momentary="${key}">${t('momentaryBtn')}</button>`;
    }
    return `${common}<label class="switch widget-switch self-lock-switch"><input type="checkbox" ${value ? "checked" : ""} data-dashboard-send-switch="${key}"><span></span>${t('toggleSwitch')}</label>`;
  }
  if (field.control === "slider") {
    return `${common}<div class="dashboard-slider-row"><input class="widget-slider" type="range" min="${field.min ?? 0}" max="${field.max ?? 1000}" step="${sliderStep(field)}" value="${value}" data-dashboard-send-control="${key}"><input class="dashboard-number compact-number" type="number" min="${field.min ?? 0}" max="${field.max ?? 1000}" value="${value}" data-dashboard-send-control="${key}"></div>`;
  }
  return `${common}<input class="dashboard-number" type="number" min="${field.min ?? ""}" max="${field.max ?? ""}" value="${value}" data-dashboard-send-control="${key}">`;
}

function createDashboardWidget(type, metric = null, idSeed = "", field = null) {
  return {
    id: `w_${idSeed || metric || Math.random().toString(16).slice(2)}`,
    type,
    metric: metric || t('unnamed'),
    min: Number(field?.min) || 0,
    max: Number(field?.max) || guessGaugeMax(field, metric),
    skin: state.dashboardSkin || els.dashboardSkin?.value || "clean",
  };
}

function guessGaugeMax(field, metric) {
  const text = `${metric || ""} ${field?.name || ""}`.toLowerCase();
  if (text.includes("电流")) return 100;
  if (text.includes("电压")) return 1000;
  if (text.includes("速度") || text.includes("转速") || text.includes("speed") || text.includes("rpm")) return 5000;
  return 5000;
}

function renderGaugeSvg(ratio, min, max) {
  const cx = 60;
  const cy = 58;
  const r = 42;
  const angle = Math.PI - ratio * Math.PI;
  const x = cx + Math.cos(angle) * (r - 4);
  const y = cy - Math.sin(angle) * (r - 4);
  const progress = Math.round(ratio * 1000) / 10;
  return `
    <div class="gauge-face">
      <svg class="gauge-svg" viewBox="0 0 120 72" aria-hidden="true">
        <path class="gauge-track" d="M18 58 A42 42 0 0 1 102 58" pathLength="100"></path>
        <path class="gauge-progress" d="M18 58 A42 42 0 0 1 102 58" pathLength="100" style="stroke-dasharray:${progress} 100"></path>
        <line class="gauge-needle-svg" x1="${cx}" y1="${cy}" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}"></line>
        <circle class="gauge-hub" cx="${cx}" cy="${cy}" r="4"></circle>
      </svg>
      <div class="gauge-ticks"><span>${formatAxisNumber(min)}</span><span>${formatAxisNumber(max)}</span></div>
    </div>`;
}

function renderDashboardWidget(widget, metric) {
  const name = widget.metric || t('unbound');
  const value = metric.value;
  const numeric = Number(value);
  const min = Number.isFinite(Number(widget.min)) ? Number(widget.min) : 0;
  const max = Math.max(min + 1, Number(widget.max) || 5000);
  const normalized = Number.isFinite(numeric) ? Math.max(0, Math.min(1, (numeric - min) / (max - min))) : 0;
  const common = `<div class="metric-name">${escapeHtml(name)}</div>`;
  if (widget.type === "gauge") {
    return `${common}${renderGaugeSvg(normalized, min, max)}<div class="metric-value">${escapeHtml(value)}</div>`;
  }
  if (widget.type === "lamp") {
    return `${common}<div class="lamp-dot-large ${numeric > 0 ? "on" : ""}"></div><div class="metric-value">${escapeHtml(value)}</div>`;
  }
  if (widget.type === "slider") {
    return `${common}<input class="widget-slider" type="range" min="0" max="5000" value="${Number.isFinite(numeric) ? numeric : 0}"><div class="metric-value">${escapeHtml(value)}</div>`;
  }
  if (widget.type === "switch") {
    return `${common}<label class="switch widget-switch"><input type="checkbox" ${numeric > 0 ? "checked" : ""}><span></span>${t('output')}</label><div class="metric-value">${escapeHtml(value)}</div>`;
  }
  return `${common}<div class="metric-value">${escapeHtml(value)}</div>`;
}

function updatePacketHexPreview() {
  const packet = state.profile.packets[state.activePacket];
  const preview = document.querySelector("[data-packet-hex-preview]");
  if (packet && preview) preview.value = toHex(safeBuildPacket(packet));
}

function syncSendControlInputs(packetIndex, fieldIndex, value, source = null) {
  if (packetIndex === state.activePacket) {
    document.querySelectorAll(`[data-control-field="${fieldIndex}"], [data-control-number="${fieldIndex}"], [data-control-switch="${fieldIndex}"]`).forEach((input) => {
      if (input === source) return;
      if (input.type === "checkbox") input.checked = Boolean(value);
      else input.value = value;
    });
  }
  document.querySelectorAll(`[data-dashboard-send-control="${packetIndex}:${fieldIndex}"], [data-dashboard-send-switch="${packetIndex}:${fieldIndex}"]`).forEach((input) => {
    if (input === source) return;
    if (input.type === "checkbox") input.checked = Boolean(value);
    else input.value = value;
  });
  updatePacketFieldInputs(fieldIndex);
  updatePacketHexPreview();
}

function queueTriggeredPacketSend(packetIndex, immediate = false) {
  const packet = state.profile.packets[packetIndex];
  if (!packet?.trigger) return;
  const key = String(packetIndex);
  const sendNow = () => {
    clearTimeout(state.sendTimers[key]);
    state.sendTimers[key] = null;
    sendBytes(buildPacket(packet), packet.name);
  };
  if (immediate) {
    sendNow();
    return;
  }
  if (state.sendTimers[key]) return;
  state.sendTimers[key] = setTimeout(sendNow, 45);
}

function setDashboardSendControlValue(target, immediate = false) {
  const [packetIndex, fieldIndex] = target.dataset.dashboardSendControl.split(":").map(Number);
  const packet = state.profile.packets[packetIndex];
  const field = packet?.fields?.[fieldIndex];
  if (!packet || !field) return;
  const value = Number(target.value);
  field.value = value;
  syncSendControlInputs(packetIndex, fieldIndex, value, target);
  queueTriggeredPacketSend(packetIndex, immediate);
}

function rangeValueFromPointer(input, event) {
  const rect = input.getBoundingClientRect();
  const min = Number(input.min) || 0;
  const max = Number(input.max) || 100;
  const step = Number(input.step) || 1;
  const ratio = rect.width ? Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) : 0;
  const raw = min + (max - min) * ratio;
  const value = Math.round((raw - min) / step) * step + min;
  return Math.max(min, Math.min(max, value));
}

function updatePacketFieldInputs(idx) {
  const packet = state.profile.packets[state.activePacket];
  const field = packet?.fields?.[idx];
  if (!field) return;
  document.querySelectorAll(`[data-field-prop="${idx}:value"], [data-control-field="${idx}"], [data-control-number="${idx}"]`).forEach((input) => {
    input.value = field.value ?? 0;
  });
  document.querySelectorAll(`[data-control-switch="${idx}"]`).forEach((input) => {
    input.checked = Boolean(field.value);
  });
  updatePacketHexPreview();
}

function drawCurve() {
  const canvas = els.curveCanvas;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 20 || rect.height < 20) return;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  ctx.scale(dpr, dpr);
  const w = rect.width;
  const h = rect.height;
  const plot = { left: 58, top: 14, right: 14, bottom: 34 };
  const plotW = w - plot.left - plot.right;
  const plotH = h - plot.top - plot.bottom;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  const visibleEntries = Object.entries(state.curveSeries).filter(([name]) => !state.hiddenSeries[name]);
  const allPoints = visibleEntries.flatMap(([, s]) => s.points);
  if (!allPoints.length) {
    drawCurveGrid(ctx, plot, plotW, plotH, [0, 1], [0, 1]);
    ctx.fillStyle = "#7d8994";
    ctx.fillText(t('emptyCurve'), plot.left + 8, plot.top + 22);
    renderCurveLegend();
    renderCurveChannels();
    return;
  }
  const rawXMin = Math.min(...allPoints.map((p) => p.t));
  const rawXMax = Math.max(...allPoints.map((p) => p.t));
  const rawYMin = Math.min(...allPoints.map((p) => p.v));
  const rawYMax = Math.max(...allPoints.map((p) => p.v));
  let xMin = state.curveView.xStart ?? rawXMin;
  let xMax = state.curveView.xEnd ?? rawXMax;
  if (xMin === xMax) xMax = xMin + 1;
  const pointsInView = allPoints.filter((p) => p.t >= xMin && p.t <= xMax);
  let yMin = state.curveView.yMin ?? Math.min(...(pointsInView.length ? pointsInView : allPoints).map((p) => p.v));
  let yMax = state.curveView.yMax ?? Math.max(...(pointsInView.length ? pointsInView : allPoints).map((p) => p.v));
  if (yMin === yMax) {
    yMin -= 1;
    yMax += 1;
  }
  const yPad = (yMax - yMin) * 0.08;
  if (state.curveView.yMin == null) yMin -= yPad;
  if (state.curveView.yMax == null) yMax += yPad;
  drawCurveGrid(ctx, plot, plotW, plotH, [xMin, xMax], [yMin, yMax]);
  state.lastCurveDomain = { xMin, xMax, yMin, yMax };
  state.lastCurvePlot = { ...plot, plotW, plotH };
  for (const [, series] of visibleEntries) {
    const pts = series.points.filter((p) => p.t >= xMin && p.t <= xMax);
    if (pts.length < 2) continue;
    ctx.strokeStyle = series.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    pts.forEach((p, i) => {
      const x = plot.left + ((p.t - xMin) / (xMax - xMin)) * plotW;
      const y = plot.top + (1 - (p.v - yMin) / (yMax - yMin)) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
  if (state.curveSelection) {
    const x = Math.min(state.curveSelection.startX, state.curveSelection.endX);
    const y = Math.min(state.curveSelection.startY, state.curveSelection.endY);
    const sw = Math.abs(state.curveSelection.endX - state.curveSelection.startX);
    const sh = Math.abs(state.curveSelection.endY - state.curveSelection.startY);
    ctx.fillStyle = "rgba(0, 143, 134, 0.12)";
    ctx.strokeStyle = "rgba(0, 143, 134, 0.85)";
    ctx.fillRect(x, y, sw, sh);
    ctx.strokeRect(x, y, sw, sh);
  }
  drawMeasureOverlay(ctx);
  renderCurveLegend();
  renderCurveChannels();
}

function drawMeasureOverlay(ctx) {
  if (!state.measuring) return;
  const plot = state.lastCurvePlot;
  const domain = state.lastCurveDomain;
  if (!plot || !domain) return;
  ctx.save();
  ctx.strokeStyle = "#d38a00";
  ctx.fillStyle = "#6e4a00";
  ctx.lineWidth = 1.2;
  ctx.font = "12px Microsoft YaHei UI, Segoe UI, Arial";
  for (const p of state.measurePoints) {
    ctx.beginPath();
    ctx.moveTo(p.x, plot.top);
    ctx.lineTo(p.x, plot.top + plot.plotH);
    ctx.moveTo(plot.left, p.y);
    ctx.lineTo(plot.left + plot.plotW, p.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (state.measurePoints.length >= 2) {
    const [a, b] = state.measurePoints.slice(-2);
    const dt = Math.abs(b.t - a.t) / 1000;
    const dv = Math.abs(b.v - a.v);
    const yMin = Math.min(...state.measurePoints.map((p) => p.v));
    const yMax = Math.max(...state.measurePoints.map((p) => p.v));
    const pp = yMax - yMin;
    const x = Math.min(a.x, b.x) + 12;
    const y = Math.min(a.y, b.y) + 18;
    ctx.fillStyle = "rgba(255, 243, 216, 0.94)";
    ctx.strokeStyle = "#d38a00";
    ctx.fillRect(x, y, 158, 58);
    ctx.strokeRect(x, y, 158, 58);
    ctx.fillStyle = "#6e4a00";
    ctx.fillText(`${t('measurePeriod')}${roundValue(dt)} s`, x + 8, y + 20);
    ctx.fillText(`${t('measureDiff')}${roundValue(dv)}`, x + 8, y + 38);
    ctx.fillText(`${t('measurePeak')}${roundValue(pp)}`, x + 8, y + 54);
  }
  ctx.restore();
}

function drawCurveGrid(ctx, plot, plotW, plotH, xDomain, yDomain) {
  const [xMin, xMax] = xDomain;
  const [yMin, yMax] = yDomain;
  ctx.save();
  ctx.strokeStyle = "#e7edf0";
  ctx.fillStyle = "#52616a";
  ctx.font = "11px Consolas";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const y = plot.top + (plotH / 5) * i;
    const value = yMax - ((yMax - yMin) / 5) * i;
    ctx.beginPath();
    ctx.moveTo(plot.left, y + 0.5);
    ctx.lineTo(plot.left + plotW, y + 0.5);
    ctx.stroke();
    ctx.fillText(formatAxisNumber(value), 6, y + 4);
  }
  for (let i = 0; i <= 6; i++) {
    const x = plot.left + (plotW / 6) * i;
    const time = xMin + ((xMax - xMin) / 6) * i;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, plot.top);
    ctx.lineTo(x + 0.5, plot.top + plotH);
    ctx.stroke();
    ctx.fillText(formatCurveTime(time), x - 28, plot.top + plotH + 20);
  }
  ctx.strokeStyle = "#9eabb2";
  ctx.strokeRect(plot.left, plot.top, plotW, plotH);
  ctx.restore();
}

function formatAxisNumber(value) {
  const abs = Math.abs(value);
  if (abs >= 1000) return String(Math.round(value));
  if (abs >= 10) return String(Math.round(value * 10) / 10);
  return String(Math.round(value * 1000) / 1000);
}

function sliderStep(field) {
  const step = Number(field.step);
  return Number.isFinite(step) && step > 0 && step < 100 ? step : 1;
}

function fieldTypeRange(type) {
  const ranges = {
    uint8: { min: 0, max: 255 },
    int8: { min: -128, max: 127 },
    uint16: { min: 0, max: 65535 },
    int16: { min: -32768, max: 32767 },
    uint32: { min: 0, max: 4294967295 },
    int32: { min: -2147483648, max: 2147483647 },
  };
  return ranges[type] || null;
}

function clampNumber(value, min, max) {
  const next = Number(value);
  if (!Number.isFinite(next)) return min;
  return Math.max(min, Math.min(max, next));
}

function normalizeFieldControlLimits(field) {
  const range = fieldTypeRange(field.type);
  if (!range) {
    if (field.min == null) field.min = 0;
    if (field.max == null) field.max = Math.max(1000, Number(field.value) || 1000);
  } else {
    field.min = clampNumber(field.min ?? range.min, range.min, range.max);
    field.max = clampNumber(field.max ?? range.max, range.min, range.max);
  }
  if (field.min > field.max) [field.min, field.max] = [field.max, field.min];
  if (typeof field.value === "number") field.value = clampNumber(field.value, field.min, field.max);
}

function limitInputAttrs(field) {
  const range = fieldTypeRange(field.type);
  return range ? ` min="${range.min}" max="${range.max}"` : "";
}

function formatCurveTime(ms) {
  const d = new Date(ms);
  const pad = (n, size = 2) => String(n).padStart(size, "0");
  return `${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(Math.floor(d.getMilliseconds() / 10), 2)}`;
}

function renderCurveLegend() {
  els.curveLegend.innerHTML = Object.entries(state.curveSeries)
    .filter(([name]) => !state.hiddenSeries[name])
    .map(([name, series]) => `<span class="legend-item"><span class="legend-dot" style="background:${series.color}"></span>${escapeHtml(name)}</span>`)
    .join("");
}

function renderCurveChannels() {
  if (!els.curveChannelList) return;
  const names = Object.keys(state.curveSeries);
  if (!names.length) {
    els.curveChannelList.innerHTML = `<div class="curve-empty">${t('noCurveChannel')}</div>`;
    return;
  }
  els.curveChannelList.innerHTML = names
    .map((name) => {
      const series = state.curveSeries[name];
      const latest = series.points.at(-1)?.v ?? "-";
      return `
        <label class="curve-channel">
          <input type="checkbox" data-curve-visible="${escapeHtml(name)}" ${state.hiddenSeries[name] ? "" : "checked"}>
          <span><span class="legend-dot" style="background:${series.color}"></span> ${escapeHtml(name)}</span>
          <span class="curve-channel-value">${escapeHtml(latest)}</span>
        </label>`;
    })
    .join("");
}

function getCurveDomains() {
  const visibleEntries = Object.entries(state.curveSeries).filter(([name]) => !state.hiddenSeries[name]);
  const points = visibleEntries.flatMap(([, s]) => s.points);
  if (!points.length) return null;
  const rawXMin = Math.min(...points.map((p) => p.t));
  const rawXMax = Math.max(...points.map((p) => p.t));
  const xMin = state.curveView.xStart ?? rawXMin;
  const xMax = state.curveView.xEnd ?? rawXMax;
  const inView = points.filter((p) => p.t >= xMin && p.t <= xMax);
  const ySource = inView.length ? inView : points;
  let yMin = state.curveView.yMin ?? Math.min(...ySource.map((p) => p.v));
  let yMax = state.curveView.yMax ?? Math.max(...ySource.map((p) => p.v));
  if (yMin === yMax) {
    yMin -= 1;
    yMax += 1;
  }
  if (state.curveView.yMin == null || state.curveView.yMax == null) {
    const pad = (yMax - yMin) * 0.08;
    yMin -= pad;
    yMax += pad;
  }
  return { xMin, xMax: xMin === xMax ? xMin + 1 : xMax, yMin, yMax };
}

function zoomCurve(axis, factor, anchorRatio = 0.5) {
  const domain = getCurveDomains();
  if (!domain) return;
  if (axis === "x") {
    const span = (domain.xMax - domain.xMin) * factor;
    const anchor = domain.xMin + (domain.xMax - domain.xMin) * anchorRatio;
    state.curveView.xStart = anchor - span * anchorRatio;
    state.curveView.xEnd = anchor + span * (1 - anchorRatio);
  }
  if (axis === "y") {
    const span = (domain.yMax - domain.yMin) * factor;
    const anchor = domain.yMin + (domain.yMax - domain.yMin) * (1 - anchorRatio);
    state.curveView.yMin = anchor - span * (1 - anchorRatio);
    state.curveView.yMax = anchor + span * anchorRatio;
  }
  drawCurve();
}

function resetCurveView() {
  state.curveView = { xStart: null, xEnd: null, yMin: null, yMax: null };
  state.curveSelection = null;
  els.curveCanvas.classList.remove("selecting");
  drawCurve();
}

function resetRuntimeData() {
  stopAllPacketCycles();
  if (state.logRenderTimer) clearTimeout(state.logRenderTimer);
  if (state.runtimeRenderTimer) clearTimeout(state.runtimeRenderTimer);
  state.logRenderTimer = null;
  state.runtimeRenderTimer = null;
  state.metrics = {};
  state.curveSeries = {};
  state.hiddenSeries = {};
  state.dashboardWidgets = [];
  state.receiveBuffer = [];
  state.csvRows = [];
  resetCurveView();
  renderMetrics();
}

function canvasPoint(event) {
  const rect = els.curveCanvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top, rect };
}

function canvasPointToCurveValue(point) {
  const plot = state.lastCurvePlot;
  const domain = state.lastCurveDomain;
  if (!plot || !domain) return null;
  const x = Math.max(plot.left, Math.min(plot.left + plot.plotW, point.x));
  const y = Math.max(plot.top, Math.min(plot.top + plot.plotH, point.y));
  const t = domain.xMin + ((x - plot.left) / plot.plotW) * (domain.xMax - domain.xMin);
  const v = domain.yMax - ((y - plot.top) / plot.plotH) * (domain.yMax - domain.yMin);
  return { x, y, t, v };
}

function renderPacketList() {
  els.packetList.innerHTML = "";
  state.profile.packets.forEach((packet, idx) => {
    const bytes = safeBuildPacket(packet);
    const item = document.createElement("div");
    item.className = `packet-item ${idx === state.activePacket ? "active" : ""}`;
    item.innerHTML = `
      <input type="checkbox" ${packet.enabled ? "checked" : ""} data-packet-enabled="${idx}">
      <div class="packet-name" title="${escapeHtml(toHex(bytes))}">${escapeHtml(packet.name)}</div>
      <button class="mini" data-edit-packet="${idx}">${t('edit')}</button>
      <button class="mini" data-send-packet="${idx}">${t('send')}</button>
      <button class="mini danger" data-delete-packet="${idx}">${t('del')}</button>`;
    item.addEventListener("click", (event) => {
      if (event.target.tagName === "BUTTON" || event.target.tagName === "INPUT") return;
      state.activePacket = idx;
      renderAll();
    });
    els.packetList.appendChild(item);
  });
}

function safeBuildPacket(packet) {
  try {
    return buildPacket(packet);
  } catch {
    return new Uint8Array();
  }
}

function renderPacketFields() {
  const packet = state.profile.packets[state.activePacket];
  if (!packet) {
    els.packetFields.innerHTML = "";
    return;
  }
  const rows = packet.fields
    .map((field, idx) => {
      const numericField = !["const", "tail", "checksum8", "crc16"].includes(field.type);
      const valueInput = field.type === "const" || field.type === "tail"
        ? `<input value="${escapeHtml(field.bytes || "")}" data-field-prop="${idx}:bytes">`
        : `<input type="number" value="${field.value ?? 0}" data-field-prop="${idx}:value">`;
      const controlSelect = numericField
        ? `<select data-field-control="${idx}">${options(getControlTypeOptions(), field.control || "none")}</select>`
        : `<span class="field-static">-</span>`;
      if (numericField && ["slider", "number"].includes(field.control)) normalizeFieldControlLimits(field);
      const limitInputs = numericField && ["slider", "number"].includes(field.control)
        ? `<div class="field-control-limits">
            <label>${t('min')}<input type="number"${limitInputAttrs(field)} value="${field.min ?? 0}" data-field-limit="${idx}:min"></label>
            <label>${t('max')}<input type="number"${limitInputAttrs(field)} value="${field.max ?? Math.max(1000, Number(field.value) || 1000)}" data-field-limit="${idx}:max"></label>
          </div>`
        : `<span class="field-static">-</span>`;
      return `
        <div class="field-row">
          <select data-field-prop="${idx}:type">${options(getFieldTypeOptions(), field.type)}</select>
          <input value="${escapeHtml(field.name || "")}" data-field-prop="${idx}:name">
          <select data-field-prop="${idx}:endian"><option value="little" ${field.endian !== "big" ? "selected" : ""}>${t('littleEndian')}</option><option value="big" ${field.endian === "big" ? "selected" : ""}>${t('bigEndian')}</option></select>
          ${valueInput}
          ${controlSelect}
          ${limitInputs}
          <div class="field-actions">
            <button class="mini" data-move-field-up="${idx}" ${idx === 0 ? "disabled" : ""}>↑</button>
            <button class="mini" data-move-field-down="${idx}" ${idx === packet.fields.length - 1 ? "disabled" : ""}>↓</button>
            <button class="mini danger" data-delete-field="${idx}">${t('del')}</button>
          </div>
        </div>`;
    })
    .join("");
  const bytes = safeBuildPacket(packet);
  els.packetFields.innerHTML = `
    <div class="group-row">
      <input readonly data-packet-hex-preview value="${escapeHtml(toHex(bytes))}">
      <button data-copy-packet>${t('copyHex')}</button>
    </div>
    ${rows}
    ${renderGeneratedControls(packet)}
  `;
}

function renderGeneratedControls(packet) {
  const controls = packet.fields
    .map((field, idx) => ({ field, idx }))
    .filter(({ field }) => field.control && field.control !== "none");
  if (!controls.length) return "";
  return `
    <div class="control-panel">
      <strong>${t('generatedControls')}</strong>
      ${controls
        .map(({ field, idx }) => renderPacketControl(field, idx, packet))
        .join("")}
    </div>`;
}

function renderPacketControl(field, idx, packet) {
  const name = escapeHtml(field.name || t('control'));
  const value = Number(field.value) || 0;
  if (field.control === "switch") {
    const mode = field.switchMode || "toggle";
    const switchControl = mode === "momentary"
      ? `<button class="momentary-btn" data-control-momentary="${idx}">${t('switchMomentary')}</button>`
      : `<label class="switch self-lock-switch"><input type="checkbox" ${value ? "checked" : ""} data-control-switch="${idx}"><span></span>${t('switchToggle')}</label>`;
    return `
      <div class="control-row compact-control">
        <span>${name}</span>
        ${switchControl}
        <select data-switch-mode="${idx}">${options(getSwitchModeOptions(), mode)}</select>
        <button class="mini" data-control-send="${idx}">${packet.trigger ? t('trigger') : t('send')}</button>
      </div>`;
  }
  if (field.control === "number") {
    return `
      <div class="control-row compact-control">
        <span>${name}</span>
        <input type="number" min="${field.min ?? ""}" max="${field.max ?? ""}" value="${value}" data-control-number="${idx}">
        <span></span>
        <button class="mini" data-control-send="${idx}">${packet.trigger ? t('trigger') : t('send')}</button>
      </div>`;
  }
  return `
    <div class="control-row">
      <span>${name}</span>
      <input type="range" min="${field.min ?? 0}" max="${field.max ?? 1000}" step="${sliderStep(field)}" value="${value}" data-control-field="${idx}">
      <input type="number" min="${field.min ?? ""}" max="${field.max ?? ""}" value="${value}" data-control-number="${idx}">
      <button class="mini" data-control-send="${idx}">${packet.trigger ? t('trigger') : t('send')}</button>
    </div>`;
}

function renderParserList() {
  els.parserList.innerHTML = "";
  state.profile.parsers.forEach((parser, idx) => {
    const item = document.createElement("div");
    item.className = `packet-item ${idx === state.activeParser ? "active" : ""}`;
    item.innerHTML = `
      <input type="checkbox" ${parser.enabled ? "checked" : ""} data-parser-enabled="${idx}">
      <div class="packet-name">${escapeHtml(parser.name)} · ${frameLength(parser)} bytes</div>
      <button class="mini" data-edit-parser="${idx}">${t('edit')}</button>
      <button class="mini" data-clone-parser="${idx}">${t('copy')}</button>
      <button class="mini danger" data-delete-parser="${idx}">${t('del')}</button>`;
    item.addEventListener("click", (event) => {
      if (event.target.tagName === "BUTTON" || event.target.tagName === "INPUT") return;
      state.activeParser = idx;
      renderAll();
    });
    els.parserList.appendChild(item);
  });
}

function renderParserFields() {
  const parser = state.profile.parsers[state.activeParser];
  if (!parser) {
    els.parserFields.innerHTML = "";
    return;
  }
  const rows = parser.fields
    .map((field, idx) => {
      const valueInput = field.type === "const" || field.type === "tail"
        ? `<input value="${escapeHtml(field.bytes || "")}" data-parser-prop="${idx}:bytes">`
        : field.type === "checksum8"
          ? `<input value="${t('autoChecksum')}" disabled>`
          : (!field.show && !field.curve && typeof field.value === "number")
            ? `<input type="number" value="${field.value}" data-parser-prop="${idx}:value">`
            : `<input value="${escapeHtml(field.expr || "")}" placeholder="${t('exprPlaceholder')}" data-parser-prop="${idx}:expr">`;
      const widgetSelect = field.show
        ? `<select data-parser-widget="${idx}">${options(getWidgetTypeOptions(), field.widget || "metric")}</select>`
        : `<span class="field-static">-</span>`;
      return `
        <div class="parser-row">
          <select data-parser-prop="${idx}:type">${options(getParserTypeOptions(), field.type)}</select>
          <input value="${escapeHtml(field.name || "")}" data-parser-prop="${idx}:name">
          <select data-parser-prop="${idx}:endian"><option value="little" ${field.endian !== "big" ? "selected" : ""}>${t('littleEndian')}</option><option value="big" ${field.endian === "big" ? "selected" : ""}>${t('bigEndian')}</option></select>
          ${valueInput}
          <label class="check-inline"><input type="checkbox" ${field.show ? "checked" : ""} data-parser-check="${idx}:show">${t('panel')}</label>
          <label class="check-inline"><input type="checkbox" ${field.curve ? "checked" : ""} data-parser-check="${idx}:curve">${t('curve')}</label>
          ${widgetSelect}
          <div class="field-actions">
            <button class="mini" data-move-parser-field-up="${idx}" ${idx === 0 ? "disabled" : ""}>↑</button>
            <button class="mini" data-move-parser-field-down="${idx}" ${idx === parser.fields.length - 1 ? "disabled" : ""}>↓</button>
            <button class="mini danger" data-delete-parser-field="${idx}">${t('del')}</button>
          </div>
        </div>`;
    })
    .join("");
  els.parserFields.innerHTML = `
    ${rows}
  `;
}

function options(list, selected) {
  return list.map(([value, label]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`).join("");
}

function renderProfileSelect() {
  if (!els.profileSelect) return;
  els.profileSelect.innerHTML = state.profiles
    .map((profile, idx) => `<option value="${idx}" ${idx === state.activeProfileIndex ? "selected" : ""}>${escapeHtml(profile.groupName || t('groupFallback')(idx + 1))}</option>`)
    .join("");
}

function activateProfile(index) {
  const next = state.profiles[index];
  if (!next) return;
  stopAllPacketCycles();
  state.activeProfileIndex = index;
  state.profile = next;
  state.activePacket = 0;
  state.activeParser = 0;
  resetRuntimeData();
  renderAll();
}

function setProfileName(name) {
  state.profile.groupName = name.trim() || t('unnamedGroup');
  state.profiles[state.activeProfileIndex] = state.profile;
  renderProfileSelect();
}

function updateProtocolModeUi() {
  const fixed = (state.profile.protocolMode || "custom") === "fixed";
  document.querySelector(".tabs-line")?.classList.toggle("fixed-mode", fixed);
  document.querySelectorAll('[data-editor="send"], [data-editor="recv"]').forEach((button) => {
    button.classList.toggle("hidden", fixed);
  });
  ["sendEditor", "recvEditor"].forEach((id) => document.getElementById(id)?.classList.toggle("hidden", fixed));
  const active = document.querySelector(".editor-pane.active");
  if (fixed && (active?.id === "sendEditor" || active?.id === "recvEditor")) {
    document.querySelectorAll(".small-tab").forEach((b) => b.classList.toggle("active", b.dataset.editor === "data"));
    document.querySelectorAll(".editor-pane").forEach((pane) => pane.classList.remove("active"));
    document.getElementById("dataEditor")?.classList.add("active");
  }
}

function pulsePacketField(packetIndex, fieldIndex) {
  const packet = state.profile.packets[packetIndex];
  const field = packet?.fields?.[fieldIndex];
  if (!packet || !field) return;
  field.value = 1;
  if (packetIndex === state.activePacket) updatePacketFieldInputs(fieldIndex);
  renderSendDashboardControls();
  renderPacketList();
  if (packet.trigger) sendBytes(buildPacket(packet), packet.name);
  setTimeout(() => {
    field.value = 0;
    if (packetIndex === state.activePacket) updatePacketFieldInputs(fieldIndex);
    renderSendDashboardControls();
    renderPacketList();
    if (packet.trigger) sendBytes(buildPacket(packet), packet.name);
  }, 160);
}

function renderAll() {
  if (els.profileMode) els.profileMode.value = state.profile.protocolMode || "custom";
  renderProfileSelect();
  updateProtocolModeUi();
  syncDashboardFromParserDefinitions();
  renderPacketList();
  renderPacketFields();
  renderParserList();
  renderParserFields();
  renderSendDashboardControls();
  renderPacketCycleControls();
  renderMetrics();
  renderCurveChannels();
  drawCurve();
}

function openNameModal(title, value) {
  els.settingsModalTitle.textContent = title;
  els.settingsModalInput.value = value || "";
  els.settingsModal.classList.remove("hidden");
  els.settingsModalInput.focus();
  els.settingsModalInput.select();
  return new Promise((resolve) => {
    state.modalResolver = resolve;
  });
}

function closeNameModal(value) {
  els.settingsModal.classList.add("hidden");
  const resolve = state.modalResolver;
  state.modalResolver = null;
  if (resolve) resolve(value);
}

async function editPacketSettings(index) {
  const packet = state.profile.packets[index];
  if (!packet) return;
  const name = await openNameModal(t('packetSettings'), packet.name || "");
  if (name == null) return;
  packet.name = name.trim() || t('unnamedPacket');
  state.activePacket = index;
  renderAll();
}

async function editParserSettings(index) {
  const parser = state.profile.parsers[index];
  if (!parser) return;
  const name = await openNameModal(t('parserSettings'), parser.name || "");
  if (name == null) return;
  parser.name = name.trim() || t('unnamedParser');
  state.activeParser = index;
  renderAll();
}

function exportProfile() {
  state.profile.groupName ||= t('unnamedExport');
  const blob = new Blob([JSON.stringify(state.profile, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${state.profile.groupName}.ftserial.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function importProfile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      stopAllPacketCycles();
      state.profile = normalizeProfile(data);
      state.profiles.push(state.profile);
      state.activeProfileIndex = state.profiles.length - 1;
      state.activePacket = 0;
      state.activeParser = 0;
      resetRuntimeData();
      renderAll();
      addLog("parsed", t('imported')(state.profile.groupName), { css: "parsed" });
    } catch (err) {
      addLog("error", t("importFail")(err.message), { css: "error" });
    }
  };
  reader.readAsText(file, "utf-8");
}

function normalizeProfile(data) {
  if (Array.isArray(data) && data[0]?.CycleSendList) return convertJcomProfile(data[0]);
  if (data?.packets && data?.parsers) return data;
  throw new Error(t("unsupportedFormat"));
}

function convertJcomProfile(jcom) {
  const packets = (jcom.CycleSendList || []).map((item) => ({
    name: item.PacketName || "JCom发送",
    enabled: item.Enable !== false,
    delay: item.Delay || 50,
    trigger: Boolean(item.Trigger),
    fields: item.hexFieldContent?.length
      ? item.hexFieldContent.map(convertJcomField)
      : [{ type: "const", name: "Raw", bytes: toHex(base64Bytes(item.HexByteData || "")) }],
  }));
  const parsers = (jcom.RecvHexList || []).map((item) => ({
    name: item.PacketName || "JCom解析",
    enabled: item.Checked !== false,
    fields: (item.hexFieldContent || []).map(convertJcomParserField),
  }));
  return {
    groupName: jcom.GroupName || "JCom Import",
    packets: packets.length ? packets : createDefaultProfile().packets,
    parsers: parsers.length ? parsers : createDefaultProfile().parsers,
  };
}

function base64Bytes(value) {
  try {
    return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
  } catch {
    return new Uint8Array();
  }
}

function convertJcomField(field) {
  const bytes = base64Bytes(field.HexData || "");
  if ([0, 2, 10].includes(field.HexType)) return { type: field.HexType === 10 ? "tail" : "const", name: "固定", bytes: toHex(bytes) };
  if (field.HexType === 9) return { type: "checksum8", name: "校验", rangeStart: field.Check?.RangStart || 0, rangeEnd: field.Check?.RangEnd || 0 };
  const len = field.CntLimit || bytes.length || 1;
  const type = len === 1 ? "uint8" : len === 2 ? "uint16" : "uint32";
  return {
    type,
    name: field.CreateControl?.Name || t('defaultField'),
    value: bytesToNumber(bytes, field.IsBigEndian),
    endian: field.IsBigEndian ? "big" : "little",
    control: field.CreateControl?.Slider ? "slider" : "none",
    min: field.CreateControl?.Slider?.SliderMin ?? 0,
    max: field.CreateControl?.Slider?.SliderMax ?? 1000,
    step: field.CreateControl?.Slider?.SliderTick ?? 1,
  };
}

function convertJcomParserField(field) {
  const bytes = base64Bytes(field.HexData || "");
  if ([0, 2, 10].includes(field.HexType)) return { type: field.HexType === 10 ? "tail" : "const", name: "固定", bytes: toHex(bytes), show: false, curve: false };
  if (field.HexType === 9) return { type: "checksum8", name: "校验", rangeStart: field.Check?.RangStart || 0, rangeEnd: field.Check?.RangEnd || 0, show: false, curve: false };
  const len = field.CntLimit || bytes.length || 1;
  const type = len === 1 ? "uint8" : len === 2 ? "uint16" : "uint32";
  const dc = field.DataConvert || {};
  return {
    type,
    name: dc.Name || t('defaultField'),
    endian: field.IsBigEndian ? "big" : "little",
    show: field.PanelShow !== false,
    curve: Boolean(dc.ShowCurve),
    expr: normalizeExpression(dc.Expression || ""),
  };
}

function normalizeExpression(expr) {
  return expr.replace(/\[x\]/g, "x");
}

function openProtocolAnalysis() {
  state.protocolAnalysis = null;
  els.protocolAnalysisImport.disabled = true;
  els.protocolAnalysisStatus.textContent = t('waitPasteCode');
  els.protocolAnalysisStatus.className = "protocol-analysis-status";
  els.protocolAnalysisResult.innerHTML = "";
  els.protocolAnalysisName.value = `${t('aiProtocol')} ${new Date().toLocaleTimeString("zh-CN", { hour12: false })}`;
  els.protocolAnalysisModal.classList.remove("hidden");
  els.protocolAnalysisSource.focus();
}

function closeProtocolAnalysis() {
  els.protocolAnalysisModal.classList.add("hidden");
}

function analyzeProtocolSource() {
  try {
    const result = window.ProtocolCodeParser.parse(els.protocolAnalysisSource.value, {
      groupName: els.protocolAnalysisName.value,
    });
    state.protocolAnalysis = result;
    els.protocolAnalysisImport.disabled = false;
    els.protocolAnalysisStatus.textContent = t('parseDone')(result.analysis.confidence);
    els.protocolAnalysisStatus.className = "protocol-analysis-status success";
    renderProtocolAnalysisResult(result);
  } catch (error) {
    state.protocolAnalysis = null;
    els.protocolAnalysisImport.disabled = true;
    els.protocolAnalysisStatus.textContent = t('parseFail')(error.message);
    els.protocolAnalysisStatus.className = "protocol-analysis-status error";
    els.protocolAnalysisResult.innerHTML = "";
  }
}

function renderProtocolAnalysisResult(result) {
  const { profile, analysis } = result;
  const packetItems = profile.packets.map((packet) => `
    <li><strong>${escapeHtml(packet.name)}</strong><span>${t('fieldsCount')(packet.fields.length)}</span></li>`).join("");
  const parserItems = profile.parsers.map((parser) => `
    <li><strong>${escapeHtml(parser.name)}</strong><span>${t('fieldsCount')(parser.fields.length)}</span></li>`).join("");
  const findings = analysis.findings.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const notes = analysis.notes.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  els.protocolAnalysisResult.innerHTML = `
    <div class="protocol-analysis-summary">
      <span>${t('sourceLabel')(escapeHtml(analysis.sourceType))}</span>
      <span>${t('packetLabel')(profile.packets.length)}</span>
      <span>${t('parserLabel')(profile.parsers.length)}</span>
    </div>
    <section><h3>${t('analysisTitle')}</h3><ul>${findings}</ul></section>
    <div class="protocol-preview-grid">
      <section><h3>${t('sendGroupTitle')}</h3><ul class="protocol-preview-list">${packetItems || `<li>${t('noSendFound')}</li>`}</ul></section>
      <section><h3>${t('recvGroupTitle')}</h3><ul class="protocol-preview-list">${parserItems || `<li>${t('noRecvFound')}</li>`}</ul></section>
    </div>
    <section class="protocol-analysis-notes"><h3>${t('importTips')}</h3><ul>${notes}</ul></section>`;
}

function importAnalyzedProtocol() {
  if (!state.protocolAnalysis?.profile) return;
  stopAllPacketCycles();
  const profile = structuredClone(state.protocolAnalysis.profile);
  profile.groupName = els.protocolAnalysisName.value.trim() || profile.groupName || t('aiProtocol');
  profile.protocolMode ||= "custom";
  profile.packets ||= [];
  profile.parsers ||= [];
  state.profiles.push(profile);
  state.activeProfileIndex = state.profiles.length - 1;
  state.profile = profile;
  state.activePacket = 0;
  state.activeParser = 0;
  resetRuntimeData();
  renderAll();
  closeProtocolAnalysis();
  addLog("parsed", t('aiImported')(profile.groupName), { css: "parsed" });
}

function bytesToNumber(bytes, bigEndian) {
  const arr = [...bytes];
  const ordered = bigEndian ? arr : arr.reverse();
  return ordered.reduce((sum, b) => (sum << 8) + b, 0);
}

function appendTerminal(text) {
  els.terminalView.textContent += text;
  if (els.terminalView.textContent.length > MAX_TERMINAL_CHARS) {
    els.terminalView.textContent = els.terminalView.textContent.slice(-MAX_TERMINAL_CHARS);
  }
  els.terminalView.scrollTop = els.terminalView.scrollHeight;
}

function demoTick() {
  const t = Date.now() / 1000;
  const target = 1800 + Math.round(Math.sin(t / 2) * 700);
  const actual = target + Math.round(Math.sin(t * 3) * 120);
  const current = 180 + Math.round(Math.sin(t * 2.2) * 70);
  const voltage = 241;
  const frame = [0xaa, 0x02, (target >> 8) & 0xff, target & 0xff, (actual >> 8) & 0xff, actual & 0xff, (current >> 8) & 0xff, current & 0xff, (voltage >> 8) & 0xff, voltage & 0xff];
  let sum = 0;
  for (let i = 1; i <= 9; i++) sum = (sum + frame[i]) & 0xff;
  frame.push(sum, 0x0d);
  handleIncoming(new Uint8Array(frame));
}

function toggleDemo() {
  if (state.demoTimer) {
    clearInterval(state.demoTimer);
    state.demoTimer = null;
    els.demoBtn.textContent = t("demo");
    return;
  }
  state.demoTimer = setInterval(demoTick, 120);
  els.demoBtn.textContent = t("demoStop");
}


function renderHelp() {
  const lang = els.helpLanguage?.value || state.language || "zh";
  const tl = (key) => tLang(lang, key);
  els.helpContent.innerHTML = `
    <h3>${escapeHtml(tl('helpTitle'))}</h3>
    ${tl('helpLines').map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
    <section class="help-about">
      <strong>${tl('aboutTitle')}</strong>
      <div><span>${tl('aboutAuthor')}</span><b>L.S</b></div>
      <div><span>${tl('aboutCompany')}</span><b>峰岹科技(青岛)有限公司</b></div>
      <div><span>${tl('aboutWebsite')}</span><a href="https://www.fortiortech.com/" target="_blank" rel="noreferrer">www.fortiortech.com</a></div>
    </section>`;
}


function applyToolLanguage(language, notifyMain = true) {
  const lang = ["en", "ja", "ko"].includes(language) ? language : "zh";
  state.language = lang;
  localStorage.setItem("ftToolLanguage", lang);
  const htmlLangMap = { en: "en", ja: "ja", ko: "ko" };
  document.documentElement.lang = htmlLangMap[lang] || "zh-CN";
  if (els.toolLanguage) els.toolLanguage.value = lang;
  updateStaticText();
  renderAll();
  if (els.helpLanguage) {
    els.helpLanguage.value = lang;
    renderHelp();
  }
  if (notifyMain) window.ftApp?.setLanguage(lang);
}

/** 更新所有静态 UI 元素的文字 */
function updateStaticText() {
  // 按钮
  const btnMap = {
    connectBtn: state.connected ? "close" : "open",
    demoBtn: state.demoTimer ? "demoStop" : "demo",
    clearLogBtn: "clear", saveLogBtn: "save",
    pauseReceive: state.receivePaused ? "resume" : "pause",
    importBtn: "import", exportBtn: "export",
    renameProfileBtn: "rename", newProfileBtn: "new",
    addPacketBtn: "addPacket", addFieldBtn: "addField",
    addParserBtn: "addRule", addParserFieldBtn: "addField",
    pauseCurveBtn: state.curvePaused ? "resumeCurve" : "pauseCurve",
    clearCurveBtn: "clearCurve",
    measureCurveBtn: state.measuring ? "measureExit" : "measure",
    expandCurveBtn: state.curveExpanded ? "restore" : "expand",
    sendRawBtn: "send", clearSendBtn: "clear",
    terminalSendBtn: "send", terminalClearBtn: "clear",
  };
  for (const [id, key] of Object.entries(btnMap)) {
    const el = document.getElementById(id);
    if (el && !el.classList.contains("active")) el.textContent = t(key);
  }

  // 标签页
  const tabKeys = ["tabData", "tabCurve", "tabSend", "tabRecv"];
  document.querySelectorAll(".small-tab").forEach((btn, i) => {
    if (tabKeys[i]) btn.textContent = t(tabKeys[i]);
  });

  // 面板标题
  const panelSelectors = [".receive-panel .panel-title", ".side-panel .panel-title", ".send-panel .panel-title"];
  const panelKeys = ["panelRecv", "panelGroup", "panelSend"];
  panelSelectors.forEach((sel, i) => {
    const el = document.querySelector(sel);
    if (el) el.textContent = t(panelKeys[i]);
  });

  // 复选框标签
  const checkMap = {
    hexView: "checkHex", autoScroll: "checkAutoScroll", pauseReceive: "checkPause",
    sendHex: "checkHexSend", cycleSend: "checkCycle", appendNewline: "checkCR", logCsv: "checkCsv",
  };
  for (const [id, key] of Object.entries(checkMap)) {
    const el = document.getElementById(id);
    if (el?.closest("label")) {
      const node = [...el.closest("label").childNodes].find(n => n.nodeType === 3 && n.textContent.trim());
      if (node) node.textContent = `${t(key)} `;
    }
  }

  // 设置标签
  const labelMap = {
    linkType: "labelLink", portSelect: "labelPort", baudRate: "labelBaud",
    toolLanguage: "labelLang", timeFormat: "labelTime", maxLogLines: "labelMaxLog",
    maxCurvePoints: "labelMaxCurve",
  };
  for (const [id, key] of Object.entries(labelMap)) {
    const el = document.getElementById(id);
    if (el?.closest("label")) {
      const node = [...el.closest("label").childNodes].find(n => n.nodeType === 3 && n.textContent.trim());
      if (node) node.textContent = `${t(key)} `;
    }
  }

  // 链路下拉框
  const linkKeys = ["linkUsb", "linkBle", "linkTcp"];
  if (els.linkType) {
    [...els.linkType.options].forEach((opt, i) => {
      if (linkKeys[i]) opt.textContent = t(linkKeys[i]);
    });
  }

  // 协议模式下拉框
  if (els.profileMode) {
    els.profileMode.options[0].textContent = t("protoCustom");
    els.profileMode.options[1].textContent = t("protoFixed");
  }

  // 设置面板标题
  const settingsTitle = document.querySelector(".settings-panel h2");
  if (settingsTitle) settingsTitle.textContent = t("settingsTitle");

  // 状态栏
  if (!state.connected) {
    els.statusText.textContent = t("disconnected");
    els.connectBtn.textContent = t("open");
  }

  // 浏览器支持文字
  if (window.ftUsbSerial) {
    els.browserSupport.textContent = t("nativeUsbOk");
  } else if (!("serial" in navigator)) {
    els.browserSupport.textContent = window.ftTcpSerial ? t("tcpOk") : t("browserSerialNo");
  } else {
    els.browserSupport.textContent = t("browserSerialOk");
  }
}

function updateSettingsFromStorage() {
  const repository = localStorage.getItem("ftGitHubRepository") || "https://github.com/1052970753-hue/FTSerialTool";
  const mirrorUrl = localStorage.getItem("ftUpdateMirrorUrl") || "";
  const autoCheck = localStorage.getItem("ftAutoCheckUpdates") !== "false";
  if (els.githubRepository) els.githubRepository.value = repository;
  if (els.updateMirrorUrl) els.updateMirrorUrl.value = mirrorUrl;
  if (els.autoCheckUpdates) els.autoCheckUpdates.checked = autoCheck;
  window.ftApp?.configureUpdates({ repository, mirrorUrl, autoCheck });
}

function saveUpdateSettings() {
  const repository = els.githubRepository?.value.trim() || "";
  const mirrorUrl = els.updateMirrorUrl?.value.trim() || "";
  const autoCheck = els.autoCheckUpdates?.checked !== false;
  localStorage.setItem("ftGitHubRepository", repository);
  localStorage.setItem("ftUpdateMirrorUrl", mirrorUrl);
  localStorage.setItem("ftAutoCheckUpdates", String(autoCheck));
  window.ftApp?.configureUpdates({ repository, mirrorUrl, autoCheck });
  if (els.updateStatus) els.updateStatus.textContent = mirrorUrl ? t('updateSaved') : (repository ? t('githubSaved') : t('fillUpdateUrl'));
}

function setAppMode(mode) {
  if (mode === "settings") {
    els.toolSettingsModal?.classList.remove("hidden");
    return;
  }
  if (mode === "help") {
    renderHelp();
    els.helpModal?.classList.remove("hidden");
    return;
  }
  $$(".tab").forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
  $("#workbenchMode").classList.toggle("hidden", mode !== "workbench");
  $("#terminalMode").classList.toggle("hidden", mode !== "terminal");
}

function setWorkspaceView(view, notifyMain = true) {
  const next = ["general", "vacuum", "ecm", "compressor"].includes(view) ? view : "general";
  const workbench = $("#workbenchMode");
  const dataEditor = $("#dataEditor");
  const dataHome = $("#dataEditorHome");
  const vacuumHost = $("#vacuumDashboardHost");
  const vacuumPanel = $("#vacuumDashboardPanel");

  if (next === "vacuum") {
    const activeEditor = document.querySelector(".editor-pane.active")?.id?.replace("Editor", "");
    if (activeEditor && activeEditor !== "curve") state.generalEditor = activeEditor;
    vacuumHost?.appendChild(dataEditor);
    vacuumPanel?.classList.remove("hidden");
    workbench?.classList.add("workspace-vacuum");
  } else {
    if (dataEditor && dataHome?.parentNode) dataHome.parentNode.insertBefore(dataEditor, dataHome);
    vacuumPanel?.classList.add("hidden");
    workbench?.classList.remove("workspace-vacuum");
    $$(".small-tab").forEach((button) => button.classList.toggle("active", button.dataset.editor === state.generalEditor));
    $$(".editor-pane").forEach((pane) => pane.classList.toggle("active", pane.id === `${state.generalEditor}Editor`));
  }

  state.workspaceView = next;
  localStorage.setItem("ftWorkspaceView", next);
  document.body.dataset.workspaceView = next;
  if (notifyMain) window.ftApp?.setWorkspaceView(next);
  setAppMode("workbench");
  setTimeout(drawCurve, 60);
}

window.ftApp?.onUpdateStatus((status) => {
  if (els.updateStatus) els.updateStatus.textContent = status?.message || t('updateUnknown');
  renderUpdateProgress(status);
});

function formatUpdateBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
}

function setUpdateProgress(element, label, value) {
  const percent = Math.max(0, Math.min(100, Math.round((Number(value) || 0) * 100)));
  if (element) element.value = percent;
  if (label) label.textContent = `${percent}%`;
}

function renderUpdateProgress(status = {}) {
  // 所有非空状态都显示弹窗，让用户看到反馈
  if (status.state) els.updateProgressModal?.classList.remove("hidden");
  // "current" 状态 2 秒后自动关闭
  if (status.state === "current") setTimeout(() => els.updateProgressModal?.classList.add("hidden"), 2000);
  els.updateProgressModal?.classList.toggle("update-available-mode", status.state === "available");
  els.updateAvailableInfo?.classList.toggle("hidden", status.state !== "available");
  if (status.state === "available") {
    if (els.updateAvailableTitle) els.updateAvailableTitle.textContent = t('newVersion')(status.latest || "");
    if (els.updateVersionDetail) els.updateVersionDetail.textContent = `${t('currentVersion')(status.current || "-")} · ${t('updatePkg')} ${formatUpdateBytes(status.size)}`;
    if (els.updateReleaseNotes) els.updateReleaseNotes.textContent = status.notes || t('noReleaseNotes');
  }
  setUpdateProgress(els.updateDownloadProgress, els.updateDownloadPercent, status.progress);
  setUpdateProgress(els.updateInstallProgress, els.updateInstallPercent, status.updateProgress);
  if (els.updateProgressStatus) els.updateProgressStatus.textContent = status.message || t('preparingUpdate');
  if (els.updateDownloadDetail && status.state === "downloading") {
    const size = status.total ? `${formatUpdateBytes(status.received)} / ${formatUpdateBytes(status.total)}` : formatUpdateBytes(status.received);
    els.updateDownloadDetail.textContent = `${size} · ${formatUpdateBytes(status.speed)}/s`;
  }
  if (els.updateDownloadDetail && ["verifying", "ready", "installing"].includes(status.state)) {
    els.updateDownloadDetail.textContent = t('downloadDone');
  }
  if (els.updateInstallDetail) {
    if (status.state === "verifying") els.updateInstallDetail.textContent = t('verifying')(formatUpdateBytes(status.checked), formatUpdateBytes(status.total));
    if (status.state === "ready") els.updateInstallDetail.textContent = t('verifyDone');
    if (status.state === "installing") els.updateInstallDetail.textContent = t('launchingNew');
    if (status.state === "error") els.updateInstallDetail.textContent = status.message || t('updateFailed');
  }
  if (els.updateActionBtn) {
    els.updateActionBtn.disabled = !["available", "ready"].includes(status.state);
    els.updateActionBtn.textContent = status.state === "ready" ? t('updateNow') : t('downloadUpdate');
    els.updateActionBtn.dataset.action = status.state === "ready" ? "install" : "download";
  }
}

document.addEventListener("click", async (event) => {
  const target = event.target;
  if (target.matches(".tab")) {
    setAppMode(target.dataset.mode);
  }
  if (target.matches(".small-tab")) {
    $$(".small-tab").forEach((b) => b.classList.toggle("active", b === target));
    $$(".editor-pane").forEach((pane) => pane.classList.remove("active"));
    $(`#${target.dataset.editor}Editor`).classList.add("active");
    drawCurve();
  }
  if (target.closest(".receive-tools button")) {
    $$(".receive-tools button").forEach((b) => b.classList.toggle("active", b === target));
    renderLog();
  }
  if (target.id === "connectBtn") connectSerial();
  if (target.id === "demoBtn") toggleDemo();
  if (target.id === "clearLogBtn") {
    state.logRows = [];
    renderLog();
  }
  if (target.id === "saveLogBtn") saveText("serial-log.txt", state.logRows.map((r) => `${r.time} ${r.kind.toUpperCase()} ${r.text}`).join("\n"));
  if (target.id === "pauseReceive") {
    state.receivePaused = !state.receivePaused;
    updatePauseReceiveButton();
  }
  if (target.id === "sendRawBtn") sendRaw();
  if (target.id === "clearSendBtn") els.sendText.value = "";
  if (target.id === "terminalSendBtn") sendTerminal();
  if (target.id === "terminalClearBtn") els.terminalView.textContent = "";
  if (target.id === "settingsModalCancel") closeNameModal(null);
  if (target.id === "settingsModalOk") closeNameModal(els.settingsModalInput.value);
  if (target.id === "toolSettingsClose" || target.id === "toolSettingsModal") els.toolSettingsModal?.classList.add("hidden");
  if (target.id === "updateProgressClose") els.updateProgressModal?.classList.add("hidden");
  if (target.id === "updateActionBtn") {
    target.disabled = true;
    const action = target.dataset.action;
    const task = action === "install" ? window.ftApp?.installUpdate() : window.ftApp?.downloadUpdate();
    task?.catch((error) => renderUpdateProgress({ state: "error", message: error.message }));
  }
  if (target.id === "helpClose" || target.id === "helpModal") els.helpModal?.classList.add("hidden");
  if (target.id === "protocolAnalysisClose") closeProtocolAnalysis();
  if (target.id === "protocolAnalyzeBtn") analyzeProtocolSource();
  if (target.id === "protocolAnalysisImport") importAnalyzedProtocol();
  if (target.id === "checkUpdatesBtn") {
    saveUpdateSettings();
    window.ftApp?.checkUpdates().catch(err => {
      renderUpdateProgress({ state: "error", message: err.message || String(err) });
    });
  }
  if (target.dataset.packetCycleSend !== undefined) {
    const packetIndex = Number(target.dataset.packetCycleSend);
    const packet = state.profile.packets[packetIndex];
    if (packet) sendBytes(buildPacket(packet), packet.name);
  }
  if (target.id === "pauseCurveBtn") {
    state.curvePaused = !state.curvePaused;
    els.pauseCurveBtn.textContent = state.curvePaused ? t('resumeCurve') : t('pauseCurve');
  }
  if (target.id === "clearCurveBtn") {
    state.curveSeries = {};
    state.hiddenSeries = {};
    resetCurveView();
  }
  if (target.id === "measureCurveBtn") {
    state.measuring = !state.measuring;
    state.measurePoints = [];
    target.classList.toggle("active", state.measuring);
    target.textContent = state.measuring ? t('measureExit') : t('measure');
    drawCurve();
  }
  if (target.id === "expandCurveBtn") {
    state.curveExpanded = !state.curveExpanded;
    $("#curveEditor")?.classList.toggle("curve-expanded", state.curveExpanded);
    els.expandCurveBtn.textContent = state.curveExpanded ? t('restore') : t('expand');
    setTimeout(drawCurve, 60);
  }
  if (target.id === "importBtn") els.importFile.click();
  if (target.id === "exportBtn") exportProfile();
  if (target.id === "renameProfileBtn") {
    openNameModal(t('profileRename'), state.profile.groupName || "").then((name) => {
      if (name == null) return;
      setProfileName(name);
      renderAll();
    });
  }
  if (target.id === "newProfileBtn") {
    stopAllPacketCycles();
    const profile = createDefaultProfile();
    profile.groupName = `${t('newGroupName')} ${new Date().toLocaleTimeString("zh-CN", { hour12: false })}`;
    state.profiles.push(profile);
    state.activeProfileIndex = state.profiles.length - 1;
    state.profile = profile;
    state.activePacket = 0;
    state.activeParser = 0;
    resetRuntimeData();
    renderAll();
  }
  if (target.id === "addPacketBtn") {
    state.profile.packets.push(structuredClone(createDefaultProfile().packets[0]));
    state.activePacket = state.profile.packets.length - 1;
    renderAll();
  }
  if (target.id === "addFieldBtn") {
    state.profile.packets[state.activePacket]?.fields.push({ type: "uint8", name: t('defaultField'), value: 0, endian: "little", control: "none" });
    renderAll();
  }
  if (target.id === "addParserBtn") {
    state.profile.parsers.push(structuredClone(createDefaultProfile().parsers[0]));
    state.activeParser = state.profile.parsers.length - 1;
    renderAll();
  }
  if (target.id === "addParserFieldBtn") {
    state.profile.parsers[state.activeParser]?.fields.push({ type: "uint16", name: t('defaultField'), endian: "big", show: true, curve: false, widget: "metric", expr: "x" });
    renderAll();
  }
  if (target.dataset.sendPacket !== undefined) sendBytes(buildPacket(state.profile.packets[Number(target.dataset.sendPacket)]), state.profile.packets[Number(target.dataset.sendPacket)].name);
  if (target.dataset.editPacket !== undefined) editPacketSettings(Number(target.dataset.editPacket));
  if (target.dataset.editParser !== undefined) editParserSettings(Number(target.dataset.editParser));
  if (target.dataset.editActivePacket !== undefined) editPacketSettings(state.activePacket);
  if (target.dataset.editActiveParser !== undefined) editParserSettings(state.activeParser);
  if (target.dataset.deletePacket !== undefined) {
    stopAllPacketCycles();
    state.profile.packets.splice(Number(target.dataset.deletePacket), 1);
    state.activePacket = Math.min(Math.max(0, state.activePacket), Math.max(0, state.profile.packets.length - 1));
    renderAll();
  }
  if (target.dataset.deleteParser !== undefined) {
    state.profile.parsers.splice(Number(target.dataset.deleteParser), 1);
    state.activeParser = Math.min(Math.max(0, state.activeParser), Math.max(0, state.profile.parsers.length - 1));
    renderAll();
  }
  if (target.dataset.cloneParser !== undefined) {
    state.profile.parsers.push(structuredClone(state.profile.parsers[Number(target.dataset.cloneParser)]));
    renderAll();
  }
  if (target.dataset.deleteField !== undefined) {
    state.profile.packets[state.activePacket].fields.splice(Number(target.dataset.deleteField), 1);
    renderAll();
  }
  if (target.dataset.deleteParserField !== undefined) {
    state.profile.parsers[state.activeParser].fields.splice(Number(target.dataset.deleteParserField), 1);
    renderAll();
  }
  if (target.dataset.moveFieldUp !== undefined) {
    const idx = Number(target.dataset.moveFieldUp);
    moveItem(state.profile.packets[state.activePacket].fields, idx, idx - 1);
    renderAll();
  }
  if (target.dataset.moveFieldDown !== undefined) {
    const idx = Number(target.dataset.moveFieldDown);
    moveItem(state.profile.packets[state.activePacket].fields, idx, idx + 1);
    renderAll();
  }
  if (target.dataset.addField !== undefined) {
    state.profile.packets[state.activePacket].fields.push({ type: "uint8", name: t('defaultField'), value: 0, endian: "little", control: "none" });
    renderAll();
  }
  if (target.dataset.copyPacket !== undefined) navigator.clipboard?.writeText(toHex(buildPacket(state.profile.packets[state.activePacket])));
  if (target.dataset.addParserField !== undefined) {
    state.profile.parsers[state.activeParser].fields.push({ type: "uint16", name: t('defaultField'), endian: "big", show: true, curve: false, widget: "metric", expr: "x" });
    renderAll();
  }
  if (target.dataset.moveParserFieldUp !== undefined) {
    const idx = Number(target.dataset.moveParserFieldUp);
    moveItem(state.profile.parsers[state.activeParser].fields, idx, idx - 1);
    renderAll();
  }
  if (target.dataset.moveParserFieldDown !== undefined) {
    const idx = Number(target.dataset.moveParserFieldDown);
    moveItem(state.profile.parsers[state.activeParser].fields, idx, idx + 1);
    renderAll();
  }
  if (target.dataset.controlMomentary !== undefined) pulsePacketField(state.activePacket, Number(target.dataset.controlMomentary));
  if (target.dataset.dashboardSendMomentary !== undefined) {
    const [packetIndex, fieldIndex] = target.dataset.dashboardSendMomentary.split(":").map(Number);
    pulsePacketField(packetIndex, fieldIndex);
  }
  if (target.dataset.controlSend !== undefined) sendBytes(buildPacket(state.profile.packets[state.activePacket]), state.profile.packets[state.activePacket].name);
});

document.addEventListener("input", (event) => {
  const target = event.target;
  if (target.dataset.packetCycleMs !== undefined) {
    const packetIndex = Number(target.dataset.packetCycleMs);
    const packet = state.profile.packets[packetIndex];
    if (packet) packet.cycleMs = Math.max(10, Number(target.value) || 100);
  }
  if (target.id === "profileMode") {
    state.profile.protocolMode = target.value;
    updateProtocolModeUi();
  }
  if (target.dataset.fieldProp) {
    const [idx, prop] = target.dataset.fieldProp.split(":");
    const field = state.profile.packets[state.activePacket].fields[Number(idx)];
    field[prop] = target.type === "number" ? Number(target.value) : target.value;
    if (prop === "type" && ["slider", "number"].includes(field.control)) normalizeFieldControlLimits(field);
    updatePacketHexPreview();
    if (prop === "name") renderPacketList();
    if (prop === "value") {
      syncSendControlInputs(state.activePacket, Number(idx), field.value, target);
      renderSendDashboardControls();
    }
    if (target.tagName === "SELECT") renderAll();
  }
  if (target.dataset.fieldControl) {
    const field = state.profile.packets[state.activePacket].fields[Number(target.dataset.fieldControl)];
    field.control = target.value;
    if (target.value === "slider") {
      field.min ??= 0;
      field.max ??= Math.max(1000, Number(field.value) || 1000);
      field.step = field.step && field.step < 100 ? field.step : 1;
      normalizeFieldControlLimits(field);
    }
    if (target.value === "number") normalizeFieldControlLimits(field);
    if (target.value === "switch") {
      field.switchMode ??= "toggle";
    }
    renderAll();
  }
  if (target.dataset.switchMode) {
    state.profile.packets[state.activePacket].fields[Number(target.dataset.switchMode)].switchMode = target.value;
    renderAll();
  }
  if (target.dataset.fieldLimit) {
    const [idx, prop] = target.dataset.fieldLimit.split(":");
    const field = state.profile.packets[state.activePacket].fields[Number(idx)];
    field[prop] = Number(target.value);
    normalizeFieldControlLimits(field);
    target.value = field[prop];
  }
  if (target.dataset.packetName !== undefined) {
    state.profile.packets[state.activePacket].name = target.value;
    renderPacketList();
  }
  if (target.dataset.parserProp) {
    const [idx, prop] = target.dataset.parserProp.split(":");
    const field = state.profile.parsers[state.activeParser].fields[Number(idx)];
    field[prop] = target.type === "number" ? Number(target.value) : target.value;
    if (target.tagName === "SELECT") renderAll();
  }
  if (target.dataset.parserCheck) {
    const [idx, prop] = target.dataset.parserCheck.split(":");
    state.profile.parsers[state.activeParser].fields[Number(idx)][prop] = target.checked;
    renderAll();
  }
  if (target.dataset.parserWidget) {
    state.profile.parsers[state.activeParser].fields[Number(target.dataset.parserWidget)].widget = target.value;
    renderAll();
  }
  if (target.dataset.parserName !== undefined) {
    state.profile.parsers[state.activeParser].name = target.value;
    renderParserList();
  }
  if (target.dataset.packetEnabled) state.profile.packets[Number(target.dataset.packetEnabled)].enabled = target.checked;
  if (target.dataset.parserEnabled) state.profile.parsers[Number(target.dataset.parserEnabled)].enabled = target.checked;
  if (target.dataset.curveVisible) {
    state.hiddenSeries[target.dataset.curveVisible] = !target.checked;
    drawCurve();
  }
  if (target.dataset.controlField || target.dataset.controlNumber) {
    const idx = Number(target.dataset.controlField ?? target.dataset.controlNumber);
    const packet = state.profile.packets[state.activePacket];
    const value = Number(target.value);
    packet.fields[idx].value = value;
    syncSendControlInputs(state.activePacket, idx, value, target);
    if (packet.trigger) sendBytes(buildPacket(packet), packet.name);
  }
  if (target.dataset.dashboardSendControl) {
    setDashboardSendControlValue(target, target.type !== "range");
  }
  if (target.dataset.controlField || target.dataset.controlNumber) {
    renderPacketList();
  }
});

document.addEventListener("change", (event) => {
  const target = event.target;
  if (target.dataset.cyclePacketSelect !== undefined) {
    state.cyclePacketIndex = Number(target.value);
    renderPacketCycleControls();
  }
  if (target.dataset.packetCycleEnabled !== undefined) {
    const packetIndex = Number(target.dataset.packetCycleEnabled);
    if (target.checked) startPacketCycle(packetIndex);
    else stopPacketCycle(packetIndex);
    renderPacketCycleControls();
  }
  if (target.dataset.packetCycleMs !== undefined) {
    const packetIndex = Number(target.dataset.packetCycleMs);
    const packet = state.profile.packets[packetIndex];
    if (packet) {
      packet.cycleMs = Math.max(10, Number(target.value) || 100);
      if (packet.cycleEnabled) startPacketCycle(packetIndex);
    }
    renderPacketCycleControls();
  }
  if (target.id === "profileSelect") activateProfile(Number(target.value));
  if (target.id === "profileMode") {
    state.profile.protocolMode = target.value;
    updateProtocolModeUi();
  }
  if (target.id === "baudRate") updateBaudRateUi();
  if (target.dataset.fieldProp) {
    const [idx, prop] = target.dataset.fieldProp.split(":");
    const field = state.profile.packets[state.activePacket].fields[Number(idx)];
    field[prop] = target.type === "number" ? Number(target.value) : target.value;
    if (prop === "type" && ["slider", "number"].includes(field.control)) normalizeFieldControlLimits(field);
    renderAll();
  }
  if (target.dataset.fieldLimit) {
    const [idx, prop] = target.dataset.fieldLimit.split(":");
    const field = state.profile.packets[state.activePacket].fields[Number(idx)];
    field[prop] = Number(target.value);
    normalizeFieldControlLimits(field);
    renderAll();
  }
  if (target.dataset.parserProp) {
    const [idx, prop] = target.dataset.parserProp.split(":");
    const field = state.profile.parsers[state.activeParser].fields[Number(idx)];
    field[prop] = target.type === "number" ? Number(target.value) : target.value;
    renderAll();
  }
  if (target.dataset.parserCheck) {
    const [idx, prop] = target.dataset.parserCheck.split(":");
    state.profile.parsers[state.activeParser].fields[Number(idx)][prop] = target.checked;
    renderAll();
  }
  if (target.dataset.packetEnabled) state.profile.packets[Number(target.dataset.packetEnabled)].enabled = target.checked;
  if (target.dataset.parserEnabled) state.profile.parsers[Number(target.dataset.parserEnabled)].enabled = target.checked;
  if (target.dataset.fieldControl) {
    const field = state.profile.packets[state.activePacket].fields[Number(target.dataset.fieldControl)];
    field.control = target.value;
    if (target.value === "slider") {
      field.min ??= 0;
      field.max ??= Math.max(1000, Number(field.value) || 1000);
      field.step = field.step && field.step < 100 ? field.step : 1;
      normalizeFieldControlLimits(field);
    }
    if (target.value === "number") normalizeFieldControlLimits(field);
    if (target.value === "switch") {
      field.switchMode ??= "toggle";
    }
    renderAll();
  }
  if (target.dataset.switchMode) {
    state.profile.packets[state.activePacket].fields[Number(target.dataset.switchMode)].switchMode = target.value;
    renderAll();
  }
  if (target.dataset.parserWidget) {
    state.profile.parsers[state.activeParser].fields[Number(target.dataset.parserWidget)].widget = target.value;
    renderAll();
  }
  if (target.dataset.dashboardSendControl) {
    setDashboardSendControlValue(target, true);
    renderPacketList();
  }
  if (target.dataset.controlSwitch) {
    const idx = Number(target.dataset.controlSwitch);
    const packet = state.profile.packets[state.activePacket];
    const field = packet.fields[idx];
    if ((field.switchMode || "toggle") === "momentary") {
      field.value = 1;
      target.checked = true;
      renderPacketList();
      updatePacketFieldInputs(idx);
      renderSendDashboardControls();
      if (packet.trigger) sendBytes(buildPacket(packet), packet.name);
      setTimeout(() => {
        field.value = 0;
        updatePacketFieldInputs(idx);
        renderSendDashboardControls();
        if (packet.trigger) sendBytes(buildPacket(packet), packet.name);
      }, 160);
      return;
    }
    packet.fields[idx].value = target.checked ? 1 : 0;
    renderPacketList();
    updatePacketFieldInputs(idx);
    renderSendDashboardControls();
    if (packet.trigger) sendBytes(buildPacket(packet), packet.name);
  }
  if (target.dataset.dashboardSendSwitch) {
    const [packetIndex, fieldIndex] = target.dataset.dashboardSendSwitch.split(":").map(Number);
    const packet = state.profile.packets[packetIndex];
    const field = packet?.fields?.[fieldIndex];
    if (!packet || !field) return;
    if ((field.switchMode || "toggle") === "momentary") {
      field.value = 1;
      target.checked = true;
      if (packetIndex === state.activePacket) updatePacketFieldInputs(fieldIndex);
      if (packet.trigger) sendBytes(buildPacket(packet), packet.name);
      setTimeout(() => {
        field.value = 0;
        target.checked = false;
        if (packetIndex === state.activePacket) updatePacketFieldInputs(fieldIndex);
        renderSendDashboardControls();
        if (packet.trigger) sendBytes(buildPacket(packet), packet.name);
      }, 160);
      return;
    }
    field.value = target.checked ? 1 : 0;
    if (packetIndex === state.activePacket) updatePacketFieldInputs(fieldIndex);
    renderSendDashboardControls();
    if (packet.trigger) sendBytes(buildPacket(packet), packet.name);
  }
});

els.importFile.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (file) importProfile(file);
  event.target.value = "";
});

els.cycleSend.addEventListener("change", () => {
  if (els.cycleSend.checked) startCycleSend();
  else stopCycleSend();
});

els.linkType.addEventListener("change", async () => {
  if (state.connected) await disconnectSerial();
  updateLinkTypeUi();
});

els.dashboardSkin.addEventListener("change", () => {
  state.dashboardSkin = els.dashboardSkin.value;
  state.dashboardWidgets.forEach((widget) => {
    widget.skin = els.dashboardSkin.value;
  });
  renderMetrics();
});

els.toolLanguage?.addEventListener("change", () => applyToolLanguage(els.toolLanguage.value));
els.helpLanguage.addEventListener("change", renderHelp);
els.githubRepository?.addEventListener("change", saveUpdateSettings);
els.updateMirrorUrl?.addEventListener("change", saveUpdateSettings);
els.autoCheckUpdates?.addEventListener("change", saveUpdateSettings);

document.addEventListener("pointerdown", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || target.type !== "range" || !target.dataset.dashboardSendControl) return;
  state.dashboardSliderDrag = { target, pointerId: event.pointerId };
  target.setPointerCapture?.(event.pointerId);
  target.value = rangeValueFromPointer(target, event);
  setDashboardSendControlValue(target);
  event.preventDefault();
});

document.addEventListener("pointermove", (event) => {
  const drag = state.dashboardSliderDrag;
  if (!drag || drag.pointerId !== event.pointerId) return;
  drag.target.value = rangeValueFromPointer(drag.target, event);
  setDashboardSendControlValue(drag.target);
  event.preventDefault();
});

document.addEventListener("pointerup", (event) => {
  const drag = state.dashboardSliderDrag;
  if (!drag || drag.pointerId !== event.pointerId) return;
  drag.target.value = rangeValueFromPointer(drag.target, event);
  setDashboardSendControlValue(drag.target, true);
  renderPacketList();
  drag.target.releasePointerCapture?.(event.pointerId);
  state.dashboardSliderDrag = null;
  event.preventDefault();
});

document.addEventListener("pointercancel", (event) => {
  if (state.dashboardSliderDrag?.pointerId === event.pointerId) state.dashboardSliderDrag = null;
});

els.curveCanvas.addEventListener("wheel", (event) => {
  if (!event.ctrlKey && !event.shiftKey) return;
  event.preventDefault();
  const { x, y, rect } = canvasPoint(event);
  const factor = event.deltaY < 0 ? 0.82 : 1.22;
  if (event.ctrlKey) zoomCurve("x", factor, Math.max(0, Math.min(1, x / rect.width)));
  if (event.shiftKey) zoomCurve("y", factor, Math.max(0, Math.min(1, y / rect.height)));
}, { passive: false });

els.curveCanvas.addEventListener("contextmenu", (event) => event.preventDefault());

els.curveCanvas.addEventListener("mousedown", (event) => {
  if (state.measuring && event.button === 0) {
    const point = canvasPointToCurveValue(canvasPoint(event));
    if (point) {
      state.measurePoints.push(point);
      if (state.measurePoints.length > 4) state.measurePoints.shift();
      drawCurve();
    }
    return;
  }
  if (state.measuring && event.button === 2) {
    state.measuring = false;
    state.measurePoints = [];
    els.measureCurveBtn.textContent = t('measure');
    els.measureCurveBtn.classList.remove("active");
    drawCurve();
    return;
  }
  if (event.button !== 2) return;
  const { x, y } = canvasPoint(event);
  state.curveSelection = { startX: x, startY: y, endX: x, endY: y, moved: false };
  els.curveCanvas.classList.add("selecting");
});

window.addEventListener("mousemove", (event) => {
  if (!state.curveSelection) return;
  const { x, y } = canvasPoint(event);
  state.curveSelection.endX = x;
  state.curveSelection.endY = y;
  state.curveSelection.moved = Math.abs(x - state.curveSelection.startX) > 4 || Math.abs(y - state.curveSelection.startY) > 4;
  drawCurve();
});

window.addEventListener("mouseup", (event) => {
  if (event.button !== 2 || !state.curveSelection) return;
  const selection = state.curveSelection;
  const domain = getCurveDomains();
  if (!selection.moved || !domain) {
    resetCurveView();
    return;
  }
  const rect = els.curveCanvas.getBoundingClientRect();
  const plot = { left: 58, top: 14, right: 14, bottom: 34 };
  const plotW = rect.width - plot.left - plot.right;
  const plotH = rect.height - plot.top - plot.bottom;
  const sx1 = Math.max(plot.left, Math.min(plot.left + plotW, Math.min(selection.startX, selection.endX)));
  const sx2 = Math.max(plot.left, Math.min(plot.left + plotW, Math.max(selection.startX, selection.endX)));
  const sy1 = Math.max(plot.top, Math.min(plot.top + plotH, Math.min(selection.startY, selection.endY)));
  const sy2 = Math.max(plot.top, Math.min(plot.top + plotH, Math.max(selection.startY, selection.endY)));
  if (sx2 - sx1 > 8 && sy2 - sy1 > 8) {
    const xRatio1 = (sx1 - plot.left) / plotW;
    const xRatio2 = (sx2 - plot.left) / plotW;
    const yRatioTop = (sy1 - plot.top) / plotH;
    const yRatioBottom = (sy2 - plot.top) / plotH;
    state.curveView.xStart = domain.xMin + (domain.xMax - domain.xMin) * xRatio1;
    state.curveView.xEnd = domain.xMin + (domain.xMax - domain.xMin) * xRatio2;
    state.curveView.yMax = domain.yMax - (domain.yMax - domain.yMin) * yRatioTop;
    state.curveView.yMin = domain.yMax - (domain.yMax - domain.yMin) * yRatioBottom;
  }
  state.curveSelection = null;
  els.curveCanvas.classList.remove("selecting");
  drawCurve();
});

els.terminalInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") sendTerminal();
});

els.settingsModalInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") closeNameModal(els.settingsModalInput.value);
  if (event.key === "Escape") closeNameModal(null);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    els.toolSettingsModal?.classList.add("hidden");
    els.helpModal?.classList.add("hidden");
  }
});

els.protocolAnalysisSource?.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    analyzeProtocolSource();
  }
});

window.addEventListener("resize", drawCurve);
window.addEventListener("beforeunload", disconnectSerial);

async function sendTerminal() {
  const text = els.terminalInput.value;
  if (!text) return;
  els.terminalInput.value = "";
  appendTerminal(`> ${text}\n`);
  await sendBytes(textBytes(`${text}\r`));
}

function saveText(name, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

if (window.ftUsbSerial) {
  els.browserSupport.textContent = t("nativeUsbOk");
} else if (!("serial" in navigator)) {
  els.browserSupport.textContent = window.ftTcpSerial ? t("tcpOk") : t("browserSerialNo");
} else {
  els.browserSupport.textContent = t("browserSerialOk");
}

initTransports();
renderAll();
applyToolLanguage(state.language);
updateSettingsFromStorage();
setWorkspaceView(state.workspaceView);
window.ftApp?.getVersion().then((version) => {
  if (els.appVersion) els.appVersion.textContent = `v${version}`;
});
drawCurve();
