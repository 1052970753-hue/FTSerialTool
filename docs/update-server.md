# FTSerialTool 更新加速服务器

软件仍从 GitHub Releases 检查版本号和读取更新说明。加速服务器只负责提供更新文件，因此可以使用任意支持 HTTPS 和 Range 分段下载的静态文件服务。

## 文件目录

将最新单文件便携版上传到服务器，并保持文件名不变：

```text
https://update.example.com/FTSerialTool/FTSerialTool-portable-x64.exe
```

然后在 FTSerialTool 的“设置”中填写：

```text
https://update.example.com/FTSerialTool
```

软件会优先从该地址四路并发下载。如果加速服务器不可用，会自动回退到 GitHub。

## Nginx 示例

```nginx
server {
    listen 443 ssl http2;
    server_name update.example.com;

    root /srv/updates;

    location /FTSerialTool/ {
        try_files $uri =404;
        add_header Cache-Control "public, max-age=300";
    }
}
```

把文件放到：

```text
/srv/updates/FTSerialTool/FTSerialTool-portable-x64.exe
```

Nginx 默认支持 Range 分段下载。建议启用 HTTPS，并确保服务器带宽足够。

## 发布流程

每次 GitHub 新版本构建完成后，将 Release 中的 `FTSerialTool-portable-x64.exe` 上传并覆盖加速服务器上的同名文件即可。
