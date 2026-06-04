const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

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
  groupName: $("#groupName"),
  importFile: $("#importFile"),
  rxCount: $("#rxCount"),
  txCount: $("#txCount"),
  toolLanguage: $("#toolLanguage"),
  maxLogLines: $("#maxLogLines"),
  maxCurvePoints: $("#maxCurvePoints"),
  timeFormat: $("#timeFormat"),
  githubRepository: $("#githubRepository"),
  autoCheckUpdates: $("#autoCheckUpdates"),
  updateStatus: $("#updateStatus"),
};

const fieldTypes = [
  ["const", "固定"],
  ["uint8", "U8"],
  ["int8", "I8"],
  ["int16", "I16"],
  ["uint16", "U16"],
  ["uint32", "U32"],
  ["int32", "I32"],
  ["float", "Float"],
  ["checksum8", "SUM8"],
  ["crc16", "CRC16"],
  ["tail", "尾"],
];

const parserTypes = [
  ["const", "固定"],
  ["uint8", "U8"],
  ["int8", "I8"],
  ["uint16", "U16"],
  ["int16", "I16"],
  ["uint32", "U32"],
  ["int32", "I32"],
  ["float", "Float"],
  ["checksum8", "SUM8"],
  ["tail", "尾"],
];

const controlTypes = [
  ["none", "无控件"],
  ["slider", "滑条"],
  ["switch", "开关"],
  ["number", "数值框"],
];

const switchModes = [
  ["toggle", "自锁"],
  ["momentary", "点动"],
];

const widgetTypes = [
  ["metric", "数值卡"],
  ["gauge", "仪表"],
  ["lamp", "指示灯"],
  ["slider", "滑条"],
  ["switch", "开关"],
];

const colors = ["#ff4d4f", "#20c997", "#46a3ff", "#f9c74f", "#b185ff", "#ff8f3d", "#5cd6d6", "#ef5da8"];

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
  language: localStorage.getItem("ftToolLanguage") || "zh",
  modalResolver: null,
  protocolAnalysis: null,
  profile: createDefaultProfile(),
  profiles: [],
  activeProfileIndex: 0,
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
  if (clean.length % 2) throw new Error("HEX长度必须是偶数");
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
  if (els.pauseReceive.checked && kind === "rx") return;
  const bytes = payload instanceof Uint8Array ? payload : null;
  const text = bytes ? (els.hexView.checked ? toHex(bytes) : bytesText(bytes)) : String(payload);
  const row = { kind, time: nowLabel(), text, css: options.css || "" };
  state.logRows.push(row);
  const max = Number(els.maxLogLines.value) || 2000;
  if (state.logRows.length > max) state.logRows.splice(0, state.logRows.length - max);
  renderLog();
  if (kind === "rx" && bytes) {
    state.rxBytes += bytes.length;
    els.rxCount.textContent = state.rxBytes;
  }
  if (kind === "tx" && bytes) {
    state.txBytes += bytes.length;
    els.txCount.textContent = state.txBytes;
  }
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
    addLog("error", "当前浏览器不支持 Web Serial，请用 Chrome/Edge 打开 localhost 页面。", { css: "error" });
    return;
  }
  try {
    state.port = await navigator.serial.requestPort();
    const baudRate = selectedBaudRate();
    await state.port.open({ baudRate });
    state.writer = state.port.writable.getWriter();
    state.connected = true;
    state.reading = true;
    els.connectBtn.textContent = "关闭";
    els.statusText.textContent = `USB串口已连接 ${baudRate}`;
    readLoop();
  } catch (err) {
    addLog("error", err.message, { css: "error" });
  }
}

async function connectNativeUsbSerial() {
  const portPath = els.portSelect.value;
  const baudRate = selectedBaudRate();
  if (!portPath) {
    addLog("error", "未找到 USB 串口，请检查设备连接和驱动。", { css: "error" });
    await refreshUsbPorts();
    return;
  }
  try {
    await window.ftUsbSerial.connect({ path: portPath, baudRate });
    state.connected = true;
    state.transport = "usb";
    els.connectBtn.textContent = "关闭";
    const selectedName = els.portSelect.selectedOptions[0]?.textContent || portPath;
    els.statusText.textContent = `USB串口已连接 ${selectedName} @ ${baudRate}`;
  } catch (err) {
    addLog("error", err.message, { css: "error" });
  }
}

