FROM node:20-alpine

LABEL maintainer="FTSerialTool"
LABEL description="FTSerialTool 更新服务器"

WORKDIR /app

# 复制依赖文件（构建上下文为项目根目录，保持目录结构以便 require 路径正确）
COPY server/start.js ./server/start.js
COPY scripts/update-server-core.js ./scripts/update-server-core.js

# 创建上传和证书目录
RUN mkdir -p /app/uploads /app/certs

# 环境变量默认值
ENV FT_PORT=8765
ENV FT_UPLOAD_DIR=/app/uploads
ENV FT_VERSION=0.0.0

# 暴露端口
EXPOSE 8765

# 声明卷
VOLUME ["/app/uploads", "/app/certs"]

# 启动
CMD ["node", "server/start.js"]
