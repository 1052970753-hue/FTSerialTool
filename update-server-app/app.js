const $ = (selector) => document.querySelector(selector);
let currentState = { running: false, addresses: [], stats: {}, config: {} };

function formatBytes(value) {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function render(state) {
  currentState = { ...currentState, ...state };
  const { config = {}, stats = {}, running, addresses = [] } = currentState;
  $("#version").value = config.version || "";
  $("#port").value = config.port || 8765;
  $("#filePath").value = config.filePath || "";
  $("#notes").value = config.notes || "";
  $("#autoStart").checked = Boolean(config.autoStart);
  $(".server-state").classList.toggle("running", running);
  $("#stateText").textContent = running ? "运行中" : "已停止";
  $("#toggleBtn").textContent = running ? "停止服务" : "启动服务";
  $("#requests").textContent = stats.requests || 0;
  $("#downloads").textContent = stats.downloads || 0;
  $("#active").textContent = stats.active || 0;
  $("#bytes").textContent = formatBytes(stats.bytes);
  $("#footerStatus").textContent = state.error || state.message || (running ? "客户端可以连接更新服务" : "更新服务未启动");
  $("#addresses").innerHTML = addresses.length
    ? addresses.map((address) => `<div class="address"><span>${address}</span><button data-copy="${address}">复制</button></div>`).join("")
    : "<span>服务启动后显示地址</span>";
}

function formConfig() {
  return {
    version: $("#version").value.trim(),
    port: Number($("#port").value) || 8765,
    filePath: $("#filePath").value,
    notes: $("#notes").value.trim(),
    autoStart: $("#autoStart").checked,
    publishedAt: new Date().toISOString(),
  };
}

$("#chooseFile").addEventListener("click", async () => render({ config: await window.ftUpdateServer.chooseFile() }));
$("#openFile").addEventListener("click", () => window.ftUpdateServer.openFile());
$("#saveBtn").addEventListener("click", async () => {
  const config = await window.ftUpdateServer.save(formConfig());
  render({ config, message: "发布配置已保存" });
});
$("#toggleBtn").addEventListener("click", async () => {
  try {
    await window.ftUpdateServer.save(formConfig());
    await (currentState.running ? window.ftUpdateServer.stop() : window.ftUpdateServer.start());
  } catch (error) {
    render({ error: error.message });
  }
});
document.addEventListener("click", (event) => {
  if (event.target.dataset.copy) navigator.clipboard.writeText(event.target.dataset.copy);
});
window.ftUpdateServer.onState(render);
window.ftUpdateServer.getState().then(render);
