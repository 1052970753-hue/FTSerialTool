#!/bin/bash
# FTSerialTool 更新服务器 - 宝塔 Linux 部署脚本
# 用法: bash setup.sh

set -e

INSTALL_DIR="/www/wwwroot/ft-updateserver"
PORT=${1:-8765}
VERSION=${2:-"1.2.12"}

echo "========================================="
echo "  FTSerialTool 更新服务器部署"
echo "========================================="

# 创建目录结构
mkdir -p "$INSTALL_DIR/server"
mkdir -p "$INSTALL_DIR/scripts"
mkdir -p "$INSTALL_DIR/uploads"
mkdir -p "$INSTALL_DIR/logs"

# 复制服务端文件
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cp "$SCRIPT_DIR/../../server/start.js" "$INSTALL_DIR/server/"
cp "$SCRIPT_DIR/../../scripts/update-server-core.js" "$INSTALL_DIR/scripts/"
cp "$SCRIPT_DIR/ecosystem.config.js" "$INSTALL_DIR/"

# 更新 ecosystem.config.js 中的端口和版本
sed -i "s/FT_PORT: .*/FT_PORT: $PORT,/" "$INSTALL_DIR/ecosystem.config.js"
sed -i "s/FT_VERSION: .*/FT_VERSION: \"$VERSION\",/" "$INSTALL_DIR/ecosystem.config.js"

echo ""
echo "[OK] 文件已部署到: $INSTALL_DIR"
echo ""
echo "下一步:"
echo "  1. 宝塔面板 → 网站 → Node项目 → 添加Node项目"
echo "  2. 项目目录: $INSTALL_DIR"
echo "  3. 启动选项: PM2启动"
echo "  4. 项目端口: $PORT"
echo "  5. 启动文件: server/start.js"
echo ""
echo "或者直接用 PM2 启动:"
echo "  cd $INSTALL_DIR && pm2 start ecosystem.config.js"
echo ""
echo "========================================="
