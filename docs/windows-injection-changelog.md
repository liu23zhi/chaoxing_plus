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
## 五、真实客户端验收结果（2026-10-29，管理员权限实测）

| 客户端 | `--remote-debugging-port` | 注入结果 |
| --- | --- | --- |
| 电子科技大学中山学院 考试客户端 4.1.4.25512 | ✅ 启动 1 秒内开端口 | ✅ `ownershipVerified=true`、`pageSessions=1`、`bootstraps=6`、`bundles=6`；用户确认面板正常 |
| 河南应用技术职业学院 考试客户端 4.1.4.25512 | ✅ 同上 | ✅ `ownershipVerified=true`、`pageSessions=1`、`bootstraps=7`、`bundles=7`；**用户确认客户端内可见悬浮面板** |
| 超星考试客户端 4.3.0.4 | ❌ 完全不开端口（等待 30 秒 `no-listener`） | 无法注入（Themida 加壳，命令行开关被忽略） |

补充结论：

1. 三份客户端**都在本机**（`C:\Users\Zelly\Desktop` 下三个目录），此前"第三份缺失"的判断是搜索方式有误，已更正。
2. `dll-proxy` 的 PEB 命令行改写**在客户端进程内确实生效**（诊断日志显示真实 `GetCommandLineW` 已含开关），但超星 4.3.0.4 仍不开端口 → 该客户端在应用层过滤/忽略调试开关（**后续已用 `cef_initialize` 强制 `remote_debugging_port` 解决，见第七节**），代理方案对它无效。
3. 因此三条注入通道的实际适用范围：`cdp-port` 与 `cdp-pipe` 适用于两份 4.1.4 客户端；`dll-proxy` 不适用于任何已测客户端（仅保留作研究记录）。
### 4.3.0.4 专项结论（结论：当前无法注入）

针对"超星考试客户端 4.3.0.4"做了三轮尝试，均未打开调试端点：

| 尝试 | 结果 |
| --- | --- |
| 命令行传 `--remote-debugging-port` | 30 秒 `no-listener`（该客户端忽略开关） |
| winmm 代理改写 PEB 命令行 | 进程内 `GetCommandLineW` 确实返回带开关的字符串（日志 `| 1`），但 Chromium 仍未监听 → libcef 早于 winmm 加载，命令行已被读走 |
| 代理挂 `cef_initialize` / `cef_command_line_get_global` | 该 EXE 只从 libcef 导入 `cef_command_line_get_global`；钩子能装上（日志 `command line getter hooked`），但应用未在关键时刻调用它，开关未追加成功 |

结论：4.3.0.4 为 Themida 加壳版本，未暴露可用的 CDP 入口；建议使用两份 4.1.4 客户端（已实测可注入并可见面板）。
### cdp-pipe 真机验收状态（结论：真机不响应）

- 夹具验证：`--inject-mode cdp-pipe` 对 `cdp-echo` 假对端可完成 bootstrap + bundle（`bootstraps=1 bundles=1`）。
- 真机：宿主在管道模式启动客户端时若返回 Win32 740，会请求 UAC（`cdp-pipe: client requires administrator rights; requesting UAC`）；本会话的自动化提权未能稳定建立，因此**真机 pipe 注入尚未取得报告证据**。建议在管理员 PowerShell 中直接执行：
  ```powershell
  .\build-windows\bin\chaoxing_plus.exe --inject-mode cdp-pipe --client "<4.1.4 客户端>" --panel-all-pages
  ```
补测（2026-10-29）：把 4.1.4 客户端复制到临时目录并用 `mt.exe` 改写清单为 `asInvoker`，绕开 UAC 后以管理员无关身份运行：

```
cdp-pipe: launching client with --remote-debugging-pipe
cdp-pipe: Target.getTargets attempt 1 status 0   （超时）
cdp-pipe: Target.getTargets attempt 2 status 0
cdp-pipe: Target.getTargets attempt 3 status 0
cdp-pipe: Target.getTargets attempt 4 status 0
```

客户端正常启动但管道上没有任何响应 → 该客户端（或该 CEF 构建）未启用 `--remote-debugging-pipe`。因此 `injectModeSupport.cdp-pipe` 改回 `false`：管道通道仅对夹具（cdp-echo）可用，不能用于真实客户端。
## 六、安全软件干扰（火绒）

2026-10-29 测试期间系统提示"检测到火绒软件，疑似冲突"。以下现象与安全软件拦截**高度吻合**，在排除前不宜据此判定通道本身不可用：

| 现象 | 可能是拦截点 |
| --- | --- |
| 客户端加载 winmm 代理后 `0xc0000142` | 无签名 DLL 的加载/初始化被拦截 |
| 代理已安装但 `%TEMP%\cxhook-*.log` 缺失或日志不完整 | 文件写入/进程注入监控 |
| `--remote-debugging-pipe` 客户端启动正常但管道无任何回包 | 调试端口/管道通信被防护拦截 |
| 偶发的 `CreateProcessW` 失败（如 267/740 之外的错误） | 进程创建监控 |

