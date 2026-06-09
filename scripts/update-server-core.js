const http = require("http");
const https = require("https");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

function localAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((item) => item && item.family === "IPv4" && !item.internal)
    .map((item) => item.address);
}

function createUpdateServer(options) {
  const port = Number(options.port) || 8765;
  const basePath = `/${String(options.basePath || "FTSerialTool").replace(/^\/+|\/+$/g, "")}`;
  const getRelease = options.getRelease;
  const setRelease = options.setRelease || (() => {});
  const onStats = options.onStats || (() => {});
  const adminToken = options.adminToken || "";
  const uploadDir = options.uploadDir || path.join(process.cwd(), "uploads");
  const cert = options.cert || null;
  const key = options.key || null;
  const useHttps = !!(cert && key);
  const stats = { requests: 0, downloads: 0, active: 0, bytes: 0, startedAt: Date.now() };

  function report() {
    onStats({ ...stats });
  }

  function sendJson(response, status, value) {
    const body = Buffer.from(JSON.stringify(value));
    response.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": body.length,
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*",
    });
    response.end(body);
  }

  function sendHtml(response, status, html) {
    const body = Buffer.from(html, "utf-8");
    response.writeHead(status, {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Length": body.length,
      "Cache-Control": "no-cache",
    });
    response.end(body);
  }

  function readBody(request) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      request.on("data", (chunk) => chunks.push(chunk));
      request.on("end", () => resolve(Buffer.concat(chunks)));
      request.on("error", reject);
    });
  }

  function parseMultipart(buffer, boundary) {
    const boundaryBuf = Buffer.from(`--${boundary}`);
    const parts = [];
    let start = buffer.indexOf(boundaryBuf) + boundaryBuf.length + 2; // skip \r\n after boundary
    while (start < buffer.length) {
      const end = buffer.indexOf(boundaryBuf, start);
      if (end === -1) break;
      const part = buffer.slice(start, end - 2); // -2 for \r\n before boundary
      const headerEnd = part.indexOf("\r\n\r\n");
      if (headerEnd === -1) { start = end + boundaryBuf.length + 2; continue; }
      const headerStr = part.slice(0, headerEnd).toString("utf-8");
      const body = part.slice(headerEnd + 4);
      const nameMatch = /name="([^"]+)"/.exec(headerStr);
      const filenameMatch = /filename="([^"]+)"/.exec(headerStr);
      parts.push({
        name: nameMatch ? nameMatch[1] : "",
        filename: filenameMatch ? filenameMatch[1] : "",
        data: body,
      });
      start = end + boundaryBuf.length + 2;
    }
    return parts;
  }

  function checkAdminToken(request) {
    if (!adminToken) return false;
    const url = new URL(request.url, "http://localhost");
    const token = url.searchParams.get("token");
    return token === adminToken;
  }

  function getAdminPage() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>FTUpdateServer Admin</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f0f2f5; color: #1a1a2e; min-height: 100vh; }
  .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: #fff; padding: 20px 32px; display: flex; align-items: center; gap: 16px; }
  .header h1 { font-size: 22px; font-weight: 600; }
  .header .badge { background: #0f3460; padding: 4px 12px; border-radius: 12px; font-size: 12px; }
  .container { max-width: 960px; margin: 24px auto; padding: 0 16px; }
  .card { background: #fff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); margin-bottom: 20px; overflow: hidden; }
  .card-header { padding: 16px 20px; border-bottom: 1px solid #eef0f4; font-weight: 600; font-size: 15px; display: flex; align-items: center; gap: 8px; }
  .card-body { padding: 20px; }
  .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; }
  .stat-item { background: #f8f9fb; border-radius: 8px; padding: 16px; text-align: center; }
  .stat-value { font-size: 28px; font-weight: 700; color: #0f3460; }
  .stat-label { font-size: 12px; color: #666; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
  .form-group { margin-bottom: 16px; }
  .form-group label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: #333; }
  .form-group input, .form-group textarea { width: 100%; padding: 10px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; font-family: inherit; transition: border-color 0.2s; }
  .form-group input:focus, .form-group textarea:focus { outline: none; border-color: #0f3460; box-shadow: 0 0 0 3px rgba(15,52,96,0.1); }
  .form-group textarea { resize: vertical; min-height: 80px; }
  .btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
  .btn-primary { background: #0f3460; color: #fff; }
  .btn-primary:hover { background: #1a4a7a; }
  .btn-danger { background: #e74c3c; color: #fff; }
  .btn-danger:hover { background: #c0392b; }
  .btn-sm { padding: 6px 12px; font-size: 12px; }
  .btn-group { display: flex; gap: 10px; flex-wrap: wrap; }
  .drop-zone { border: 2px dashed #ccc; border-radius: 8px; padding: 40px 20px; text-align: center; cursor: pointer; transition: all 0.2s; color: #888; }
  .drop-zone:hover, .drop-zone.dragover { border-color: #0f3460; background: #f0f4ff; color: #0f3460; }
  .drop-zone p { font-size: 14px; margin-top: 8px; }
  .file-info { margin-top: 12px; padding: 10px; background: #e8f5e9; border-radius: 6px; font-size: 13px; display: none; }
  .toast { position: fixed; top: 20px; right: 20px; padding: 12px 20px; border-radius: 8px; color: #fff; font-size: 14px; z-index: 9999; opacity: 0; transition: opacity 0.3s; pointer-events: none; }
  .toast.show { opacity: 1; }
  .toast.success { background: #27ae60; }
  .toast.error { background: #e74c3c; }
  .addr-list { list-style: none; }
  .addr-list li { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 13px; font-family: monospace; }
  .addr-list li:last-child { border-bottom: none; }
  .token-section { display: flex; gap: 10px; align-items: flex-end; }
  .token-section .form-group { flex: 1; margin-bottom: 0; }
  .status-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
  .status-dot.ok { background: #27ae60; }
  .status-dot.err { background: #e74c3c; }
  .progress-bar { width: 100%; height: 6px; background: #eee; border-radius: 3px; margin-top: 10px; overflow: hidden; display: none; }
  .progress-bar .fill { height: 100%; background: #0f3460; border-radius: 3px; width: 0; transition: width 0.3s; }
</style>
</head>
<body>
<div class="header">
  <h1>FTUpdateServer</h1>
  <span class="badge" id="statusBadge">Admin Panel</span>
</div>
<div class="container">
  <div class="card">
    <div class="card-header"><span class="status-dot ok" id="serverDot"></span> Authentication</div>
    <div class="card-body">
      <div class="token-section">
        <div class="form-group">
          <label>Admin Token</label>
          <input type="password" id="tokenInput" placeholder="Enter admin token...">
        </div>
        <button class="btn btn-primary btn-sm" onclick="saveToken()">Set Token</button>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-header">📊 Server Statistics</div>
    <div class="card-body">
      <div class="stats-grid">
        <div class="stat-item"><div class="stat-value" id="statRequests">0</div><div class="stat-label">Requests</div></div>
        <div class="stat-item"><div class="stat-value" id="statDownloads">0</div><div class="stat-label">Downloads</div></div>
        <div class="stat-item"><div class="stat-value" id="statActive">0</div><div class="stat-label">Active</div></div>
        <div class="stat-item"><div class="stat-value" id="statBytes">0 B</div><div class="stat-label">Transferred</div></div>
      </div>
      <div style="margin-top:12px;text-align:right;">
        <button class="btn btn-primary btn-sm" onclick="loadStats()">Refresh</button>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-header">🌐 Server Addresses</div>
    <div class="card-body">
      <ul class="addr-list" id="addrList"></ul>
    </div>
  </div>

  <div class="card">
    <div class="card-header">📦 Release Configuration</div>
    <div class="card-body">
      <div class="form-group">
        <label>Version</label>
        <input type="text" id="versionInput" placeholder="e.g. 1.2.0">
      </div>
      <div class="form-group">
        <label>Release Notes</label>
        <textarea id="notesInput" placeholder="What changed in this release..."></textarea>
      </div>
      <div class="btn-group">
        <button class="btn btn-primary" onclick="updateConfig()">Save Release Info</button>
        <button class="btn btn-danger" onclick="clearRelease()">Clear Release</button>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-header">📤 Upload Update File</div>
    <div class="card-body">
      <div class="drop-zone" id="dropZone" onclick="document.getElementById('fileInput').click()">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        <p>Drag & drop file here or click to browse</p>
      </div>
      <input type="file" id="fileInput" style="display:none">
      <div class="file-info" id="fileInfo"></div>
      <div class="progress-bar" id="progressBar"><div class="fill" id="progressFill"></div></div>
      <div style="margin-top:12px;">
        <button class="btn btn-primary" id="uploadBtn" onclick="uploadFile()" disabled>Upload File</button>
      </div>
    </div>
  </div>
</div>

<div class="toast" id="toast"></div>

<script>
(function() {
  var token = localStorage.getItem('ft_admin_token') || '';
  document.getElementById('tokenInput').value = token;

  var dropZone = document.getElementById('dropZone');
  var fileInput = document.getElementById('fileInput');
  var selectedFile = null;

  ['dragenter','dragover'].forEach(function(e) {
    dropZone.addEventListener(e, function(ev) { ev.preventDefault(); dropZone.classList.add('dragover'); });
  });
  ['dragleave','drop'].forEach(function(e) {
    dropZone.addEventListener(e, function(ev) { ev.preventDefault(); dropZone.classList.remove('dragover'); });
  });
  dropZone.addEventListener('drop', function(ev) {
    if (ev.dataTransfer.files.length) { handleFile(ev.dataTransfer.files[0]); }
  });
  fileInput.addEventListener('change', function() {
    if (fileInput.files.length) { handleFile(fileInput.files[0]); }
  });

  function handleFile(file) {
    selectedFile = file;
    var info = document.getElementById('fileInfo');
    info.style.display = 'block';
    info.textContent = file.name + ' (' + formatBytes(file.size) + ')';
    document.getElementById('uploadBtn').disabled = false;
  }

  window.saveToken = function() {
    token = document.getElementById('tokenInput').value.trim();
    localStorage.setItem('ft_admin_token', token);
    toast('Token saved', 'success');
  };

  window.loadStats = function() {
    apiFetch('/api/admin/stats').then(function(data) {
      if (!data) return;
      document.getElementById('statRequests').textContent = data.requests || 0;
      document.getElementById('statDownloads').textContent = data.downloads || 0;
      document.getElementById('statActive').textContent = data.active || 0;
      document.getElementById('statBytes').textContent = formatBytes(data.bytes || 0);
      var addrs = data.addresses || [];
      var list = document.getElementById('addrList');
      list.innerHTML = '';
      addrs.forEach(function(a) {
        var li = document.createElement('li');
        li.textContent = a;
        var btn = document.createElement('button');
        btn.className = 'btn btn-primary btn-sm';
        btn.textContent = 'Copy';
        btn.onclick = function() { copyText(a); };
        li.appendChild(btn);
        list.appendChild(li);
      });
      toast('Stats loaded', 'success');
    });
  };

  window.updateConfig = function() {
    var body = {
      version: document.getElementById('versionInput').value.trim(),
      notes: document.getElementById('notesInput').value.trim()
    };
    apiFetch('/api/admin/config', 'POST', body).then(function(data) {
      if (data) { toast('Release info updated', 'success'); }
    });
  };

  window.clearRelease = function() {
    apiFetch('/api/admin/release', 'DELETE').then(function(data) {
      if (data) { toast('Release cleared', 'success'); }
    });
  };

  window.uploadFile = function() {
    if (!selectedFile) return;
    var form = new FormData();
    form.append('file', selectedFile);
    var bar = document.getElementById('progressBar');
    var fill = document.getElementById('progressFill');
    bar.style.display = 'block';
    fill.style.width = '0%';

    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/admin/upload?token=' + encodeURIComponent(token));
    xhr.upload.onprogress = function(e) {
      if (e.lengthComputable) { fill.style.width = Math.round(e.loaded / e.total * 100) + '%'; }
    };
    xhr.onload = function() {
      bar.style.display = 'none';
      if (xhr.status >= 200 && xhr.status < 300) {
        toast('File uploaded successfully', 'success');
        selectedFile = null;
        document.getElementById('fileInfo').style.display = 'none';
        document.getElementById('uploadBtn').disabled = true;
      } else {
        var msg = 'Upload failed';
        try { msg = JSON.parse(xhr.responseText).error || msg; } catch(e) {}
        toast(msg, 'error');
      }
    };
    xhr.onerror = function() { bar.style.display = 'none'; toast('Upload failed', 'error'); };
    xhr.send(form);
  };

  function apiFetch(url, method, body) {
    method = method || 'GET';
    var sep = url.indexOf('?') === -1 ? '?' : '&';
    var opts = { method: method, headers: {} };
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    return fetch(url + sep + 'token=' + encodeURIComponent(token), opts)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.error) { toast(data.error, 'error'); return null; }
        return data;
      })
      .catch(function() { toast('Request failed', 'error'); return null; });
  }

  function formatBytes(b) {
    if (b === 0) return '0 B';
    var k = 1024, sizes = ['B','KB','MB','GB','TB'];
    var i = Math.floor(Math.log(b) / Math.log(k));
    return (b / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
  }

  function copyText(text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function() { toast('Copied!', 'success'); });
    } else {
      var ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy');
      document.body.removeChild(ta);
      toast('Copied!', 'success');
    }
  }

  function toast(msg, type) {
    var el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'toast show ' + (type || 'success');
    setTimeout(function() { el.className = 'toast'; }, 2500);
  }

  loadStats();
})();
</script>
</body>
</html>`;
  }

  function sendFile(request, response, release) {
    const stat = fs.statSync(release.filePath);
    const range = request.headers.range;
    const commonHeaders = {
      "Accept-Ranges": "bytes",
      "Content-Type": release.contentType || "application/octet-stream",
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*",
    };
    let start = 0;
    let end = stat.size - 1;
    let status = 200;

    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      if (!match) {
        response.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
        response.end();
        return;
      }
      start = Number(match[1]);
      end = match[2] ? Math.min(Number(match[2]), stat.size - 1) : stat.size - 1;
      if (start > end || start >= stat.size) {
        response.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
        response.end();
        return;
      }
      status = 206;
      commonHeaders["Content-Range"] = `bytes ${start}-${end}/${stat.size}`;
    }

    response.writeHead(status, { ...commonHeaders, "Content-Length": end - start + 1 });
    if (request.method === "HEAD") return response.end();

    stats.downloads += 1;
    stats.active += 1;
    report();
    const input = fs.createReadStream(release.filePath, { start, end });
    input.on("data", (chunk) => {
      stats.bytes += chunk.length;
    });
    const finish = () => {
      stats.active = Math.max(0, stats.active - 1);
      report();
    };
    input.on("close", finish);
    input.on("error", finish);
    input.pipe(response);
  }

  async function handleAdminRequest(request, response) {
    const url = new URL(request.url, "http://localhost");
    const pathname = url.pathname;

    // Admin page (no token required)
    if (pathname === "/admin" || pathname === `${basePath}/admin`) {
      sendHtml(response, 200, getAdminPage());
      return true;
    }

    // All other admin endpoints require token
    if (!pathname.startsWith("/api/admin")) return false;
    if (!checkAdminToken(request)) {
      sendJson(response, 401, { error: "Invalid or missing token" });
      return true;
    }

    if (pathname === "/api/admin/stats" && request.method === "GET") {
      sendJson(response, 200, {
        ...stats,
        addresses: localAddresses().map((a) => `http://${a}:${port}${basePath}`),
      });
      return true;
    }

    if (pathname === "/api/admin/config" && request.method === "POST") {
      try {
        const body = JSON.parse((await readBody(request)).toString("utf-8"));
        const release = getRelease() || {};
        if (body.version) release.version = body.version;
        if (body.notes !== undefined) release.notes = body.notes;
        release.publishedAt = new Date().toISOString();
        setRelease(release);
        sendJson(response, 200, { ok: true, version: release.version });
      } catch (e) {
        sendJson(response, 400, { error: "Invalid JSON body" });
      }
      return true;
    }

    if (pathname === "/api/admin/upload" && request.method === "POST") {
      try {
        const contentType = request.headers["content-type"] || "";
        const boundaryMatch = /boundary=(.+)/.exec(contentType);
        if (!boundaryMatch) {
          sendJson(response, 400, { error: "Missing multipart boundary" });
          return true;
        }
        const buffer = await readBody(request);
        const parts = parseMultipart(buffer, boundaryMatch[1]);
        const filePart = parts.find((p) => p.filename);
        if (!filePart) {
          sendJson(response, 400, { error: "No file found in upload" });
          return true;
        }
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        const safeName = path.basename(filePart.filename).replace(/[^a-zA-Z0-9._-]/g, "_");
        const destPath = path.join(uploadDir, safeName);
        fs.writeFileSync(destPath, filePart.data);
        sendJson(response, 200, { ok: true, fileName: safeName, size: filePart.data.length, path: destPath });
      } catch (e) {
        sendJson(response, 500, { error: "Upload failed: " + e.message });
      }
      return true;
    }

    if (pathname === "/api/admin/release" && request.method === "DELETE") {
      setRelease(null);
      sendJson(response, 200, { ok: true });
      return true;
    }

    sendJson(response, 404, { error: "Unknown admin endpoint" });
    return true;
  }

  const requestHandler = async (request, response) => {
    stats.requests += 1;
    report();

    // Allow POST for admin endpoints
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const isAdminPath = pathname.startsWith("/api/admin") || pathname === "/admin" || pathname === `${basePath}/admin`;

    if (!isAdminPath && !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      response.writeHead(405);
      response.end();
      return;
    }
    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS, POST, DELETE",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      response.end();
      return;
    }

    // Handle admin routes
    if (isAdminPath) {
      const handled = await handleAdminRequest(request, response);
      if (handled) return;
    }

    const release = getRelease();
    if (pathname === `${basePath}/api/latest`) {
      if (!release?.filePath || !fs.existsSync(release.filePath)) {
        sendJson(response, 503, { error: "尚未发布可用更新" });
        return;
      }
      const file = path.basename(release.filePath);
      const size = fs.statSync(release.filePath).size;
      sendJson(response, 200, {
        version: release.version,
        notes: release.notes || "",
        publishedAt: release.publishedAt || new Date().toISOString(),
        asset: { name: file, size, url: `${basePath}/files/${encodeURIComponent(file)}` },
      });
      return;
    }
    if (release?.filePath && pathname === `${basePath}/files/${encodeURIComponent(path.basename(release.filePath))}`) {
      sendFile(request, response, release);
      return;
    }
    if (pathname === "/" || pathname === basePath || pathname === `${basePath}/`) {
      sendJson(response, 200, {
        service: "FTUpdateServer",
        version: release?.version || "",
        file: release?.filePath ? path.basename(release.filePath) : "",
      });
      return;
    }
    response.writeHead(404);
    response.end("Not found");
  };

  const server = useHttps
    ? https.createServer({ cert: fs.readFileSync(cert), key: fs.readFileSync(key) }, requestHandler)
    : http.createServer(requestHandler);

  const protocol = useHttps ? "https" : "http";

  return {
    port,
    basePath,
    addresses: () => localAddresses().map((address) => `${protocol}://${address}:${port}${basePath}`),
    listen: () => new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, "0.0.0.0", () => {
        server.removeListener("error", reject);
        resolve();
      });
    }),
    close: () => new Promise((resolve) => server.close(resolve)),
    stats: () => ({ ...stats }),
  };
}

module.exports = { createUpdateServer, localAddresses };
