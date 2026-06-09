"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { createUpdateServer } = require("../scripts/update-server-core");

// ---- 读取环境变量 ----
const port = Number(process.env.FT_PORT) || 8765;
const token = process.env.FT_TOKEN || crypto.randomBytes(24).toString("hex");
const certFile = process.env.FT_CERT || "";
const keyFile = process.env.FT_KEY || "";
const uploadDir = path.resolve(process.env.FT_UPLOAD_DIR || "./uploads");
const version = process.env.FT_VERSION || "0.0.0";

// ---- 确保上传目录存在 ----
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log(`[INFO] 已创建上传目录: ${uploadDir}`);
}

// ---- 查找最新发布的文件 ----
function findLatestFile() {
  if (!fs.existsSync(uploadDir)) return null;
  const files = fs
    .readdirSync(uploadDir)
    .filter((f) => /\.(exe|zip|msi|dmg|tar\.gz|AppImage)$/i.test(f))
    .map((f) => ({
      name: f,
      fullPath: path.join(uploadDir, f),
      mtime: fs.statSync(path.join(uploadDir, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);

  return files.length > 0 ? files[0] : null;
}

// ---- 构造 release 对象 ----
function getRelease() {
  const latest = findLatestFile();
  if (!latest) return null;
  return {
    version,
    filePath: latest.fullPath,
    notes: "",
    publishedAt: new Date(latest.mtime).toISOString(),
    contentType: "application/octet-stream",
  };
}

// ---- 统计信息回调 ----
function onStats(stats) {
  const elapsed = ((Date.now() - stats.startedAt) / 1000).toFixed(0);
  const mb = (stats.bytes / (1024 * 1024)).toFixed(2);
  process.stdout.write(
    `\r[STATS] 请求:${stats.requests} 下载:${stats.downloads} 活跃:${stats.active} 流量:${mb}MB 运行:${elapsed}s  `
  );
}

// ---- 启动服务 ----
async function main() {
  const server = createUpdateServer({
    port,
    getRelease,
    onStats,
  });

  await server.listen();

  console.log("=".repeat(60));
  console.log("  FTSerialTool 更新服务器已启动");
  console.log("=".repeat(60));
  console.log(`  端口:     ${port}`);
  console.log(`  上传目录: ${uploadDir}`);
  console.log(`  版本号:   ${version}`);
  console.log(`  Token:    ${token}`);
  console.log("-".repeat(60));
  console.log("  服务地址:");
  server.addresses().forEach((addr) => console.log(`    ${addr}`));
  console.log(`    http://localhost:${port}/FTSerialTool`);
  console.log("-".repeat(60));
  console.log("  API 端点:");
  console.log(`    GET  /FTSerialTool/api/latest  查询最新版本`);
  console.log(`    GET  /FTSerialTool/files/:name 下载更新文件`);
  console.log("=".repeat(60));

  if (certFile && keyFile && fs.existsSync(certFile) && fs.existsSync(keyFile)) {
    console.log(`[INFO] 检测到 HTTPS 证书: ${certFile}`);
    console.log("[INFO] 若需 HTTPS，请在前端使用反向代理（如 nginx）");
  }

  const release = getRelease();
  if (!release) {
    console.log("[WARN] 当前没有可用的更新文件，请将文件放入上传目录");
  } else {
    console.log(`[INFO] 当前发布文件: ${path.basename(release.filePath)}`);
  }
}

main().catch((err) => {
  console.error("[FATAL]", err);
  process.exit(1);
});