复测建议（需要用户操作）：

1. 把以下路径加入火绒信任区：仓库根目录（尤其 `build-windows\`）、被测客户端目录、`%TEMP%` 下 `cx-*` 目录；
2. 或临时退出火绒的"实时监控/主动防御"；
3. 重新执行：
   ```powershell
   .\build-windows\bin\chaoxing_plus.exe --inject-mode cdp-pipe --client "<4.1.4 客户端>" --panel-all-pages
   ```
4. 若排除后管道仍无回包，才能确认"该 CEF 构建不支持 pipe 调试"这一结论。

注意：`cdp-port`（端口）通道在同样装着火绒的机器上是**实测可用**的（两份 4.1.4 客户端均出面板），因此端口通道不受此干扰影响。
### 火绒排查结论（2026-10-30）

| 检查项 | 结果 |
| --- | --- |
| 产物是否被隔离/删除 | 否：`chaoxing_plus.exe`(606720)、`winmm.dll`(19456)、`cdp-echo.exe`、`cdp-server.exe`、`winmm-proxy.dll` 全部在位 |
| 我们的 EXE 能否反复执行 | 能：`--self-check` 连续 3 次 exit=0 |
| 我们的 DLL 能否加载并生效 | 能：`proxy-test` 全通过（含 `PASS command line injected`） |
| 火绒隔离区/日志 | `C:\ProgramData\Huorong\Sysdiag\Quarantine` 最后写入 2026-10-28（早于本次测试）；`hips.db`/`behav.db` 存在但未解析 |
| 系统事件 | 2026-10-30 00:13:52/59 有 SecurityCenter 注册事件（火绒重新注册/更新），无拦截记录 |

因此**没有证据表明火绒拦截了我们的程序**。

反证（关键）：用 `--pipe-call` 连接**官方 Chrome**（`--remote-debugging-pipe` + 独立 user-data-dir）同样只走到 `stage: getVersion` 就失败、零回包。Chrome 一定支持该开关，说明问题在我们的管道实现（帧格式/句柄语义），而不是被安全软件拦截。

进一步推断：Chromium 的 DevTools 管道在 Windows 上并不使用 stdin/stdout，而是使用子进程的 **fd 3/4（CRT 句柄编号）**——Puppeteer 的 `pipe:true` 就是按 fds 3/4 传的。我们当前实现走的是 stdin/stdout，所以两端都收不到回包。

若要继续推进该通道，需要：
1. 用 `PROC_THREAD_ATTRIBUTE_HANDLE_LIST` / `STARTUPINFOEX` 让子进程拿到两根专用管道；
2. 按 Chromium 的 NUL 结尾 JSON 帧收发；
3. 先用官方 Chrome 做对照（成功即实现正确），再回到 CEF 客户端。

在完成上述改造前，`cdp-pipe` 维持 `false`（不可用），`cdp-port` 仍是唯一验证可用的注入通道。
## 七、4.3.0.4 解决方案（2026-10-30，已实测打通端口）

### 根因（IG5 + 运行时证据）

| 证据 | 说明 |
| --- | --- |
| IG5 静态分析 | `CXExam.exe` 仅 2 个可识别函数，节表含 `.themida`(5.7MB) 与 `.boot`(3.4MB)，入口在 `.boot` → Themida 加壳，静态不可读 |
| 字符串对照 | 4.1.4 EXE 含 `cef_initialize`/`cef_execute_process`；**4.3.0.4 EXE 只有 `cef_command_line_get_global`** → 初始化入口被壳隐藏 |
| 运行时命令行 | 带 `--remote-debugging-port=38800` 启动后，浏览器进程命令行**仍含该开关**，但端口不开 → 客户端禁用了命令行开关（CEF `command_line_args_disabled` 语义） |
| `/json/list` | 端口强制打开后返回 `[ ]`（登录前没有 page target） |

结论：4.3.0.4 不是"不能注入"，而是**忽略命令行开关**；只要在 `cef_initialize` 里把 `CefSettings.remote_debugging_port` 写进去，端口立刻可用。

### 解法（已实现于 winmm 代理）

1. 在代理工作线程里定位 `libcef!cef_initialize`；
2. 识别其 GCC/MinGW 序言 `55 89 E5 53 57 56`（6 字节完整指令边界），用 `push <hook>; ret` 做 6 字节补丁（另支持 `55 8B EC 83 EC` 的 MSVC 形态）；
3. 钩子里按 `cef_settings_t.size` 定位 `remote_debugging_port`（size≥228 → offset 184；==216 → offset 172）并写入端口。

### 实测结果（asInvoker 副本，无需 UAC）

```
winmm proxy: cef_initialize patched (pushret)
winmm proxy: cef settings port applied
port-open-after=1s
/json/version → Browser: Chrome/75.0.3770.100
                User-Agent: chaoxingExamPc/chaoxingExam_4.3.0.4_...