async function connectTcpSerial() {
  const host = els.tcpHost.value.trim();
  const port = Number(els.tcpPort.value);
  if (!host || !port) {
    addLog("error", "请填写网络串口主机和端口。", { css: "error" });
    return;
  }
  if (!window.ftTcpSerial) {
    addLog("error", "网络串口需要在 EXE 版本中使用；浏览器预览不开放原生 TCP。", { css: "error" });
    return;
  }
  try {
    await window.ftTcpSerial.connect({ host, port });
    state.connected = true;
    state.transport = "tcp";
    els.connectBtn.textContent = "关闭";
    els.statusText.textContent = `网络串口已连接 ${host}:${port}`;
  } catch (err) {
    addLog("error", err.message, { css: "error" });
  }
}

async function connectBleSerial() {
  if (!navigator.bluetooth) {
    addLog("error", "当前环境不支持 Web Bluetooth，请使用 Chrome/Edge 或 EXE 版本。", { css: "error" });
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
    els.connectBtn.textContent = "关闭";
    els.statusText.textContent = `蓝牙串口已连接 ${state.bleDevice.name || "BLE UART"}`;
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
  els.connectBtn.textContent = "打开";
  els.statusText.textContent = "未连接";
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
  runParsers();
}

function initTransports() {
  if (window.ftUsbSerial) {
    window.ftUsbSerial.onData((bytes) => handleIncoming(new Uint8Array(bytes)));
    window.ftUsbSerial.onClose(() => {
      if (state.transport === "usb" && state.connected) {
        state.connected = false;
        els.connectBtn.textContent = "打开";
        els.statusText.textContent = "USB串口已断开";
      }
    });
    window.ftUsbSerial.onError((message) => addLog("error", message, { css: "error" }));
  }
  if (window.ftTcpSerial) {
    window.ftTcpSerial.onData((bytes) => handleIncoming(new Uint8Array(bytes)));
    window.ftTcpSerial.onClose(() => {
      if (state.transport === "tcp" && state.connected) {
        state.connected = false;
        els.connectBtn.textContent = "打开";
        els.statusText.textContent = "网络串口已断开";
      }
    });
    window.ftTcpSerial.onError((message) => addLog("error", message, { css: "error" }));
  }
  updateLinkTypeUi();
}

async function refreshUsbPorts() {
  if (els.linkType.value !== "usb") return;
  if (!window.ftUsbSerial) {
    els.portSelect.innerHTML = "<option value=\"\">浏览器串口</option>";
    return;
  }
  const previous = els.portSelect.value;
  els.portSelect.innerHTML = "<option value=\"\">正在搜索串口...</option>";
  try {
    const ports = await window.ftUsbSerial.list();
    if (!ports.length) {
      els.portSelect.innerHTML = "<option value=\"\">未发现 USB 串口</option>";
      return;
    }
    els.portSelect.innerHTML = ports
      .map((port) => `<option value="${escapeHtml(port.path)}" ${port.path === previous ? "selected" : ""}>${escapeHtml(port.label)}</option>`)
      .join("");
  } catch (err) {
    els.portSelect.innerHTML = "<option value=\"\">串口枚举失败</option>";
    addLog("error", `USB串口枚举失败: ${err.message}`, { css: "error" });
  }
}

function updateLinkTypeUi() {
  const isTcp = els.linkType.value === "tcp";
  const isUsb = els.linkType.value === "usb";
  $$(".network-field").forEach((el) => el.classList.toggle("hidden", !isTcp));
  $("#portSelect").closest("label").classList.toggle("hidden", isTcp);
  els.baudRate.closest("label").classList.toggle("hidden", !isUsb);
  updateBaudRateUi();
  if (els.linkType.value === "ble") {
    els.portSelect.innerHTML = "<option>BLE UART / Nordic NUS</option>";
  } else if (els.linkType.value === "usb") {
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
    renderMetrics();
    drawCurve();
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
    const fn = new Function("x", "Truncate", "Round", "Abs", "Min", "Max", `"use strict"; return (${expr});`);
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
    if (els.logCsv.checked) state.csvRows.push([new Date().toISOString(), name, value]);
  }
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
  const max = Number(els.maxCurvePoints.value) || 1200;
  if (points.length > max) points.splice(0, points.length - max);
}

function renderMetrics() {
  syncDashboardFromParserDefinitions();
  renderSendDashboardControls();
  els.metricGrid.innerHTML = "";
  if (!state.dashboardWidgets.length) {
    els.metricGrid.innerHTML = `<div class="dashboard-empty">请在“接收解析”字段中勾选“面板”，数据面板会自动显示。</div>`;
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
    els.sendControlGrid.innerHTML = `<div class="dashboard-empty">请在“组包发送”字段中选择控件类型。</div>`;
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
        <label class="check-inline"><input type="checkbox" data-packet-cycle-enabled="${state.cyclePacketIndex}" ${packet.cycleEnabled ? "checked" : ""}>周期发送</label>
        <label class="packet-cycle-period">周期(ms)<input type="number" min="10" step="10" value="${packet.cycleMs || 100}" data-packet-cycle-ms="${state.cyclePacketIndex}"></label>
        <button data-packet-cycle-send="${state.cyclePacketIndex}">发送</button>
      </div>`
    : `<span class="dashboard-hint">暂无发送包</span>`;
  [els.dataPacketCycleControls, els.curvePacketCycleControls].forEach((container) => {
    if (container) container.innerHTML = html;
  });
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
  const label = `${packet.name} / ${field.name || "字段"}`;
  const value = Number(field.value) || 0;
  const common = `<div class="metric-name">${escapeHtml(label)}</div>`;
  if (field.control === "switch") {
    const mode = field.switchMode || "toggle";
    if (mode === "momentary") {
      return `${common}<button class="momentary-btn widget-switch" data-dashboard-send-momentary="${key}">点动开关</button>`;
    }
    return `${common}<label class="switch widget-switch self-lock-switch"><input type="checkbox" ${value ? "checked" : ""} data-dashboard-send-switch="${key}"><span></span>自锁开关</label>`;
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
    metric: metric || "未命名",
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
  const name = widget.metric || "未绑定";
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
    return `${common}<label class="switch widget-switch"><input type="checkbox" ${numeric > 0 ? "checked" : ""}><span></span>输出</label><div class="metric-value">${escapeHtml(value)}</div>`;
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
    ctx.fillText("等待解析数据或勾选曲线通道...", plot.left + 8, plot.top + 22);
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
    ctx.fillText(`周期 Δt: ${roundValue(dt)} s`, x + 8, y + 20);
    ctx.fillText(`差值 ΔY: ${roundValue(dv)}`, x + 8, y + 38);
    ctx.fillText(`峰峰值: ${roundValue(pp)}`, x + 8, y + 54);
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
    els.curveChannelList.innerHTML = `<div class="curve-empty">暂无曲线通道</div>`;
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
      <button class="mini" data-edit-packet="${idx}">设置</button>
      <button class="mini" data-send-packet="${idx}">发送</button>
      <button class="mini danger" data-delete-packet="${idx}">删</button>`;
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
        ? `<select data-field-control="${idx}">${options(controlTypes, field.control || "none")}</select>`
        : `<span class="field-static">-</span>`;
      if (numericField && ["slider", "number"].includes(field.control)) normalizeFieldControlLimits(field);
      const limitInputs = numericField && ["slider", "number"].includes(field.control)
        ? `<div class="field-control-limits">
            <label>最小<input type="number"${limitInputAttrs(field)} value="${field.min ?? 0}" data-field-limit="${idx}:min"></label>
            <label>最大<input type="number"${limitInputAttrs(field)} value="${field.max ?? Math.max(1000, Number(field.value) || 1000)}" data-field-limit="${idx}:max"></label>
          </div>`
        : `<span class="field-static">-</span>`;
      return `
        <div class="field-row">
          <select data-field-prop="${idx}:type">${options(fieldTypes, field.type)}</select>
          <input value="${escapeHtml(field.name || "")}" data-field-prop="${idx}:name">
          <select data-field-prop="${idx}:endian"><option value="little" ${field.endian !== "big" ? "selected" : ""}>小端</option><option value="big" ${field.endian === "big" ? "selected" : ""}>大端</option></select>
          ${valueInput}
          ${controlSelect}
          ${limitInputs}
          <div class="field-actions">
            <button class="mini" data-move-field-up="${idx}" ${idx === 0 ? "disabled" : ""}>↑</button>
            <button class="mini" data-move-field-down="${idx}" ${idx === packet.fields.length - 1 ? "disabled" : ""}>↓</button>
            <button class="mini danger" data-delete-field="${idx}">删</button>
          </div>
        </div>`;
    })
    .join("");
  const bytes = safeBuildPacket(packet);
  els.packetFields.innerHTML = `
    <div class="group-row">
      <input readonly data-packet-hex-preview value="${escapeHtml(toHex(bytes))}">
      <button data-copy-packet>复制HEX</button>
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
      <strong>生成控件</strong>
      ${controls
        .map(({ field, idx }) => renderPacketControl(field, idx, packet))
        .join("")}
    </div>`;
}

