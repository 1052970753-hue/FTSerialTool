# FTSerialTool 项目结构说明

## 哪个目录是最新项目

- `C:\Users\shuow\Documents\FTSerialTool` 是源码项目根目录，也是继续开发、修改和提交 Git 的位置。
- `C:\Users\shuow\Documents\FTSerialTool\dist\FTSerialTool-win32-x64` 是最新生成的 Windows 解压运行版。
- `C:\Users\shuow\Documents\FTSerialTool\dist\FTSerialTool-portable-x64.exe` 是最新生成的单文件便携版。
- `dist\FTSerialTool-win32-x64\resources\app` 中虽然包含运行所需源码副本，但它由打包脚本自动生成。不要直接在此目录开发，因为再次运行 `npm run pack:win` 时整个目录会被删除并重新生成。

## 根目录

| 路径 | 类型 | 说明 |
| --- | --- | --- |
| `.git/` | Git 数据 | 本地提交历史、分支和版本控制数据。 |
| `.github/` | 配置目录 | GitHub Actions 自动构建和发布配置。 |
| `dist/` | 生成目录 | Windows 解压版、单文件便携版及打包临时文件；可通过 `npm run clean` 删除后重新生成。 |
| `docs/` | 文档目录 | 设计记录、更新服务和项目结构说明。 |
| `node_modules/` | 依赖目录 | Electron、串口库及其依赖；由 `npm install` 生成。 |
| `scripts/` | 工具目录 | 清理、打包、测试、发布和局域网更新服务脚本。 |
| `src/` | 应用源码目录 | FTSerialTool 的 Electron 主进程、界面、样式与协议分析器源码。 |
| `update-server-app/` | 更新服务端源码 | 独立的 FTUpdateServer 图形化更新服务软件。 |
| `.gitignore` | Git 配置 | 指定不提交的依赖、构建产物和压缩包。 |
| `package.json` | 项目配置 | 版本号、运行命令、依赖和项目基本信息。 |
| `package-lock.json` | 依赖锁定 | 固定依赖版本，保证不同电脑安装结果一致。 |
| `README.md` | 使用说明 | 开发、测试、打包和发布的快速说明。 |

## `src/`

| 路径 | 说明 |
| --- | --- |
| `src/app.js` | 主界面状态、协议组、组包发送、接收解析、数据面板、实时曲线和交互逻辑。 |
| `src/index.html` | 软件工作台、命令行、弹窗和各功能面板的 HTML 结构。 |
| `src/main.js` | Electron 主进程，负责窗口、菜单、原生串口、网络串口和软件更新。 |
| `src/preload.js` | 在主进程与界面之间暴露受控 IPC 接口。 |
| `src/protocol-parser.js` | 从用户粘贴的代码中识别发送包、接收包和字段。 |
| `src/styles.css` | 全部布局、控件、皮肤、弹窗和响应式样式。 |

## `.github/`

| 路径 | 说明 |
| --- | --- |
| `.github/workflows/release.yml` | 推送 `v*` 标签后，在 GitHub 上检查、测试、打包并发布 Windows 版本。 |

## `docs/`

| 路径 | 说明 |
| --- | --- |
| `docs/jcom-design-notes.md` | JCOM 功能与界面参考记录。 |
| `docs/update-server.md` | GitHub 与局域网更新加速服务的部署说明。 |
| `docs/project-structure.md` | 当前项目目录和文件职责说明。 |

## `scripts/`

| 路径 | 说明 |
| --- | --- |
| `scripts/clean.ps1` | 删除 `dist/` 构建产物。 |
| `scripts/compact-win.ps1` | 对 Windows 解压版应用 LZX 磁盘压缩。 |
| `scripts/package-win.ps1` | 生成精简后的 Windows x64 解压版。 |
| `scripts/package-portable-win.ps1` | 生成单文件便携版；首次快速解压到版本缓存，后续直接启动缓存。 |
| `scripts/package-update-server-win.ps1` | 生成独立的 FTUpdateServer Windows 服务端软件。 |
| `scripts/publish-github.ps1` | 同步源码、创建标签并触发 GitHub Release。 |
| `scripts/test-protocol-parser.js` | 协议分析器自动测试。 |
| `scripts/update-server.js` | 在局域网提供支持 Range 分段下载的更新文件服务。 |

## `dist/`

| 路径 | 说明 |
| --- | --- |
| `dist/FTSerialTool-win32-x64/` | 可直接运行的 Windows x64 解压版。 |
| `dist/FTSerialTool-portable-x64.exe` | 最新生成的单文件便携版。 |

构建产物、依赖目录和 Git 内部文件数量较多，不需要手工维护。日常新增功能主要修改 `src/` 中的应用源码。

## `dist/FTSerialTool-win32-x64/` 运行成品详解

| 路径 | 说明 |
| --- | --- |
| `FTSerialTool.exe` | 软件启动程序。它是改名后的 Electron Windows 主程序，读取 `resources/app` 中的 FTSerialTool 代码。 |
| `resources/app/` | 本次打包复制进去的应用代码副本，只用于运行。 |
| `resources/app/src/` | 本次打包复制进去的应用源码副本。 |
| `resources/app/src/app.js` | 成品中的界面业务逻辑副本。 |
| `resources/app/src/index.html` | 成品中的主界面结构副本。 |
| `resources/app/src/main.js` | 成品中的 Electron 主进程副本。 |
| `resources/app/src/preload.js` | 成品中的安全 IPC 桥接副本。 |
| `resources/app/src/protocol-parser.js` | 成品中的协议代码分析器副本。 |
| `resources/app/src/styles.css` | 成品中的界面样式副本。 |
| `resources/app/package.json` | 成品运行入口、版本号和运行依赖信息。 |
| `resources/app/node_modules/` | 成品实际使用的生产依赖，目前主要包含原生串口模块及其依赖。 |
| `locales/` | Electron/Chromium 的中英文运行语言资源。 |
| `chrome_100_percent.pak` | Chromium 标准缩放比例界面资源。 |
| `chrome_200_percent.pak` | Chromium 高 DPI 缩放界面资源。 |
| `ffmpeg.dll` | Chromium 使用的媒体解码运行库。 |
| `icudtl.dat` | Unicode、中文、日期和国际化处理数据。 |
| `resources.pak` | Chromium 内置界面与运行资源包。 |
| `snapshot_blob.bin` | V8 JavaScript 引擎启动快照，用于加快引擎初始化。 |
| `v8_context_snapshot.bin` | Chromium 页面 JavaScript 上下文启动快照。 |
| `version` | 当前 Electron/Chromium 运行时版本标记。 |
| `LICENSE` | Electron 许可证。 |
| `LICENSES.chromium.html` | Chromium 及第三方依赖许可证汇总。 |

运行版必须保留整个 `FTSerialTool-win32-x64` 文件夹结构，不能只单独发送里面的 `FTSerialTool.exe`。需要只发送一个文件时，应发送 `dist\FTSerialTool-portable-x64.exe`。