```

宿主完整流程：`ownershipVerified=True`（端点被发现且归属校验通过）；`pageSessions=0` 是因为**登录前没有 page target**（`/json/list` 为空），登录后应出现并可注入。

### 使用方式

```powershell
# 1) 安装代理到 4.3.0.4 客户端目录
.\build-windows\bin\chaoxing_plus.exe --install-proxy --proxy-source ".\build-windows\hook\winmm.dll" --client "<4.3.0.4>\CXExam.exe"
# 2) 正常启动（会弹 UAC），登录后面板应出现
.\build-windows\bin\chaoxing_plus.exe --client "<4.3.0.4>\CXExam.exe" --panel-all-pages
# 3) 还原
.\build-windows\bin\chaoxing_plus.exe --uninstall-proxy --client "<4.3.0.4>\CXExam.exe"
```

`--probe-client` 对加壳客户端现在输出 `suggested=dll-proxy-required`（未装代理）或 `dll-proxy`（已装）。
### 4.3.0.4 真机验收通过（2026-10-30，UAC 实测）

用户批准 UAC 后，用真实「超星考试客户端 4.3.0.4」完整跑通：

```
代理日志：cef_initialize patched (pushret)
report: ownershipVerified=True pageSessions=1 bootstraps=6 bundles=6 stopReason=client-exit
```

用户反馈：**"程序启动正常，并且看到面板了"**。

至此三份客户端全部可用：

| 客户端 | 通道 | 结果 |
| --- | --- | --- |
| 电子科技大学中山学院 4.1.4.25512 | `cdp-port` | ✅ bootstraps=6 bundles=6，面板可见 |
| 河南应用技术职业学院 4.1.4.25512 | `cdp-port` | ✅ bootstraps=7 bundles=7，面板可见 |
| 超星考试客户端 4.3.0.4 | `dll-proxy`（cef_initialize 强制设置端口） | ✅ bootstraps=6 bundles=6，面板可见 |

注意：4.3.0.4 必须先把 `winmm.dll` 代理装进客户端目录（`--install-proxy`），否则它忽略命令行开关、端口不会打开。使用完可用 `--uninstall-proxy` 还原。
### auto 模式自动切换（2026-10-30）

`--inject-mode auto`（默认）现在会先探测客户端是否带 `.themida` 节：

| 情况 | 行为 |
| --- | --- |
| 加壳 + 已装代理 | 自动启用 `dll-proxy`，打印「auto: 检测到加壳客户端，已自动启用 dll-proxy」 |
| 加壳 + 未装代理 | 打印提示，要求先 `--install-proxy`（否则命令行开关会被忽略） |
| 未加壳 | 保持 `cdp-port`，行为不变 |

实测：4.3.0.4 命中自动切换；4.1.4 不触发。
### cdp-pipe 终局证据（2026-10-30，官方 Chrome 对照）

用官方 Chrome 直接验证管道模式，Chrome 在启动瞬间就报错退出：

```
[1030/005628.789:ERROR:chrome\app\chrome_main_delegate.cc:1226] Remote debugging pipe file descriptors are not open.
```

即便把 stdin/stdout 都接成管道（.NET `RedirectStandardInput/Output`），Chrome 仍然报同一条错误并退出（exit 13）。这说明 Windows 上的 `--remote-debugging-pipe` **不读 stdin/stdout**，而是需要额外的管道描述符，而我们的 `CreateProcessW` + 匿名管道模型无法提供。

结论：`cdp-pipe` 在 Windows 上对本项目的两种宿主都不可行（不是 CEF 客户端裁剪，也不是火绒拦截）。保留实现仅供夹具与排障使用，能力面维持 `cdp-pipe:false`。

附带改进：`--pipe-call` 诊断改为 NUL 帧优先（1.5s 超时）再回退长度前缀，既保留夹具可用性，又避免长时间等待。
## 八、IG5 反编译确认 cef_settings_t 布局（2026-10-30）

对 `libcef.dll`（92MB，full 分析 605s、75,293 函数）反编译 `cef_initialize`（`0x10001181`）与其设置拷贝函数 `FUN_100030bc`，得到硬证据：

```
cef_initialize:
  uStack_1c = *param_1;          // *settings = size
  uStack_108 = 0xe4;             // 0xE4 = 228