function renderPacketControl(field, idx, packet) {
  const name = escapeHtml(field.name || "控制");
  const value = Number(field.value) || 0;
  if (field.control === "switch") {
    const mode = field.switchMode || "toggle";
    const switchControl = mode === "momentary"
      ? `<button class="momentary-btn" data-control-momentary="${idx}">点动</button>`
      : `<label class="switch self-lock-switch"><input type="checkbox" ${value ? "checked" : ""} data-control-switch="${idx}"><span></span>自锁</label>`;
    return `
      <div class="control-row compact-control">
        <span>${name}</span>
        ${switchControl}
        <select data-switch-mode="${idx}">${options(switchModes, mode)}</select>
        <button class="mini" data-control-send="${idx}">${packet.trigger ? "触发" : "发送"}</button>
      </div>`;
  }
  if (field.control === "number") {
    return `
      <div class="control-row compact-control">
        <span>${name}</span>
        <input type="number" min="${field.min ?? ""}" max="${field.max ?? ""}" value="${value}" data-control-number="${idx}">
        <span></span>
        <button class="mini" data-control-send="${idx}">${packet.trigger ? "触发" : "发送"}</button>
      </div>`;
  }
  return `
    <div class="control-row">
      <span>${name}</span>
      <input type="range" min="${field.min ?? 0}" max="${field.max ?? 1000}" step="${sliderStep(field)}" value="${value}" data-control-field="${idx}">
      <input type="number" min="${field.min ?? ""}" max="${field.max ?? ""}" value="${value}" data-control-number="${idx}">
      <button class="mini" data-control-send="${idx}">${packet.trigger ? "触发" : "发送"}</button>
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
      <button class="mini" data-edit-parser="${idx}">设置</button>
      <button class="mini" data-clone-parser="${idx}">复制</button>
      <button class="mini danger" data-delete-parser="${idx}">删</button>`;
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
          ? `<input value="自动校验" disabled>`
          : (!field.show && !field.curve && typeof field.value === "number")
            ? `<input type="number" value="${field.value}" data-parser-prop="${idx}:value">`
            : `<input value="${escapeHtml(field.expr || "")}" placeholder="公式: x / 10" data-parser-prop="${idx}:expr">`;
      const widgetSelect = field.show
        ? `<select data-parser-widget="${idx}">${options(widgetTypes, field.widget || "metric")}</select>`
        : `<span class="field-static">-</span>`;
      return `
        <div class="parser-row">
          <select data-parser-prop="${idx}:type">${options(parserTypes, field.type)}</select>
          <input value="${escapeHtml(field.name || "")}" data-parser-prop="${idx}:name">
          <select data-parser-prop="${idx}:endian"><option value="little" ${field.endian !== "big" ? "selected" : ""}>小端</option><option value="big" ${field.endian === "big" ? "selected" : ""}>大端</option></select>
          ${valueInput}
          <label class="check-inline"><input type="checkbox" ${field.show ? "checked" : ""} data-parser-check="${idx}:show">面板</label>
          <label class="check-inline"><input type="checkbox" ${field.curve ? "checked" : ""} data-parser-check="${idx}:curve">曲线</label>
          ${widgetSelect}
          <div class="field-actions">
            <button class="mini" data-move-parser-field-up="${idx}" ${idx === 0 ? "disabled" : ""}>↑</button>
            <button class="mini" data-move-parser-field-down="${idx}" ${idx === parser.fields.length - 1 ? "disabled" : ""}>↓</button>
            <button class="mini danger" data-delete-parser-field="${idx}">删</button>
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
    .map((profile, idx) => `<option value="${idx}" ${idx === state.activeProfileIndex ? "selected" : ""}>${escapeHtml(profile.groupName || `协议组 ${idx + 1}`)}</option>`)
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
  state.profile.groupName = name.trim() || "未命名协议组";
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
  els.groupName.value = state.profile.groupName;
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
  const name = await openNameModal("发送包设置", packet.name || "");
  if (name == null) return;
  packet.name = name.trim() || "未命名发送包";
  state.activePacket = index;
  renderAll();
}

async function editParserSettings(index) {
  const parser = state.profile.parsers[index];
  if (!parser) return;
  const name = await openNameModal("解析规则设置", parser.name || "");
  if (name == null) return;
  parser.name = name.trim() || "未命名解析规则";
  state.activeParser = index;
  renderAll();
}

function exportProfile() {
  state.profile.groupName = els.groupName.value || "未命名";
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
      addLog("parsed", `已导入协议组: ${state.profile.groupName}`, { css: "parsed" });
    } catch (err) {
      addLog("error", `导入失败: ${err.message}`, { css: "error" });
    }
  };
  reader.readAsText(file, "utf-8");
}

function normalizeProfile(data) {
  if (Array.isArray(data) && data[0]?.CycleSendList) return convertJcomProfile(data[0]);
  if (data?.packets && data?.parsers) return data;
  throw new Error("不支持的配置格式");
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
    name: field.CreateControl?.Name || "数据",
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
    name: dc.Name || "数据",
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
  els.protocolAnalysisStatus.textContent = "等待粘贴协议代码";
  els.protocolAnalysisStatus.className = "protocol-analysis-status";
  els.protocolAnalysisResult.innerHTML = "";
  els.protocolAnalysisName.value = `AI解析协议 ${new Date().toLocaleTimeString("zh-CN", { hour12: false })}`;
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
    els.protocolAnalysisStatus.textContent = `解析完成 · 可信度 ${result.analysis.confidence}`;
    els.protocolAnalysisStatus.className = "protocol-analysis-status success";
    renderProtocolAnalysisResult(result);
  } catch (error) {
    state.protocolAnalysis = null;
    els.protocolAnalysisImport.disabled = true;
    els.protocolAnalysisStatus.textContent = `解析失败：${error.message}`;
    els.protocolAnalysisStatus.className = "protocol-analysis-status error";
    els.protocolAnalysisResult.innerHTML = "";
  }
}

function renderProtocolAnalysisResult(result) {
  const { profile, analysis } = result;
  const packetItems = profile.packets.map((packet) => `
    <li><strong>${escapeHtml(packet.name)}</strong><span>${packet.fields.length} 个字段</span></li>`).join("");
  const parserItems = profile.parsers.map((parser) => `
    <li><strong>${escapeHtml(parser.name)}</strong><span>${parser.fields.length} 个字段</span></li>`).join("");
  const findings = analysis.findings.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const notes = analysis.notes.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  els.protocolAnalysisResult.innerHTML = `
    <div class="protocol-analysis-summary">
      <span>来源：${escapeHtml(analysis.sourceType)}</span>
      <span>发送包：${profile.packets.length}</span>
      <span>接收规则：${profile.parsers.length}</span>
    </div>
    <section><h3>解析分析</h3><ul>${findings}</ul></section>
    <div class="protocol-preview-grid">
      <section><h3>发送组包</h3><ul class="protocol-preview-list">${packetItems || "<li>未识别到发送包</li>"}</ul></section>
      <section><h3>接收解析</h3><ul class="protocol-preview-list">${parserItems || "<li>未识别到接收规则</li>"}</ul></section>
    </div>
    <section class="protocol-analysis-notes"><h3>导入提示</h3><ul>${notes}</ul></section>`;
}

function importAnalyzedProtocol() {
  if (!state.protocolAnalysis?.profile) return;
  stopAllPacketCycles();
  const profile = structuredClone(state.protocolAnalysis.profile);
  profile.groupName = els.protocolAnalysisName.value.trim() || profile.groupName || "AI解析协议";
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
  addLog("parsed", `协议解析已导入: ${profile.groupName}`, { css: "parsed" });
}

function bytesToNumber(bytes, bigEndian) {
  const arr = [...bytes];
  const ordered = bigEndian ? arr : arr.reverse();
  return ordered.reduce((sum, b) => (sum << 8) + b, 0);
}

function appendTerminal(text) {
  els.terminalView.textContent += text;
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
    els.demoBtn.textContent = "模拟数据";
    return;
  }
  state.demoTimer = setInterval(demoTick, 120);
  els.demoBtn.textContent = "停止模拟";
}

const helpText = {
  zh: {
    title: "中文帮助",
    lines: [
      "USB串口用于普通 COM 口设备；蓝牙串口用于 BLE UART 透传；网络串口用于 TCP Client。",
      "组包发送中，字段可设置为滑条、开关或数值框控件，控件改变会同步字段值和 HEX 预览。",
      "接收解析中，勾选“面板”的字段会自动出现在数据面板；勾选“曲线”的字段会进入实时曲线。",
      "曲线支持 Ctrl+滚轮缩放时间轴，Shift+滚轮缩放数值轴，右键框选放大，右键单击复位。"
    ],
  },
  en: {
    title: "Help",
    lines: [
      "USB Serial is for COM devices; Bluetooth Serial is for BLE UART; Network Serial is a TCP client.",
      "Packet fields can generate sliders, switches, or numeric controls. Control changes update field values and HEX preview.",
      "Fields checked for Panel appear in the dashboard. Fields checked for Curve are plotted in the realtime chart.",
      "Use Ctrl+wheel to zoom the time axis, Shift+wheel to zoom the value axis, right-drag to zoom a region, and right-click to reset."
    ],
  },
  ja: {
    title: "ヘルプ",
    lines: [
      "USBシリアルはCOMデバイス用、BluetoothシリアルはBLE UART用、ネットワークシリアルはTCPクライアント用です。",
      "送信フィールドはスライダー、スイッチ、数値入力にできます。操作するとフィールド値とHEXプレビューが更新されます。",
      "受信解析で「面板」を有効にしたフィールドはデータパネルに表示され、「曲线」を有効にしたフィールドはリアルタイム波形に表示されます。",
      "Ctrl+ホイールで時間軸、Shift+ホイールで値軸を拡大縮小できます。右ドラッグで範囲拡大、右クリックでリセットします。"
    ],
  },
  ko: {
    title: "도움말",
    lines: [
      "USB 시리얼은 COM 장치용, 블루투스 시리얼은 BLE UART용, 네트워크 시리얼은 TCP 클라이언트용입니다.",
      "송신 필드는 슬라이더, 스위치, 숫자 입력 컨트롤로 만들 수 있으며 값 변경 시 필드와 HEX 미리보기가 함께 갱신됩니다.",
      "수신解析에서 패널 표시를 선택한 필드는 데이터 패널에 표시되고, 곡선을 선택한 필드는 실시간 파형에 표시됩니다.",
      "Ctrl+휠은 시간축 확대/축소, Shift+휠은 값축 확대/축소입니다. 우클릭 드래그는 영역 확대, 우클릭은 초기화입니다."
    ],
  },
};

function renderHelp() {
  const lang = els.helpLanguage?.value || "zh";
  const content = helpText[lang] || helpText.zh;
  const about = lang === "en"
    ? { title: "Software Information", author: "Author", company: "Company", website: "Website" }
    : { title: "软件信息", author: "作者", company: "公司", website: "公司网址" };
  els.helpContent.innerHTML = `
    <h3>${escapeHtml(content.title)}</h3>
    ${content.lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
    <section class="help-about">
      <strong>${about.title}</strong>
      <div><span>${about.author}</span><b>L.S</b></div>
      <div><span>${about.company}</span><b>峰岹科技(青岛)有限公司</b></div>
      <div><span>${about.website}</span><a href="https://www.fortiortech.com/" target="_blank" rel="noreferrer">www.fortiortech.com</a></div>
    </section>`;
}

const toolText = {
  zh: {
    buttons: {
      "#connectBtn": "打开", "#demoBtn": "模拟数据", "#clearLogBtn": "清空", "#saveLogBtn": "保存数据",
      "#importBtn": "导入", "#exportBtn": "导出", "#renameProfileBtn": "重命名", "#newProfileBtn": "新建",
      "#addPacketBtn": "添加包", "#addFieldBtn": "加字段", "#addParserBtn": "添加规则", "#addParserFieldBtn": "加字段",
      "#pauseCurveBtn": "暂停曲线", "#clearCurveBtn": "清空曲线", "#measureCurveBtn": "测量", "#expandCurveBtn": "放大",
      "#sendRawBtn": "发送", "#clearSendBtn": "清空", "#terminalSendBtn": "发送", "#terminalClearBtn": "清空",
    },
    tabs: ["数据面板", "实时曲线", "组包发送", "接收解析"],
    labels: { link: "链路", port: "串口", baud: "波特率", toolLanguage: "工具语言", timeFormat: "时间戳格式", maxLog: "最大日志行数", maxCurve: "曲线缓存点数", encoding: "默认接收编码" },
    panels: ["接收区", "协议组", "发送区"],
    checks: { hexView: "HEX显示", autoScroll: "自动滚动", pauseReceive: "暂停", sendHex: "HEX发送", cycleSend: "周期发送", appendNewline: "回车发送", logCsv: "CSV缓存" },
    settingsTitle: "工具设置",
  },
  en: {
    buttons: {
      "#connectBtn": "Open", "#demoBtn": "Demo Data", "#clearLogBtn": "Clear", "#saveLogBtn": "Save Data",
      "#importBtn": "Import", "#exportBtn": "Export", "#renameProfileBtn": "Rename", "#newProfileBtn": "New",
      "#addPacketBtn": "Add Packet", "#addFieldBtn": "Add Field", "#addParserBtn": "Add Rule", "#addParserFieldBtn": "Add Field",
      "#pauseCurveBtn": "Pause Curve", "#clearCurveBtn": "Clear Curve", "#measureCurveBtn": "Measure", "#expandCurveBtn": "Expand",
      "#sendRawBtn": "Send", "#clearSendBtn": "Clear", "#terminalSendBtn": "Send", "#terminalClearBtn": "Clear",
    },
    tabs: ["Dashboard", "Realtime Curve", "Packet Send", "Receive Parser"],
    labels: { link: "Link", port: "Port", baud: "Baud Rate", toolLanguage: "Tool Language", timeFormat: "Timestamp Format", maxLog: "Maximum Log Lines", maxCurve: "Curve Buffer Points", encoding: "Default Receive Encoding" },
    panels: ["Receive", "Protocol Group", "Send"],
    checks: { hexView: "HEX View", autoScroll: "Auto Scroll", pauseReceive: "Pause", sendHex: "HEX Send", cycleSend: "Cycle Send", appendNewline: "Append CR", logCsv: "CSV Buffer" },
    settingsTitle: "Tool Settings",
  },
};

function setLabelText(element, text) {
  if (!element) return;
  const node = [...element.childNodes].find((child) => child.nodeType === Node.TEXT_NODE && child.textContent.trim());
  if (node) node.textContent = `${text} `;
}

function applyToolLanguage(language, notifyMain = true) {
  const lang = language === "en" ? "en" : "zh";
  const text = toolText[lang];
  state.language = lang;
  localStorage.setItem("ftToolLanguage", lang);
  document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
  if (els.toolLanguage) els.toolLanguage.value = lang;
  Object.entries(text.buttons).forEach(([selector, value]) => {
    const button = document.querySelector(selector);
    if (button && !button.classList.contains("active")) button.textContent = value;
  });
  document.querySelectorAll(".small-tab").forEach((button, index) => {
    if (text.tabs[index]) button.textContent = text.tabs[index];
  });
  setLabelText(els.linkType?.closest("label"), text.labels.link);
  setLabelText(els.portSelect?.closest("label"), text.labels.port);
  setLabelText(els.baudRate?.closest("label"), text.labels.baud);
  setLabelText(els.toolLanguage?.closest("label"), text.labels.toolLanguage);
  setLabelText(els.timeFormat?.closest("label"), text.labels.timeFormat);
  setLabelText(els.maxLogLines?.closest("label"), text.labels.maxLog);
  setLabelText(els.maxCurvePoints?.closest("label"), text.labels.maxCurve);
  setLabelText($("#textEncoding")?.closest("label"), text.labels.encoding);
  [".receive-panel .panel-title", ".side-panel .panel-title", ".send-panel .panel-title"].forEach((selector, index) => {
    const title = document.querySelector(selector);
    if (title) title.textContent = text.panels[index];
  });
  Object.entries(text.checks).forEach(([id, value]) => setLabelText(document.getElementById(id)?.closest("label"), value));
  const linkOptions = lang === "en" ? ["USB Serial", "Bluetooth Serial", "Network Serial"] : ["USB串口", "蓝牙串口", "网络串口"];
  [...els.linkType.options].forEach((option, index) => { if (linkOptions[index]) option.textContent = linkOptions[index]; });
  if (els.profileMode) {
    els.profileMode.options[0].textContent = lang === "en" ? "Custom Protocol" : "自定义协议";
    els.profileMode.options[1].textContent = lang === "en" ? "Fixed Protocol" : "固定协议";
  }
  const settingsTitle = document.querySelector(".settings-panel h2");
  if (settingsTitle) settingsTitle.textContent = text.settingsTitle;
  if (els.helpLanguage) {
    els.helpLanguage.value = lang;
    renderHelp();
  }
  if (notifyMain) window.ftApp?.setLanguage(lang);
}

function updateSettingsFromStorage() {
  const repository = localStorage.getItem("ftGitHubRepository") || "https://github.com/1052970753-hue/FTSerialTool";
  const autoCheck = localStorage.getItem("ftAutoCheckUpdates") !== "false";
  if (els.githubRepository) els.githubRepository.value = repository;
  if (els.autoCheckUpdates) els.autoCheckUpdates.checked = autoCheck;
  window.ftApp?.configureUpdates({ repository, autoCheck });
}

function saveUpdateSettings() {
  const repository = els.githubRepository?.value.trim() || "";
  const autoCheck = els.autoCheckUpdates?.checked !== false;
  localStorage.setItem("ftGitHubRepository", repository);
  localStorage.setItem("ftAutoCheckUpdates", String(autoCheck));
  window.ftApp?.configureUpdates({ repository, autoCheck });
  if (els.updateStatus) els.updateStatus.textContent = repository ? "GitHub 更新设置已保存" : "请填写 GitHub 仓库地址";
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

window.ftApp?.onMode((mode) => setAppMode(mode));
window.ftApp?.onSettings(() => els.toolSettingsModal?.classList.remove("hidden"));
window.ftApp?.onHelp(() => {
  renderHelp();
  els.helpModal?.classList.remove("hidden");
});
window.ftApp?.onProtocolAnalysis(openProtocolAnalysis);
window.ftApp?.onLanguage((language) => applyToolLanguage(language, false));
window.ftApp?.onUpdateStatus((status) => {
  if (els.updateStatus) els.updateStatus.textContent = status?.message || "更新状态未知";
});

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
  if (target.id === "sendRawBtn") sendRaw();
  if (target.id === "clearSendBtn") els.sendText.value = "";
  if (target.id === "terminalSendBtn") sendTerminal();
  if (target.id === "terminalClearBtn") els.terminalView.textContent = "";
  if (target.id === "settingsModalCancel") closeNameModal(null);
  if (target.id === "settingsModalOk") closeNameModal(els.settingsModalInput.value);
  if (target.id === "toolSettingsClose" || target.id === "toolSettingsModal") els.toolSettingsModal?.classList.add("hidden");
  if (target.id === "helpClose" || target.id === "helpModal") els.helpModal?.classList.add("hidden");
  if (target.id === "protocolAnalysisClose") closeProtocolAnalysis();
  if (target.id === "protocolAnalyzeBtn") analyzeProtocolSource();
  if (target.id === "protocolAnalysisImport") importAnalyzedProtocol();
  if (target.id === "checkUpdatesBtn") {
    saveUpdateSettings();
    window.ftApp?.checkUpdates();
  }
  if (target.dataset.packetCycleSend !== undefined) {
    const packetIndex = Number(target.dataset.packetCycleSend);
    const packet = state.profile.packets[packetIndex];
    if (packet) sendBytes(buildPacket(packet), packet.name);
  }
  if (target.id === "pauseCurveBtn") {
    state.curvePaused = !state.curvePaused;
    els.pauseCurveBtn.textContent = state.curvePaused ? "继续曲线" : "暂停曲线";
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
    target.textContent = state.measuring ? "退出测量" : "测量";
    drawCurve();
  }
  if (target.id === "expandCurveBtn") {
    state.curveExpanded = !state.curveExpanded;
    $("#curveEditor")?.classList.toggle("curve-expanded", state.curveExpanded);
    els.expandCurveBtn.textContent = state.curveExpanded ? "恢复" : "放大";
    setTimeout(drawCurve, 60);
  }
  if (target.id === "importBtn") els.importFile.click();
  if (target.id === "exportBtn") exportProfile();
  if (target.id === "renameProfileBtn") {
    openNameModal("协议组重命名", state.profile.groupName || "").then((name) => {
      if (name == null) return;
      setProfileName(name);
      renderAll();
    });
  }
  if (target.id === "newProfileBtn") {
    stopAllPacketCycles();
    const profile = createDefaultProfile();
    profile.groupName = `新协议组 ${new Date().toLocaleTimeString("zh-CN", { hour12: false })}`;
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
    state.profile.packets[state.activePacket]?.fields.push({ type: "uint8", name: "数据", value: 0, endian: "little", control: "none" });
    renderAll();
  }
  if (target.id === "addParserBtn") {
    state.profile.parsers.push(structuredClone(createDefaultProfile().parsers[0]));
    state.activeParser = state.profile.parsers.length - 1;
    renderAll();
  }
  if (target.id === "addParserFieldBtn") {
    state.profile.parsers[state.activeParser]?.fields.push({ type: "uint16", name: "数据", endian: "big", show: true, curve: false, widget: "metric", expr: "x" });
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
    state.profile.packets[state.activePacket].fields.push({ type: "uint8", name: "数据", value: 0, endian: "little", control: "none" });
    renderAll();
  }
  if (target.dataset.copyPacket !== undefined) navigator.clipboard?.writeText(toHex(buildPacket(state.profile.packets[state.activePacket])));
  if (target.dataset.addParserField !== undefined) {
    state.profile.parsers[state.activeParser].fields.push({ type: "uint16", name: "数据", endian: "big", show: true, curve: false, widget: "metric", expr: "x" });
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
  if (target.id === "groupName") setProfileName(target.value);
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
    els.measureCurveBtn.textContent = "测量";
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
  els.browserSupport.textContent = "原生USB串口可用";
} else if (!("serial" in navigator)) {
  els.browserSupport.textContent = window.ftTcpSerial ? "网络串口可用" : "浏览器串口不可用";
} else {
  els.browserSupport.textContent = "浏览器串口可用";
}

initTransports();
renderAll();
applyToolLanguage(state.language);
updateSettingsFromStorage();
drawCurve();
