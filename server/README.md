# FTSerialTool 更新服务器

FTSerialTool 客户端的 OTA 更新分发服务。支持查询最新版本、断点续传下载更新文件。

---

## 快速启动

### 本地运行

```bash
cd server
node start.js
```

服务器默认监听 `8765` 端口，上传目录为当前目录下的 `uploads/`。

将更新文件（支持 `.exe`、`.zip`、`.msi`、`.dmg`、`.tar.gz`、`.AppImage`）放入 `uploads/` 目录即可。

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `FT_PORT` | `8765` | 监听端口 |
| `FT_TOKEN` | 随机生成 | 认证 Token |
| `FT_CERT` | - | HTTPS 证书文件路径 |
| `FT_KEY` | - | HTTPS 私钥文件路径 |
| `FT_UPLOAD_DIR` | `./uploads` | 更新文件存放目录 |
| `FT_VERSION` | `0.0.0` | 当前发布版本号 |

示例：

```bash
FT_PORT=9000 FT_VERSION=2.1.0 FT_TOKEN=my-secret node start.js
```

---

## Docker 部署

### 使用 Docker Compose（推荐）

```bash
cd server

# 创建目录
mkdir -p uploads certs

# 将更新文件放入 uploads/
cp /path/to/FTSerialTool-2.0.0.exe uploads/

# 启动
docker-compose up -d

# 查看日志
docker-compose logs -f
```

### 使用 Docker 命令

```bash
# 构建镜像
docker build -t ft-update-server -f server/Dockerfile .

# 运行
docker run -d \
  --name ft-update-server \
  -p 8765:8765 \
  -v $(pwd)/server/uploads:/app/uploads \
  -v $(pwd)/server/certs:/app/certs \
  -e FT_VERSION=1.0.0 \
  ft-update-server
```

---

## HTTPS 配置

### 方式一：Nginx 反向代理（推荐）

```nginx
server {
    listen 443 ssl;
    server_name update.example.com;

    ssl_certificate     /etc/nginx/certs/cert.pem;
    ssl_certificate_key /etc/nginx/certs/key.pem;

    location / {
        proxy_pass http://127.0.0.1:8765;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 方式二：环境变量配置

将证书文件挂载到容器内，设置环境变量：

```bash
FT_CERT=/app/certs/cert.pem
FT_KEY=/app/certs/key.pem
```

---

## 客户端配置

在 FTSerialTool 客户端中，将更新服务器地址配置为：

```
http://<服务器IP>:8765/FTSerialTool
```

或使用 HTTPS：

```
https://update.example.com/FTSerialTool
```

---

## API 文档

### 查询服务状态

```
GET /
```

响应示例：

```json
{
  "service": "FTUpdateServer",
  "version": "1.0.0",
  "file": "FTSerialTool-1.0.0.exe"
}
```

### 查询最新版本

```
GET /FTSerialTool/api/latest
```

响应示例：

```json
{
  "version": "1.0.0",
  "notes": "修复若干 Bug",
  "publishedAt": "2026-06-05T12:00:00.000Z",
  "asset": {
    "name": "FTSerialTool-1.0.0.exe",
    "size": 52428800,
    "url": "/FTSerialTool/files/FTSerialTool-1.0.0.exe"
  }
}
```

无可用文件时返回 `503`：

```json
{
  "error": "尚未发布可用更新"
}
```

### 下载更新文件

```
GET /FTSerialTool/files/:filename
```

- 支持 `Range` 请求头（断点续传）
- 支持 `HEAD` 请求获取文件大小
- CORS 已开启，支持跨域访问

---

## 目录结构

```
FTSerialTool/
  scripts/
    update-server-core.js   # 核心服务器逻辑
  server/
    start.js                 # 独立启动器
    Dockerfile               # Docker 镜像定义
    docker-compose.yml       # Docker Compose 配置
    README.md                # 本文档
    uploads/                 # 更新文件存放目录（自动创建）
    certs/                   # HTTPS 证书目录（可选）
```