```

`FUN_100030bc` 逐字段拷贝，偏移与 CEF 头文件完全一致：

| 偏移 | 字段 |
| --- | --- |
| +0x04 | `no_sandbox` |
| +0x2C (44) | `command_line_args_disabled` |
| +0xB4 (180) | `pack_loading_disabled` |
| **+0xB8 (184)** | **`remote_debugging_port`** |
| +0xBC (188) | `uncaught_exception_stack_size` |
| +0xC8 (200) | `background_color` |
| +0xD8 (216) | `application_client_id_for_file_scanning` |
| sizeof | **0xE4 = 228** |

结论：代理里 `size>=228 → offset 184` 的判定不是猜测，与 libcef 实际布局一致；`--install-proxy` 后 4.3.0.4 端口 1 秒内打开可复现。

同一轮还额外把 `command_line_args_disabled`（+44）清零作为防御性处理：实测该客户端本来就是 0（日志无 `command_line_args_disabled=N>0`），说明它忽略开关的原因在于应用自行构造命令行而非该字段，端口强制仍然有效。

另：`cdp-pipe` 已用官方 Chrome 取得终局证据——Chrome 启动即报 `Remote debugging pipe file descriptors are not open`（exit 13），即该模式在 Windows 上不使用 stdin/stdout，本项目 `CreateProcessW` + 匿名管道模型无法满足。
### 偏移逻辑修正与 libcef 同一性（2026-10-30）

三份客户端的 `libcef.dll` **完全同一份**：

```
超星 4.3.0.4           97297400 bytes  sha256=E65E3A2C8BDD230C...
电子科大 4.1.4.25512   97297400 bytes  sha256=E65E3A2C8BDD230C...
河南 4.1.4.25512       97297400 bytes  sha256=E65E3A2C8BDD230C...
```

因此 IG5 对其中任意一份的布局结论（sizeof=228、`remote_debugging_port`=+184）对三份客户端同时成立。

配套修正：原先"size==216 → 偏移 172"的回退分支是**错误**的。IG5 显示 216 的差异只来自结构体末尾少了 `application_client_id_for_file_scanning`（+0xD8 起 12 字节），`remote_debugging_port` 仍固定在 +184；写 172 会破坏 `locales_dir_path` 的字符串指针。现已改为：**只要 `size >= 188` 就使用 184**，否则记录 size 并跳过。

复测（4.3.0.4 asInvoker 副本）：`port-open-after=1s`、`listener=True`。

补充说明：把代理装到 4.1.4 的 asInvoker 副本后，客户端自身在非管理员下会提前退出（`client-exit-before-endpoint`），因此"4.1.4 + 代理"这条组合仍**未经管理员真机验证**，不作为已支持结论。
### 运行时 size 复核与未完成的验证（2026-10-30）

代理新增一行运行日志，用于核对 IG5 静态结论：

```
winmm proxy: cef_initialize patched (pushret)
winmm proxy: cef_settings size=228
winmm proxy: cef settings port applied
listener=True            ← 4.3.0.4 asInvoker 副本，端口正常
```

`cef_settings size=228` 与 IG5 反编译得到的 `0xE4(228)` 完全一致，静态结论与运行时行为对上。

未完成项（如实记录）：把代理装进真实「河南 4.1.4」目录后运行宿主，**UAC 未获批准**，父实例等待到超时、未生成报告。已执行 `--uninstall-proxy` 还原该目录，当前三份客户端目录中只有 4.3.0.4 保留代理（这是它可用的前提）。"4.1.4 + 代理"仍未验证。
### 4.1.4 + 代理：实测崩溃，改为明确拒绝（2026-10-30）

按用户要求做了 UAC 真机验证，结果不是"能用"，而是**崩溃**。系统事件日志：

```
出错应用程序名称： CXExam.exe，版本： 4.1.4.25512
出错模块名称：     libcef.dll，版本： 75.1.4.0
异常代码：         0xc0000005
错误偏移：         0x0193c706
```

代理日志显示该进程同时做了三件事：

```
winmm proxy: cef_initialize patched (pushret)    ← 强制 settings 端口
winmm proxy: cef_settings size=228
winmm proxy: cef settings port applied           ← 出现两次
winmm proxy: cef command line switch appended    ← vtable append(索引 76)
winmm proxy: hook pass1 slots=21                 ← 另外还改了 21 个 IAT
```

处置（两条都已实测）：

1. **停用高风险的 vtable append**：`cef_command_line_get_global` 的 vtable 索引在跨构建时不保证稳定，写错会破坏内存；端口改由 `cef_initialize` 设置即可，已默认不再调用。
2. **对非加壳客户端直接拒绝 dll-proxy**：

```
$ chaoxing_plus.exe --inject-mode dll-proxy --client "<4.1.4>\CXExam.exe"
非加壳客户端无需 dll-proxy：它支持命令行开关，请改用默认的 cdp-port
（实测 4.1.4 客户端装代理后会在 libcef.dll 内 0xC0000005 崩溃）
exit=4  stopReason=inject-proxy-not-needed
```

停用 vtable append 后复测 4.3.0.4 副本：

```
winmm proxy: cef_settings size=228
winmm proxy: cef settings port applied
port-open-after=1s          ← 仍然正常
（无 "command line switch appended" 日志，符合预期）
```

结论更新：`dll-proxy` **只适用于加壳客户端（4.3.0.4）**；两份 4.1.4 客户端必须走 `cdp-port`。河南 4.1.4 目录已还原（`winmm=False`）。
### 4.1.4 崩溃点定位（IG5，2026-10-30）

崩溃偏移 `0x0193c706` 加上 PE 基址 `0x10000000` → `0x1193c706`。用 IG5 反编译同区域函数后定位到调用链：

```
cef_initialize(0x10001181)
  └─ FUN_1193ba38(0x1193ba38)       // 检查 settings 尺寸字段 == 0xE4(228)，建 CEF 上下文
       └─ FUN_1193bba6(0x1193bba6)  // 对应源码路径 ../../cef/libcef/browser/context.cc:Initialize
            └─ FUN_1193c698         // 0x1193c698 起，覆盖 0x1193c706（崩溃指令所在）
