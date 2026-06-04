# FTSerialTool

GitHub: https://github.com/1052970753-hue/FTSerialTool

FTSerialTool 是面向串口、蓝牙串口和网络串口的协议调试工具，支持：

- 可视化发送组包与接收解析
- 数据面板与实时曲线
- 周期发送与控件联动
- AI 协议代码解析
- GitHub Releases 在线更新

## 开发

```powershell
npm install
npm start
```

## 检查与测试

```powershell
npm run check
npm test
```

## Windows 打包

```powershell
npm run pack:win
```

生成目录：

`dist/FTSerialTool-win32-x64`

## 发布更新

更新 `package.json` 中的版本号后创建对应标签，例如：

```powershell
npm version patch --no-git-tag-version
npm run release:github
```

`release:github` 会通过 GitHub API 同步源码并创建版本标签。GitHub Actions 随后自动构建并发布 `FTSerialTool-win32-x64.zip`。软件通过 GitHub Releases 检查和下载新版本。
