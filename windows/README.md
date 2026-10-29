# windows/ 目录说明

本目录只放 **Windows 端（超星考试客户端 / CEF 75）** 的代码与构建脚本。插件（浏览器扩展）的构建目录不在这里，
`src/`、`dist/`、`build.mjs` 一律原地不动。

| 路径 | 归属 | 说明 |
| --- | --- | --- |
| `native-source/` | 原生 | 原生宿主的 C 源码、头文件、`.inc`、manifest、`assets.rc.in` 与 `tests/*.c`；由 `windows/native/build.ps1` 编译 |
| `native/` | 原生 | 只保留编译脚本 `build.ps1`（MSVC/SDK 定位、RCDATA 资源内嵌，输出到仓库根部 `build-windows/bin`） |
| `share-file/` | 共享 | 两个宿主共用的页面侧资源：`windows-bootstrap.js`（配置水合/面板壳/Chrome75 兼容层）与 `trampoline.js`（早期注入桥）。构建时复制到 `dist-windows/`，原生再以 RCDATA 内嵌 |
| `host/` | Node（已弃用） | Node 宿主实现（`main.mjs`、CDP 注入、选择窗口 `.ps1`、静默 VBS 等）。仅保留作兼容/对照与排障，不再开发新能力 |
| `config.example.json` | 共享 | 宿主配置模板（Node/原生都可只读解析），打包时复制进发布包 |
| `parameter-generator.html` | 共享 | 参数生成器页面（浏览器打开，生成 Node/原生两套命令行） |
| `data/` | 本机 | 运行时数据/日志（gitignore，不入库） |
| `local-features.json` | 本机 | 本机功能开关（gitignore，不得提交） |

## 构建与发布

| 入口 | 作用 |
| --- | --- |
| `build-windows.cmd` | Windows CMD 原生发布：资源 → 原生 x86 EXE → 发布包 → 校验 + 入口自检 |
| `build-windows-node.cmd` | 旧 Node 包（`--skip-native`），备用 |
| `build-windows.sh` / `build-windows-node.sh` | 同上两者的 Git Bash 版本 |
| `build-browser.sh` | 只构建浏览器扩展（`dist/`），与 Windows 宿主无关 |
| `windows/native/build.ps1` | 只编译原生宿主与测试 EXE（`-BuildTests`） |

`.cmd` 与 `.ps1` 必须保持**纯 ASCII**：PowerShell 5.1 按 ANSI 解码无 BOM 脚本；cmd 在 `chcp 65001` 下解析
中文 `rem` 行会吞掉后续命令（已实测）。中文提示只出现在原生程序内部与文档中。

## 相关文档

- `docs/windows.md`：宿主设计、配置、诊断与验收命令
- `AGENTS.md`：Windows 端必须遵守的边界与回归清单