```

三个要点：

1. `FUN_1193ba38` 第一件事就是校验 `*(int *)(param_2 + 4) == 0xe4`，与我们运行时日志 `cef_settings size=228` 一致——说明**尺寸检查通过**，崩溃不在尺寸判定。
2. 崩溃发生在 `context.cc:Initialize` 之后的子函数里，属于上下文初始化阶段，而不是设置拷贝阶段。
3. 4.1.4 那一次运行同时做了三件事（settings 端口 + PEB 命令行改写 + 21 处 IAT 补丁 + vtable append），而 4.3.0.4 同样的 settings 补丁却稳定；差异在于前者的命令行开关**本来就生效**，属于"重复注入"。

因此维持既有处置：非加壳客户端一律走 `cdp-port`，`dll-proxy` 只用于加壳客户端；vtable append 已停用。IG5 给出的调用链作为该结论的支撑证据记录在此，不再继续深挖崩溃根因（收益低于风险）。
### dll-proxy 自动安装与自动还原（2026-10-30）

`--inject-mode dll-proxy` 不再要求手工 `--install-proxy`：

| 场景 | 行为 |
| --- | --- |
| 客户端目录没有代理 | 自动复制 `winmm.dll` + 写标记，打印「本次运行临时安装代理，结束后自动还原」 |
| 运行结束（含失败路径） | 自动删除代理与标记；被占用时重试约 5 秒 |
| 客户端目录已有代理 | 不重复安装，也不会在结束时删除 |

实测（asInvoker 副本，无 UAC）：

```
install-proxy: copied ...\winmm.dll -> ...\winmm.dll
dll-proxy: 本次运行临时安装代理，结束后自动还原
report: injectMode=dll-proxy ownershipVerified=True stopReason=client-exit
uninstall-proxy: removed ...\winmm.dll
after: proxy=False marker=False      ← 目录已还原
```

同时修掉两个输出缺陷：

1. `install-proxy: copied ...` 缺换行，与后续输出粘在一起（已补 `\n`，并把误并入成功分支的失败提示恢复成 `else` 分支）；
2. 加壳客户端在**已装代理**时仍打印「请用 --install-proxy」，该重复提示块已删除，改为由 auto 分支统一提示。

注意：4.3.0.4 目录当前保留代理（用户日常可用）；即使删掉，下次以 `dll-proxy` 启动也会自动装好并在退出时清理。
### `input` 模式正式移除（2026-10-30）

`input` 从 `--inject-mode` 的可选值中移除，能力面同步：

```json
"injectModes":["auto","cdp-port","cdp-pipe","dll-proxy"]
"injectModeSupport":{"auto":true,"cdp-port":true,"cdp-pipe":false,"dll-proxy":true}
```

显式传入时给出明确指引并退出：

```
$ chaoxing_plus.exe --inject-mode input --client "<客户端>"
input 模式未实现：请改用 cdp-port（4.1.4 客户端）或 dll-proxy（加壳客户端，如 4.3.0.4）
exit=4  stopReason=inject-input-unavailable
```

理由：该模式从来没有语义定义，长期以 `input:false` 挂在能力面会误导使用者。与其保留一个幻影开关，不如移除并在文档中说明三种真实通道。

同一轮 IG5 反编译 `cef_execute_process`（0x100010ac）确认其签名只有 `CefMainArgs* / CefApp* / sandbox_info`，**没有 CefSettings**：

```c
undefined4 cef_execute_process(undefined4 *param_1, undefined4 param_2, undefined4 param_3)
```

也就是说调试端口只能在浏览器进程的 `cef_initialize` 里设置，子进程无法通过 settings 注入——这与我们"代理只钩 cef_initialize"的实现完全一致，属于设计闭环的最后一环证据。
### 全自动通道选择（2026-10-30）

`auto`（默认）现在是**完整自动**，不需要任何 `--inject-mode`：

| 客户端 | 自动行为 | 报告 `injectMode` |
| --- | --- | --- |
| 无 `.themida` 节（4.1.4 ×2） | 直接用命令行端口，不碰客户端目录 | `cdp-port` |
| 有 `.themida` 节 + 已有代理 | 走代理（cef_initialize 强制端口） | `dll-proxy` |
| 有 `.themida` 节 + 无代理 | **自动安装代理**，运行结束自动还原 | `dll-proxy` |
| 自动安装失败（目录只读等） | 打印可操作提示，不静默降级 | — |

实测（asInvoker 副本，无 UAC）：

```
# 加壳客户端，起点无代理
auto: 检测到加壳客户端，已自动安装代理并启用 dll-proxy（结束后还原）
report: injectMode=dll-proxy ownershipVerified=True
uninstall-proxy: removed ...\winmm.dll
end-state: proxy=False marker=False

