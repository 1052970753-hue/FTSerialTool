#!/usr/bin/env node
"use strict";

/**
 * FTSerialTool Update Server
 * 双击运行，自动从 GitHub Release 拉取最新版本，供客户端更新
 */

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { exec } = require("child_process");

// ══════════════════════════════════════════════════════════════
//  配置
// ══════════════════════════════════════════════════════════════

// pkg 编译后 process.execPath 指向 exe，node 运行时指向 node 二进制
const isPackaged = process.pkg !== undefined;
const EXE_DIR = isPackaged
  ? path.dirname(process.execPath)
  : path.resolve(__dirname);
const CONFIG_FILE = path.join(EXE_DIR, "update-server-config.json");
const CACHE_DIR = path.join(EXE_DIR, "cache");
const LOG_FILE = path.join(EXE_DIR, "update-server.log");

const defaultConfig = {
  port: 8765,
  githubRepo: "1052970753-hue/FTSerialTool",
  checkInterval: 300, // 秒，每5分钟检查一次
  autoOpenBrowser: true,
};

function loadConfig() {
  try {
    return { ...defaultConfig, ...JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")) };
  } catch {
    return { ...defaultConfig };
  }
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

let config = loadConfig();
let adminToken = crypto.randomBytes(24).toString("hex");

if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

// ══════════════════════════════════════════════════════════════
//  日志
// ══════════════════════════════════════════════════════════════

const logStream = fs.createWriteStream(LOG_FILE, { flags: "a" });
function log(level, msg) {
  const ts = new Date().toLocaleString("zh-CN");
  const line = `[${ts}] [${level}] ${msg}`;
  console.log(line);
  logStream.write(line + "\n");
}

// ══════════════════════════════════════════════════════════════
//  工具函数
// ══════════════════════════════════════════════════════════════

function localAddresses() {
  return Object.values(os.networkInterfaces()).flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal)
    .map((i) => i.address);
}

function openBrowser(url) {
  const cmd = process.platform === "win32" ? `start "" "${url}"` : process.platform === "darwin" ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { "User-Agent": "FTUpdateServer/1.0", Accept: "application/vnd.github+json" },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpsGet(res.headers.location).then(resolve, reject);
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(Buffer.concat(chunks).toString()) }); }
        catch { resolve({ status: res.statusCode, data: Buffer.concat(chunks) }); }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

function httpsDownload(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const doRequest = (u) => {
      const req = https.get(u, {
        headers: { "User-Agent": "FTUpdateServer/1.0" },
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return doRequest(res.headers.location);
        }
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        const total = Number(res.headers["content-length"]) || 0;
        const file = fs.createWriteStream(dest);
        let received = 0;
        res.on("data", (c) => {
          received += c.length;
          file.write(c);
          if (onProgress) onProgress(received, total);
        });
        res.on("end", () => { file.end(); resolve(received); });
        res.on("error", reject);
        file.on("error", reject);
      });
      req.on("error", reject);
    };
    doRequest(url);
  });
}

function versionParts(v) {
  return String(v || "").replace(/^v/i, "").split(/[.-]/).map(Number);
}

function isNewer(latest, current) {
  const a = versionParts(latest), b = versionParts(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
  }
  return false;
}

// ══════════════════════════════════════════════════════════════
//  GitHub Release 同步
// ══════════════════════════════════════════════════════════════

let currentRelease = null; // { version, notes, filePath, publishedAt, size }
let syncStatus = "idle"; // idle | checking | downloading | done | error
let syncMessage = "";
let downloadProgress = 0;

