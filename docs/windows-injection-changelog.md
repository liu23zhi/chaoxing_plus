# Windows 注入方案变更清单

范围：从引入 `--inject-mode` 到当前 HEAD，全部改动均已在本地提交（**未 push**）。
分支：`codex/campus-offline-map`。

## 一、按主题分组的提交

### 1. 注入方式骨架与参数

| 提交 | 内容 |
| --- | --- |
| `bc79bdd` | 新增 `--inject-mode`（解析/校验/合并） |
| `c19c235` | 注入方式分派：未实现模式显式失败（exit 4），显式退出码不被覆盖 |
| `f95ca25` | `--remote-debugging-pipe` 帧编解码（4 字节小端长度前缀）与回归 |
| `5801825` | JSON 配置支持 `injectMode` / `panelAllPages`，同步 `config.example.json` |
| `fe24e51` | 帮助与文档补齐（`--inject-proxy-dir`、`--panel-all-pages`、`--pipe-*`） |
| `8f7e170` | 能力面新增 `injectModeSupport`（每种模式是否可用） |

### 2. dll-proxy（winmm 代理）

| 提交 | 内容 | 证据 |
| --- | --- | --- |
| `2d70a28` | 代理 DLL 骨架：无 CRT、转发 `PlaySoundW`、写 `%TEMP%\cxhook-*.log` | `PASS log` |
| `d3b8486` | 全导出转发（180 个 naked 跳转桩）+ x86 自检 | `proxy-test exit=0` |
| `cf604f2` | **命令行注入**：IAT 改写 `GetCommandLineW` 追加调试开关 | `PASS command line injected` |
| `89c3724` | `proc_launch_env`：可不传端口开关启动 | 编译通过 |
| `1a78aaf` | dll-proxy 接入主流程（宿主设 `CX_INJECT_PORT`，客户端不带端口开关启动） | 夹具 `[launch] Owned client started` |
| `a8773b5` | 运行报告新增 `injectMode` / `commandLineInjected` | `injectMode=dll-proxy commandLineInjected=True` |
| `32b4599` | `env-probe` 夹具验证环境变量确实传到客户端 | `CX_INJECT_PORT=38100` |
| `e91e6a8` | `cdp-server` 夹具（HTTP 端点） | `ownershipVerified=True` |
| `16c01ee` | 夹具补 WebSocket（SHA1/base64 + 帧） | `[session] CDP page connected` |
| `9548f79` | 夹具结构化回复 | `pageSessions=1` |
| `70de635` | 夹具补发 CDP 事件 | `[bootstrap] Injection acknowledged`，`bootstraps=1` |
| `2469dd7` | 固定端口注入：`cxhook-port.txt` + `--proxy-port`（第三方拉起场景） | 仅放端口文件即 `PASS command line injected` |
| `281c0a0` / `1696b32` | `--install-proxy` / `--uninstall-proxy`（含标记文件） | 安装→探测→卸载闭环回归 |
| `64b80f2` | 代理源自动查找 + 发布包附带 `winmm-proxy.dll` | 发布包 12 文件校验通过 |
| `b43d1c2` | 权限失败提示（Program Files 场景） | `access denied writing ...` |

### 3. cdp-pipe（匿名管道 CDP）

| 提交 | 内容 | 证据 |
| --- | --- | --- |
| `7d7ccb1` | `--pipe-test`：证明宿主可用继承管道启动子进程 | `pipe-test: PIPE-TEST-OK` |
| `c716953` | `net_pipe_send_frame` / `net_pipe_recv_frame` + 回环回归 | `PROTOCOL SELF TEST PASS` |
| `6def6a8` | `cdp-echo` 升级为管道版假 CDP 对端 | 回 `Chrome/75…` 与 `sessionId` |
| `3f861ad` | `--pipe-call` 阶段化诊断 | 6 个 stage 全打印 |
| `67a36a2` | open → getVersion → getTargets → attach → evaluate | `stage: session=CXSESSION` |
| `b998c9b` | 支持 `--pipe-expr "<js>"` | `document.title.length` 通过 |
| `78d3f69` | 接入主流程：attach 后注入 bootstrap | `cdp-pipe: bootstrap injected` |
| `e8f655e` | 注入 bundle（复用 sessionId） | `bootstraps=1 bundles=1` |
| `075ca13` | `--panel-all-pages` 生效 + 边界说明 | — |
| `8a946c7` | 补齐配置同步（抽出 `h_build_page_config` 共用） | 三个 `Runtime.evaluate`：配置 / bootstrap / bundle |

### 4. 探测、回归与文档

| 提交 | 内容 |
| --- | --- |
| `d0f6a85` | `--probe-client`：离线探测架构/版本/libcef 开关/代理状态并给建议通道 |
| 本轮 | 探测增加 `client-winmm`（客户端是否导入 winmm.dll，决定代理能否加载） |
| `87078a7` | `--probe-all`：扫描常见目录输出兼容性表 |
| `653fdfd` | 代理闭环回归 `windows-native-proxy-actions` |
| `20d91f5` | `--attach` 回归 `windows-native-attach` |
| `dff5e5a` | 帮助/文档同步回归 `windows-native-help-sync`（101 个开关） |
| `445436c` | `.gitattributes`：`*.sh` 强制 LF |
| `2bf44da` / `8237e65` | 操作手册 `docs/windows-injection-guide.md` + 本机验证记录 |
| `bd335cd` / `61a814d` / `a70a240` | 文档与帮助补漏 |

### 5. 需要知道的一次回退

| 提交 | 说明 |
| --- | --- |
| `b0f5def` → `84a8756` → `8872644` | "auto 自动选择代理" 曾导致 `elevation-host-tests` 17 项失败，先整块回退，后改为**仅在显式 `--inject-mode auto`** 时生效 |

## 二、当前能力矩阵

| 通道 | 启动方式 | 注入内容 | 自动化证据 | 真实客户端 |
| --- | --- | --- | --- | --- |
| `cdp-port`（默认） | 宿主传 `--remote-debugging-port` | bootstrap + bundle + 配置 | 全量测试 | ✅ 面板可见 |
| `dll-proxy` | 代理改写 `GetCommandLineW` | 同上 | 夹具跑到 bootstrap + bundle | ⏳ 需管理员 |
| `cdp-pipe` | `--remote-debugging-pipe` + attach | 同上 | 夹具跑到 bootstrap + bundle | ⏳ 需管理员 |
| `--attach` | 连接外部端点 | 同上 | `windows-native-attach` | ⏳ 需管理员 |
| `input` | — | — | — | ❌ 未实现 |

## 三、验证命令（可复现）

```powershell
# 全量回归
node --test --test-concurrency=4 scripts/*.test.mjs

# 针对性回归
node --test scripts/windows-native-proxy-actions.test.mjs
node --test scripts/windows-native-attach.test.mjs
node --test scripts/windows-native-help-sync.test.mjs

# 离线兼容性表
.\build-windows\bin\chaoxing_plus.exe --probe-all --no-disk-write --quiet
```

最近一次全量结果：**857 项 / 825 通过 / 0 失败 / 32 跳过**。

## 四、未完成项

1. `dll-proxy` 与 `cdp-pipe` 的真实 CEF 75 客户端验收（需管理员权限 + 登录）；
2. 第三份客户端（河南应用技术职业学院）目录不在本机，未纳入探测；
3. `input` 模式未实现（语义待定义）。