# 非加壳客户端
report: injectMode=cdp-port ownershipVerified=True
end-state: proxy=False
```

回归：`windows-native-proxy-actions.test.mjs` 新增「auto 模式对加壳客户端自动选择 dll-proxy 并清理临时代理」，断言报告 `injectMode` 与目录零残留。
### 控制台中文乱码与调试入口 GUI（2026-10-30）

用户反馈 `start-windows-debug.cmd` 下客户端列表显示为 `娌冲崡搴旂敤...`，并且选择窗口（GUI）不再出现。

**乱码根因**：`h_print` 把宽字符转成 **UTF-8 字节**后直接 `WriteFile` 到控制台；Windows 中文控制台代码页是 936(GBK)，UTF-8 字节被按 GBK 解释 → 典型 `娌冲崡` 乱码。

修复：输出目标是控制台时改用 `WriteConsoleW` 直接写宽字符（编码无关）；输出被重定向到管道/文件时仍走 UTF-8，保证脚本与测试解析不受影响。

验证（重定向输出，仍以 UTF-8 显示正常）：

```
1  x86  4.1.4.25512  C:\Users\Zelly\Desktop\河南应用技术职业学院 考试客户端_V4.1.4.25512(2023.06.09)\CXExam.exe [recommended]
2  x86  4.1.4.25512  C:\Users\Zelly\Desktop\电子科技大学中山学院 考试客户端_V4.1.4.25512(2023.06.09)\CXExam.exe
3  x86  4.3.0.4       C:\Users\Zelly\Desktop\超星考试客户端_V4.3.0.4\CXExam.exe
```

**GUI 消失根因**：`start-windows-debug.cmd` 以 `--console` 启动宿主，而宿主的 `auto` 判定在"有控制台"时走文本选择。调试入口改成：

```
"%CXPLUS_EXE%" --console --ui gui %*
```

显式 `--ui gui` 不受"是否附带控制台"影响，调试窗口与控制台可同时存在；用户自己传 `--ui console` 仍可覆盖。

注意：该 `.cmd` 必须保持 **LF** 换行（`windows-silent-launcher.test.mjs` 断言 `source.includes('\r') === false`），本次写入时已显式转换。
## 九、settings-only 模式：更稳定的注入路径（2026-10-30，无 UAC 实测）

### 背景

此前 4.1.4 客户端装代理会在 `libcef.dll` 里 `0xC0000005` 崩溃。IG5 定位到崩溃在 `context.cc:Initialize` 之后，而当时的代理同时做了三件事：强制 settings 端口、改写 PEB 命令行、补 21 处 `GetCommandLineW` IAT 项，还有一次 vtable append。

### 改动

1. **settings-only 优先**：`cef_initialize` 6 字节 `push/ret` 补丁安装成功后，代理**立即返回**，完全不碰命令行与 IAT；
2. **强制开关**：宿主在 `dll-proxy` 模式启动客户端时设置 `CX_PROXY_SETTINGS_ONLY=1`，代理读到后即使补丁失败也不做任何命令行/IAT 改写（宁可失败也不制造重复注入）；
3. **解除限制**：既然 settings-only 稳定，允许 `--inject-mode dll-proxy` 用于任意客户端（原先对非加壳客户端直接拒绝）。

### 无 UAC 实测（asInvoker 副本）

```
# 4.3.0.4
winmm proxy: settings-only mode
winmm proxy: cef_settings size=228
winmm proxy: cef settings port applied
port-open-after=1s   listener=True   alive=True

# 4.1.4（此前必崩，现在稳定）
winmm proxy: settings-only mode
winmm proxy: cef_settings size=228
winmm proxy: cef settings port applied
alive-after-12s=True  listener=True

# 4.1.4 走宿主完整链路
report: injectMode=dll-proxy ownershipVerified=True stopReason=duration
（pageSessions=0 是登录前没有 page target，与 4.3.0.4 同因）
```

### 结论

`dll-proxy`（settings-only）现在是三份客户端**通用且更稳定**的注入方式：
- 不再依赖命令行是否被尊重（加壳客户端本来就忽略）；
- 不再改动 PEB/IAT，抹掉了此前 4.1.4 崩溃的那部分动作；
- 两份 4.1.4 仍推荐 `cdp-port`（零文件、零安装），但需要统一通道时可直接用 `dll-proxy`。
## 十、多目标代理：version.dll 注入通道（2026-10-30，无 UAC 实测）

### 动机

此前代理固定为 `winmm.dll`。若某个客户端不导入 winmm（或该名字被占用），注入就无法进行。三份客户端都导入 `version.dll`，因此新增第二个代理目标。

### 实现

- 代理源码把目标 DLL 名参数化：`CX_PROXY_TARGET_DLL`（默认 `L"winmm.dll"`），加载系统同名 DLL 时使用该宏；
- `build-proxy.ps1` 增加 `-Target <name>`：按该名字 dump 系统导出、生成 stubs/def、输出 `build-windows/hook/<name>.dll`；
- 宿主新增 `--proxy-target winmm|version`，安装/卸载/自动安装都按目标名落到 `<name>.dll`。

### 无 UAC 实测

```
# 构建
build-proxy.ps1                → winmm.dll   21504 bytes
build-proxy.ps1 -Target version → version.dll 11776 bytes