function getCachedFile() {
  if (!fs.existsSync(CACHE_DIR)) return null;
  const files = fs.readdirSync(CACHE_DIR)
    .filter((f) => /\.(exe|zip)$/i.test(f))
    .map((f) => ({
      name: f,
      path: path.join(CACHE_DIR, f),
      mtime: fs.statSync(path.join(CACHE_DIR, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);
  return files.length > 0 ? files[0] : null;
}

function getCachedVersion() {
  const vFile = path.join(CACHE_DIR, "version.txt");
  try { return fs.readFileSync(vFile, "utf8").trim(); } catch { return "0.0.0"; }
}

function setCachedVersion(v) {
  fs.writeFileSync(path.join(CACHE_DIR, "version.txt"), v);
}

async function syncFromGitHub() {
  if (syncStatus === "checking" || syncStatus === "downloading") return;
  syncStatus = "checking";
  syncMessage = "正在检查 GitHub Release...";
  log("INFO", `检查 GitHub Release: ${config.githubRepo}`);

  try {
    const { status, data } = await httpsGet(`https://api.github.com/repos/${config.githubRepo}/releases/latest`);
    if (status !== 200) throw new Error(`GitHub API 返回 ${status}`);

    const latestVersion = (data.tag_name || data.name || "").replace(/^v/i, "");
    const cachedVersion = getCachedVersion();
    log("INFO", `GitHub 版本: ${latestVersion}, 本地缓存: ${cachedVersion}`);

    if (!isNewer(latestVersion, cachedVersion)) {
      syncStatus = "done";
      syncMessage = `已是最新版本 ${cachedVersion}`;
      // 确保 currentRelease 正确
      const cached = getCachedFile();
      if (cached && !currentRelease) {
        currentRelease = {
          version: cachedVersion,
          notes: data.body || "",
          filePath: cached.path,
          publishedAt: data.published_at || new Date().toISOString(),
          size: fs.statSync(cached.path).size,
        };
      }
      log("INFO", "无需更新");
      return;
    }

    // 找到最佳下载资产
    const assets = data.assets || [];
    const asset = assets.find((a) => /portable.*\.exe$/i.test(a.name))
      || assets.find((a) => /\.exe$/i.test(a.name))
      || assets.find((a) => /\.zip$/i.test(a.name));
    if (!asset) throw new Error("Release 中未找到可下载的文件");

    syncStatus = "downloading";
    syncMessage = `正在下载 ${asset.name} (${(asset.size / 1048576).toFixed(1)} MB)`;
    downloadProgress = 0;
    log("INFO", `开始下载: ${asset.name} (${(asset.size / 1048576).toFixed(1)} MB)`);

    const destPath = path.join(CACHE_DIR, asset.name);
    await httpsDownload(asset.browser_download_url, destPath, (received, total) => {
      downloadProgress = total ? received / total : 0;
      const mb = (received / 1048576).toFixed(1);
      const totalMB = total ? (total / 1048576).toFixed(1) : "?";
      syncMessage = `正在下载 ${asset.name} ${mb}/${totalMB} MB (${Math.round(downloadProgress * 100)}%)`;
    });

    // 下载完成，更新缓存
    setCachedVersion(latestVersion);
    currentRelease = {
      version: latestVersion,
      notes: data.body || "",
      filePath: destPath,
      publishedAt: data.published_at || new Date().toISOString(),
      size: asset.size,
    };

    syncStatus = "done";
    syncMessage = `已更新到 ${latestVersion}`;
    log("INFO", `下载完成: ${asset.name}, 版本 ${latestVersion}`);

    // 清理旧文件
    fs.readdirSync(CACHE_DIR).forEach((f) => {
      if (f !== asset.name && f !== "version.txt" && /\.(exe|zip)$/i.test(f)) {
        try { fs.unlinkSync(path.join(CACHE_DIR, f)); log("INFO", `清理旧文件: ${f}`); } catch {}
      }
    });

  } catch (err) {
    syncStatus = "error";
    syncMessage = `同步失败: ${err.message}`;
    log("ERROR", `同步失败: ${err.message}`);
  }
}

// ══════════════════════════════════════════════════════════════
//  HTTP 服务器
// ══════════════════════════════════════════════════════════════

const stats = { requests: 0, downloads: 0, active: 0, bytes: 0, startedAt: Date.now() };
const basePath = "/FTSerialTool";

function sendJson(res, status, value) {
  const body = Buffer.from(JSON.stringify(value));
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": body.length, "Cache-Control": "no-cache", "Access-Control-Allow-Origin": "*" });
  res.end(body);
}

function sendHtml(res, status, html) {
  const body = Buffer.from(html);
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8", "Content-Length": body.length, "Cache-Control": "no-cache" });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => { const c = []; req.on("data", d => c.push(d)); req.on("end", () => resolve(Buffer.concat(c))); });
}

function checkAdmin(req) {
  return new URL(req.url, "http://localhost").searchParams.get("token") === adminToken;
}

function sendFile(req, res, filePath) {
  const stat = fs.statSync(filePath);
  const range = req.headers.range;
  const headers = { "Accept-Ranges": "bytes", "Content-Type": "application/octet-stream", "Cache-Control": "no-cache", "Access-Control-Allow-Origin": "*" };
  let start = 0, end = stat.size - 1, code = 200;
  if (range) {
    const m = /^bytes=(\d+)-(\d*)$/.exec(range);
    if (m) { start = Number(m[1]); end = m[2] ? Math.min(Number(m[2]), stat.size - 1) : stat.size - 1; code = 206; headers["Content-Range"] = `bytes ${start}-${end}/${stat.size}`; }
  }
  res.writeHead(code, { ...headers, "Content-Length": end - start + 1 });
  if (req.method === "HEAD") return res.end();
  stats.downloads++; stats.active++;
  const input = fs.createReadStream(filePath, { start, end });
  input.on("data", (c) => { stats.bytes += c.length; });
  input.on("close", () => { stats.active = Math.max(0, stats.active - 1); });
  input.pipe(res);
}

// ══════════════════════════════════════════════════════════════
//  管理页面
// ══════════════════════════════════════════════════════════════

function adminPage() {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>FTUpdateServer 管理</title><style>
*{box-sizing:border-box;margin:0;padding:0}body{font-family:"Microsoft YaHei UI","Segoe UI",sans-serif;background:#f0f2f5;color:#1a1a2e;min-height:100vh}
.shell{max-width:860px;margin:0 auto;padding:24px}
header{display:flex;align-items:center;justify-content:space-between;padding:20px 0;border-bottom:2px solid #e0e0e0;margin-bottom:24px}
.brand{display:flex;align-items:center;gap:12px}.brand span{width:42px;height:42px;display:grid;place-items:center;background:linear-gradient(135deg,#008f86,#00b4d8);color:#fff;font-weight:800;border-radius:10px;font-size:16px}
.brand h1{font-size:20px}.brand p{color:#666;font-size:13px}
.status{display:flex;align-items:center;gap:8px}.dot{width:10px;height:10px;border-radius:50%;background:#ccc}.dot.on{background:#18a058;box-shadow:0 0 8px #18a058aa}.dot.sync{background:#f9c74f;box-shadow:0 0 8px #f9c74faa}.dot.err{background:#cc3b3b}
.card{background:#fff;border-radius:12px;padding:20px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,.06)}
.card h2{font-size:15px;margin-bottom:14px;color:#333;border-bottom:1px solid #eee;padding-bottom:8px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.grid-4{grid-template-columns:repeat(4,1fr)}
.stat{text-align:center;padding:14px 8px;background:#f8fafb;border-radius:8px}.stat span{display:block;font-size:12px;color:#888;margin-bottom:4px}.stat strong{font-size:20px;color:#008f86}
label{display:block;margin-bottom:10px;font-size:13px;color:#555}label input{width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;margin-top:4px}
.btn{padding:8px 18px;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;transition:.2s}
.primary{background:#008f86;color:#fff}.primary:hover{background:#00756e}.ghost{background:#fff;border:1px solid #ddd;color:#333}.ghost:hover{background:#f5f5f5}.danger{background:#cc3b3b;color:#fff}.danger:hover{background:#a82e2e}
.addr{display:flex;align-items:center;gap:8px;padding:8px 12px;background:#f8fafb;border-radius:6px;margin-bottom:6px;font-family:Consolas,monospace;font-size:13px}
.addr button{margin-left:auto;font-size:12px;padding:4px 10px}
.toast{position:fixed;top:20px;right:20px;padding:12px 20px;border-radius:8px;color:#fff;font-size:13px;z-index:999;opacity:0;transition:.3s;transform:translateY(-10px)}
.toast.show{opacity:1;transform:translateY(0)}.toast.ok{background:#18a058}.toast.err{background:#cc3b3b}
.token-row{display:flex;gap:8px;align-items:center;margin-bottom:12px}
.token-row input{flex:1;font-family:Consolas,monospace}
.progress{background:#eee;border-radius:4px;height:8px;overflow:hidden;margin:8px 0}.progress-bar{background:#008f86;height:100%;width:0;transition:.3s}
.release-info{padding:12px 16px;background:#f0faf9;border-radius:8px;border-left:4px solid #008f86;margin-bottom:12px}
.release-info strong{color:#008f86}.release-info p{font-size:12px;color:#666;margin-top:4px}
footer{text-align:center;padding:20px 0;color:#aaa;font-size:12px;margin-top:20px}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.tag{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600}
.tag.ok{background:#e4f5f3;color:#008f86}.tag.sync{background:#fff3d8;color:#d38a00}.tag.err{background:#fde8e8;color:#cc3b3b}.tag.idle{background:#f0f0f0;color:#888}
</style></head><body>
<div class="shell">
<header><div class="brand"><span>FT</span><div><h1>FTUpdateServer</h1><p>自动同步 GitHub Release</p></div></div>
<div class="status"><div class="dot" id="dot"></div><strong id="stateText">检查中...</strong></div></header>

<div class="card"><h2>管理员认证</h2>
<div class="token-row"><input id="tokenInput" placeholder="输入管理 Token" type="password"><button class="btn ghost" onclick="toggleToken()">显示</button><button class="btn primary" onclick="saveToken()">保存</button></div></div>

<div class="card"><h2>同步状态</h2>
<div id="syncInfo" class="release-info"><strong>检查中...</strong></div>
<div class="progress"><div class="progress-bar" id="progressBar"></div></div>
<div class="row"><span id="syncTag" class="tag idle">idle</span><span id="syncMsg" style="font-size:12px;color:#888"></span></div>
<div class="row" style="margin-top:12px"><button class="btn primary" onclick="doSync()">立即检查更新</button></div></div>

<div class="card"><h2>服务器统计</h2>
<div class="grid-4 grid">
<div class="stat"><span>请求次数</span><strong id="sReq">0</strong></div>
<div class="stat"><span>下载次数</span><strong id="sDown">0</strong></div>
<div class="stat"><span>活跃连接</span><strong id="sAct">0</strong></div>
<div class="stat"><span>已传输</span><strong id="sBytes">0 B</strong></div>
</div></div>

<div class="card"><h2>客户端更新地址</h2>
<div id="addresses"></div>
<p style="font-size:12px;color:#888;margin-top:8px">复制地址到 FTSerialTool 设置 → 更新服务器</p></div>

<div class="card"><h2>设置</h2>
<label>GitHub 仓库<input id="cfgRepo" placeholder="owner/repo"></label>
<label>检查间隔（秒）<input id="cfgInterval" type="number" min="30"></label>
<div class="row"><button class="btn primary" onclick="saveConfig()">保存设置</button></div></div>

<footer>FTUpdateServer · 自动同步 GitHub Release</footer>
</div>
<div class="toast" id="toast"></div>
<script>
let token=localStorage.getItem("ft_admin_token")||"";
document.getElementById("tokenInput").value=token;
const BASE=location.origin;

function toast(msg,ok){const t=document.getElementById("toast");t.textContent=msg;t.className="toast show "+(ok?"ok":"err");setTimeout(()=>t.className="toast",3000)}
function toggleToken(){const i=document.getElementById("tokenInput");i.type=i.type==="password"?"text":"password"}
function saveToken(){token=document.getElementById("tokenInput").value.trim();localStorage.setItem("ft_admin_token",token);toast("Token 已保存",true);refresh()}

async function api(method,url,body){
  const opts={method,headers:{"Content-Type":"application/json"}};
  if(body)opts.body=JSON.stringify(body);
  const sep=url.includes("?")?"&":"?";
  const r=await fetch(BASE+url+(token?sep+"token="+token:""),opts);
  return r.json();
}

async function refresh(){
  try{
    const d=await api("GET","/api/admin/stats");
    if(d.error){document.getElementById("dot").className="dot err";document.getElementById("stateText").textContent="认证失败";return}
    document.getElementById("dot").className="dot on";
    document.getElementById("stateText").textContent="运行中";

    // 统计
    document.getElementById("sReq").textContent=d.stats?.requests||0;
    document.getElementById("sDown").textContent=d.stats?.downloads||0;
    document.getElementById("sAct").textContent=d.stats?.active||0;
    document.getElementById("sBytes").textContent=d.stats?.bytes?((d.stats.bytes/1048576).toFixed(2)+" MB"):"0 B";

    // 地址
    const addr=document.getElementById("addresses");
    addr.innerHTML=(d.addresses||[]).map(a=>'<div class="addr"><span>'+a+'</span><button class="btn ghost" onclick="navigator.clipboard.writeText(\\''+a+'\\')">复制</button></div>').join("");

    // 同步状态
    const sync=d.sync||{};
    const tag=document.getElementById("syncTag");
    const msg=document.getElementById("syncMsg");
    const info=document.getElementById("syncInfo");
    const bar=document.getElementById("progressBar");
    tag.textContent=sync.status||"idle";
    tag.className="tag "+(sync.status==="done"?"ok":sync.status==="error"?"err":sync.status==="downloading"?"sync":"idle");
    msg.textContent=sync.message||"";
    bar.style.width=((sync.progress||0)*100)+"%";

    if(d.release){
      info.innerHTML='<strong>v'+d.release.version+'</strong> · '+(d.release.size?(d.release.size/1048576).toFixed(1)+" MB":"")+'<p>'+(d.release.notes||"").slice(0,200)+'</p>';
    } else {
      info.innerHTML='<strong>暂无缓存版本</strong><p>等待首次同步...</p>';
    }

    // 设置
    document.getElementById("cfgRepo").value=d.config?.githubRepo||"";
    document.getElementById("cfgInterval").value=d.config?.checkInterval||300;
  }catch(e){
    document.getElementById("dot").className="dot err";
    document.getElementById("stateText").textContent="连接失败";
  }
}

async function doSync(){try{await api("POST","/api/admin/sync");toast("已触发同步",true);setTimeout(refresh,2000)}catch(e){toast("同步失败",false)}}

async function saveConfig(){
  const githubRepo=document.getElementById("cfgRepo").value.trim();
  const checkInterval=Number(document.getElementById("cfgInterval").value)||300;
  try{await api("POST","/api/admin/config",{githubRepo,checkInterval});toast("设置已保存",true)}catch(e){toast("保存失败",false)}
}

refresh();setInterval(refresh,3000);
</script></body></html>`;
}

// ══════════════════════════════════════════════════════════════
//  启动 HTTP 服务器
// ══════════════════════════════════════════════════════════════

const server = http.createServer(async (req, res) => {
  stats.requests++;
  const url = new URL(req.url, "http://localhost");
  const pathname = decodeURIComponent(url.pathname);

  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,HEAD,POST,DELETE,OPTIONS", "Access-Control-Allow-Headers": "Content-Type,Authorization" });
    return res.end();
  }

  // 管理页面
  if (pathname === "/admin" || pathname === "/admin/") return sendHtml(res, 200, adminPage());

  // 管理 API
  if (pathname.startsWith("/api/admin/")) {
    if (!checkAdmin(req)) return sendJson(res, 401, { error: "Token 无效" });
    if (pathname === "/api/admin/stats" && req.method === "GET") {
      return sendJson(res, 200, {
        stats,
        release: currentRelease ? { version: currentRelease.version, notes: currentRelease.notes, size: currentRelease.size, publishedAt: currentRelease.publishedAt } : null,
        sync: { status: syncStatus, message: syncMessage, progress: downloadProgress },
        addresses: localAddresses().map(a => `http://${a}:${config.port}${basePath}`),
        config,
      });
    }
    if (pathname === "/api/admin/sync" && req.method === "POST") {
      syncFromGitHub();
      return sendJson(res, 200, { ok: true });
    }
    if (pathname === "/api/admin/config" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)).toString());
      if (body.githubRepo) config.githubRepo = body.githubRepo;
      if (body.checkInterval) config.checkInterval = Math.max(30, Number(body.checkInterval));
      saveConfig(config);
      return sendJson(res, 200, { ok: true });
    }
    return sendJson(res, 404, { error: "未知 API" });
  }

  // 客户端 API
  if (pathname === `${basePath}/api/latest`) {
    if (!currentRelease?.filePath || !fs.existsSync(currentRelease.filePath)) {
      return sendJson(res, 503, { error: "尚未有可用更新，请等待同步完成" });
    }
    return sendJson(res, 200, {
      version: currentRelease.version,
      notes: currentRelease.notes || "",
      publishedAt: currentRelease.publishedAt,
      asset: { name: path.basename(currentRelease.filePath), size: currentRelease.size, url: `${basePath}/files/${encodeURIComponent(path.basename(currentRelease.filePath))}` },
    });
  }
  if (currentRelease?.filePath && pathname === `${basePath}/files/${encodeURIComponent(path.basename(currentRelease.filePath))}`) {
    return sendFile(req, res, currentRelease.filePath);
  }
  if (pathname === "/" || pathname === basePath || pathname === `${basePath}/`) {
    return sendJson(res, 200, { service: "FTUpdateServer", version: currentRelease?.version || "", status: syncStatus });
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(config.port, "0.0.0.0", () => {
  const adminUrl = `http://localhost:${config.port}/admin`;
  console.log("");
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║         FTUpdateServer - 自动同步 GitHub Release        ║");
  console.log("╠══════════════════════════════════════════════════════════╣");
  console.log(`║  端口:       ${String(config.port).padEnd(44)}║`);
  console.log(`║  GitHub 仓库: ${config.githubRepo.padEnd(42)}║`);
  console.log(`║  检查间隔:   ${(config.checkInterval + " 秒").padEnd(44)}║`);
  console.log("╠══════════════════════════════════════════════════════════╣");
  console.log(`║  管理页面:   ${adminUrl.padEnd(44)}║`);
  console.log(`║  管理Token:  ${adminToken.slice(0, 20).padEnd(44)}║`);
  console.log("╠══════════════════════════════════════════════════════════╣");
  console.log("║  客户端更新地址:                                       ║");
  localAddresses().forEach(a => console.log(`║    http://${a}:${config.port}${basePath}`.padEnd(59) + "║"));
  console.log(`║    http://localhost:${config.port}${basePath}`.padEnd(59) + "║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log("");

  // 启动时先加载本地缓存
  const cached = getCachedFile();
  if (cached) {
    const cachedVer = getCachedVersion();
    currentRelease = {
      version: cachedVer,
      notes: "",
      filePath: cached.path,
      publishedAt: new Date(cached.mtime).toISOString(),
      size: fs.statSync(cached.path).size,
    };
    log("INFO", `从缓存加载: ${cached.name} (v${cachedVer})`);
  }

  // 然后同步 GitHub（后台）
  syncFromGitHub();

  // 定期同步
  setInterval(syncFromGitHub, config.checkInterval * 1000);

  // 自动打开浏览器
  if (config.autoOpenBrowser) setTimeout(() => openBrowser(adminUrl), 500);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") console.error(`[ERROR] 端口 ${config.port} 已被占用`);
  else console.error("[ERROR]", err);
  process.exit(1);
});
