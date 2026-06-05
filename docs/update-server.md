# FTSerialTool 更新加速服务器

## 局域网本地部署

在作为服务器的电脑中执行：

```powershell
npm run serve:updates
```

服务默认监听 `8765` 端口，并自动显示局域网更新地址。在其他同一局域网电脑的软件设置中填写该地址，例如：

```text
http://192.168.5.74:8765/FTSerialTool
```

本地服务自动提供 `dist/FTSerialTool-win32-x64.zip` 和 `dist/FTSerialTool-portable-x64.exe` 中实际存在的更新文件，并支持四路 Range 分段下载。普通更新只需要同步 GitHub Release 中的同名 ZIP 文件。

软件仍从 GitHub Releases 检查版本号和读取更新说明。加速服务器只负责提供更新文件，因此可以使用任意支持 HTTPS 和 Range 分段下载的静态文件服务。

## 文件目录

将 GitHub Release 中的更新 ZIP 原样上传到服务器，并保持文件名不变：

```text
https://update.example.com/FTSerialTool/FTSerialTool-win32-x64.zip
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
/srv/updates/FTSerialTool/FTSerialTool-win32-x64.zip
```

Nginx 默认支持 Range 分段下载。建议启用 HTTPS，并确保服务器带宽足够。

## 发布流程

每次 GitHub 新版本构建完成后，将 Release 中的 `FTSerialTool-win32-x64.zip` 下载到 `dist/` 并覆盖同名文件，再重启本地更新服务即可。文件必须与 GitHub Release 资产保持一致。