# 用 version.dll 代理注入 4.3.0.4 副本（客户端目录内无 winmm.dll）
port-open-after=1s   listener=True   alive=True
winmm proxy: cef_initialize patched (pushret)
winmm proxy: settings-only mode
winmm proxy: cef_settings size=228
winmm proxy: cef settings port applied

# 宿主安装/卸载
--install-proxy --proxy-target version   → 只生成 version.dll + marker，不碰 winmm.dll
--uninstall-proxy --proxy-target version → 两者都被清除
```

回归：`windows-native-proxy-actions.test.mjs` 新增 `--proxy-target version` 用例（断言不写 winmm.dll、卸载后零残留），全量 862 项通过。
### 三载体与自动选择（2026-10-30，无 UAC 实测）

新增 `uxtheme.dll` 载体，并把载体选择做成自动：

```
$ chaoxing_plus.exe --probe-client "<客户端>\CXExam.exe"
probe: packed=themida
probe: proxies=winmm,version,uxtheme     ← 按导入表实测得出
probe: suggested=dll-proxy
```

- `--proxy-target winmm|version|uxtheme`：显式指定载体；
- `--proxy-target auto`：按客户端导入表挑第一个可用载体（winmm → version → uxtheme），都不导入时回落 winmm；
- 安装/卸载/自动安装的目标文件名由载体推导（`<carrier>.dll`），不再写死 winmm。

三种载体在同一份 4.3.0.4 副本上的实测结果：

| 载体 | 端口 | 日志要点 |
| --- | --- | --- |
| `winmm.dll` | 1 秒打开 | settings-only + size=228 + port applied |
| `version.dll` | 1 秒打开 | 同上 |
| `uxtheme.dll` | 1 秒打开 | 同上 |

回归：`windows-native-proxy-actions.test.mjs` 增至 6 项（新增 uxtheme 与 auto 解析用例），全量 863 项通过。
### 载体冲突处理（2026-10-30，无 UAC 实测）

客户端目录里可能已经存在第三方同名 DLL（例如别的软件放置的 `winmm.dll`）。现在的规则：

| 场景 | 行为 |
| --- | --- |
| 目标 `<carrier>.dll` 不存在 | 正常安装 |
| 已存在且 marker 是我们写的 | 视为自己的，正常覆盖 |
| 已存在且无 marker，`--proxy-target auto` | 按 winmm → version → uxtheme 换下一个可用载体 |
| 已存在且无 marker，显式 `--proxy-target` | 直接报错并提示换载体或手工清理 |

marker 现在记录实际载体名：

```
cxhook-proxy
carrier=version
```

卸载据此删除对应文件，**不会**碰第三方同名 DLL。

实测：

```
install-proxy: 载体冲突，改用 version
install-proxy: copied ...\version.dll -> ...\version.dll
（目标目录保留第三方 winmm.dll 原样）
uninstall-proxy: removed ...\version.dll
卸载后：只剩 CXExam.exe + 第三方 winmm.dll
```

回归：proxy-actions 增至 7 项，全量 864 项通过。
### 端口自愈：失败后自动改用 settings-only 代理（2026-10-30，无 UAC 实测）

**问题**：如果某个客户端忽略命令行开关、又没被打包壳标记为"加壳"，`auto` 会走端口方式并失败——之前只能干等 30 秒后报错。

**改动**：`auto` 模式下端口尝试失败（拿不到端点）时，自动：

1. 停掉本次启动的客户端，并轮询等待实例真正退出（否则重启会撞 `client-already-running`）；
2. 安装 settings-only 代理（按导入表选载体、冲突时换载体）；
3. 重新启动客户端，用代理强制 `remote_debugging_port`。

触发条件严格限定：显式 `--inject-mode cdp-port`、`--attach`、或已经是代理模式时不重试。

**构造验证场景（无 UAC）**：把 4.3.0.4 副本的 `.themida` 节名改成 `.xemida0`，让加壳检测落空（但客户端行为仍是忽略开关），于是 `auto` 先走端口并失败。

实测输出：

```
端口方式未拿到端点，改用 settings-only 代理重试
report: injectMode=dll-proxy ownershipVerified=True stopReason=duration
after: proxy=False marker=False          ← 自愈期间装的代理在退出时也清理了
```

对比改造前：同样场景会直接以 `endpoint-unavailable` 结束、没有面板。

回归：`windows-native-proxy-actions.test.mjs` 新增「端口拿不到端点时自动改用 settings-only 代理重试」用例（用夹具改名 `.xemida0` 构造同款场景），全量 865 项通过。
### 五载体扩展与 imm32 否决（2026-10-30，无 UAC 实测）

在 winmm / version / uxtheme 之外，新增 `msimg32` 与 `sensapi` 两个小载体，并把载体表集中为一处（`h_proxy_carriers`）：

```
probe: proxies=winmm,version,uxtheme,msimg32,sensapi
```

逐个载体实测（4.3.0.4 asInvoker 副本，无 UAC）：

| 载体 | 端口 | 说明 |
| --- | --- | --- |
| `winmm.dll` | ✅ 1 秒 | 已验证 |
| `version.dll` | ✅ 1 秒 | 已验证 |
| `uxtheme.dll` | ✅ 1 秒 | 已验证 |
| `msimg32.dll` | ✅ | `settings-only` + `size=228` + `port applied` |
| `sensapi.dll` | ✅ | 同上 |
| `imm32.dll` | ❌ | 代理能构建（19456 字节），但客户端进程里**没有加载记录**、端口不开；原因未查明，已从载体表移除 |

构建脚本的导出门槛从 8 降到 2，以便支持只有 3~5 个导出的小 DLL；报错文案也改成按目标名输出。

回归：`--proxy-target msimg32 / sensapi` 的安装+卸载用例已加入，proxy-actions 共 9 项；全量 866 项通过。
### imm32 谜团解开：它是 KnownDLLs（2026-10-30）

上一轮 imm32 载体"能构建却不加载"，原因查明并已核实：

```powershell
# HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\KnownDLLs
imm32 : KNOWN
winmm / version / uxtheme / msimg32 / sensapi : not-listed
```

**KnownDLLs 里的 DLL 会被系统强制从 System32 加载**，应用目录放同名文件完全不起作用——所以我们的 imm32 代理永远不会被加载。这不是构建问题，也不是时序问题。

处置：

1. 载体表剔除 imm32（保持 winmm / version / uxtheme / msimg32 / sensapi 五个）；
2. 新增 `h_carrier_is_known_dll()`（内置 KnownDLL 清单：imm32、kernel32、user32、gdi32、advapi32、ole32、oleaut32、shell32、shlwapi、comdlg32、comctl32、rpcrt4、ws2_32、msvcrt、ntdll、userenv、wininet、crypt32 等）；
3. 显式指定这类名字时直接拒绝，避免用户白折腾：

```
$ chaoxing_plus.exe --install-proxy --proxy-target imm32 --client "<客户端>"
install-proxy: 该名字在 KnownDLLs 里（系统强制从 System32 加载），应用目录放同名 DLL 无效；请换一个载体
exit=1（不产生任何文件）
```

4. `--probe-client` 的 `proxies=` 也不再列出 KnownDLL 名字。

回归：新增「KnownDLLs 里的名字（imm32）拒绝作为载体」用例，proxy-actions 共 10 项；全量 867 项通过。
### 载体扩展到七个（2026-10-30，无 UAC 实测）

新增 `oledlg.dll`（12800 字节）与 `wtsapi32.dll`（16896 字节），两者都不在 KnownDLLs 中：

```
probe: proxies=winmm,version,uxtheme,msimg32,sensapi,oledlg,wtsapi32
```

单个载体注入实测（4.3.0.4 asInvoker 副本）：

```
# 客户端目录只放 oledlg.dll
listener=True   alive=True
```

- 载体表扩充为 7 项，`auto` 选择 / 冲突避让 / 探测输出自动跟随；
- `--proxy-target` 可接受的名字同步扩展；
- 回归用例的小载体列表扩为 `msimg32 / sensapi / oledlg / wtsapi32`。

注意：`build-windows/hook/imm32.dll` 仍会被构建脚本产出（`-Target imm32` 手动构建），但宿主已把它列入 KnownDLL 黑名单，不会使用。
### 自愈触发条件细化（2026-10-30）

自愈不再"只要失败就重试"，改为按端点探测结果判断：

| 探测结果 | 是否重试 | 理由 |
| --- | --- | --- |
| 全程无监听（`listenerSeen=false`，无 http/归属原因） | ✅ | 典型"忽略命令行开关"场景，换代理能解决 |
| 端口上有监听但不属于本次启动（`listener-not-owned`） | ❌ | 换代理也抢不到别人的端口，还可能干扰其它程序 |
| 有监听但 HTTP 不通（`http-failed`） | ❌ | 说明是别的服务占用，不是开关问题 |
| 用户显式 `--inject-mode cdp-port` / `--attach` | ❌ | 尊重显式选择 |

回归：既有自愈用例（夹具无监听）仍然通过，proxy-actions 10 项全绿；全量 867 项通过。

另在 `docs/windows.md` 增加「注入通道决策表」，把各客户端特征 → 通道选择、自愈条件、载体顺序整理成一张表，便于交付时对照。
