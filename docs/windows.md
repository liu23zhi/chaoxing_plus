# Windows 端（超星考试客户端 / CEF 75）使用与设计

源码按 `windows/node-source/`、`windows/native-source/` 与 `windows/share-file/` 分组，插件共用的源码与插件构建目录保留原位。仓库内原生入口为 `windows/native-scripts/start-windows*.cmd`，Node 备用入口为 `windows/node-scripts/start-windows-node*.cmd`；原生包启动器位于 `multi-file/`，Node 兼容包启动器仍在包根。文末历史验证记录中的旧入口名只代表当时的布局，当前可执行命令以本文目录与快速开始部分为准。

Windows 6.2.0 第一阶段提供 **普通可审计 Windows 宿主**：它用官方 CEF 远程调试参数启动超星考试客户端，并通过 CDP（Chrome DevTools Protocol）把扩展的业务 bundle 注入到客户端网页主世界。扫描、配置和离线参数生成器属于本阶段；内存执行（`--execution-mode memory` / `--memory-exec`：宿主侧零落盘、客户端仍正常可见启动）已支持；**状态（2026-10-29）**：**Node 宿主已弃用**——`windows/node-source/*` 只保留文件作兼容/对照与排障，不再开发新能力。单文件原生宿主保留既有静默场景实现；本轮多文件原生宿主不支持删除挂起、自删、自毁或 `--stage-boot` 暂存启动，并明确拒绝相关请求，不能将单文件能力视为已适配多文件发布包。发布构建主入口是 `windows/native-source/build-windows.sh`；`windows/node-source/build-windows-node.sh` 只构建备用 Node 包（`--skip-native`），不再演进。

**2026-10-30 发布目录与冻结规则**：原生三个构建入口默认生成嵌入资源的 `single-file/chaoxing_plus.exe`（GUI），以及外置资源的 `multi-file/chaoxing_plus.exe`（GUI）和 `multi-file/chaoxing_plus.com`（Console helper）。`BuildConsole` 保留默认 `true`，包含新多文件变体的编译；显式 `-BuildConsole:$false` 仅生成单文件 GUI。PowerShell `build-windows.ps1` 只编译，CMD/SH 继续完成完整打包与校验。最终目录直接为 `windows/native-build/release/`，不追加版本目录，不在仓库根 `release/` 另建原生包，不生成 ZIP，也不复制 README 或 docs；`single-file/` 只含 GUI EXE，`multi-file/` 带外置资源、helper、普通临时释放包、普通与调试两个启动器、配置及独立清单/校验器。原生发布根另有清单与校验器，不放兼容 EXE 或启动器；`windows/native-build/bin/` 保留宿主与调试/测试 EXE。Node 单 EXE 为 `windows/node-build/release/chaoxing_plus_node.exe`，使用 Node SEA 内嵌运行时、宿主模块、页面资源、配置模板与 PowerShell 脚本，目标机器无需安装 Node；`npm run build:node:exe` 使用已有 release 资源生成它，Node CMD/SH 构建同时生成单 EXE 和备用目录包，历史 ZIP/文档行为保持不变。模块与注入资源从内存加载，原有 GUI 全盘扫描仍使用系统临时状态文件。原生主程序、helper、临时释放包启动器与 Node EXE 使用 `windows/share-file/assets/app-icon.ico`，PNG 源图在同目录。Node 宿主及其构建/启动器保持冻结，只保留历史兼容、对照和排障；后续演进仅做原生。

## 状态与适用对象

### 浏览器临时会话与在线扩展

双击原生 EXE 先打开首页。“考试客户端”进入原有选择与注入流程；带参数的既有命令行入口继续按原规则运行。

首页可以新建 Edge 或 Chrome 临时会话，最多同时八个。每个会话有独立资料目录与扩展存储，关闭最后一个浏览器窗口、在首页关闭会话或退出首页时清理本次资料。程序只管理自己启动的进程，不复用日常浏览器资料。它采用支持 `Extensions.loadUnpacked` 的 Chromium CDP 管道；不支持该协议的旧浏览器会明确报错。

扩展只从“设置注入”中的 tikuAdapter 地址获取：`GET /adapter-service/extensions/edge/latest` 与响应中的下载地址；每个新会话重新获取当前包，先校验大小、SHA256、CRX3 开发者签名、扩展 ID 与 ZIP 内容，再加载。原生 EXE 不内嵌 CRX，不读取下载目录，没有本地 CRX 入口。Chrome 当前使用同一 Edge 发布包；服务端为未来 Chrome 商店保留独立来源。服务端须先部署扩展分发接口，并通过管理后台配置与检查更新；无已验证缓存时客户端显示失败，不启动缺少扩展的会话。

“设置注入”可填写服务地址、API key 和允许共享键的 JSON（例如 `{"common.settings.extension-enabled":true}`；具体键以当前扩展为准）。“单独配置会话”从公共配置复制，修改只应用到新会话。现有会话也可以通过扩展界面独立调整。设置仅保存在当前宿主进程内存中，密码与 JWT 不写入日志或文件。账号登录需要服务器验证码，成功后复用已有访问令牌；只有显式勾选后才会在没有令牌时创建。

原生主页的“注入设置”表单与 Windows 悬浮面板使用同一份共享设置：除 tikuAdapter 地址/API key 外，还可直接设置启用注入、自动答题、AI 兜底搜题、异步/同步搜题、深度思考、AI 兜底失败后的停留/继续策略、考试自动交卷和本地题库缓存。保存后这些值写入 `cx.new.study.*` 或 `common.settings.extension-enabled`，页面悬浮面板与原生启动的考试客户端会读取相同结果；高级 JSON 仍可用于扩展未在表单中展示的共享键。Windows 面板专属的显示位置、主题、答题快捷键、线程数、倒计时、重试和宿主日志选项仍保留在同一窗口中。

新增回归使用原生测试 EXE：`CX_NATIVE_HOME_EXE`、`CX_NATIVE_ADAPTER_EXE`、`CX_NATIVE_ACCOUNT_WINDOW_EXE`、`CX_NATIVE_BROWSER_SESSION_EXE`，分别指向 `windows/native-build/bin/` 下的 `home-tests.exe`、`adapter-account-tests.exe`、`account-window-tests.exe`、`browser-session-tests.exe`。这些变量只用于测试，不是产品运行配置。`CX_TEST_NATIVE_WINDOW=1` 会显示测试窗口并自动关闭。真实 Chrome/Edge 的多会话、存储和清理测试不等于真实超星课程或 CEF75 考试验收。

| 项 | 状态 |
| --- | --- |
| 目标客户端 | 电子科技大学中山学院 考试客户端 V4.1.4.25512（x86，CEF 75.1.4 / Chromium 75.0.3770.100） |
| 注入方式 | `--remote-debugging-port` + 本地 CDP（仅 127.0.0.1） |
| 宿主运行时 | 完整 Node 宿主：Node.js ≥ 22；原生原型：x86 Win32、无 CRT，单文件内嵌资源、多文件读取同目录外置资源（边界见下文） |
| 自动化验证 | mock CDP 回归、真实 Chromium（非 CEF75）端到端冒烟、Chrome75 语法闸门、类型检查与扩展全量测试 |
| 真实考试客户端整体验证 | **需人工按下方步骤执行一次**（启动需要 UAC，且需要在客户端里登录后观察） |

> 前置结论来自临时注入探针的实测：真实客户端 `CDP_CONFIRMED`、7 个页面上下文注入成功、`/json/version = Chrome/75.0.3770.100`。本 Windows 端的宿主与页面 bootstrap 按同一协议实现。

### 发布与系统兼容边界

Node 备用源码入口 `windows/node-scripts/start-windows-node.cmd`（隐藏控制台）、`start-windows-node-debug.cmd`（调试）及静默变体要求 Node.js 22+；客户端选择窗口使用 PowerShell 5.1 与 WinForms。需要 Node 的发布包通过 `--with-node` 或 `--skip-native` 显式生成，并可携带 `runtime/node.exe`（`package-windows.mjs` 的 `--runtime-exe` / `--no-runtime`）。启动器先定位仓库根或发布包根，再优先使用该根目录内的运行时；`runtime/node.exe` 永不纳入程序痕迹清理。原生 EXE 使用 Win32 选择窗口，不依赖 Node、PowerShell 或 WinForms。

`windows/native-source/` 是另一条普通运行的原生宿主原型。单文件 GUI `single-file/chaoxing_plus.exe` 将 bootstrap、业务 bundle、新文档探针、SweetAlert2 CSS 与 winmm 代理 DLL 作为五项 RCDATA 内嵌，直接从资源读取，无需解包旁置文件。多文件 GUI `multi-file/chaoxing_plus.exe` 不包含 JS/CSS/DLL RCDATA，只按自己的 EXE 目录读取 `assets/windows-bootstrap.js`、`assets/chaoxing-plus.windows.js`、`assets/trampoline.js`、`assets/vendor/sweetalert2.min.css` 和根目录 `winmm-proxy.dll`；首次校验或加载时将五项资源一起缓存到进程内存，返回给调用方的缓冲独立持有。它不按进程工作目录查找，不回退源码或其他构建目录，任一默认资源缺失或为空均明确报错。显式 `--assets <dir>` 可用于四项页面资源的调试覆盖，目录结构须与 `dist-windows` 一致，CSS 位于 `vendor/sweetalert2.min.css`；覆盖文件缺失或无效时明确报错，不回退默认资源。原生程序的导入表只包含系统 DLL，没有 Node、.NET 或 VC++ Runtime；外置代理是发布资源，不是宿主新增的链接运行库依赖。

原生路径现已通过真实 TCP/WebSocket 适配器持续轮询 page target，为各 target 建立上下文会话，处理导航、新 target、延迟创建的 iframe、上下文销毁、连接关闭与重连重试；首次连接和导航后保留顶层补注入。`runtime`、`script`、`hybrid` 三种注入策略均接入同一生命周期。宿主在本次启动的客户端退出或 `--duration` 到期后关闭会话；默认不结束仍存活的客户端，只有 `--stop-client-on-exit` 或启动失败时结束本次创建的进程，`--attach` 的外部浏览器不在该范围内。

原生宿主在每轮目标刷新及建立 WebSocket 前重新检查监听进程归属；检查失败会关闭现有会话并阻止新连接。只有显式测试参数 `--attach` 跳过归属校验。重连后，已完成 DOM 初始化的上下文通过既有 `requestBundle()` 重发就绪通知，避免 iframe 因 console 历史已清除而一直等待；业务包仍由文档标记去重。当前容量为最多 16 个 page 会话，每页最多 256 个默认上下文、512 个 frame，超过容量的目标不会覆盖仍在使用的状态。

原生客户端选择使用 Win32 控件和 `GetOpenFileNameW`：显示序号、架构、文件版本、完整路径与推荐项，支持双击、确认和手动浏览；扫描无候选时仍可浏览，取消不会启动客户端。所选路径会再次检查有效 PE 和系统架构兼容性。

原生宿主现已接入共享配置同步、持久化、文件热更新、文件日志与运行报告，`--capabilities` 中 `configReload:true`、`configPersistence:true`、`fileLogging:true`、`runReport:true`、`pageScreenshots:true`、`windowDiagnostics:true`、`diagnosticsSummary:true`、`highDpiUi:true`、`retainData:true`、`deleteConfig:true`。渲染诊断能力需区分：`renderDiagnostics:false` 表示不支持完整宿主渲染诊断（无 Node 同构的合并 JSON/系统进程命令行/窗口 PNG），`pageRenderDiagnostics:true` 表示支持有限的页面布局采样，`pageScreenshots:true` 表示通过 CDP `Page.captureScreenshot` 生成并校验 `render-diagnostics-page.png`。接受部分参数或将设置传入页面不等于实现对应宿主行为，原生宿主仍不与 Node 宿主完整等价。原生版本仍为原型，其构建依赖本机 MSVC x86 工具链和 Windows SDK；x86/x64 客户端适配及旧版 Windows 兼容性仍需在目标干净环境验收。

下文兼容性快速开始与完整 Node 参数示例使用 `windows/node-scripts/start-windows-node.cmd`；原生入口的具体参数以自己的 `--help`、`--capabilities` 和已执行测试为准，不默认宣称与 Node 全部等价。两条宿主均支持内存执行（`memory`：宿主侧零落盘、客户端正常可见启动）；原生静默场景与已弃用的 Node 能力边界以开头状态说明及各自帮助为准。

普通退出的数据生命周期两条入口均已对齐：Node 与原生都支持 `--no-retain-data`、`--delete-config` 及对应 JSON 字段（`retainData:false`、`deleteConfig:true`）。原生宿主在 UAC 交接时由提升后的子实例完成最终删除；`--delete-config` 要求显式 `--config`，且不能与 `--no-disk-write` 同用。两条入口均支持 `--self-check`，但检查范围和输出行为以各自说明为准。

三份本地样本的静态审计结果：V4.1.4.25512 的两个学校版本 EXE 相同，V4.3.0.4 的 EXE 不同，三者均为 x86，所带 CEF 均为 `75.1.4+g4210896 / Chromium 75.0.3770.100`。该结论仅代表文件架构与版本，未完成这些客户端在各 Windows 版本上的启动、登录及答题验证。

三份样本的 manifest 均要求管理员权限，所带 `libcef.dll` 及关键 CEF 资源内容一致；4.3.0.4 另有音视频组件，启动时应保留原安装目录和客户端工作目录，不能只复制 `CXExam.exe`。对三个显式目录的只读原生自检均返回 `0`，仅报告当前普通用户权限警告；自检没有启动客户端、请求 UAC、连接 CDP 或写入文件。

2026-10-28 人工配合的本机运行记录（原生普通宿主）：

| 客户端 | 本轮实际证据 | 尚未验收 |
| --- | --- | --- |
| 4.1.4.25512 中山学院版本 | 标准 UAC 交接、监听归属校验通过；`hybrid` 收到 8 次 bootstrap 和 7 次业务包执行确认，用户确认正常加载并显示面板；手动关闭后报告 `success:true`、`client-exit` | 实际答题、Swal 交互、无面板模式及旧 Windows 环境 |
| 4.3.0.4 通用版本 | 用户确认可到登录页和测试考试；早期 `script`/`runtime` 运行没有建立 CDP 页面会话；随后 `hybrid` 登录页观察约 59 秒，553 次探测均为无监听，用户手动关闭窗口 | 需完成登录后再次观察端点和面板，不能将人工关闭归为异常退出，也不能由登录页无监听断定不兼容 |
| 4.1.4.25512 河南应用技术职业学院版本 | 仅有静态文件和只读自检证据；用户没有登录测试环境 | 启动、登录及页面注入 |

4.3.0.4 首次等待 30 秒后，宿主按启动失败策略结束了本次创建的客户端；第二次等待上限设为 120 秒，约 41 秒时客户端进程结束。该旧版报告均记为 `endpoint-unavailable`，不能将第二次也解释成调试等待超时。没有证明其考试页面主动拒绝或退出，也没有通过改动客户端文件或关闭保护来验证。

随后一次 `hybrid` 人工运行中，用户确认登录页出现，并在约 59 秒时手动关闭窗口。该轮报告为 `client-exit-before-endpoint`，553 次初始探测均为 `no-listener`，没有进入页面注入。此结果只说明该段登录页等待期间未发现调试监听，不代表客户端自动退出或登录后不兼容。用户提出调试连接可能在完成登录后才开放，尚需在下一轮登录后观察；不要把“先确认连接”设为允许人工登录的前置条件。

同日用户进一步明确人工观察：“客户端在登录页未加载任何脚本，只有登录完成才能正常加载，然后才出现了悬浮面板。”用户要求保留该行为，只记录以免误判。因此停留登录页时未出现答题脚本或悬浮面板，不单独判为注入失败，应允许人工完成登录后再观察。该反馈没有指定本次客户端序号，不能据此宣布三个客户端均已验收；也不能把用户可见的加载时机等同于 CDP 端点开放时机，或反推所有登录文档都没有宿主技术 bootstrap。

“单文件”和“旧系统兼容”需要分别验收：[Node 24 官方平台要求](https://github.com/nodejs/node/blob/v24.12.0/BUILDING.md)为 Windows 10 / Server 2016 起，Windows 发布架构为 x64/arm64；[SEA 打包](https://nodejs.org/download/release/v24.12.0/docs/api/single-executable-applications.html)不能降低这一系统要求。[Go 1.21 起](https://go.dev/doc/go1.21#windows)也以 Windows 10 / Server 2016 为最低要求，原设计的 Go 1.22+ 静态构建不能据此宣称覆盖 Windows 7。Chromium 75 [官方构建说明](https://github.com/chromium/chromium/blob/75.0.3770.100/build/config/win/BUILD.gn)仍以 Windows 7 为受支持系统；样本 PE 头的 `5.1` 声明不能证明客户端支持 Windows XP。

后续普通单文件宿主仍须补齐与 Node 的参数行为差异，并在明确的 x86/x64、旧版和现代 Windows 干净环境中验证。当前 CDP 使用 TCP/WebSocket 通信，宿主与客户端无需相同位数；没有必要仅为页面注入拆分两套业务资源。现代 Chromium 自动化已覆盖原生实际 WebSocket 注入、导航、iframe、新 target、CSP 回退和限时关闭；历史探针和样式诊断只证明当时记录的局部行为，**本次 Windows 6.2.0 第一阶段尚未完成真实 CEF75 客户端端到端验收**。

### 原生环境自检

原生 `chaoxing_plus.exe --self-check` 在配置合并、参数校验后执行，检查当前 Windows 架构、token 提升状态、当前变体的默认资源、实际选择的四项页面资源和注入容量、显式客户端 PE 与架构、可绑定的本机端口。单文件使用 `embedded-resources` 检查；多文件使用 `external-resources` 检查五项同目录资源并缓存到内存，缺失资源显式失败。多文件能力输出包含 `embeddedResources:false`、`externalResources:true`、`embeddedResourceCount:0`、`resourceCount:5`、`embeddedProxy:false`。`selfCheck:true` 仅表示这些启动前检查可用。

```text
chaoxing_plus.exe --self-check --client "D:\Exam\CXExam.exe" --no-disk-write
chaoxing_plus.exe --self-check --assets "D:\Debug Assets" --port 38123
```

自检不进入普通运行：不扫描默认根目录或全盘、不显示选择窗口、不申请 UAC、不启动客户端、不连接 CDP、不写日志/诊断/报告或配置，即使同时传入 `--log`、`--diagnose`、`--report` 也是如此。显式 `--client` 安装目录仍按客户端解析规则检查该目录及一级直接子目录；未指定客户端时只警告未检查，不自动搜索。`--attach` 模式跳过绑定和连接检查；普通端口检查仅临时绑定后关闭，不保留端口，启动时仍须重新校验。

标准输出是单份 JSON，包含 `mode`、`host`、`version`、`success`、`scope`、`port`、带稳定 `id/status/detail/ok` 的 `checks` 以及 `warnings`、`failures` 标识列表。结果不包含绝对路径、原始配置、密钥、题目或答案；`--quiet` 抑制 JSON，仍保留退出码。成功或仅警告返回 `0`，环境检查失败返回 `1`；参数、配置解析错误和未实现功能请求仍在自检之前返回 `2`，不保证 JSON。通过只证明静态启动前提和当前端口可绑定，不证明客户端能启动或真实 CEF 页面兼容。调用方捕获 GUI 子系统 EXE 结果时应等待进程结束，不能使用 PowerShell 未等待时遗留的 `$LASTEXITCODE`。

2026-10-28 对本任务三个客户端的只读复核：版本依次为 `4.1.4.25512`、`4.3.0.4`、`4.1.4.25512`，均为 x86，三份 `libcef.dll` 字节和 SHA256 相同，版本为 `75.1.4+g4210896+chromium-75.0.3770.100`。三个主 EXE manifest 均要求管理员权限，普通用户直接 `CreateProcessW` 启动会遇到 Win32 740；原生宿主的按需 UAC 处理见下节。原生自检对三者均返回 `0`、无失败，并如实报告普通用户权限警告；没有启动客户端。客户端主 EXE 的 PE 版本字段不能用来证明旧版 Windows 可运行，仍需完整依赖和目标环境验收。

### 启动权限与 UAC

两种宿主默认先按当前权限扫描、选择、校验客户端并尝试启动。只有普通启动实际返回 `ERROR_ELEVATION_REQUIRED`（Win32 `740`），且未禁止自动提权时，才通过 Windows 标准 `runas` 请求重启宿主本身；是否批准由系统 UAC 确认框决定。不要求管理员权限的客户端仍按普通权限启动，不会预先申请 UAC。Node 宿主通过纯 ASCII 的 PowerShell `CreateProcessW` 包装器获取准确的 Win32 错误码，不能仅凭 `EACCES` / `EPERM` 猜测需要管理员权限。

显式添加 `--elevate-on-start`（或 JSON `"elevateOnStart": true`）时，在扫描、选择 GUI 和客户端启动之前申请管理员权限；已是管理员时直接继续。仅传这个参数仍使用无参数启动的常规扫描和 GUI。它与 `--no-elevate` 冲突，参数校验直接报错。帮助、自检、能力输出、有效配置输出、仅扫描列表及 attach 均不请求 UAC。

| 参数 | 默认 | 行为 |
| --- | --- | --- |
| `--elevate-on-start` | 关闭 | 启动时先申请管理员权限，再扫描、显示 GUI 和启动客户端；JSON 对应 `elevateOnStart` 布尔值。 |
| `--no-elevate` | 关闭 | 禁止自动申请 UAC；仍可启动不要求管理员权限的客户端。遇到 `740` 时报告权限错误，可移除此参数重试或手动以管理员身份运行宿主。 |
| `--elevated` | 内部标记 | 表示本轮已通过 UAC 重启，禁止再次自动重启；标记不能替代真实 token 提升状态检查，不应由用户手动添加。 |
| `--hide-console` | 关闭 | 隐藏 Node 宿主控制台，UAC 重启使用 `-WindowStyle Hidden`。普通隐藏入口是 `start-windows-node.cmd`，通过 `windows/node-scripts/silent-launch.vbs` 启动 `main.mjs`，保留客户端选择 GUI；`start-windows-node-silent.cmd` 则通过独立的 `silent-memory-launch.vbs` / `silent-memory-bootstrap.mjs` 使用固定静默内存参数。源码入口位于 `windows/node-source/`，发布包入口位于包根。启动器定位根目录后传规范化的工作目录和绝对脚本路径；VBS 按 Win32 规则处理尾反斜杠，WSH 不保留内嵌双引号，固定静默入口只传固定开关和根目录派生路径。 |
| `--elevated-client <path>` | 内部参数，仅原生 | 携带提权前已选中的绝对客户端路径；仅与内部重启标记及真实已提升 token 配套使用，重新校验客户端后直接启动，避免重复扫描或选择。Node 使用内部生成的显式 `--client` 交接实际选择。 |

父宿主先关闭配置、资源和审计句柄，再请求 UAC；重启保留原始参数、工作目录和已选客户端，含中文、空格、引号和内联 JSON 的参数也须保持原值。配置文件会按原有优先级重新读取，相对路径仍以保留的工作目录解析。提升后的宿主继续使用既有 `CreateProcessW` 和本次启动进程的监听归属检查，不通过 `ShellExecute` 单独启动客户端。

原生父宿主等待提升后的实例结束并回传其退出码；Node 交接启动后退出父实例，不等待提升实例运行结束。用户取消 UAC 返回 `3`，不得当作客户端已启动。原生权限查询失败、已重启实例仍遇到 `740` 或指定 `--no-elevate` 时直接失败，不循环请求权限。`--quiet` 不能抑制系统 UAC 确认框。帮助、能力输出、有效配置输出、自检、仅列出客户端以及显式 `--attach` 均不申请 UAC。

`runas` 不保证继承父实例的重定向标准输出，跨权限交接后的诊断应使用显式报告或日志。若在 UAC 中使用另一个管理员账户，系统环境变量和映射盘可能不同；保留工作目录不能替代该账户对客户端及配置文件的访问权限。

Node 开发宿主的 UAC 重启先对每一项参数执行 Win32 引用，再将完整命令行作为单个 `Start-Process -ArgumentList` 值传入，保留内联 JSON、空参数、中文、引号及尾反斜杠。对应 PowerShell 5.1/7 自动化只启动参数探针并移除提权请求，不会弹出 UAC 或启动考试客户端；它验证参数保真，不能代替真实权限交接验收。

自动化使用受控 Win32 调用替身验证提权分支、参数传递和退出码，不批准真实 UAC，也不启动真实考试客户端。这不代表已完成 UAC 人工确认、真实 CEF75 登录后页面或旧 Windows 干净环境验收；内存执行已可用（零落盘、可见进程），启动清理和自毁能力仍不可用。

### 原生已有客户端检查

普通启动在应用临时 DPI 设置及创建客户端前，检查系统进程快照中的同名可执行文件（不区分 ASCII 大小写，忽略宿主自身和 PID 0）。不同安装目录的 `CXExam.exe` 也视为冲突。发现已有客户端时返回失败，报告停止原因为 `client-already-running`；请先自行退出已有客户端再重试，宿主不会结束它们。能力标记为 `existingClientCheck:true`。

快照创建、首次枚举或后续枚举失败时停止启动，报告 `process-check-failed`，不能把无法检查当成没有客户端。UAC 提升后的宿主会再次检查；`proc_launch` 在创建进程前也复查，晚发现的冲突按启动失败处理，并先恢复已应用的临时 DPI 设置，不请求 UAC。帮助、能力输出、有效配置、自检、仅列出客户端及显式 `--attach` 不受此启动冲突检查限制。

进程快照只是检查时刻的状态，与 `CreateProcessW` 不是原子操作，仍可能遇到外部程序并发启动；它不替代原有的本次启动 PID、创建时间及调试监听归属校验。

### 原生临时 DPI 兼容层

真实子进程回归使用 `dpi-process-tests.exe`（`CX_NATIVE_DPI_PROCESS_EXE`）调用 `proc_launch` 启动 `dpi-child.exe`（`CX_NATIVE_DPI_CHILD_EXE`）的测试自有副本。该无窗口、无文件输出、`asInvoker` 程序用退出码报告 `IsProcessDPIAware()` 状态：普通启动应为 unaware，临时覆盖并在进程创建后立即恢复时应为 aware，再次普通启动应回到 unaware；同时检查测试 EXE 路径的兼容层值已不存在。它只临时操作测试自有 EXE 的对应值，不启动考试客户端，不申请 UAC；测试副本及目录由 Node 清理。

原生宿主支持 `--dpi-aware`，能力标记为 `temporaryDpiOverride:true`。它只为本次普通启动的客户端临时设置系统 DPI 兼容层；开启 `--diagnose` 时会采集页面截图（`pageScreenshots:true`），自有启动还会采集窗口 DPI/矩形与 best-effort BMP（`windowDiagnostics:true`），但 `--attach` 不采集窗口诊断，且仍不生成 Node 同构的完整渲染诊断（`renderDiagnostics:false` 边界保留）。

| 原生参数或 JSON 字段 | 默认 | 行为 |
| --- | --- | --- |
| `--dpi-aware` | 关闭 | 启动客户端前应用临时 `HIGHDPIAWARE`，`CreateProcessW` 返回后立即恢复。 |
| `dpiAwareness` | `""` | JSON 只接受空字符串或 `"system"`；`"system"` 启用，空字符串关闭，其它值或类型报错。 |
| `dpiAware` | `false` | JSON 布尔别名；同一层同时出现时优先于 `dpiAwareness`，跨层仍按完整配置优先级合并。 |

例如，原生普通启动可使用 `chaoxing_plus.exe --client "D:\Exam\CXExam.exe" --dpi-aware`；配置文件可使用 `{"dpiAwareness":"system"}`。原生 `dpiAware:true` 或等效 CLI 不能与 `--no-disk-write`、`--attach` 同用，最终配置校验会明确拒绝，不能一边请求禁止写入、一边静默修改注册表。帮助、能力输出、有效配置、自检和仅列出客户端不会应用临时兼容层；它们仍须先通过参数校验。

临时设置使用当前用户 `HKCU\Software\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Layers` 的 64 位注册表视图，只操作所选客户端绝对路径对应的一个值。本宿主实例通过会话内互斥量串行化这一临界区。原值最多 64 KiB，支持 `REG_SZ`、`REG_EXPAND_SZ`，按原始类型和字节保存；不可读取、类型无效或超限时不启动客户端。临时值保留非 DPI 兼容标记，去掉冲突的 `DPIUNAWARE`、`GDIDPISCALING` 并添加 `HIGHDPIAWARE`；原值已含 `HIGHDPIAWARE` 且没有冲突时不写入。

客户端创建成功或失败都会先恢复兼容层；若启动返回 `740`，也必须恢复成功后才能交接 UAC。恢复前重新检查值的类型和字节，观察到外部写入其它值时不覆盖并报告失败。恢复写入或删除最多尝试三次，仍失败则停止本次运行；若已经启动客户端，只结束本次宿主拥有的客户端。原值不存在时只删除本次创建的目标值，不删除整个 `Layers` 键；如果键原先不存在，新建的空键可能保留。

普通注册表读写与比对不是原子 compare-and-swap，外部程序仍可能在检查和写入之间修改值；进程崩溃、强制结束或系统中断也不能保证恢复。因此不能把临时覆盖理解为绝对无残留。恢复失败时应查看当前用户对应的 `Layers` 值和宿主报告，不应自动覆盖外部修改。上述是原生宿主的事务与失败策略，不代表 Node 宿主已经具备相同的冲突检测及重试行为。

### 原生共享配置与热更新

原生 EXE 的默认配置是 **EXE 同级的 `chaoxing-plus.json`**，与 Node 的 `windows/data/config.json` 不同，也不随原生 `--data-dir` 改变。`--config <path>` 选择配置回写目标，相对路径按进程工作目录解析；显式文件在启动时必须可读取。未指定 `--config` 且默认文件不存在时使用内存默认值，首次有效页面修改才按需创建默认文件及父目录。

原生合并顺序为：内置默认值 < EXE 同级配置 < `--config` 指定配置 < `--options-json` 启动快照 < 独立 CLI 参数。`--options-json @file` 也只在启动时读取一次，不作为热更新文件。宿主每 1500ms 检查默认文件及显式配置文件的修改时间、大小与存在状态，重新加载后仍应用原始内联 JSON 和 CLI 优先级。各层未覆盖的共享键保留；同名解码键按后层值合并，重复更新不会追加重复键而持续增大配置。

文件热更新只改变页面共享设置，客户端、端口、资源目录、注入策略等启动选项需要重启宿主。`noDiskWrite` 与日志启用策略按本次启动结果锁定，页面同步和外部文件都不能在运行期间改变它们。无效 JSON、类型或范围不合法的更新整笔拒绝，保留上一份有效内存快照。

删除默认 `chaoxing-plus.json` 会将该层视为空层，回落到内置默认值及仍生效的内联 JSON/CLI，并移除该文件独有的共享键；显式 `--config` 文件被删除或不可读取时则拒绝重载，保留最后有效快照。两种情况在文件恢复有效内容后都可继续热更新。

页面 `config-sync` 只接收共享键白名单，并校验 `source: "chaoxing-plus-windows"`、本轮唯一 `instance` 和仍存活、已登记且完成 bootstrap 的默认执行上下文；已实际完成 bootstrap 的顶层 fallback 也可参与。页面事件只验证并排队，配置文件 I/O 与 CDP 广播放在主循环的任务间执行，避免等待 CDP 回复时重入发送。配置任务与 bootstrap/bundle 串行，导航或销毁会使旧任务失效；总开关从关闭恢复开启后，已就绪但未注入的文档可以继续，已完成的 bundle 不重复执行。

有效页面修改先更新内存并广播，文件写入按 250ms 去抖。持久化会重新读取当前文件，保留未覆盖的共享设置及未知顶层字段，把完整 UTF-8 内容写入自有临时文件，再以 `MoveFileExW` 替换目标；解析、生成或替换失败不覆盖原文件，只清理自有临时文件。写入失败时继续使用内存值并保留待保存 patch；待保存修改优先，未成功保存前不发布外部文件快照覆盖它。`--no-disk-write` 禁止配置文件、临时文件及其父目录创建，也禁止 bootstrap/runtimeStore 写入或删除 localStorage，但仍允许内存同步、DOM 镜像和读取已有配置。

原生广播完整快照使用 `{kind:"config", values:settings, replace:true}`。缺失的旧共享键会从配置闭包、DOM 属性和延迟属性队列移除；允许写盘时同步删除 localStorage，并通过独立 `chaoxing-plus:shared-store-remove` 事件清理 runtimeStore 内存。无写盘模式保留旧磁盘值，但删除标记阻止当前 runtimeStore 把它重新读回；后续重新水合该键会清除删除标记。删除通知不回流为 `config-sync`，非共享键不受删除影响。不带 `replace:true` 的配置消息继续使用增量合并语义；同实例重连复用原桥并按完整快照重新水合。新宿主接管仍存续的文档时，通过原桥 `adoptInstance()` 同时更新原发送闭包的实例标识和配置快照，避免旧身份导致同步被拒绝；监听器、面板与已完成业务包继续复用。

`scripts/windows-native-config.test.mjs` 验证已编译 C 配置驱动的真实文件操作；`scripts/windows-native-config.browser.mjs` 用原生 EXE 和现代 Chromium 模拟页面验证同步、持久化、热更新与重新连接。两者均不代表真实 CEF75 客户端登录后页面验收，执行方法见下文。

### 原生文件日志与运行报告

原生宿主普通运行默认将日志写入 `<进程工作目录>/.data/chaoxing/logs/windows-host-<UTC时间>-<宿主PID>.log`。`--data-dir` 可更改数据目录（宿主自有文件统一放在其下的 `chaoxing\` 子目录：`logs`、`diagnostics`、`native-scan-cache-v1.bin`）；相对数据目录和 `--report` 路径均以创建审计对象时的进程工作目录为基准，支持中文与空格。日志使用 `CREATE_NEW`，重名时选择带序号的新文件，不覆盖已有会话日志。这里的默认目录与 Node 宿主的 `windows/data` 不同；不声明扩展 UNC 路径 `\\?\UNC\...` 支持。

| 原生开关 | 文件日志 | `--report <path>` 报告 | 控制台 |
| --- | --- | --- | --- |
| 默认 | 开启 | 指定路径才写入 | 输出固定事件 |
| `--quiet` | 保持开启 | 仍可写入 | 抑制普通运行输出 |
| `--no-log` | 禁用，不创建日志目录 | 仍可独立写入 | 保留固定事件 |
| `--no-disk-write` | 禁用，不创建日志目录 | 禁用，不创建报告或其父目录 | 仍由 `--quiet` 控制 |

`--list-clients` 只输出候选列表，即使默认启用日志也不创建日志文件，列表不会混入审计事件；只有显式 `--report` 才写入该次列表操作的报告，`--no-disk-write` 仍优先禁止写入。

日志为无 BOM 的 UTF-8 单行文本，包含 UTC 时间、级别和事件种类。宿主只传入预先脱敏的固定事件，例如启动、连接、导航、bootstrap/bundle 执行确认及停止；不记录原始配置 JSON、Token、题目、答案、URL 查询参数或片段。`--capture-console` 只把页面异常和 console error 转为省略原文的固定事件；关闭后仍保留注入就绪与 bootstrap 控制错误的处理。

报告记录 `version: "6.2.0"`、`host: "native"`、UTC `startedAt`/`finishedAt`、`mode: "launch" | "attach"`、运行时长、客户端 PID、端口、归属校验结果、成功状态、注入策略与停止原因。`ownershipVerified` 表示本轮曾实际成功校验监听归属，不是结束时的快照；调试 `--attach` 始终为 false。`totals.contexts` 是停止时仍存活的默认上下文数量；`totals.bootstraps`、`totals.bundles` 按完成 ACK 历史累计，导航、页面关闭和重连不会清零。`totals.pageSessions` 累计成功连接次数，`totals.reconnects` 记录同 target 的成功重连次数。`totals.errors` 累计页面异常、bootstrap 控制错误、注入/连接错误及最终执行失败；`console.error` 只生成告警事件，不增加该计数，正常停止取消在途任务也不计为执行错误。`success` 表示宿主流程执行结果，成功运行仍可能伴随页面告警或非零错误计数。

日志创建或写入失败不终止注入流程；写入失败后关闭该日志句柄，后续事件继续按控制台设置输出，不反复重试文件。报告会先在内存中完整生成并校验 UTF-8，再打开目标文件，因此生成失败保留已有报告；实际写入失败只报告错误，不改变宿主执行结果，也不保证原子替换。

## 工作原理

```text
windows/node-scripts/start-windows-node.cmd
  -> windows/node-source/main.mjs
     1. 读取 windows/data/config.json（clientPath / port / settings）
     2. 指定 --elevate-on-start 时先申请 UAC；默认保持当前权限
     3. 选端口：优先配置端口，否则按候选表用 bind() 实测（Windows 保留端口会 bind 失败）
     4. 检查是否已有 CXExam.exe 进程：有则拒绝启动，避免连接真实考试会话
     5. CreateProcess(clientPath, --remote-debugging-port=N --remote-debugging-address=127.0.0.1)；仅 Win32 740 才请求 UAC 并携带所选客户端重启
     6. 等待 /json/version，校验 Browser 前缀；用系统 netstat 校验监听 PID 为本次启动的客户端 PID 或其子进程（父链 + 创建时间）
     7. 轮询 /json/list，为每个 page target 建立 WebSocket：
          Page.enable -> Page.getFrameTree -> Runtime.enable
          Page.addScriptToEvaluateOnNewDocument(trampoline)
          executionContextCreated -> Runtime.evaluate(bootstrap)
          bootstrap console=ready   -> Runtime.evaluate(业务 bundle)
          console=config-sync       -> 写入 config.json 并广播到所有 frame
```

页面侧：

- `windows/share-file/windows-bootstrap.js`：建立 `window.__CX_WIN_HOST__`、把宿主配置水合进 `localStorage` 与 `documentElement` 属性（供现有 `runtimeStore` 读取）、安装 Chrome75 缺失 API 的补丁、在 DOMContentLoaded 后通知宿主注入业务 bundle。
- `windows/share-file/trampoline.js`：新文档启动探针（`Page.addScriptToEvaluateOnNewDocument`），只负责通知宿主“这里有新文档”，覆盖真实客户端上出现过的“文档已导航但没收到 executionContextCreated”的时序。该命令被拒绝时，Node 宿主记录明确降级日志，继续当前上下文注入并保留顶层补注入；会话关闭或连接断开仍按取消处理。
- 业务 bundle：`dist-windows/chaoxing-plus.windows.js`，即把现有 `src/index.ts` 以 `target: chrome75` 重新构建（内置 SweetAlert2 一并转译、页面样式由宿主注入）。

## 目录

以下源码路径相对于仓库根目录；原生包启动器位于 `multi-file/`，校验器位于原生发布根与 `multi-file/`；Node 兼容包启动器与校验器位于历史包根，不能直接把仓库源码路径当作包内入口。

```text
windows/
  node-source/                  已弃用的 Node 宿主与备用入口
    main.mjs                    启动、CDP、注入、配置与报告
    options.mjs / config.mjs    启动参数、共享键与配置持久化
    inject.mjs / cdp.mjs        页面会话、注入生命周期与 CDP
    launch.mjs                  提权、端口、PE、进程与监听归属
    selection-window.mjs        Node 客户端选择窗口封装
    scan-progress-window.mjs    Node 全盘扫描进度/取消窗口封装
    silent-*.mjs                Node 静默启动与内存引导
    build-windows-node.cmd/.sh  备用 Node 构建入口
  node-scripts/                 Node 启动与运行脚本
    start-windows-node*.cmd     Node 仓库启动器
    *.ps1 / *.vbs               Node 配套 PowerShell/WSH 脚本
  native-source/                无 CRT 的原生宿主
    *.c / *.h / *.inc           原生实现、配置、注入、审计与诊断
    tests/                      C 测试与驱动程序
    build-windows.ps1           MSVC x86 编译、资源与导入表审计
    build-windows.cmd/.sh       原生构建与默认发布入口
  native-scripts/               原生运行入口
    start-windows*.cmd          原生仓库启动器
  share-file/                   两种 Windows 宿主共用文件
    windows-bootstrap.js        页面平台层、配置水合与 Chrome75 补丁
    trampoline.js               早期新文档探针
    chrome75-syntax.mjs          Chrome75 语法闸门
    build.windows.mjs           Windows 页面 bundle 构建入口
    windows-build-features.mjs  Windows 构建开关
    package-windows.mjs          发布打包、SHA256SUMS 与 zip
    verify-release.mjs           无 npm 依赖的发布包校验器
    config.example.json         配置模板（无真实路径/密钥）
    parameter-generator.html    离线启动参数生成器
    README.md                   Windows 目录与入口说明
  data/                         本机 Node 配置与日志（gitignore）
  local-features.json           本机功能开关（gitignore）
src/ / public/                  与插件共用的源码和资源，保留原位
build.mjs / build-browser.sh    插件构建入口，保留原位
dist/                          插件构建输出，保留原位
dist-windows/                  Windows 注入资源，保留原位
windows/native-build/bin/      原生调试与测试 EXE，保留原位
windows/native-build/release/  原生完整发布根（无版本目录嵌套）
  single-file/                 GUI 独立 EXE
  multi-file/                  外置资源 GUI、Console helper 与配套文件
    chaoxing_plus.exe           GUI 主程序，无 JS/CSS/DLL RCDATA
    chaoxing_plus.com           Console helper，等待并转交主程序退出码
    start-windows.cmd          普通启动器，启动同级 GUI .exe
    start-windows-debug.cmd    调试启动器，使用同级 .com helper
    assets/                    四项页面 JS/CSS 资源
    winmm-proxy.dll             根目录代理资源
    package-to-single/          普通临时释放包 chaoxing_plus.exe
windows/node-build/release/    Node SEA 独立单 EXE
windows/node-build/             Node 备用构建输出，保留原位
release/                       Node 历史兼容包默认输出
scripts/                       全量测试入口与共用测试辅助文件
.github/workflows/ci.yml        Windows CI 构建、测试与发布包冒烟
```

`dist-windows/` 为构建产物（已 gitignore），包含：

```text
chaoxing-plus.windows.js  windows-bootstrap.js  trampoline.js
vendor/sweetalert2.min.css  config.example.json  package-manifest.json
```

## 快速开始（Node 兼容入口）

1. 安装 Node.js 22+。Node 宿主以脚本运行；原生单文件 EXE 为可选入口，见“发布构建、打包与 CI”。
2. 构建（本机开发时）：

   ```powershell
   npm run build:windows
   ```

3. 首次普通运行会自动创建 `windows/data/config.json`（从模板复制，`--no-disk-write` 时不创建）。未设置 `clientPath` 时，常规扫描依次检查桌面、OneDrive Desktop、Program Files、Program Files (x86)、AppData/ProgramData 和所有可访问固定磁盘根目录；每个根目录只检查自身和一级直接子目录。只有常规路径完全没有候选且扫描模式为 `fallback-all` 时，才递归扫描固定磁盘根目录。这里的“任意子文件夹”严格指一级子目录，不会在常规扫描中进入二级或更深目录。也可交互选客户端或直接指定路径：

   ```json
   { "clientPath": "D:\\考试客户端\\CXExam.exe", "port": 0, "settings": { "common.settings.extension-enabled": true } }
   ```

   > 首次验证建议指向客户端目录的**测试副本**；与真实账号环境隔离。

   常用启动参数（仓库内 `windows/node-scripts/start-windows-node.cmd` 会透传参数）：

   ```powershell
   .\windows\node-scripts\start-windows-node.cmd --list-clients
   .\windows\node-scripts\start-windows-node.cmd --select-client
   .\windows\node-scripts\start-windows-node.cmd --ui gui
   .\windows\node-scripts\start-windows-node.cmd --client-index 2 --panel --panel-expanded --panel-top 24 --panel-right 24 --panel-width 520
   .\windows\node-scripts\start-windows-node.cmd --client "D:\\Exam\\CXExam.exe" --answer-mode manual --answer-key Ctrl+Shift+A --answer-threads 1 --hide-answer-dialog --no-log
   ```

   `--client-index` 从扫描列表的 1 开始；`--scan-mode common` 只扫描常规根目录及一级子目录，`--scan-mode fallback-all`（默认）在常规无结果时追加全盘递归，`--scan-mode all` 强制全盘递归。`--answer-threads` 限制为 1-4。手动模式按组合键后放行对应数量的题目搜题/作答；不会自动保存或提交。自动模式按原流程运行。

4. 启动：

   ```powershell
   .\windows\node-scripts\start-windows-node.cmd
   # 或：npm run windows
   ```

   宿主要求管理员权限时会自动弹出 UAC（选择“是”），随后启动客户端并开始注入。

5. 预期日志（节选）：

   ```text
   [launch] 自动选择调试端口 9333（已用 bind 验证）
   [launch] 调试端点可用：Chrome/75.0.3770.100（CDP 1.3）
   [launch] 监听归属校验通过：pid=xxxx，127.0.0.1:9333
   [session] 已连接 target ...
   [inject] 已注入业务 bundle：context=1 url=https://mooc1.chaoxing.com/...
   [inject] context=1 bundle 完成
   ```

   `Ctrl+C` 停止宿主；默认不关闭客户端（退出后注入即失效，重新运行宿主即可）。需要连带关闭客户端时用 `--stop-client-on-exit` 或在配置里设置 `"stopClientOnExit": true`。

6. 运行报告（可选）：

   ```powershell
   node windows/node-source/main.mjs --report windows\data\last-report.json
   ```

## 发布构建、打包与 CI

正式分发默认使用原生 EXE 包；Node 备用宿主需要显式添加：

```powershell
npm ci
npm run build                  # 扩展注入脚本
npm run build:windows -- --release # dist-windows 注入资源
npm run build:native           # 原生 EXE 与编译测试（需要本机 MSVC x86 工具链）
npm run release:windows        # windows/native-build/release/，不生成 ZIP 或复制文档
```

Windows 的 Git Bash / MSYS2 / Cygwin 环境中可一键构建 x86 发布包：

```bash
bash windows/native-source/build-windows.sh
# 只做构建与打包校验，不跑发布回归：
bash windows/native-source/build-windows.sh --skip-tests
```

**Windows 打包决策（2026-10-30 更新）**：原生宿主为 x86、无 CRT，仅链接 Windows 系统 DLL。`single-file/chaoxing_plus.exe` 是嵌入五项资源的独立 GUI；`multi-file/chaoxing_plus.exe` 仍是 GUI 主程序，读取四项 `assets/` 页面资源与根目录 `winmm-proxy.dll`，不包含这些 RCDATA。`multi-file/chaoxing_plus.com` 是独立 Console helper，负责等待同目录 GUI 并保留其退出码和标准输入输出。PE 子系统不能靠改名切换，helper 与 GUI 分别链接。当前注入链路是 CXExam 官方 remote debugging + CDP 页面注入；x86 宿主可以正常启动并注入 x64 CXExam，因此**不内置 x64 可执行注入器**，也不从 x86 进程内存执行 x64 PE、不引入进程空洞/远程线程注入。

- 打包脚本 `windows/share-file/package-windows.mjs` 读取构建产物，默认直接写入已 gitignore 的 `windows/native-build/release/`，原生模式的 `--out <dir>` 指定最终目录，不追加版本目录。原生发布只生成运行目录，不生成 ZIP，也不复制 README 或 docs。发布包会校验 `dist-windows/package-manifest.json` 的 `features.injectionLog`（且清单 `version` 必须存在并与发布版本完全一致，防止旧构建被打成新版本），若为 `true`（本机 `windows/local-features.json` 开启的调试构建）则失败关闭并提示先运行 `npm run build:windows -- --release`；CI 的构建步骤固定使用 `--release`。
- 原生 `single-file/` 只含嵌入资源的 GUI `chaoxing_plus.exe`；`multi-file/` 包含外置资源 GUI `chaoxing_plus.exe`、Console helper `chaoxing_plus.com`、四项 `assets/` 资源、根目录 `winmm-proxy.dll`、`package-to-single/chaoxing_plus.exe`、两个原生启动器、配置及独立清单/校验器。普通 `start-windows.cmd` 启动同级 GUI `.exe`，调试 `start-windows-debug.cmd` 使用 `.com` helper 等待 GUI 并保留输出；原生多文件包不发布三个 `start-windows-silent*.cmd` 脚本。原生发布根另有清单和校验器，不放兼容 EXE 或启动器；`release-info.json` 记录实际变体、入口、资源目录和 PE 子系统。多文件暂不支持的静默自毁或 `--stage-boot` 请求必须明确拒绝，不会删除发布原件。显式 `--with-node`（原生 + Node）或 `--skip-native`（纯 Node）继续保留冻结 Node 历史 `<out>/<name>/` 布局、默认仓库根 `release/` 输出及其历史启动脚本和 ZIP/文档行为。
- 原生单文件编译输入默认是 `windows/native-build/bin/chaoxing_plus.exe`，多文件输入默认是 `windows/native-build/bin/multi-file/`；打包器用 `--exe <path>` 与 `--multi-dir <dir>` 覆盖。`BuildConsole` 默认 `true`，生成单文件 GUI、多文件 GUI、`.com` helper 和临时释放包；`-BuildConsole:$false` 仅生成单文件 GUI。PowerShell 编译入口只编译，CMD/SH 完成编译、完整打包与校验；未构建原生时显式用 `--skip-native` 生成仅 Node 宿主包。
- `multi-file/package-to-single/chaoxing_plus.exe` 是普通临时释放包，每次运行都将已打包的多文件主程序与资源释放到自己新建的临时目录，透传原参数、调用方工作目录和标准输入输出，等待 GUI 退出后仅清理该目录。它不会删除发布目录中的原件；这项行为不等于 `delete-suspend`、自毁或 `--stage-boot`，也不能把释放包宣称为宿主零落盘入口。需要零落盘自检时直接运行单文件 GUI，或已解压的多文件 GUI/`.com`。
- Node 包的普通入口为 `start-windows-node.cmd`（通过 `silent-launch.vbs` 隐藏 Node 控制台、保留 GUI）及 `start-windows-node-debug.cmd`（可见控制台）；`start-windows-node-silent.cmd` 通过 `silent-memory-launch.vbs` / `silent-memory-bootstrap.mjs` 进入固定静默内存场景，另有 `start-windows-node-silent-debug.cmd` 和 `start-windows-node-silent-no-full-scan-debug.cmd` 调试变体。`release-info.json` 的 `entrypoints` 记录这些入口。宿主运行闭包放在 `windows/node-source/`，配套 PowerShell/VBS 放在 `windows/node-scripts/`；`windows/share-file/config.example.json` 用于首次生成完整配置。构建期模块与外部 npm 依赖不得进入运行闭包，打包时失败关闭。
- 发布目录提供 `release-info.json`（版本、入口 `native`/`node`/`nodeDebug`/`nodeSilent`、`verifier`、payload 文件数、Node 版本）、`SHA256SUMS.txt` 与 `verify-release.mjs`。在发布目录运行 `node verify-release.mjs`，按校验清单逐文件校验 SHA-256（缺失/摘要不匹配返回 1，清单缺失/格式错误返回 2），CI 与本机发布验证都会先运行该自校验。仅 Node 历史兼容包继续由 Windows `Compress-Archive` 生成 ZIP。
- 冒烟：在原生发布目录分别等待执行 `single-file/chaoxing_plus.exe --self-check --no-disk-write` 与 `multi-file/chaoxing_plus.com --self-check --no-disk-write`；包含 Node 的历史兼容包再运行 `node windows/node-source/main.mjs --self-check --no-disk-write --quiet` 验证运行闭包。直接宿主自检只读，不扫描、启动或连接客户端；释放包入口则会创建并清理自己的临时目录。`scripts/windows-release-package.test.mjs` 覆盖原生目录结构、校验和、不含文档/ZIP、Node 历史 ZIP 条目与 CI 工作流契约。
- CI：`.github/workflows/ci.yml` 在 `windows-latest` 执行 `npm ci` → 类型检查 → 扩展/Windows/原生构建 → 通过 `$GITHUB_ENV` 导出全部 `CX_NATIVE_*` 编译测试路径 → 全量单元测试 → 浏览器回归（原生 browser 用例继承同一批变量，不再被跳过）→ `windows/native-build/release/` 发布包冒烟 → 将发布目录复制到 `windows/native-build/release-ci/`，检查必需文件、根与 `multi-file/` 完整性以及 GUI/Console 自检 → 直接上传 `windows/native-build/release/` 目录，不生成或依赖原生 ZIP。原生包不得含 Node 产物、README 或 docs；仓库根 `release-ci/` 仅保留历史忽略规则。CI 不覆盖真实 UAC 审批、真实 CEF75 登录后页面、旧 Windows 干净环境或真实考试客户端验收，这些仍需人工完成。

## 配置项

| 键 | 说明 |
| --- | --- |
| `clientPath` | 客户端 `CXExam.exe` 绝对路径；未配置时按扫描规则选择 |
| `port` | `0` = 自动选择可绑定端口；CEF 75 普通启动仅接受 `1024-65534`，固定端口不可绑定时宿主会报错，不会静默换端口 |
| `expectedBrowser` | `/json/version` 的 Browser 必须包含的字符串，默认 `Chrome/`，用于避免误连其它浏览器 |
| `stopClientOnExit` | 宿主退出时是否结束本次启动的客户端进程树 |
| `injectBlankFrames` | 是否向 about:blank/srcdoc 等不透明 origin 的 frame 注入（考试页面常用 document.write 生成题目 iframe，默认 true） |
| `captureConsole` | 是否把页面异常/日志转发到宿主日志 |
| `injectStrategy` | `hybrid`（默认）、`runtime` 或 `script`；分别表示 Runtime.evaluate 主世界执行、DOM script 元素执行，以及 runtime 优先并在失败时切换 script |
| `injectRetries` | 注入路径失败后的重试次数，`0-5`，默认 `2` |
| `debugEndpointTimeoutMs` | 等待本次客户端 `/json/version` 的超时，`1000-120000`，默认 `30000` |
| `targetPollIntervalMs` | 轮询本次客户端 `/json/list` 的间隔，`250-10000`，默认 `1000` |
| `bundleTimeoutMs` | 单次业务 bundle 执行超时，`1000-300000`，默认 `120000` |
| `dpiAwareness` | `""`（默认）/`"system"`；`system` 会在启动客户端时临时加 Windows `HIGHDPIAWARE` 兼容层（启动后立即恢复注册表原值），用于修复系统缩放 125%/150% 下整个客户端窗口被位图缩放导致的模糊 |
| `settings` | 共享配置快照（`common.settings.*`、`cx.new.*` 等），会被水合到所有 frame；面板里修改的设置也会回写到这里 |

### 注入通道与 winmm 代理

原生宿主提供三条注入通道，由 `--inject-mode` 选择：

| 模式 | 启动方式 | 注入内容 |
| --- | --- | --- |
| `input`（已移除：无实现） | — |；实测 4.3.0.4 客户端不响应调试开关，两份 4.1.4 客户端正常；auto 模式会自动为加壳客户端切换到 dll-proxy） | 命令行传 `--remote-debugging-port=<port>` | bootstrap + bundle + 配置同步 |
| `dll-proxy` | 命令行**不传**端口开关；宿主设置 `CX_INJECT_PORT`，客户端目录内的 `winmm.dll` 代理改写 `GetCommandLineW` 追加开关 | 同 `cdp-port` |
| `cdp-pipe` | `--remote-debugging-pipe`，匿名管道 + `Target.attachToTarget` 取 sessionId | bootstrap + bundle + 配置同步 |

`dll-proxy` 的部署流程：

```powershell
# 1) 安装（复制 winmm.dll 并写 cxhook-proxy.marker）
chaoxing_plus.exe --install-proxy --proxy-source "windows\native-build\hook\winmm.dll" --client "<CXExam.exe>"
# 2) 显式启用代理通道（auto 不会自动切换，保持默认行为可预测）
chaoxing_plus.exe --inject-mode dll-proxy --client "<CXExam.exe>" --panel-all-pages
# 3) 还原
chaoxing_plus.exe --uninstall-proxy --client "<CXExam.exe>"
```

代理 DLL 由 `windows/hook-source/build-proxy.ps1` 构建（读取系统 winmm 导出表生成 180 个转发桩）；`--proxy-target winmm|version|uxtheme|msimg32|sensapi|oledlg|wtsapi32|auto`（auto 按客户端导入表自动挑载体）只负责选择载体。单文件 GUI 从内嵌 `CX_RESOURCE_PROXY_WINMM` 取得代理，多文件 GUI 从同目录的 `winmm-proxy.dll` 取得并缓存代理；`--install-proxy`/`dll-proxy`/auto 再将其释放到客户端目录：

```powershell
# 单 EXE 即可安装（旁边没有任何 DLL）
chaoxing_plus.exe --install-proxy --client "<CXExam.exe>"
# 输出：install-proxy: 已释放内嵌代理 -> <客户端目录>\winmm.dll
```

多文件默认代理只使用同目录的 `winmm-proxy.dll`，缺失时明确失败，不搜索源码、工作目录或其他构建目录。`--proxy-source` 可显式指定文件（此时载体会固定，冲突直接报错而不切换）。其它载体（version/uxtheme/…）没有默认代理资源，必须用 `--proxy-source` 指定，否则明确报错。

**原生构建布局**：PowerShell 默认编译嵌入资源的单文件 GUI，以及多文件 GUI、Console helper 和临时释放包，复制到 `release/single-file/` 与 `release/multi-file/`；`BuildConsole` 默认 `true`，显式 `-BuildConsole:$false` 仅生成单文件 GUI。PowerShell 不负责完整打包；CMD/SH 调用发布打包器，在 `windows/native-build/release/` 补齐配套文件、根与 `multi-file/` 清单和校验器，不另建版本目录或根兼容 EXE。`build-windows.ps1` 在 `windows/native-build/hook/winmm.dll` 缺失时会自动构建它，单文件用于嵌入、多文件复制为根目录 `winmm-proxy.dll`；`-SkipProxy` 且代理源缺失时仍直接失败。选择窗口按当前变体的默认代理资源判定 `dll-proxy` 可用性。

诊断开关：`--pipe-test`（管道启动自检）、`--pipe-client <exe>`（管道握手）、`--pipe-call <exe> [--pipe-expr "<js>"] [--pipe-args "<args>"]`（管道 CDP 全链路 open → getVersion → getTargets → attach → evaluate）。
### 完整启动参数

命令行参数优先级高于 JSON 配置。重复的标量开关以命令行中最后一次设置为准；`--self-check`、`--help`、`--list-clients` 等动作型开关按各自语义执行。

帮助与版本开关**不区分大小写**并兼容常见写法（原生宿主）：`--help`、`-h`、`-H`、`--h`、`--H`、`-help`、`--Help`、`--HELP`、`-?`、`/?`、`?` 输出同一份帮助；`--version`、`-v`、`-V`、`--v`、`--Version` 只输出 `6.2.0` 后退出。未知参数以退出码 `2` 报 `unknown command line option (try --help)`。

单文件和多文件的原生主程序都是 **GUI 子系统**程序（`/SUBSYSTEM:WINDOWS`），直接双击不会分配控制台窗口。帮助/版本/能力查询沿用调用方控制台或重定向句柄，长输出先在内存拼完整再单次写出。显式执行 `.\chaoxing_plus.exe` 时，PowerShell 不能保证等待 GUI，提示符和 `$LASTEXITCODE` 不能证明 GUI 已退出；需要顺序输出时，在多文件目录使用扩展省略的 `.\chaoxing_plus`（默认解析 `.com`）或显式 `.\chaoxing_plus.com`，helper 会等待同目录 GUI 并传回退出码。必须执行 `.exe` 时使用 `Start-Process -Wait -PassThru` 并检查返回进程的 `ExitCode`。单个 PE 只能有一个 Subsystem 字段，GUI（2）与 `.com` Console helper（3）分别链接，不能仅通过改名替代。多文件普通 `start-windows.cmd` 使用 GUI `.exe`；只有调试 `start-windows-debug.cmd` 使用 `.com` helper。





参数名的整体兼容规则（原生宿主，适用于全部开关）：

| 写法 | 例子 | 说明 |
| --- | --- | --- |
| 大小写 | `--QUIET`、`--Quiet` | 参数名不区分大小写 |
| 单横线长参数 | `-quiet`、`-client <path>` | 等价 `--quiet`、`--client`；`-h`/`-v`/`-?` 仍是短参数 |
| Windows 风格 | `/quiet`、`/client=<path>`、`/h`、`/version` | 等价对应 `--` 形式 |
| 下划线 | `--panel_theme`、`--no_disk_write` | `_` 与 `-` 等价 |
| 内联值 | `--duration=1`、`--client=C:\Exam\CXExam.exe`、`--options-json={"port":0}` | 值也可继续用空格分隔；含 `=` 的值只按第一个 `=` 拆分 |
| 帮助/版本短写 | `-h`、`-?`、`/?`、`?`、`-v` | 见上一段 |

值本身不做归一化（路径、中文、JSON 原样传递）；以 `/` 开头但不像开关的字符串仍按位置参数报错。

#### 客户端扫描和选择

| 参数 | 默认/范围 | 行为 |
| --- | --- | --- |
| `--client <path>` | 未指定 | 直接启动指定的 `CXExam.exe`，跳过扫描；仍会检查 PE 架构。 |
| `--client-index <n>` | 未指定，`n >= 1` | 启动扫描结果第 n 个；常规候选按完整路径排序，全盘候选按遍历顺序。为确保序号可用，全盘扫描会完整枚举候选，不在首个 x86 提前停止。 |
| `--client-first` | 关闭 | 选择推荐候选；常规扫描结果中 x86 优先，同架构按路径排序。 |
| `--list-clients` | 关闭 | 列出候选和架构后退出，不启动客户端。Node 宿主显式 `--report <path>` 时额外写入 `mode: "list-clients"` 报告（含 `version:"6.2.0"`、`host:"node"`、`stopReason:"list-clients"`、`scanMode`、`startedAt/finishedAt`、`durationMs`、`success`、`total` 及候选 `path/name/machine`，字段与原生列表报告对齐），`--no-disk-write` 抑制报告写入；原生宿主遵循同样的“仅显式报告才写入”规则。 |
| `--select-client` | 关闭 | 扫描后显示 **Windows 原生选择窗口**，可选择候选、手动浏览或点击“全盘扫描”刷新列表；全盘扫描后仍须确认选择，不自动启动。窗口不可用时回退终端逐项选择，非交互终端回退推荐候选；用户取消时以退出码 3 结束，不启动客户端。 |
| `--scan-mode common\|fallback-all\|all` | `fallback-all` | `common` 只扫常规根目录及一级直接子目录；`fallback-all` 仅在常规扫描为零结果时递归固定磁盘；`all` 直接递归固定磁盘。 |
| `--scan-all` / `--no-scan-all` | 默认 fallback-all | `--scan-all` 启用常规无结果后的递归回退；`--no-scan-all` 将扫描限制为常规路径。 |
| `--scan-clients` / `--rescan` | 关闭 | 忽略配置中的现有客户端路径并执行扫描；扫描结果默认缓存到数据目录的 `scan-cache.json`，`--rescan` 仍会执行本次实时扫描并更新缓存。 |
| `--no-scan-cache` | 关闭 | 不读取或写入扫描缓存；实时扫描仍照常执行。 |
| `--ui auto\|gui\|cli` | `auto`；Windows 真正无参数入口使用 `gui` | `gui` 使用 Windows 原生选择窗口；`cli` 使用终端交互；显式 `auto` 优先使用已配置客户端路径，否则交互终端提示选择，Windows 非交互环境默认显示原生选择窗口，其他非交互环境使用推荐候选。显式 `--client` 在三种界面模式下均跳过扫描和选择窗口。Windows `auto` 窗口不可用时回退推荐候选；需要窗口时，`gui` 在非 Windows 平台或窗口不可用时直接报错。`--quiet` 或 `--client-first` 会关闭 `auto` 原生选择窗口并使用推荐候选。 |

此处参数表描述 Node 宿主。它的宿主支持 `--version`（输出 `6.2.0` 后以 0 退出，只读无副作用）与 `--print-effective-config` 等只读诊断入口。选择窗口使用 Windows 自带的 PowerShell（5.1+）与 WinForms，不新增 npm 依赖：窗口列出扫描到的 `CXExam.exe`（架构、完整路径），支持双击/按钮确认与“手动浏览”选择任意 `CXExam.exe`，取消返回 `cancelled`。`windows/node-scripts/selection-window.ps1` **必须保持纯 ASCII**（Windows PowerShell 5.1 对无 BOM 的 `.ps1` 按 ANSI/OEM 解析，中文文案会破坏语法），所有界面文案经 UTF-8 JSON 传入；`--self-check` 会构建一次窗口控件做冒烟（不显示窗口），`--capabilities` 的 `supported.nativeClientSelection` 在 Windows 上为 true。自动化验证可用环境变量 `CXPLUS_SELECTION_AUTO_CLOSE_MS=<ms>` 让窗口自动关闭（仅测试/调试，避免无人值守阻塞）。

Windows 上直接双击 `start-windows.cmd`、无参数运行 Node 宿主或直接双击原生 EXE，都会只做常规扫描（根目录及一级直接子目录），然后显示客户端选择 GUI，即使配置已保存客户端路径或全盘扫描模式。常规无结果也不自动递归全盘，仍显示窗口供手动浏览或点击“全盘扫描”；Node 全盘扫描失败时保留现有候选，原生宿主失败时明确退出。取消选择不启动客户端；默认到启动客户端时才按需请求 UAC，提权后继续使用本次选择，不再弹出选择窗口。仅传 `--elevate-on-start` 时保留此常规扫描和 GUI 行为，但先申请管理员权限。带有 `--config`、`--options-json` 等其他参数时，仍按参数和配置优先级运行；需要沿用已保存路径时可显式传 `--ui auto`。这里的 GUI 是客户端选择窗口，完整参数表单仍使用离线 `windows/share-file/parameter-generator.html`。

WinForms 窗口在 `Shown` 时显式调用 `ShowWindow` 并请求前台显示：隐藏 PowerShell 控制台的启动设置可能使首个窗口仍不可见，不能仅凭控件探针或 `ShowDialog` 运行判定窗口已显示。回归包含操作系统 `IsWindowVisible` 检查及全盘扫描按钮的真实点击。

点击全盘扫描后，选择窗口关闭并由宿主执行全盘扫描；扫描期间显示独立的进度窗口，实时显示“已检查目录数/发现候选数”，可点击“取消扫描”中止并保留原候选。扫描完成后重新打开选择窗口，仍须人工确认选择，不自动启动客户端；进度窗口不可用时继续无界面全盘扫描。Node 使用 `windows/node-scripts/scan-progress-window.ps1`（WinForms）；原生 EXE 使用 `windows/native-source/selection.c` 的独立线程 Win32 进度窗口（类名 `CXPlusNativeScanProgress`），取消通过 discovery 的进度/取消钩子中止并回到原候选。两端真实窗口可见性都由 `CX_TEST_NATIVE_WINDOW=1` 的显式冒烟验证，真实客户端全盘扫描均未在自动化中执行，汇报时须区分两端测试证据。

原生 EXE 的 `--ui gui` 表示使用 GUI 首页和后续选择流程；首页的“考试客户端”操作再调用 `windows/native-source/selection.c`，没有 PowerShell 子进程。`--select-client` 可直接进入客户端选择窗口。其隐藏控件探针由 `selection-tests.exe` 执行；实际显示、取消和选择 Unicode 路径的交互冒烟需显式设置 `CX_TEST_NATIVE_WINDOW=1`，测试通过 `CXPLUS_NATIVE_SELECTION_AUTO_CLOSE_MS` 自动取消，避免等待人工操作。全盘扫描进度窗口另有 `selection-tests.exe --scan-progress` 冒烟（同样需 `CX_TEST_NATIVE_WINDOW=1`），检查 `IsWindowVisible` 并模拟点击取消；隐藏生命周期与 discovery 进度/取消回调在默认探针中覆盖。取消全盘扫描后宿主重新打开选择窗口时会显示“已取消全盘扫描，保留原候选；可重试或手动浏览。”提示，隐藏探针覆盖通知标题切换。原生 EXE 内嵌 `dpiAware=true`/`asInvoker` manifest，选择与扫描进度窗口按系统 DPI 缩放固定像素布局和字体；测试可用 `CXPLUS_NATIVE_UI_DPI=144` 覆盖 DPI 验证缩放，能力标记为 `highDpiUi:true`。该测试不会执行所选客户端，也不会执行真实全盘扫描。

原生 EXE 的 `--ui cli` 列出候选序号、架构、版本、完整路径和推荐项；`--list-clients` 同样输出这些元信息。终端交互接受完整数字序号、Enter 选择推荐项、`q`/`Q` 取消（退出码 `3`），也接受有效 `CXExam.exe` 路径或安装目录，支持中文、空格及外层双引号。没有扫描候选时仍可手动输入路径；非法输入或输入流结束会明确失败，不会擅自启动推荐客户端。

常规扫描依次检查用户桌面、OneDrive Desktop、Program Files、Program Files (x86)、AppData/ProgramData 等常见根目录，以及所有可访问固定磁盘根目录；每个根目录只检查根目录自身和一级子目录。跳过符号链接、不可访问目录和 Windows 系统目录。常规扫描找到候选后不再递归全盘，即使候选只有 x64 也一样。普通自动选择时，递归回退按固定磁盘和子目录的确定性顺序遍历，记住首个 x64，发现首个 x86 后停止；未发现 x86 时选首个 x64。为支持用户显式选择，`--client-index`、`--select-client` 和 `--list-clients` 会完整枚举全盘结果。架构校验允许 x86 Windows 选择 x86 客户端，x64 Windows 选择 x86/x64 客户端；这不代表当前 Node 宿主已覆盖所有这些系统。自动推荐优先 x86，x64 CEF 客户端尚未做真实客户端验证。

原生 EXE 使用独立的 `<data-dir>/chaoxing/native-scan-cache-v1.bin`，不与 Node 的 `scan-cache.json` 共用格式。仅缓存完整常规扫描的非空结果，有效期 5 分钟；命中时重新校验扫描根目录、系统架构、一级深度、候选 PE、文件标识/大小/修改时间，以及父目录的系统排除和 reparse 状态。新增客户端在缓存期内可能暂不出现，使用 `--rescan` 强制刷新。`--no-scan-cache`、`--no-disk-write`、`--list-clients`、显式客户端路径和强制全盘扫描均不读写该缓存；空结果、递归回退或不完整扫描不写入。缓存损坏、过期、过大、访问/替换失败或范围超出缓存容量时，继续实时扫描，不阻止启动。

选择参数互斥：`--client` 不可与扫描参数（`--scan-clients`、`--scan-mode`、`--rescan`）、`--client-index`、`--client-first`、`--select-client` 或 `--list-clients` 同用；`--client-index` 不可与 `--client-first`、`--select-client` 或 `--list-clients` 同用；`--select-client` 与 `--list-clients` 不可同用。这样可避免“显式路径被扫描结果覆盖”的歧义。

#### 配置和数据

| 参数 | 默认/范围 | 行为 |
| --- | --- | --- |
| `--config <path>` | `windows/data/config.json` | 读取指定的宿主 JSON 配置文件；普通模式会同步宿主共享设置，`--no-disk-write` 时不回写。 |
| `--options-json <json>` | 未指定 | 将内联 JSON 对象合并为配置；也可使用 `--options-json @<file.json>` 从文件读取。顶层必须是 JSON 对象，指定的文件不存在或无法解析时会在启动前报错。 |
| `--data-dir <path>` | `windows/data` | 设置宿主配置、日志和诊断的默认数据目录；明确指定 `--config` 时配置文件路径仍以 `--config` 为准。 |
| `--no-disk-write` | 关闭 | 不创建/更新配置，不写日志、诊断、运行报告或宿主临时业务文件；并关闭扫描缓存。同时通过共享设置下发 `windows-no-disk-write`，阻止 Windows 业务 runtime store 和 bootstrap 把共享业务设置写入 localStorage，但仍可读取已有配置。不能阻止 CXExam 自身或其它未接入本项目 runtime store 的页面脚本写盘，也不能保证 OS 错误或 UAC 提示静默。 |
| `--retain-data` / `--no-retain-data` | 默认保留 | `retainData=false` / `--no-retain-data` 仅在普通退出收尾时清理**本轮登记的宿主产物**，例如本轮日志、诊断、报告和新建配置；不扫描删除历史数据，不删除整个数据目录，不属于启动清理或自毁。 |
| `--delete-config` | 关闭 | 退出时删除 `--config` 指定的**外部**配置文件；必须同时指定 `--config`，否则启动前直接报错，避免误删默认配置。 |

配置合并顺序为：内置默认值 < 默认宿主配置（默认 `windows/data/config.json`） < 同目录 `chaoxing-plus.json` < `--config` 指定配置 < `--options-json` < 独立命令行参数。配置层支持对应的宿主启动选项和共享 `settings` 中的 Windows 设置；命令行始终优先。使用 `--no-disk-write` 时仍可读取现有配置，但所有宿主侧写入都关闭。配置只会向页面共享键白名单同步。

显式 `--ui cli` 会忽略低优先级配置中的客户端路径并进入终端扫描与选择；`--ui gui` 选择原生 GUI 首页，首页操作再进入客户端选择；显式 `--select-client` 或 `--client-index` 可直接进入客户端选择，显式 `--client` 仍优先直接启动。JSON 配置中，更高层的 `gui` / `cli` 覆盖低层路径，同层或更高层的 `clientPath` 仍生效；最终界面模式改回 `auto` 时可继续使用原有配置路径。

配置文件热更新和页面设置同步继续按相同优先级合并并校验，不会覆盖命令行或内联 JSON 指定的设置；未覆盖的共享设置可以更新。无效更新保留上一份有效配置。客户端、数据目录、日志、诊断、注入策略等宿主启动选项需要重启才能生效；`noDiskWrite` 是本次运行锁定的写入策略，不能通过热更新改变。

普通退出会先停止注入与监视、关闭配置和日志写入，再按本轮产物登记收尾。显式报告路径如果在本轮被写入并登记，也属于本轮清理对象；未登记的用户文件和 CXExam 文件不在清理范围。`--delete-config` 是单独的显式授权，只删除 `--config` 指定的外部配置，不能由 `--no-retain-data` 推导出来，也不能与 `--no-disk-write` 同用。

#### CEF 注入兼容参数

| 参数 | 默认/范围 | 行为 |
| --- | --- | --- |
| `--expected-browser <text>` | `Chrome/` | 校验 `/json/version` 的 Browser 字段；不匹配时中止，防止误连其它 Chromium。 |
| `--inject-mode auto\|cdp-port\|cdp-pipe\|dll-proxy\|input` | `auto` | 选择注入方式。显式 `--inject-mode auto` 时若客户端目录存在我们安装的代理（`cxhook-proxy.marker`），自动改走 `dll-proxy`；不传 `--inject-mode` 等同于 `cdp-port`；`cdp-pipe` 已与端口通道对齐（bootstrap + bundle + 配置同步），`input` 已于 2026-10-30 按用户决定放弃开发，仅保留拒绝行为，不再规划实现。 |
| `--inject-proxy-dir <dir>` | 客户端目录 | `dll-proxy` 模式检查 `winmm.dll` 的目录；缺失时提示放置路径，已就位时说明进程内 hook 尚未驱动。 |
| `--show-inject-reasons` | 关闭 | 选择窗口在注入方式被灰化时显示具体原因（加壳 / 非 x86 / 目录不可写 / 无载体 / 缺代理 DLL）。默认不显示，避免正常启动时被提示行干扰；调试入口 `start-windows-debug.cmd` 已带上这个参数。 |
| `--panel-all-pages` | 关闭 | 非考试页也挂载悬浮面板，用于确认注入是否生效；默认仍只在考试路径显示。 |
| `--pipe-test` | 关闭 | 诊断：用匿名管道启动 `cmd /c echo` 并读回 stdout，验证宿主可继承句柄启动子进程。 |
| `--install-proxy [--proxy-source <winmm.dll>]` | 关闭 | 把 winmm 代理安装到 `--client` 推导出的客户端目录；源默认取宿主同目录 `winmm.dll`。`auto` 检测到代理后会自动改走"代理追加调试开关"的注入链路。 |
| `--uninstall-proxy` | 关闭 | 仅当客户端目录存在安装标记 `cxhook-proxy.marker` 时删除 `winmm.dll` 与标记，避免误删第三方同名 DLL。 |
| `--proxy-port <1024-65534>` | 不写 | 可选：`--install-proxy`、`--proxy-target winmm|version|uxtheme|msimg32|sensapi|oledlg|wtsapi32|auto`（auto 按客户端导入表自动挑载体） 时写入 `cxhook-port.txt`。写好后，客户端被第三方拉起（没有 `CX_INJECT_PORT`）时，代理读取该文件并固定打开此端口，宿主可用 `--attach` 连接。不传则不写，避免客户端每次启动都开端口。 |
| `--probe-client <CXExam.exe>` / `--probe-all` | 关闭 | 离线探测：架构、版本、`libcef.dll` 是否含 `remote-debugging-port`/`-pipe`、客户端是否导入 `winmm.dll`（决定代理能否被加载）、代理/标记/固定端口文件状态，并给出建议通道；`--probe-all` 扫描常见目录逐条输出。 |
| `--console` | 关闭 | 保持/附加控制台，便于看到 `[launch]`/`[bootstrap]` 等日志。宿主为 CONSOLE 子系统，但普通 GUI 运行与静默场景会主动 `FreeConsole()`，只有这个开关（或动作型命令）保留控制台。 |
| `--stage-boot` | 关闭 | 仅单文件宿主保留既有暂存启动行为；多文件宿主本轮明确拒绝，不用于普通临时释放包。 |
| `--probe-client <CXExam.exe>` | 关闭 | 离线探测客户端：架构、版本、`libcef.dll` 是否含 `remote-debugging-port`/`-pipe`、代理与标记是否存在，并给出建议通道（不启动客户端）。 |
| `--pipe-client <客户端路径>` | 关闭 | 诊断：以 `--remote-debugging-pipe` 启动客户端并发一帧 `Browser.getVersion`；返回 740 时自动提权重启自身。 || `--inject-strategy hybrid\|runtime\|script` | `hybrid` | `runtime` 直接在目标 execution context 执行；`script` 创建临时 DOM `<script>` 执行并在失败时回退 runtime；`hybrid` 先 runtime、失败后 script。两种方式都只针对已验证的本机 CDP target。 |
| `--inject-retries <n>` | `2`，`0-5` | 每一轮注入路径失败后重试；每次切换策略都会写诊断日志。 |
| `--inject-blank-frames` / `--no-inject-blank-frames` | 开启 | 是否向 `about:blank`、`srcdoc` 和其它不透明 frame 注入。 |
| `--capture-console` / `--no-capture-console` | 开启 | 是否转发页面 console、异常和 bundle 诊断到宿主日志。 |
| `--debug-timeout <ms>` | `30000`，`1000-120000` | 等待本次启动客户端调试端点的最长时间。 |
| `--target-poll-interval <ms>` | `1000`，`250-10000` | `/json/list` target 枚举间隔；较小值更快发现导航 target，但会增加请求。 |
| `--bundle-timeout <ms>` | `120000`，`1000-300000` | 单次 bootstrap/bundle CDP 执行超时。 |

参考项目中的 `cef-hook` 是当前进程内的 CEF/Detours hook，不能安全地作为通用外部注入器复用；本宿主因此采用“启动客户端时注入受控远程调试参数 + 校验 Browser/PID/端口归属 + CDP 多路径页面注入”。宿主不会自动连接任意已有端口；`--attach` 仅用于测试/调试。

Node 宿主在每轮 target 刷新和 WebSocket 建连前仍实时查询监听归属，但直接调用 Windows 系统目录的 `netstat.exe -ano -p tcp`，避免每次启动 PowerShell 查询带来的数秒开销。只接受精确 `127.0.0.1:port` 的唯一 `TCP LISTENING` 记录及有效 PID，不缓存上次监听 PID；查询失败、输出不完整、重复监听或无法识别的状态均拒绝连接。监听 PID 等于本次启动的客户端 PID 时直接通过，不再启动任何进程查询；不同时才用一次 Windows PowerShell `Get-CimInstance Win32_Process` 读取有界父链（最多 8 层），校验每级父子关系与创建时间顺序，成功结果按监听 PID 缓存，失败结果保留 30 秒短 TTL 后重试，避免慢 WMI 响应永久拒绝合法监听。`scripts/windows-listener-owner.test.mjs` 包含真实临时回环监听的归属、非监听连接、关闭后失效、真实祖孙进程监听及父链查询回归；本机耗时测量不代表其他 Windows 环境或真实考试客户端的端到端启动耗时。

原生宿主的 HTTP 请求和 WebSocket Upgrade 均按一次总截止时间执行，连接、发送、分块接收不会重新开始计时，并受本次 `--duration` 的剩余时间限制。调试版本尚未就绪时，报告分别记录 `client-exit-before-endpoint`（客户端已结束）、`duration-before-endpoint`（运行时长已到）或 `endpoint-unavailable`（调试等待截止），避免把不同停止原因统一写成等待超时。

原生报告另提供 `endpointProbe`，仅保存有界计数和固定原因码：`no-listener`、`listener-not-owned`、`listener-query-failed`、`listener-binding-rejected`、`http-failed`、`invalid-version`、`browser-mismatch`、`ready`。`attempts` 与 `reasonCounts` 记录初始端点等待，不混入后续 target 轮询；`elapsedMs` 为该阶段耗时。`listenerSeen`、`ownershipVerified`、`versionResponseReceived` 表示曾确证的状态，查询失败且 `listenerSeen=false` 不能证明绝无监听。显式 attach 收到版本响应后可确认存在监听，但不宣称进程归属。未执行探测时为 `not-started`。失败仅写一次 `[endpoint-probe]` 汇总，不记录响应体、页面地址或配置；版本格式无效仍保留兼容停止原因 `browser-mismatch`，以 `lastReason=invalid-version` 细分。旧报告没有这些字段，无法事后还原客户端 2 的具体失败类别。

CDP 断开时关闭旧页面会话；target 仍存在则在下一轮枚举重新连接。初次连接、重连和顶层导航后都会延迟检查 bootstrap/bundle，避免已有 bootstrap 不再发送 `ready` 时漏注入。同一执行上下文的并发 `ready` 合并为一次业务注入；上下文销毁或会话关闭后，迟到结果作废，停止后续策略切换及重试。DOM script 注入使用执行完成标记识别 CSP 阻止或脚本异常，失败后按所选策略回退，不把无异常的 CDP 响应当作脚本已成功执行。配置广播使用 `{kind:"config", values:...}` 包装；原生宿主的完整快照另带 `replace:true` 以删除已移除的旧共享键，不带该标记时保留增量合并语义。同实例重连复用已有配置桥水合最新完整快照，不重复安装监听或面板。

运行报告累计保留历次 target 会话的统计；断线重连或页面关闭不会抹去此前成功注入的计数，也不会因此误报“没有完成任何业务注入”。Node 普通运行/attach 报告与列表报告同样包含 `version:"6.2.0"` 与 `host:"node"`，与原生报告的 `version`/`host:"native"` 对应，便于工具按统一字段区分宿主类型与版本。

#### 面板和答题

| 参数 | 默认/范围 | 行为 |
| --- | --- | --- |
| `--panel` / `--no-panel` | 面板由 Windows 页面规则决定，默认考试页显示 | 启用或关闭业务悬浮面板；关闭后不挂载 bootstrap 折叠壳，也不显示手动答题就绪和按键反馈浮层，快捷键答题仍可用。 |
| `--panel-collapsed` / `--panel-expanded` | 默认折叠 | 设置首次出现时的展开状态。 |
| `--panel-top <px>` / `--panel-right <px>` | `16`，`0-10000` | 设置面板距视口上边和右边的距离。 |
| `--panel-width <px>` | `460`，`320-800` | 设置面板宽度。 |
| `--panel-theme <name>` | `pink` | 内置浅色主题：`pink`（默认）/`blue`/`green`。业务面板与 bootstrap 折叠壳使用同一色板并在共享设置热更新后重绘；未知名称回退 `pink`，自定义 CSS 不生效。 |
| `--answer-mode auto\|manual` | `auto` | 自动模式按页面设置流程运行；manual 由快捷键为题目处理发放许可。 |
| `--answer-key <shortcut>` | `F8` | 手动模式快捷键；示例 `Ctrl+Alt+Shift+S`。仅支持一个基础按键，可组合 Ctrl/Alt/Shift/Win。方向键推荐使用 `ArrowUp` / `ArrowDown` / `ArrowLeft` / `ArrowRight`，同时兼容 `Up` / `Down` / `Left` / `Right`。 |
| `--answer-threads <n>` | `4`，`1-4` | 每次手动许可放行/并行处理的题目数量；超出范围或非整数直接报错。同一分页任务保留未用许可，新建重答任务不继承旧批次余量。 |
| `--answer-countdown <sec>` | `5`，整数 `0-3600` | 自动模式开始前的倒计时秒数；`0` 不自动倒计时，等待用户确认。 |
| `--answer-retry <n>` | 默认 `3`，`0-20` | 设置单题额外重试次数；必须为整数，`0` 表示不额外重试。 |
| `--show-answer-dialog` / `--hide-answer-dialog` | 显示 | 控制自动答题确认弹窗。 |
| `--no-auto-submit` | 关闭 | 禁止 Windows 宿主自动提交，章节、作业和考试改为保存；未指定时保留配置文件及业务默认行为。 |

手动模式等待按键的时间不计入搜题超时，只有真正开始搜题才启动请求截止。关闭任务会取消授权等待，不再应用迟到结果；完成后再点击重答会重新建立按键监听。并发任务共用一次按键的许可总数，避免重复放行；同一分页任务可以将一次授权用于后续页面，关闭后清空。快捷键须使用实际按键名，`F08` 等前导零名称无效。

#### 日志、诊断和运行

| 参数 | 默认/范围 | 行为 |
| --- | --- | --- |
| `--log` / `--no-log` | 写入宿主日志 | 开启或关闭宿主日志文件。 |
| `--quiet` | 关闭 | 减少常规控制台输出；参数错误、OS/UAC 提示不一定静默。 |
| `--diagnose` / `--no-diagnose` | 正式启动默认开启 | 开启或关闭渲染诊断。命令行开关覆盖 JSON 值。 |
| `--diagnostics-dir <path>` | `windows/data/diagnostics/<timestamp>` | 指定诊断图片和 JSON 的输出目录。 |
| `--report <path>` | 不生成 | 将运行报告写入指定路径。 |
| `--execution-mode normal\|memory` | `normal` | `normal` 为普通可审计运行；`memory`（等价 `--memory-exec`）表示宿主侧零落盘：不创建/更新配置与数据目录，不写日志、诊断、报告或扫描缓存，客户端仍按正常方式启动并显示在进程列表中。`delete-suspend` / `--delete-suspend` 仍明确报错。 |
| `--stop-client-on-exit` | 关闭 | 宿主退出时结束本次启动的客户端进程树。 |
| `--dpi-aware` | 关闭 | 本次启动临时添加 HIGHDPIAWARE 兼容层，进程创建后立即恢复原注册表值。 |
| `--port <n>` | `0` | `0` 使用自动端口；CEF 75 普通启动指定端口范围为 `1024-65534`。CLI、JSON 与生成器均校验；仅测试用的 `--attach` 保持 `1-65535`。 |
| `--assets <dir>` | `dist-windows` | 指定注入资源目录。 |
| `--duration <ms>` | `0`，不限时 | 测试模式运行指定时长后退出；仅接受 `0-2147483647` 整数毫秒，两条宿主一致。 |
| `--attach <port>` | 不启用 | 仅测试/调试连接已存在端点；不会启动客户端或校验进程归属。 |
| `--self-check` / `--help` | 关闭 | 只做环境检查或输出参数帮助。Node 自检默认保持只读：不创建数据目录、日志、诊断或配置（与原生自检对齐）；显式 `--report` 仍写运行报告（自检报告含 `version:"6.2.0"`/`host:"node"`），显式 `--log` 才写文件日志，`--no-disk-write` 继续禁止所有落盘。原生宿主的 `--help` 另接受 `-h`/`-H`/`--h`/`--H`/`-help`/`--Help`/`--HELP`/`-?`/`/?`/`?`（大小写不敏感）。 |
| `--print-effective-config` | 关闭 | 只输出合并后的共享设置 JSON（单行）后以 0 退出；不扫描、不启动客户端、不申请 UAC、不写日志/配置/报告，`--quiet` 不抑制该输出。两种宿主语义一致。原生宿主把页面共享设置中由类型化字段托管的键（extension-enabled、windows-panel-*、windows-answer-* 等）从原始快照中过滤后再统一输出，避免同一 JSON 出现重复键；未托管键（如题库服务地址/密钥、未知共享键）原样保留。输出可能包含敏感共享设置，请勿外发。 |
| `--version` / `-v` | 关闭 | 只输出版本号 `6.2.0`（单行）后退出，不扫描、不启动客户端、不写日志/配置/诊断；原生宿主同样支持，并额外接受 `-V`/`--v`/`--Version`（大小写不敏感）。 |
| `--capabilities` | 关闭 | 输出机器可读的能力标记。Node 宿主列出 `executionModes:["normal","memory"]`、扫描、参数生成器、原生选择窗口，以及 `configReload`/`configPersistence`/`fileLogging`/`runReport`/`pageRenderDiagnostics`/`pageScreenshots`/`windowDiagnostics`/`renderDiagnostics`/`retainData`/`deleteConfig` 等已支持能力；删除挂起、启动清理和自毁均标记为不支持，并保留设计 schema。原生 capabilities 同样输出 `executionModes`、`memory` 与 `deleteSuspend:false`。原生宿主单独输出自身能力，不得把两者的已支持项合并推断。新增/移除能力时必须同步该输出与 `windows-host.test.mjs` 的内容断言。 |
| `--elevate-on-start` | 关闭 | 两种宿主均在扫描和 GUI 前请求管理员权限；JSON 字段为 `elevateOnStart`。已提升时不重复请求，只读模式不请求；与 `--no-elevate` 冲突。 |
| `--no-elevate` | 关闭 | 禁止自动申请 UAC；普通权限可启动的客户端照常运行，实际启动返回 Win32 `740` 时失败。 |
| `--retain-data` / `--no-retain-data` | 默认保留 | 两种宿主均支持：`--no-retain-data` / JSON `retainData:false` 在普通退出时只删除本轮创建的日志、运行报告和诊断运行目录，不删除历史数据、整个数据目录、扫描缓存或 CXExam 文件。原生宿主递归删除本次诊断运行目录内的页面 JSON/PNG、窗口 JSON/BMP/PNG 与宿主摘要，只登记本轮真实创建的文件；UAC 交接时父实例清理自身产物，提升后的子实例负责最终收尾。 |
| `--delete-config` | 关闭 | 两种宿主均支持：退出时删除显式 `--config` 指定的外部配置文件；必须同时给出 `--config`，且不能与 `--no-disk-write` 同用；默认配置路径不会被隐式删除。原生宿主在 UAC 交接时跳过父实例删除，由提升后的子实例执行。 |

#### 禁用能力的参数设计

以下表格记录单文件原生宿主的既有高级参数。多文件 GUI、`.com` helper 和临时释放包中的多文件 GUI 本轮不支持删除挂起、自删、自毁、发布目录清除或 `--stage-boot` 暂存启动，收到相关请求时明确拒绝；不能因资源已缓存而宣称这些功能已适配。多文件发布原件不删除。普通临时释放包仅在 GUI 结束后清理它本次创建的临时目录。共享设置（`common.settings.windows-*`）仍然不接受这些高级意图。

| 能力或参数 | 设计值 | 当前行为 |
| --- | --- | --- |
| `--execution-mode memory`、`--memory-exec` | 内存执行 | **已支持**：宿主零落盘，客户端正常可见启动；不创建配置/数据目录，不写日志/诊断/报告/扫描缓存。 |
| `--execution-mode delete-suspend`、`--delete-suspend` | 删除挂起 | **已支持**：客户端启动后删除程序痕迹并继续运行；需要发布布局，强制 no-disk-write，禁止 `--attach`/`--list-clients`。 |
| `--wipe-owned-files-on-start` | 关闭 | **已支持**：启动时清理 `<data-dir>\chaoxing` 登记的扫描缓存、宿主日志、本次诊断产物，以及所选 `CXExam.exe` 同目录的 `debug.log`（不删除客户端本身）。`debug.log` 在启动清理、`delete-suspend`、静默场景、自毁触发和客户端退出/宿主退出时都会清理；被占用时改为清空内容而不是保留原日志。 |
| `--wipe-failure-policy retry\|background\|ignore\|abort` | `retry` | **已支持**：abort 失败退出 3；background 转后台；ignore 尝试一次。 |
| `--wipe-retries <1-20>` | `5` | **已支持**：启动阶段每个文件的尝试次数。 |
| `--wipe-retry-delay <ms>` | `200`，`50-5000` | **已支持**：重试间隔。 |
| `--wipe-runtime-retry` / `--no-wipe-runtime-retry` | 开启 | **已支持**：剩余文件由后台线程按间隔重试，退出时停止。 |
| `--wipe-runtime-interval <sec>` | `30`，`1-86400` | **已支持**：后台重试间隔。 |
| `--self-destruct-key <shortcut>` | 可重复，默认无 | **已支持**：最多 4 个，不得与 `--answer-key` 相同。 |
| `--self-destruct-on-fullscreen-exit` | 关闭 | **已支持**：只有先进入全屏后退出才触发。 |
| `--self-destruct-delay <ms>` | `0` | **已支持**：0–60000ms，确认后延迟执行。 |
| `--self-destruct-confirm` / `--no-self-destruct-confirm` | 开启 | **已支持**：默认弹 MessageBox 确认；无确认开关时测试走 `--no-self-destruct-confirm`。 |

多文件变体收到这些清除、自毁及其调优参数时明确报错；单文件保留既有行为。不能以生成器能够导出某字段作为多文件已实现的依据，共享 Windows 设置仍不接受这些请求。

本轮不扩展既有清理策略或自毁监控。多文件发布目录、客户端目录和未登记用户文件不属于普通临时释放包的清理范围。

普通数据退出清理、临时释放包的自有临时目录清理与单文件既有高级能力分别处理；多文件不安装自毁热键、全屏自毁监视或自删除操作。

已知限制：Windows 端没有扩展 popup，目前通过编辑 `config.json` 或在页面内面板修改设置；`common.settings.extension-enabled=false` 时不会注入业务 bundle。

### Windows 参数生成器与启动示例

`windows/share-file/parameter-generator.html` 是离线单文件参数生成器，可在浏览器中打开，生成 PowerShell、cmd、JSON 配置和参数摘要。默认选择原生单文件 EXE，但首次打开不预填路径；可直接粘贴 `chaoxing_plus.exe` 完整路径，也可点击“选择 EXE…”使用文件选择器（浏览器通常只返回文件名，此时需补全目录，或通过 `?nativePath=` 查询参数预填）；发布文件复制到其他位置后请填写实际绝对路径，单独复制 HTML 时不会猜测 EXE 路径。套用预设和重置保留已选原生入口。原生默认诊断目录为 `<data-dir>/chaoxing/diagnostics`，随数据目录调整，手动指定诊断目录后保留输入。页面不联网、不执行命令、不保存输入；Node 兼容入口已冻结，仅供历史兼容和排障。切回原生时会清除并隐藏 Node 专属 `--hide-console` 开关。

原生宿主能力应按实际实现区分：普通启动、宿主零写盘、扫描与选择、共享配置、面板、答题设置和诊断均已接入；诊断包含页面布局、页面 PNG、窗口 DPI、BMP/PNG 和宿主摘要。`input` 注入已于 2026-10-30 按用户决定放弃开发，不再列为待实现功能；`cdp-pipe` 目前只做首次引导注入，未完成常驻会话、导航后的重注入与重连，生成器将两项显示为禁用且阻止导出命令和 JSON。注入方式“沿用宿主默认”不传 `--inject-mode`，由宿主与选择窗口决定方式，不保证采用端口方式，也不等同于显式 `--inject-mode auto`。

参数生成器保留单文件原生宿主的 `delete-suspend`、`wipe-*`、`self-destruct-*` 和固定 `--silent-scenario` 字段；不能据此认定多文件宿主也支持。多文件 GUI 明确拒绝相关清除和暂存启动请求，普通临时释放包仅清理自建临时目录。真实 CEF75 登录后页面与旧 Windows 兼容性仍需分别验收，不能用自动化模拟结果替代。

Node 模式需要 Node.js 22+，默认根据 HTML 所在位置定位 `windows\node-source\main.mjs`，并以该脚本对应的项目根目录作为工作目录，数据目录默认 `windows\data`。原生模式直接启动填写的 `chaoxing_plus.exe`，无需 Node.js，以 EXE 所在目录作为工作目录，数据目录默认 `.data`。两种模式的相对配置、数据与报告路径均按对应工作目录解析；切换宿主只调整未自定义的默认数据/诊断目录。入口只接受 Windows 驱动器绝对路径（支持 `C:/`）或包含服务器及共享名的完整 UNC 路径，不接受相对路径、`C:foo` 或仅以 `\` 开头的路径；生成器无法确认文件存在，请填写实际发布文件的位置。

PowerShell 输出兼容 Windows PowerShell 5.1 和 PowerShell 7：通过 `ProcessStartInfo` 直接启动 `node.exe` 或原生 EXE，显式关闭 shell 执行，按 Win32 参数规则保留 JSON 双引号、中文、空格、单引号、尾反斜杠与 shell 字符，等待结束后设置 `$LASTEXITCODE`。不要把内联 JSON 改回 `start-windows.cmd` 的 `%*` 转交链路，普通 PowerShell 单引号引用不能保证该链路保留 JSON。cmd 输出为单行直接宿主命令；遇到内联 JSON、命令解释符、百分号、感叹号、双引号、换行、尾反斜杠参数或 UNC 工作目录时停止导出 cmd，使用 PowerShell 输出或配置文件。

页面按客户端扫描 / 配置和数据 / 执行模式 / 面板 / 答题 / 日志与诊断 / 启动清理 / 自毁分组，提供 8 个预设；顶部“加载已有配置”可选择本地 `chaoxing-plus.json`，读取顶层字段与 `settings` 共享设置并回填表单（不上传、不保存），未知字段会提示忽略。执行模式可选普通运行或内存执行（宿主侧零落盘）；选择内存执行时生成器会同时输出 `--execution-mode memory` 与 `--no-disk-write`，并拒绝日志/诊断/报告等落盘请求。绝对静默型只生成下方第一阶段普通启动子集，并为 Node 宿主附加 `--hide-console`（原生 EXE 无控制台，不附加该参数；原生宿主选择该开关会被校验阻止）；Node 历史兼容包的 `start-windows-node-silent.cmd` 行为保持冻结。原生多文件包只发布普通与调试两个 CMD 入口，不提供静默自毁脚本。友好交互型、懒人型、手动答题型、仅扫描型、直接路径型和全盘扫描型均为普通运行。**启动清理型（`startupClean`）是不可执行的设计预设**：选中后说明缺失能力并清空命令与 JSON 输出，不能生成去掉清理开关的普通命令冒充清理启动。

实时校验包括客户端选择互斥、`--no-disk-write` 冲突、答题线程/面板宽度/清理重试范围、内联 JSON 的范围/枚举/类型、`--delete-config` 与 `--config` 关联、归一化后的答题/自毁快捷键冲突、非法序号和以 `--` 开头的参数值。导出普通启动、内存执行、删除挂起、扫描、面板、答题、日志、诊断、普通数据生命周期、启动清理与自毁参数；面板主题只导出 `pink`/`blue`/`green`（留空使用 `pink`，其他名称阻止导出）。支持 `--dpi-aware`（两种宿主，原生宿主与 `--no-disk-write` 互斥）和 Node 专属 `--hide-console` 静默控制台开关；原生宿主选择静默控制台会被实时校验阻止。删除挂起、启动清理和自毁控件可正常导出；共享设置（`common.settings.windows-*`）中的这些字段仍会阻止导出，避免网页误改安全策略；内存执行/删除挂起会生成零落盘命令与 JSON。生成结果由宿主解析器回归校验。

原生模式另行校验自身入口的边界：面板坐标/宽度必须是整数，序号最大 `2147483647`，快捷键使用原生支持的 `Ctrl` / `Alt` / `Shift` / `Win` 与一个基础按键，不能重复修饰键。原生内联 JSON 不接受未知顶层键，也会校验被 CLI 覆盖前的 JSON 类型。路径参数最多为 1023 个 UTF-16 字符，Browser 文本、主题和快捷键最多为 127 个；表单与 JSON 使用相同限制。导出 JSON 会按原生 CLI 的覆盖规则规范化客户端选择参数族及诊断反向别名，避免命令可运行而 JSON 冲突。原生宿主同样支持 `--no-retain-data` / `--delete-config`（后者要求显式 `--config` 且不能与 `--no-disk-write` 同用），表单在两种宿主下都可用，切换宿主不会静默丢弃清理请求。原生诊断现包含页面布局采样、页面 PNG 截图与自有启动窗口 DPI/BMP（`pageScreenshots:true`、`windowDiagnostics:true`），仍不采集正文/URL/窗口标题；选择“友好交互型”也不会改变这个能力边界。生成器中的 `--dpi-aware` 表示客户端 DPI 兼容层，与原生宿主界面自身的高 DPI 感知（`highDpiUi:true`）不是同一概念。

常规路径扫描会检查桌面、OneDrive Desktop、Program Files、Program Files (x86)、AppData/ProgramData，以及所有可识别固定磁盘根目录；每个根目录只检查根目录自身和一级直接子目录。若常规扫描找到候选，默认不递归全盘。常规无候选时 `fallback-all` 才递归固定磁盘；`all` 直接全盘扫描。扫描结果会按模式写入数据目录的 `scan-cache.json`，缓存默认 5 分钟有效；命中前逐个检查文件仍存在且 PE 架构未变化，任何候选失效、缓存过期或解析失败都会自动实时重扫。缓存还会核对当前常规根目录、固定磁盘及目录排除策略；这些范围变化或旧版缓存会实时重扫。默认 `fallback-all` 可复用已完整完成根目录和一级子目录扫描的常规命中结果；提前停止的递归结果不缓存，不能冒充完整候选列表。`--no-scan-cache` 和 `--no-disk-write` 都完全禁止缓存读写。`--ui cli`、`--select-client` 或 `--client-index` 会直接显示完整候选列表；`--ui gui` 先显示原生首页，再由首页进入选择窗口；原生选择窗口支持手动浏览，即使扫描没有候选也可以手动浏览。终端提示则支持输入列表序号或带引号的手动 `CXExam.exe` 路径。`--ui auto` 优先使用配置中的客户端路径；没有配置路径时，交互终端提示选择，Windows 非交互环境显示原生选择窗口，quiet/client-first 模式则直接使用推荐候选。

#### 启动示例

以下保留完整目标设计，并提供多种本阶段可执行的普通启动/内存执行示例。目标设计中的启动清理和自毁参数当前均会明确报错；内存执行（不含启动清理/自毁）可执行。生成器不会为启动清理/自毁请求导出可运行命令。

**1. 绝对静默型**

最终目标设计（不可执行示例）：以下组合包含启动清理和自毁，当前仍未实现；Node 与原生入口都会明确拒绝，不会静默降级。其中 `--execution-mode memory` 本身已支持，可单独使用。

```powershell
& "C:\Tools\chaoxing_plus.exe" `
  --ui cli `
  --scan-mode fallback-all `
  --client-first `
  --execution-mode memory `
  --wipe-owned-files-on-start `
  --wipe-failure-policy retry `
  --wipe-retries 5 `
  --wipe-retry-delay 200 `
  --wipe-runtime-retry `
  --wipe-runtime-interval 30 `
  --no-disk-write `
  --no-log `
  --quiet `
  --no-panel `
  --answer-mode manual `
  --answer-key Ctrl+Alt+Shift+S `
  --answer-threads 1 `
  --hide-answer-dialog `
  --self-destruct-key Ctrl+Alt+Shift+E `
  --self-destruct-key F8 `
  --self-destruct-on-fullscreen-exit `
  --no-self-destruct-confirm
```

第一阶段可执行的普通启动子集（关闭宿主一般日志、面板和宿主侧持久化，以快捷键手动放行一题；不包含内存执行、启动清理或自毁。CXExam 自身的浏览器存储、操作系统和 UAC 提示不受这些开关控制）：

```powershell
& ".\windows\node-scripts\start-windows-node.cmd" `
  --ui cli `
  --scan-mode fallback-all `
  --client-first `
  --execution-mode normal `
  --no-disk-write `
  --no-log `
  --quiet `
  --no-panel `
  --answer-mode manual `
  --answer-key Ctrl+Alt+Shift+S `
  --answer-threads 1 `
  --hide-answer-dialog
```

第一阶段行为：先扫描当前用户实际桌面（支持重定向）、OneDrive Desktop、Program Files、Program Files (x86)、AppData/ProgramData 和所有固定磁盘根目录的一级子目录；常规扫描有候选时不进行全盘递归，常规无候选时才进入全盘递归；全盘遇到第一个 x86 立即使用，只有 x64 时使用第一个 x64。此示例使用 `--quiet --client-first`，无候选时静默放弃启动并以退出码 0 结束；普通交互模式则提示手动选择或报告启动错误。`--list-clients` 始终列出扫描结果后退出。不写宿主日志、诊断、报告，不显示面板；`Ctrl+Alt+Shift+S` 每次授权 1 道题；自毁相关参数当前会被拒绝。**永远不删除 CXExam 文件。**

内存执行示例（可执行）：宿主侧零落盘、客户端仍按正常方式启动并显示在进程列表中；不创建/更新配置与数据目录，不写日志、诊断、报告或扫描缓存：

```powershell
& ".\windows\node-scripts\start-windows-node.cmd" `
  --execution-mode memory `
  --scan-mode common `
  --client-first `
  --quiet
```

内存执行不改变 UAC、客户端注入和页面行为；它不是反检测模式，不隐藏进程，也不删除 CXExam 文件。**2. 友好交互型**

```powershell
& ".\windows\node-scripts\start-windows-node.cmd" `
  --scan-mode fallback-all `
  --select-client `
  --panel `
  --panel-expanded `
  --panel-top 24 `
  --panel-right 24 `
  --panel-width 520 `
  --answer-mode auto `
  --answer-countdown 5 `
  --answer-threads 4 `
  --show-answer-dialog `
  --log `
  --diagnose `
  --report ".data\last-report.json" `
  --retain-data
```

行为：优先显示 Windows 原生候选选择窗口，并支持手动浏览；窗口不可用时按 Node 宿主选择规则回退终端交互或推荐候选。显示完整悬浮面板，自动答题前显示倒计时，同时处理最多 4 道题，写入日志、诊断和报告并保留数据。

**3. 懒人型**

```powershell
& ".\windows\node-scripts\start-windows-node.cmd" `
  --scan-mode fallback-all `
  --client-first `
  --panel `
  --panel-expanded `
  --answer-mode auto `
  --answer-countdown 5 `
  --answer-threads 4 `
  --show-answer-dialog `
  --log
```

行为：直接选择推荐客户端（x86 优先）；常规扫描优先，常规无结果才全盘扫描；显示完整悬浮面板；倒计时结束后自动答题；默认使用 4 个答题线程。

**4. 手动答题型**

```powershell
& ".\windows\node-scripts\start-windows-node.cmd" `
  --select-client `
  --panel-collapsed `
  --answer-mode manual `
  --answer-key Ctrl+Shift+A `
  --answer-threads 2 `
  --hide-answer-dialog `
  --no-auto-submit `
  --log
```

行为：优先使用 Windows 原生窗口选择或浏览客户端，也可改用 `--client <path>` 跳过扫描；面板默认折叠，每次按 `Ctrl+Shift+A` 授权 2 道题，不显示自动答题弹窗，不自动提交。

**5. 仅扫描型**

```powershell
& ".\windows\node-scripts\start-windows-node.cmd" --scan-mode common --list-clients --no-log --quiet
```

行为：只扫描常见路径（根目录和一级子目录），列出架构和路径后退出；不启动 CXExam。`--list-clients` 的候选列表不受 `--quiet` 抑制。

**6. 强制全盘扫描型**

```powershell
& ".\windows\node-scripts\start-windows-node.cmd" --scan-mode all --list-clients --no-log
```

行为：跳过常规扫描限制，递归扫描所有固定磁盘；跳过系统目录和符号链接；只列出候选，不启动 CXExam。

**7. 配置文件型**

```powershell
& ".\windows\node-scripts\start-windows-node.cmd" `
  --config "C:\Tools\chaoxing-plus.json" `
  --client-first `
  --panel `
  --answer-mode auto
```

**8. 启动时申请管理员权限**

```powershell
# 原生 EXE：先显示系统 UAC，批准后常规扫描并打开客户端选择 GUI
& "C:\Tools\chaoxing_plus.exe" --elevate-on-start

# Node 宿主同样支持；不传这个参数时，到启动客户端需要权限时才申请
& ".\windows\node-scripts\start-windows-node.cmd" --elevate-on-start

# 直接指定客户端并提前申请权限
& "C:\Tools\chaoxing_plus.exe" --elevate-on-start --client "D:\Exam\CXExam.exe"
```

配置文件也可使用 `{"elevateOnStart":true}`。取消 UAC 不启动客户端；此参数不能绕过系统授权，也不与 `--no-elevate` 同用。

**9. 内联 JSON 型**

下面的普通参数示例使用与生成器相同的直接进程启动方式；执行前位于项目根目录。复杂 JSON 请交给生成器完成引用，不要手工拼入批处理。

```powershell
$start = New-Object System.Diagnostics.ProcessStartInfo
$start.FileName = (Get-Command node.exe -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
$start.UseShellExecute = $false
$start.WorkingDirectory = (Get-Location).Path
$start.Arguments = '"windows\node-source\main.mjs" --options-json "{\"scanMode\":\"fallback-all\",\"clientFirst\":true,\"panel\":true,\"answerMode\":\"auto\",\"answerThreads\":4}"'
$hostProcess = [System.Diagnostics.Process]::Start($start)
$hostProcess.WaitForExit()
$global:LASTEXITCODE = $hostProcess.ExitCode
$hostProcess.Dispose()
```

其他常用组合：指定客户端和自定义数据目录：

```powershell
& ".\windows\node-scripts\start-windows-node.cmd" `
  --client "D:\Exam\CXExam.exe" `
  --data-dir "D:\CXPlusData" `
  --panel `
  --panel-width 520 `
  --log
```

三份本地样本都使用同名 `CXExam.exe`，下面演示直接指定文件或安装目录的参数写法，**不代表已完成这三个版本的实际注入验收**。传入目录时，Node 宿主只检查目录根部和一级直接子目录中的 `CXExam.exe`，不会递归进入二级目录；这些是示例路径，不是用户本机安装路径：

```powershell
# 电子科技大学中山学院客户端
& ".\windows\node-scripts\start-windows-node.cmd" --client "C:\ExamClients\电子科技大学中山学院 考试客户端_V4.1.4.25512(2023.06.09)" --inject-strategy hybrid

# 超星考试客户端 V4.3.0.4
& ".\windows\node-scripts\start-windows-node.cmd" --client "C:\ExamClients\超星考试客户端_V4.3.0.4" --inject-strategy script --inject-retries 3

# 河南应用技术职业学院客户端
& ".\windows\node-scripts\start-windows-node.cmd" --client "C:\ExamClients\河南应用技术职业学院 考试客户端_V4.1.4.25512(2023.06.09)" --inject-strategy runtime
```

路径必须最终解析为文件名为 `CXExam.exe` 的有效 PE；宿主会读取 PE machine，校验 x86/x64 兼容性，并只连接本次启动客户端声明的本机 CDP 端口。`hybrid` 在直接执行业务源码失败后尝试 DOM script；严格 CSP 可能阻止 DOM script，此时按策略回退 runtime。两条路径都依赖 CDP `Runtime.evaluate`，不能解决目标完全不支持该命令的问题。这些策略都是页面内 CDP 注入，不是任意进程的 DLL 注入。

Node 与原生宿主均在 target 刷新和 WebSocket 连接前重新检查监听进程归属；查询失败或归属变化时关闭已有会话，等待后续轮询重新验证，不能沿用启动时的结果。Node 定时轮询不会重叠；target 的 WebSocket 只接受指定端口的 `ws://127.0.0.1` 或 `ws://localhost`，后者固定连接已校验的 IPv4 回环地址。`--attach` 仍是显式调试例外，不检查进程归属，但保留本机同端口限制。发送命令时发现 WebSocket 已进入关闭状态，会立即取消等待请求并通知重连，不再等待默认命令超时。

Node 与原生宿主均接受本次启动 PID 及其后代进程作为调试监听所有者。Node 先精确比较直接 PID；不同时再用有界父链查询（最多 8 层）验证父子关系与创建时间顺序，确认成功后按监听 PID 缓存，失败结果只在短 TTL 内缓存后重试；父链查询依赖 Windows PowerShell/WMI，单次可能需要数秒且只在监听 PID 不同于启动 PID 时发生，查询失败、链不连续、创建时间倒置或深度超限一律拒绝连接。原生宿主另以保留句柄、创建时间及进程树枚举验证本次启动的后代进程。自有祖孙进程测试已确认 Node 后代链校验，但尚无证据表明客户端 2 使用了该交接方式；不能用父 PID 相同或关闭归属校验来推断安全接管。

数据生命周期示例（普通退出时清理本轮登记的宿主产物，并删除显式指定的外部配置）：

```powershell
& ".\windows\node-scripts\start-windows-node.cmd" `
  --config "C:\Tools\chaoxing-plus.json" `
  --no-retain-data `
  --delete-config
```

以上标明可执行的示例使用普通运行或内存执行（零落盘、可见进程），不启用启动清理、删除挂起或自毁。手动答题使用快捷键，自动模式按默认业务流程处理题目。`--no-disk-write` 关闭宿主日志、配置持久化、诊断、报告以及本项目业务 store 的本地持久化；CXExam 自身或其它页面脚本仍可能写盘。`--no-retain-data` 仅在普通退出时清理本轮登记产物，`--delete-config` 只删除显式 `--config` 指定的文件，两者都不等于启动清理或自毁。参数错误、环境检查或权限提示仍可能输出。

Windows 端与 Chrome 扩展的差异：

- **面板只在考试/答题相关页面出现**：登录页（passport2）、考试登录跳转（cflogin）、课程/学习页等不再创建面板，避免跨页面跳转时面板反复消失/出现。匹配路径：`/exam-ans/`、`/exam/test/`、`/mooc2/exam`、`/reVersionTestStartNew`、`/examcode/`。
- **面板默认折叠，且只保留考试答题功能**：Windows 宿主注入的 bootstrap 会设置 `window.__CX_WIN_HOST__`，业务侧据此：
  - 把「超星学习助手」面板初始化为折叠状态（只显示标题条，点击标题条展开/折叠）；
  - 裁剪掉学习相关功能：媒体控制、学习流程、任务能力、完成后动作、日志窗口、题库缓存列表区块；
  - 保留：答题结果与题目详情、重答本题、暂停/继续答题、自动答题、AI 兜底搜题及失败行为、考试自动交卷、本地题库缓存开关、题库配置（baseurl/令牌）、AI 搜题设置组。
- **面板主题**：`--panel-theme` 支持 `pink`（默认）/`blue`/`green`，由 `src/projects/common.ts` 的 `panelThemes` 色板统一提供表面、边框、文字与阴影；bootstrap 折叠壳用同名主题先行着色，业务包加载后复用同一节点并跟随共享设置热更新重绘。未知名称回退 `pink`，不加载外部 CSS。修改配色必须同时更新 bootstrap 与业务色板，并运行 `scripts/windows-panel-theme.browser.mjs`（真实构建包）与 `scripts/windows-bootstrap.test.mjs`。
- **提前挂载折叠壳**：bootstrap 在新文档开始阶段就挂载折叠标题条（id 与业务面板一致），业务 bundle 加载后复用同一 DOM 节点填充内容，跨页面切换时面板不再长时间空白/消失。
- Chrome 扩展没有 `__CX_WIN_HOST__`，保持原有的完整面板与默认展开行为。
- 面板生命周期加固（两端共用，属于修复）：只有顶层 frame 能占用面板所有权；顶层面板被页面 SPA 替换 body 移除后会自动重挂载；顶层 READY 丢失时宿主会兜底注入 bootstrap/bundle。

## 验证

### 自动化（不需要客户端、不需要 UAC）

```powershell
# 类型检查与构建（含 Chrome75 语法闸门）
node node_modules/typescript/bin/tsc --noEmit
npm run build
npm run build:windows

# 全量单元测试（Windows 宿主相关包含扫描、参数、生成器）
$testFiles = @(Get-ChildItem -LiteralPath scripts -Filter '*.test.mjs' -File | Sort-Object Name | Select-Object -ExpandProperty FullName)
$testFiles.Count
node --test @testFiles

# 浏览器回归：Swal iframe 顶层运行时、真实 Chromium CDP 与离线参数生成器
node --test scripts/swal-iframe.browser.mjs
node --test scripts/windows-injection.browser.mjs
node --test scripts/windows-parameter-generator.test.mjs
node --test scripts/windows-selection-window.test.mjs

# Node 宿主的 WinForms 选择窗口冒烟（会实际弹出窗口，自动关闭；仅本机手动执行）
$env:CX_TEST_NATIVE_WINDOW='1'; node --test scripts/windows-selection-window.test.mjs; Remove-Item Env:CX_TEST_NATIVE_WINDOW

node windows/node-source/main.mjs --capabilities
node windows/node-source/main.mjs --self-check
git diff --check
```

原生原型的编译验证另行执行，不能用 Node 测试代替。需先具备 MSVC x86 工具链、Windows SDK 和已构建的 `dist-windows` 资源：

```powershell
npm run build:windows
powershell -NoProfile -ExecutionPolicy Bypass -File .\windows\native-source\build-windows.ps1 -BuildTests -BuildConsole

$env:CX_NATIVE_HOST_EXE = (Resolve-Path '.\windows\native-build\bin\chaoxing_plus.exe').Path
$env:CX_NATIVE_INJECTION_EXE = (Resolve-Path '.\windows\native-build\bin\injection-tests.exe').Path
$env:CX_NATIVE_ASSETS_EXE = (Resolve-Path '.\windows\native-build\bin\assets-tests.exe').Path
$env:CX_NATIVE_OPTIONS_EXE = (Resolve-Path '.\windows\native-build\bin\options-tests.exe').Path
$env:CX_NATIVE_CACHE_EXE = (Resolve-Path '.\windows\native-build\bin\discovery-cache-driver.exe').Path
$env:CX_NATIVE_CACHE_HOST_EXE = (Resolve-Path '.\windows\native-build\bin\discovery-cache-host-tests.exe').Path
$env:CX_DISCOVERY_TEST_DRIVER = $env:CX_NATIVE_CACHE_EXE
$env:CX_NATIVE_SESSION_EXE = (Resolve-Path '.\windows\native-build\bin\session-tests.exe').Path
$env:CX_NATIVE_SELECTION_EXE = (Resolve-Path '.\windows\native-build\bin\selection-tests.exe').Path
$env:CX_NATIVE_CLI_SELECTION_EXE = (Resolve-Path '.\windows\native-build\bin\cli-selection-tests.exe').Path
$env:CX_NATIVE_TRANSPORT_EXE = (Resolve-Path '.\windows\native-build\bin\transport-tests.exe').Path
$env:CX_NATIVE_AUDIT_EXE = (Resolve-Path '.\windows\native-build\bin\audit-tests.exe').Path
$env:CX_NATIVE_CONFIG_EXE = (Resolve-Path '.\windows\native-build\bin\config-store-tests.exe').Path
$env:CX_NATIVE_DIAGNOSTICS_EXE = (Resolve-Path '.\windows\native-build\bin\diagnostics-tests.exe').Path
$env:CX_NATIVE_ELEVATION_EXE = (Resolve-Path '.\windows\native-build\bin\elevation-tests.exe').Path
$env:CX_NATIVE_ELEVATION_HOST_EXE = (Resolve-Path '.\windows\native-build\bin\elevation-host-tests.exe').Path
$env:CX_NATIVE_DPI_EXE = (Resolve-Path '.\windows\native-build\bin\dpi-tests.exe').Path
$env:CX_NATIVE_DPI_PROCESS_EXE = (Resolve-Path '.\windows\native-build\bin\dpi-process-tests.exe').Path
$env:CX_NATIVE_DPI_CHILD_EXE = (Resolve-Path '.\windows\native-build\bin\dpi-child.exe').Path
$env:CX_NATIVE_PROCESS_CHECK_EXE = (Resolve-Path '.\windows\native-build\bin\process-check-tests.exe').Path
$env:CX_NATIVE_PROCESS_FIXTURE_EXE = (Resolve-Path '.\windows\native-build\bin\process-fixture.exe').Path
try {
  node --test scripts/windows-native-cache.test.mjs scripts/windows-native-discovery.test.mjs
  node --test scripts/windows-native-host.test.mjs scripts/windows-native-self-check.test.mjs scripts/windows-native-assets.test.mjs scripts/windows-native-options.test.mjs scripts/windows-native-session.test.mjs scripts/windows-native-selection.test.mjs scripts/windows-native-cli-selection.test.mjs scripts/windows-native-transport.test.mjs scripts/windows-native-audit.test.mjs scripts/windows-native-config.test.mjs scripts/windows-native-diagnostics.test.mjs scripts/windows-native-elevation.test.mjs scripts/windows-native-dpi.test.mjs scripts/windows-native-process-check.test.mjs
  node --test scripts/windows-native-injection.browser.mjs scripts/windows-native-assets.browser.mjs scripts/windows-native-lifecycle.browser.mjs scripts/windows-native-audit.browser.mjs scripts/windows-native-config.browser.mjs
} finally {
  Remove-Item Env:CX_NATIVE_CACHE_EXE, Env:CX_NATIVE_CACHE_HOST_EXE, Env:CX_DISCOVERY_TEST_DRIVER -ErrorAction SilentlyContinue
  Remove-Item Env:CX_NATIVE_HOST_EXE, Env:CX_NATIVE_INJECTION_EXE, Env:CX_NATIVE_ASSETS_EXE, Env:CX_NATIVE_OPTIONS_EXE, Env:CX_NATIVE_SESSION_EXE, Env:CX_NATIVE_SELECTION_EXE, Env:CX_NATIVE_CLI_SELECTION_EXE, Env:CX_NATIVE_TRANSPORT_EXE, Env:CX_NATIVE_AUDIT_EXE, Env:CX_NATIVE_CONFIG_EXE, Env:CX_NATIVE_DIAGNOSTICS_EXE, Env:CX_NATIVE_ELEVATION_EXE, Env:CX_NATIVE_ELEVATION_HOST_EXE, Env:CX_NATIVE_DPI_EXE, Env:CX_NATIVE_DPI_PROCESS_EXE, Env:CX_NATIVE_DPI_CHILD_EXE, Env:CX_NATIVE_PROCESS_CHECK_EXE, Env:CX_NATIVE_PROCESS_FIXTURE_EXE -ErrorAction SilentlyContinue
}
```

`diagnostics-tests.exe` 通过 `CX_NATIVE_DIAGNOSTICS_EXE` 纳入测试，检查实际文件写入、诊断 schema、CSS URL 拒绝、禁用开关、窗口 DPI/BMP 头、窗口 PNG 签名/IHDR/CRC/IEND 与 Node `zlib.inflateSync` 行解码、页面截图 base64/PNG 校验与失败降级；其测试目录由 Node 驱动创建并清理。原生测试是 GUI 子系统程序，应使用 Node `spawnSync` 或 `Start-Process -Wait` 等待结束并读取真实退出码，不要将 PowerShell 直接调用后留下的旧 `$LASTEXITCODE` 当作测试结果。`windows-native-diagnostics.test.mjs` 还通过 `CX_NATIVE_HOST_EXE` 执行现代 Chromium 采样回归，覆盖顶层 bundle 确认、分数缩放、CSS URL 脱敏、诊断关闭、路径失败以及 CDP `Page.captureScreenshot` 生成的 `render-diagnostics-page.png`（PNG 签名/IHDR/尺寸边界）；未设置这些变量时会明确跳过。

`elevation-tests.exe`（`CX_NATIVE_ELEVATION_EXE`）通过系统调用替身测试 token、`runas`、等待和取消，真实读取中文临时工作目录并验证参数逐项往返；`elevation-host-tests.exe`（`CX_NATIVE_ELEVATION_HOST_EXE`）编译实际宿主代码，验证 740 交接、父资源关闭、保留已选客户端、不重复选择、父报告不覆盖以及 `WinMain` 退出码。两者均不触发真实 UAC，不启动考试客户端；`CX_NATIVE_HOST_EXE` 还验证能力标记及内部参数在只读动作中的拒绝。

`dpi-tests.exe`（`CX_NATIVE_DPI_EXE`）在隔离的自有 HKCU 测试键中操作真实注册表，并用写入/删除调用替身模拟故障，检查原值类型及字节恢复、兼容标记合并、容量、外部修改冲突和恢复重试；测试不打开真实 `AppCompatFlags\Layers`。`elevation-host-tests.exe` 还验证实际 `h_run`/`WinMain` 的 DPI 应用、恢复及 UAC 交接顺序。`windows-native-dpi.test.mjs` 通过编译版宿主检查能力、帮助、JSON 类型和参数冲突；这些自动化不启动真实客户端，不能代替真实 CEF75 的 DPI 效果验收。

`process-check-tests.exe`（`CX_NATIVE_PROCESS_CHECK_EXE`）通过确定性进程快照替身检查空结果、同名跨目录及大小写匹配、枚举失败、错误码和句柄释放；旧 `proc_instances` 在检查失败时返回 `-1`。`windows-native-process-check.test.mjs` 还将 `process-fixture.exe`（`CX_NATIVE_PROCESS_FIXTURE_EXE`）复制到测试自有目录并命名为 `CXExam.exe`，实际验证普通启动拒绝、失败报告及已有进程保持运行，结束时仅清理自己创建的进程与目录。`elevation-host-tests.exe` 检查冲突/检查失败发生在 DPI 前、提升后重新检查及晚发现冲突时先恢复 DPI；均不启动真实考试客户端。

`-BuildTests` 编译实际原生宿主注入代码与确定性 mock CDP 传输，输出 `injection-tests.exe`，同时生成 `assets-tests.exe`、`multi-assets-tests.exe`、`options-tests.exe`、`json-tests.exe`、`session-tests.exe`、`selection-tests.exe`、`transport-tests.exe`、`audit-tests.exe` 和 `config-store-tests.exe`。`BuildConsole` 默认 `true`，生成嵌入资源 GUI、多文件外置资源 GUI（均 `Subsystem=2`）、`.com` helper（`Subsystem=3`）和普通临时释放包；`-BuildConsole:$false` 仅编译单文件 GUI。主程序与 helper 不能通过改名替代。

`CX_NATIVE_INJECTION_EXE` 启用策略顺序、重试上限、CDP 请求 ID 及执行确认测试；`CX_NATIVE_ASSETS_EXE` 启用单文件资源字节校验；`CX_NATIVE_MULTI_HOST_EXE` 指向 `bin/multi-file/chaoxing_plus.exe`，`CX_NATIVE_MULTI_ASSETS_EXE` 指向 `bin/multi-assets-tests.exe`，供 `windows-native-multi-assets.test.mjs` 检查独立目录加载、无写盘自检、五项资源缺失、无资源 RCDATA 和缓存缓冲独立性。`CX_NATIVE_OPTIONS_EXE` 启用实际 C 参数回归；其余会话、选择、传输、审计与配置变量继续执行上述测试。未设置对应变量时会显示跳过，不能称为已完成编译验证。`json-tests.exe` 可直接执行验证 JSON 解析。`CX_NATIVE_HOST_EXE` 用于单文件 CLI、现代 Chromium 生命周期、审计及配置回归，单文件能力为 `embeddedResources:true`；多文件为 `embeddedResources:false`、`externalResources:true`、`resourceCount:5`、`embeddedResourceCount:0`、`embeddedProxy:false`。两者保留普通运行的配置、日志与报告能力；这些测试仍不等同于真实客户端验收。

2026-10-28 配置同步阶段验证记录：显式展开 55 个 `scripts/*.test.mjs`，560/560 通过、0 跳过；原有 6 个浏览器回归文件共 50/50 通过，新增原生配置浏览器回归 8/8 通过，合计 58 项。类型检查、扩展构建、Chrome75 构建、原生 `-BuildTests` 均退出 0；Node 宿主 self-check 为 0 失败、0 警告。当时原生 EXE 为 498176 字节，导入表仅含 Windows 系统 DLL。编译后的故障回归先失败、修复后通过，覆盖写盘失败期间不丢失更新的内存配置；浏览器回归覆盖新宿主接管旧文档，以及默认/显式配置文件删除后的不同恢复行为。自有宿主、浏览器和监听端口已关闭。以上为本地驱动、mock CDP 与现代 Chromium 自动化证据，尚未执行真实 CEF75 客户端登录后验证；后续执行时应重新展开测试文件并报告当次实际数量。

2026-10-28 页面诊断接线阶段验证记录：显式展开 56 个 `scripts/*.test.mjs`，共 567 项、563 通过、0 失败、4 项可选窗口显示测试跳过；原生 EXE、注入、资源、参数、会话、传输、日志、配置和诊断测试变量均设置为本次构建产物，页面诊断的 6 个现代 Chromium 用例及诊断模块测试实际执行。原生注入/资源/生命周期/审计/配置浏览器回归 34/34 通过；Swal iframe 浏览器回归 8/8 通过。类型检查、扩展构建、Chrome75 构建、原生 `-BuildTests`、Node self-check、`git diff --check` 均退出 0。原生 EXE 为 508928 字节，导入表仅含系统 DLL。诊断开关的 8 个编译后断言先失败再修复通过，覆盖 CLI 最后一次生效和 JSON 分层；仍未执行真实 CEF75 人工登录或旧 Windows 干净环境验证。

2026-10-28 原生自检阶段验证记录：显式展开 57 个 `scripts/*.test.mjs`，575/575 通过、0 跳过；已设置全部原生测试 EXE 变量，并通过 `CX_TEST_NATIVE_WINDOW=1` 执行自动关闭的窗口显示冒烟。新增自检的首轮 7 项红测失败，完善后 8 项编译版回归通过；全量曾发现测试读取并行重建的构建目录而失败，现改为测试自有资源夹具，并在构建后顺序重跑通过。原生浏览器回归 34/34 通过；类型检查、扩展构建、Chrome75 构建、原生 `-BuildTests` 和 Node self-check 均退出 0。原生 EXE 为 513024 字节，导入表仍仅含系统 DLL；对三个真实客户端目录的只读自检均无失败、均报告普通用户权限警告，不代表已完成客户端启动、UAC 或 CEF 登录后验收。

2026-10-28 按需 UAC 阶段验证记录：显式展开 58 个 `scripts/*.test.mjs`，579/579 通过、0 跳过；设置所有原生测试 EXE 变量及 `CX_TEST_NATIVE_WINDOW=1`，包含新增的两个提权测试驱动。原生注入/资源/生命周期/审计/配置与 Swal iframe 浏览器回归合计 42/42 通过。类型检查、扩展构建、Chrome75 构建、无警告原生 `-BuildTests`、Node self-check 和 `git diff --check` 均退出 0；原生 EXE 为 517120 字节，导入表仅含 Windows 系统 DLL。参数往返测试真实读取中文空格临时工作目录，740、token、取消、父资源释放及报告交接使用 Win32 调用替身；没有触发真实 UAC 或启动真实考试客户端，仍需人工验收。

2026-10-28 已有客户端检查阶段验证记录：显式展开 60 个 `scripts/*.test.mjs`，587/587 通过、0 失败、0 跳过；已设置全部原生测试 EXE 变量及窗口冒烟开关。原生注入/资源/生命周期/审计/配置和 Swal iframe 浏览器回归 42/42 通过。类型检查、扩展构建、Chrome75 构建、无警告原生 `-BuildTests`、Node self-check 与 `git diff --check` 均退出 0；原生 EXE 为 522240 字节，导入表只含系统 DLL。新增能力红测先失败，完成后通过；真实测试自有进程验证已有客户端保持运行，确定性驱动还覆盖 `proc_launch` 复查及晚冲突的 DPI 恢复。没有启动真实考试客户端或触发真实 UAC，仍不代表 CEF75 登录后或旧 Windows 环境验收。

2026-10-28 扫描与生成器完善验证记录：显式展开 61 个 `scripts/*.test.mjs`，614 项中 610 通过、0 失败、4 项可选窗口显示冒烟跳过；全部原生测试程序变量指向本轮构建。另行执行 Node 实际 Chromium 注入回归 17/17、Swal iframe 回归 8/8。类型检查、扩展构建、Chrome75 构建、原生 `-BuildTests`、Node self-check 与 `git diff --check` 均退出 0，self-check 为 0 失败、0 警告；原生 EXE 为 523264 字节，导入表仅含 Windows 系统 DLL。新增回归先失败后通过，覆盖默认扫描缓存复用、范围失效、frame 子树清理、消息身份校验、原生生成命令/JSON 的选择族覆盖和字符串容量。生成器在 PowerShell 5.1/7 与 cmd 中实跑只读入口，验证 JSON、中文、引号、尾反斜杠和工作目录；桌面 1280 与手机 390 宽度布局已检查。没有执行真实 CEF75 客户端登录后、真实 UAC 或旧 Windows 干净环境验收；内存执行、启动清理、自毁仍禁用。

2026-10-28 无人工配合的收尾验证：显式展开 65 个 `scripts/*.test.mjs`，共 650 项，646 通过、0 失败，4 项需要显示原生窗口的可选冒烟跳过；全部原生编译测试变量和发现器驱动均指向本轮默认构建，新增缓存驱动已实际执行。另跑 Node 注入、Swal 及五个原生浏览器回归文件，59/59 通过、0 跳过。类型检查、扩展构建、Chrome75 构建、原生 `-BuildTests`、Node self-check 和差异检查均退出 0，自检为 0 失败、0 警告。原生 EXE 为 530432 字节，导入表只有 Windows 系统 DLL，无额外 CRT；旧 Windows 干净环境仍未验证。

本轮修复并锁定无面板模式的手动答题提示、Node UAC 参数保真、原生 HTTP/Upgrade 总截止与准确停止原因、原生常规扫描缓存及嵌套未实现能力的显式拒绝。PowerShell 5.1/7 参数回归只运行无权限参数探针；自动化使用自有 mock 服务和现代 Chromium，收尾阶段没有再次启动考试客户端或申请 UAC。真实客户端结果以前文人工运行表为准，客户端 2 的注入兼容性、客户端 3 的登录环境及旧系统适配仍未验收；内存执行、启动清理和自毁继续禁用。

2026-10-28 手动答题与参数边界完善验证：显式展开 67 个 `scripts/*.test.mjs`，690 项中 686 通过、0 失败，4 项可选窗口显示冒烟跳过；全部原生编译测试变量及缓存发现驱动指向本轮默认构建。9 个浏览器文件最终完整复测 69/69 通过、0 跳过，包含 Swal、面板、配置和全部注入策略。原生配置文件的旧夹具曾使用不合法的启动端口 `1`，已改为合法端口并新增非法端口热更新拒绝检查。类型检查、扩展构建、Chrome75 构建、原生 `-BuildTests` 均退出 0；Node self-check 为 0 失败、0 警告，独立编译 JSON 驱动 20/20 通过。

新增真实 Chromium 双运行时回归覆盖手动长等待、实际搜题截止、关闭、初始化失败、并发许可、分页一键四题及完成后重答；原生端点探测新增脱敏固定分类，并以编译测试确认进程树枚举失败不接受部分结果。原生 EXE 为 532992 字节，SHA256 为 `37DFE9E8246C8E54C6CA4E9C0A61BFD6267224484289FB486CB7FE6DC168404F`，导入表仅有 9 项 Windows 系统 DLL。此次仍为自有 mock、现代 Chromium 和本地编译驱动验证，没有再次启动真实考试客户端、申请 UAC 或完成旧 Windows 干净环境验收，不能据此宣布客户端 2 已兼容。

2026-10-28 本地连接日志验证：显式展开 70 个 `scripts/*.test.mjs`，719 项中 715 通过、0 失败，4 项可选窗口显示测试跳过；全部原生编译测试变量指向本轮构建。9 个浏览器回归文件最终 77/77 通过、0 跳过，覆盖顶层内存回放、导航/重连、无面板、无写盘、失败退避，以及真实业务包的日志区挂载。发布构建 `--release` 输出 `injectionLog=false`，独立浏览器检查确认不显示；本机忽略配置开启后输出 `true`，实际业务包检查确认 12px 日志且更新不替换答题控件。类型检查、扩展构建、Chrome75 构建、原生 `-BuildTests`、Node 自检及差异检查均退出 `0`，独立 JSON 驱动 20/20 通过。

全量浏览器首轮曾发现旧重连夹具把主动中断在途注入也误要求为零失败；新增可控断线确认失败发生于断开与恢复之间，普通到期取消仍要求零失败，原生生产统计没有修改。当前本地验证 EXE 为 542208 字节，SHA256 为 `5C9DABAB37F5E7F3D02F81FEFA93428912513F2D3A8576DB9C59F181996C5576`，导入表仍只含系统 DLL。本地构建配置及产物没有纳入 Git；本阶段新增日志尚未在真实 CEF75 登录后验证，等待人工配合。

2026-10-29 原生数据生命周期验证记录：`--no-retain-data` / `--delete-config` 已在原生宿主接通（此前显式拒绝）。编译 `windows/native-source/build-windows.ps1 -BuildTests` 退出 `0`；`options-tests.exe` 新增断言覆盖 no-retain-data 生效、delete-config 需显式 `--config`、与 `--no-disk-write` 冲突、JSON `retainData:false` / `deleteConfig:true`，执行退出 `0`；新增 `windows-native-lifecycle.test.mjs` 5/5 通过：只删除本轮创建的日志与报告、保留运行前已有文件、JSON 与 CLI 行为一致、只删除显式 `--config`、拒绝缺失 `--config` 或与 `--no-disk-write` 同用。`--capabilities` 新增 `retainData:true`、`deleteConfig:true`；生成器原生模式解除对应禁用并阻止无 `--config` 的 `deleteConfig`（生成器 36/36 通过）。全量：显式展开 74 个 `scripts/*.test.mjs`，763 项中 756 通过、0 失败、7 项可选 GUI 显示测试跳过；9 个浏览器回归文件 77/77 通过。类型检查、扩展构建、Chrome75 构建、Node 自检、原生自检及 `git diff --check` 均退出 `0`。本轮验证 EXE 为 545280 字节，SHA256 为 `433C42097891D716F16A3DD954F07847B8631D5EC2A0714342E0831711E3B472`，导入表仅含系统 DLL。默认配置“仅清理本轮新建文件”的路径与 UAC 交接时由提升子实例执行最终删除的行为目前只有代码审查与命令行生命周期回归，未在真实页面同步/UAC 人工审批场景自动化覆盖；真实 CEF75 登录后验收仍未执行。

2026-10-29 Node `--print-effective-config` 验证记录：Node 宿主补齐与原生一致的只读配置输出（此前仅原生支持），把 `--print-effective-config` 加进 Node 参数、帮助与文档，并确保它在完整配置合并之后、日志/扫描/UAC/客户端启动之前返回。输出为单行合并后共享设置 JSON：`--options-json` 覆盖 `--config`，独立 CLI 覆盖内联 JSON；`--quiet` 不抑制输出且不产生额外日志行；不扫描、不启动客户端、不申请 UAC、不写日志/配置/报告/诊断，`--data-dir` 不被创建、`--config` 文件不被改写；与 `--list-clients` 同时使用时仍优先输出并退出（约 377ms）。新增 `windows-print-effective-config.test.mjs` 3/3 通过。全量：显式展开 75 个 `scripts/*.test.mjs`，766 项中 759 通过、0 失败、7 项可选 GUI 显示测试跳过；9 个浏览器回归文件 77/77 通过。类型检查、Node 自检、原生自检及 `git diff --check` 均退出 `0`。真实 CEF75 登录后验收仍未执行。

2026-10-30 Node 监听归属后代链验证记录：Node 普通启动现在接受本次启动 PID 及其后代进程作为调试监听所有者（此前仅精确 PID）。监听 PID 等于启动 PID 时不启动任何进程查询；不同时用有界父链（≤8 层）与创建时间顺序验证，Windows PowerShell `Get-CimInstance Win32_Process` 查询按监听 PID 缓存，失败结果保留 30 秒短 TTL 后重试；查询失败、父子链断裂、深度超限或创建时间倒置均拒绝并关闭旧会话。新增 `windows-listener-owner.test.mjs` 四项回归（父链解析、PowerShell 查询直接调用与失败关闭、验证器缓存与降级语义、真实祖孙进程监听端到端），并更新注入生命周期夹具、AGENTS 规则与本文档。全量：显式展开 75 个 `scripts/*.test.mjs`，770 项中 763 通过、0 失败、7 项可选 GUI 显示测试跳过；9 个浏览器回归文件 77/77 通过；类型检查、`npm run build`、Chrome75 构建、Node 自检、原生自检及 `git diff --check` 均退出 `0`。本机 Windows PowerShell `Get-CimInstance` 单次父链查询实测约 5.6-5.9 秒，只在监听 PID 不同于启动 PID 时发生一次，不代表其他机器或真实客户端启动耗时。该验证使用测试自有祖孙进程；尚无证据表明真实客户端 2 使用子进程监听，真实 CEF75 登录后验收仍未执行。

2026-10-31 面板主题（`--panel-theme`）验证记录：该参数从“预留主题名”改为实际生效，支持 `pink`（默认）/`blue`/`green` 三个内置浅色主题。业务色板集中在 `src/projects/common.ts` 的 `panelThemes`，面板重绘时按共享设置解析并写入 `data-chaoxing-plus-theme`，面板内阴影改用 `shadowRgb` 派生的 `panelShadowColor`，换主题不再残留粉色阴影；bootstrap 折叠壳用同名色板先行着色，并在 config 热更新时同步刷新。未知/空主题名回退 `pink`，不加载外部 CSS；生成器新增主题下拉建议与三值校验（非法名称阻止导出），Node/原生帮助列出主题名。新增 `scripts/windows-panel-theme.browser.mjs`（真实构建包 + 真实 Chromium）2/2：blue/green 面板边框与主题属性生效、未知值回退 pink、运行中热更新重绘；`windows-bootstrap.test.mjs` 新增折叠壳主题/回退/热更新测试；`pink-panel-ui.test.mjs` 新增色板驱动断言。全量：显式展开 75 个 `scripts/*.test.mjs`，772 项中 765 通过、0 失败、7 项可选 GUI 显示测试跳过；10 个浏览器回归文件 79/79 通过；类型检查、`npm run build`、Chrome75 构建、原生 `-BuildTests`（内嵌新 bootstrap，EXE 548864 字节）、Node 自检、原生自检及 `git diff --check` 均退出 `0`。该验证使用本地 Chromium 构建页，不是真实 CEF75 客户端登录后验收；真实考试页面上的主题观感与可读性仍需人工确认，未支持暗色主题或自定义 CSS。

2026-11-01 发布打包与 CI 验证记录：新增 `windows/share-file/package-windows.mjs`（`npm run release:windows`）生成原生 EXE + Node 宿主双入口发布包，包含 `release-info.json`、`SHA256SUMS.txt` 与 Windows `Compress-Archive` zip；Node 宿主只带 `main.mjs` 递归运行闭包与 `launch-client.ps1` / `selection-window.ps1` / `system-probe.ps1`，`self-destruct.mjs`、`wipe.mjs`、`owned-files.mjs`、`chrome75-syntax.mjs` 等内部原型/构建期模块不进入发布包，检测到运行闭包包含内部原型或外部 npm 依赖时失败关闭（`--skip-native` 可生成仅 Node 包，`--skip-zip` 仅生成暂存目录）。新增 `.github/workflows/ci.yml`：`windows-latest` 上执行 `npm ci` → 类型检查 → 扩展/Windows/原生构建 → 全量单元测试（全部原生测试变量指向本轮编译产物）→ 10 个浏览器回归 → 发布包冒烟并上传 artifact。新增 `scripts/windows-release-package.test.mjs` 5/5：双入口包结构、`SHA256SUMS` 逐文件校验、zip 条目、仅 Node 模式、缺失资源/内部原型/外部依赖失败关闭、CI 工作流与发布脚本入口契约、原生构建脚本纯 ASCII 且不依赖模块 cmdlet。构建脚本 `windows/native-source/build-windows.ps1` 的 SHA256 输出由 `Get-FileHash` 改为系统 `certutil.exe -hashfile`，修复本机曾出现 `Get-FileHash CommandNotFound` 导致 `npm run build:native` 误报失败；同时保持 `.ps1` 纯 ASCII（中文字面量曾直接导致 PowerShell 5.1 解析失败）。实际打包产物 27 个文件、原生 EXE 548864 字节，解压后 Node 宿主 `--self-check` 与原生 `--self-check` 均退出 `0`。全量：显式展开 76 个 `scripts/*.test.mjs`，777 项中 770 通过、0 失败、7 项可选 GUI 显示测试跳过；10 个浏览器回归文件 79/79 通过；类型检查、`npm run build`、Chrome75 构建、`npm run build:native`、Node 自检、原生自检及 `git diff --check` 均退出 `0`。本记录仍是本地/CI 模拟验证；CI 通过不代表真实 UAC 审批、真实 CEF75 登录后页面、旧 Windows 干净环境或真实考试客户端验收已完成。

2026-11-02 全盘扫描进度/取消验证记录：Node 选择窗口点击全盘扫描后，宿主在执行递归扫描期间显示独立的 WinForms 进度窗口（`windows/node-scripts/scan-progress-window.ps1` / `.mjs`），实时展示“已检查目录数/发现候选数”；用户点击取消或关闭窗口时写入 `cancel.marker`，宿主通过 `AbortSignal` 中止 discovery（`AbortError`），保留原候选并重新打开选择窗口。发现器新增 `onProgress` 与 `signal`（目录数/候选数/elapsedMs，200ms 节流），进度窗口不可用时降级为无界面扫描并每 2 秒输出进度日志。新增 `windows-scan-progress-window.test.mjs` 6 项（5 通过 + 1 项 `CX_TEST_NATIVE_WINDOW` 真实窗口冒烟默认跳过）：脚本纯 ASCII、payload/状态校验、控制器状态/取消文件/临时目录清理协议、真实 PowerShell 控件探针与可选真实可见性；`windows-client-discovery.test.mjs` 新增进度回调与取消回归，`windows-client-selection.test.mjs` 新增进度窗口完成/取消集成（共 21 项）。全量：显式展开 77 个 `scripts/*.test.mjs`，787 项中 779 通过、0 失败、8 项可选 GUI 显示测试跳过；10 个浏览器回归 79/79；类型检查、扩展构建、Chrome75 构建、Node 自检、原生自检、发布包重打并解压自检及 `git diff --check` 均退出 `0`。原生 EXE 选择流程仍无进度/取消窗口，属已记录的 Node/原生差异；该验证使用测试驱动的取消与控件探针，真实窗口可见性仅在 `CX_TEST_NATIVE_WINDOW=1` 时验证，真实 CEF75 客户端登录后验收仍未执行。

2026-12-05 启动入口拆分、静默场景与配置加载验证记录：按需求把 Node 入口拆为三类——`start-windows.cmd` 常规入口（wscript 隐藏控制台但 GUI 正常显示，无参数时沿用“常规扫描 + GUI 选择”）、`start-windows-debug.cmd` 调试入口（可见控制台 + GUI）、`start-windows-silent.cmd` 静默场景入口（固定 `--scan-mode fallback-all --client-first --execution-mode memory --no-disk-write --no-log --quiet --no-panel --answer-mode manual --answer-key Ctrl+Alt+Shift+S --answer-threads 1 --hide-answer-dialog`，先常规扫描，无候选才回退全盘，x86 优先/首个 x64 保底由已有 discovery 回归覆盖）。发布包与 `release-info.entrypoints` 增加 `nodeDebug`。参数生成器新增“加载已有配置”按钮，可读取本地 config 的顶层字段与 settings 并回填表单，未知字段提示忽略。验证：新增/更新的 silent-launcher、release-package、generator 用例通过；`start-windows-debug.cmd --help` 真实退出 0；配置加载测试覆盖正常配置与非法 JSON。自毁、删除挂起、启动清理、程序文件自删除仍不实现（用户要求的自删除/自毁属破坏性且未在仓库定义），静默入口不会偷偷启用。全量回归（78 个单元文件，受限并发 4）：810 项中 801 通过、0 失败、9 项可选 GUI 跳过；10 个浏览器回归 79/79；`tsc --noEmit`、扩展构建、Chrome75 release 构建、发布包重打、包内 `verify-release.mjs`、包内 Node/原生自检、仓库 Node/原生自检与 `git diff --check` 全部退出 0；发布包无 `windows/data/` 与 `.log`，`release-info.json` 的 `entrypoints` 为 `node`/`nodeDebug`/`nodeSilent`。未在真实 CEF75/UAC/旧 Windows 环境重复验收。

2026-12-04 内存执行（executionMode=memory）验证记录：按用户确认的语义实现内存执行——宿主侧零落盘（不创建/更新配置与数据目录，不写日志、诊断、报告、扫描缓存），客户端仍用正常官方调试参数启动并显示在进程列表中，不隐藏进程、不删除 CXExam 文件。Node：`--execution-mode memory` / `--memory-exec` / JSON `executionMode:"memory"` / `memoryExec:true` 均可用，强制 `noDiskWrite`；`--capabilities` 输出 `executionModes:["normal","memory"]` 与 `memoryExecution:true`；普通/attach/列表报告含 `executionMode`。原生：options CLI/JSON 同一语义，finalize 强制 noDiskWrite，帮助与 capabilities 同步，报告含 `executionMode`；编译 options-tests 覆盖 memory/zero-disk 与 delete-suspend 拒绝。生成器执行模式支持 memory，并生成 `--execution-mode memory --no-disk-write`、拒绝日志/诊断/报告冲突。删除挂起/启动清理/自毁仍显式拒绝。测试：`windows-host.test.mjs` 实跑 memory 列表不写报告/数据目录；`windows-native-options.test.mjs` 实跑四种 memory 入口与 capabilities；`windows-parameter-generator.test.mjs` 断言 memory 命令/JSON；编译 options-tests 通过。全量回归：单元 809 项中 800 通过、0 失败、9 项可选 GUI 跳过（78 文件），10 个浏览器回归 79/79；`tsc --noEmit`、扩展构建、Chrome75 release 构建、原生构建、发布包重打、包内 `verify-release.mjs`、包内 Node/原生自检、仓库 Node/原生自检与 `git diff --check` 全部退出 0，发布包无 `windows/data/` 与 `.log`。未在真实 CEF75/UAC/旧 Windows 环境重复验收。

2026-12-03 第一阶段最终验收审计记录：对 docs/README/AGENTS 的“未实现/不支持”声明逐项复核，剩余项仅为第一阶段按 AGENTS 必须显式拒绝的内存执行、删除挂起、启动清理、自毁（CLI/JSON/配置/capability/生成器均拒绝且不静默降级）；运行时代码（`windows/node-source/*.mjs`、`windows/native-source/*.c|h`、打包/校验脚本）无 TODO/FIXME/XXX。最终验收完整流水线（受限并发 4）：`tsc --noEmit`、扩展构建、Chrome75 release 构建、原生构建、全量单元 807 项中 798 通过/0 失败/9 项可选 GUI 跳过、10 个浏览器回归 79/79、发布包重打、包内 `verify-release.mjs`、包内 Node/原生 `--self-check`、包内 `--version`、仓库 Node/原生自检、`git diff --check` 全部退出 0；发布包发布信息为 `version=6.2.0`、payload 32 文件、SHA256SUMS 33 条、含 verifier/nodeSilent 入口、zip 约 469KB，包内无 `windows/data/` 与 `.log`。边界：真实考试客户端登录后页面、真实 UAC、旧 Windows/高分屏、真实 GitHub Actions 仍未由本机自动化验收，不能据此宣称已通过真实验收；内存执行/删除挂起/启动清理/自毁仍按第一阶段要求保持显式拒绝。
2026-12-02 Node 自检报告版本/宿主字段验证记录：Node `--self-check --report` 报告此前只有 `mode:"self-check"`，缺少统一的 `version`/`host`，无法与普通/attach/列表报告一致区分宿主。现自检报告在 `mode` 后补 `version:"6.2.0"`、`host:"node"`；`windows-host.test.mjs` 自检用例断言两字段，实跑该文件 36/36 通过。全量 `scripts/*.test.mjs`（78 文件）单元 807 项中 798 通过、0 失败、9 项可选 GUI 显示测试跳过，10 个浏览器回归 79/79，类型检查、扩展构建、Chrome75 release 构建、原生构建、发布包重打与解压自检、发布包校验器、Node/原生自检及 `git diff --check` 全部退出 0。同一轮完整流水线另出现一次原生传输截止测试偶发（“native run deadline includes a slow HTTP target-list response”）：并行负载下从请求到进程退出的观测耗时超过原先 1500ms 断言上限（服务端仍延迟 2500ms，说明截止仍生效）。已将 `windows-native-transport.test.mjs` 四个截止松弛断言统一放宽到 2000ms（仍显著小于 2500ms 延迟响应，可区分截止生效与未生效），单独连跑两次 7/7 通过 + 1 项编译自检跳过。随后全量默认并发又出现一次 Chromium 诊断用例偶发（`windows-native-diagnostics.test.mjs` 的 no-disk-write 用例，单独连跑两次 7/7 通过），确认为本机默认并发下多个 Chromium/原生宿主用例同时启动导致的负载型时序问题。现将完整本地/CI 全量测试并发限制为 4（`node --test --test-concurrency=4`）：CI 单元与浏览器步骤、`windows-release-package.test.mjs` 契约断言同步；受限并发下全量单元 807/798/9、10 个浏览器 79/79 均稳定通过，类型检查、构建、发布包、自检与 `git diff --check` 全部退出 0。该验证覆盖自检报告 schema、截止测试与全量并发稳定性；未在真实客户端环境重复验收。
2026-12-01 浏览器回归偶发（interrupted in-flight injection）稳定性修复记录：`windows-native-audit.browser.mjs` 的“compiled native reports an interrupted in-flight injection and recovers its live document”在完整并行流水线偶发失败（单独重跑与全部重跑均通过），根因是测试在代理断开 WebSocket 后等待原生宿主重连并补注入的 3 秒上限在并行负载下不足，且 `--duration 4000` 过于贴近测试尾部。现将该用例的 `--duration` 提升到 10000、重连后补注入等待上限提升到 8000，并注明并行负载原因；断言/事件计数逻辑不变。单独运行 `windows-native-audit.browser.mjs` 连续两次 13/13 通过；完整流水线 10 个浏览器套件 79/79 通过、0 失败。全量 `scripts/*.test.mjs`（78 文件）单元 807 项中 798 通过、0 失败、9 项可选 GUI 显示测试跳过，类型检查、扩展构建、Chrome75 release 构建、原生构建、发布包重打与解压自检、发布包校验器、Node/原生自检及 `git diff --check` 全部退出 0。该验证修复的是测试时序稳定性，不改变宿主行为；未在真实 CI runner 或真实客户端环境重复验收。
2026-11-30 Node 运行报告版本/宿主字段对齐验证记录：Node 普通运行与 attach 运行报告此前没有 `version`/`host` 字段，工具无法像原生报告（`version:"6.2.0"`、`host:"native"`）那样直接区分宿主类型与版本；上轮新增的列表报告还使用 `hostVersion` 命名。现统一为 `version:"6.2.0"` + `host:"node"`：普通/attach 报告对象在 `mode` 后补齐两字段，列表报告由 `hostVersion` 改为 `version`（保留 `host`），文档同步。`windows-host.test.mjs` 的 attach 报告与列表报告用例分别断言 `host/version`；实跑该文件 36/36 通过。全量 `scripts/*.test.mjs`（78 文件）单元 807 项中 798 通过、0 失败、9 项可选 GUI 显示测试跳过；10 个浏览器回归在完整流水线首轮出现已知偶发（`windows-native-lifecycle.browser.mjs` 的“interrupted in-flight injection”在并行负载下 78/79），单独重跑 `windows-native-lifecycle.browser.mjs` 12/12、10 个浏览器套件全部重跑 79/79 通过，类型检查、扩展构建、Chrome75 release 构建、原生构建、发布包重打与解压自检、发布包校验器、Node/原生自检及 `git diff --check` 全部退出 0。该验证覆盖 Node 报告字段与原生 schema 对齐；未在真实客户端环境重复验收。
2026-11-29 列表报告字段对齐验证记录：Node 列表报告此前只有 mode/scanMode/时间/success/total/candidates，缺少原生报告已有的 `host`、`version/hostVersion`、`stopReason`、`durationMs`，工具无法统一解析两端报告。现补上 `host:"node"`、`hostVersion:"6.2.0"`、`stopReason:"list-clients"`、`durationMs`，与原生 `mode/stopReason/host/version` 语义对应；`windows-host.test.mjs` 断言这些字段与 `durationMs >= 0`。实跑该文件 36/36 通过。全量 `scripts/*.test.mjs`（78 文件）单元 807 项中 798 通过、0 失败、9 项可选 GUI 显示测试跳过，10 个浏览器回归 79/79，类型检查、扩展构建、Chrome75 release 构建、原生构建、发布包重打与解压自检、发布包校验器、Node/原生自检及 `git diff --check` 全部退出 0。该验证覆盖列表报告字段一致性；未在真实客户端环境重复验收。
2026-11-28 Node `--list-clients --report` 验证记录：原生宿主支持列表操作显式写报告，但 Node 的 `--list-clients` 分支在打印候选后直接返回，即使显式传 `--report` 也不生成报告（静默丢失用户请求）。现 `client-selection.mjs` 增加 `onListCandidates` 回调，列表模式打印后把候选的 path/name/machine 描述交给宿主；`main.mjs` 在 `--list-clients` 分支按显式 `--report` 写入 `mode: "list-clients"` 报告（scanMode、startedAt/finishedAt、success、total、candidates），`--no-disk-write` 仍优先抑制写入，未传 `--report` 行为不变。`windows-host.test.mjs` 新增真实列表运行回归：断言报告字段、total 与 candidates 一致、文件存在；并断言 `--no-disk-write` 下报告不创建；实跑该文件 36/36 通过。全量 `scripts/*.test.mjs`（78 文件）单元 807 项中 798 通过、0 失败、9 项可选 GUI 显示测试跳过，10 个浏览器回归 79/79，类型检查、扩展构建、Chrome75 release 构建、原生构建、发布包重打与解压自检、发布包校验器、Node/原生自检及 `git diff --check` 全部退出 0。该验证覆盖 Node 列表报告与 no-disk-write 抑制；未在真实客户端环境重复验收。
2026-11-27 发布包版本一致性守卫验证记录：打包脚本此前只校验 `dist-windows/package-manifest.json` 的 `features.injectionLog`，不校验清单 `version` 与发布版本，本地残留旧 `dist-windows` 时可能把旧构建打成新版本号。现 `package-windows.mjs` 在清单解析后强制要求 `version` 存在且与 `package.json`/`--version` 完全一致，不一致或无版本时退出 2 并提示重新执行 `npm run build:windows -- --release`。`windows-release-package.test.mjs` 新增“拒绝与发布版本不一致的 dist 构建”用例（夹具清单 9.9.8、发布版本 9.9.9，断言退出 2 及错误信息包含两个版本与 build:windows 提示）；同时给 node-only 与失败关闭用例显式传入匹配的 `--version 9.9.9`。实跑该文件 7/7 通过，真实 `npm run release:windows`（清单 6.2.0）正常通过。全量 `scripts/*.test.mjs`（78 文件）单元 806 项中 797 通过、0 失败、9 项可选 GUI 显示测试跳过，10 个浏览器回归 79/79，类型检查、扩展构建、Chrome75 release 构建、原生构建、发布包重打与解压自检、发布包校验器、Node/原生自检及 `git diff --check` 全部退出 0。该验证覆盖版本一致性守卫；未在真实 CI runner 或真实客户端环境重复验收。
2026-11-26 双宿主 `--version` 验证记录：Node 与原生宿主此前均无常见 CLI `--version` 约定，仅 `--help` 内出现版本号。现两端新增 `--version`/`-v`：Node 在参数解析层接受该开关，主入口在 help 之后、其他动作之前输出单行 `6.2.0` 并返回；原生在 options 层解析、宿主 help 之后输出 `6.2.0` 并返回，不进入普通运行/扫描/写盘流程。帮助文本与参数表同步；测试新增 Node 参数默认/开关解析、Node `--version` 实跑（输出 `6.2.0` 且不创建数据目录）、原生 `--version` 实跑（退出 0、stdout 6.2.0）、原生帮助包含 `--version`、原生提权只读清单加入 `--version`，编译 `options-tests.exe` 新增 CLI 层解析与默认关闭断言。实跑受影响套件 83 项中 82 通过、0 失败、1 项可选 GUI 跳过；原生 `--version` 实测 `EXIT=0 OUT=6.2.0`。全量并行首轮曾出现一次测试清理偶发：隐藏启动器探针写完后其 node 子进程仍短暂占用临时目录，`fs.rm` 报 `EBUSY`；已在静默启动器测试的临时目录清理加入 `maxRetries:10, retryDelay:100` 重试，重跑 9/9 通过。全量 `scripts/*.test.mjs`（78 文件）单元 805 项中 796 通过、0 失败、9 项可选 GUI 显示测试跳过，10 个浏览器回归 79/79，类型检查、扩展构建、Chrome75 release 构建、原生构建、发布包重打与解压自检、发布包校验器、Node/原生自检及 `git diff --check` 全部退出 0。该验证覆盖双宿主版本输出与只读行为；未在真实 CI runner 或真实客户端环境重复验收。
2026-11-25 Node `--capabilities` 字段补齐验证记录：Node 宿主 `--capabilities` 原仅列出 `executionModes`/`scanner`/`parameterGenerator`/`nativeClientSelection` 四项，未暴露已实现的配置热更新、配置持久化、文件日志、运行报告、页面/窗口诊断、完整渲染诊断与数据生命周期能力。现按实际实现补齐 `configReload`、`configPersistence`、`fileLogging`、`runReport`、`pageRenderDiagnostics`、`pageScreenshots`、`windowDiagnostics`、`renderDiagnostics`、`retainData`、`deleteConfig`（不宣称未实现能力，unsupported schema 保持不变）。`windows-host.test.mjs` 新增内容回归：解析 JSON、断言 `hostVersion`/`executionMode`/`executionModes`/全部新增布尔能力与 Windows 原生选择窗口标记、`unsupported.implemented=false` 及 notes 非空；实跑该文件 34/34 通过。全量 `scripts/*.test.mjs`（78 文件）单元 803 项中 794 通过、0 失败、9 项可选 GUI 显示测试跳过，10 个浏览器回归 79/79，类型检查、扩展构建、Chrome75 release 构建、原生构建、发布包重打与解压自检、发布包校验器、Node/原生自检及 `git diff --check` 全部退出 0。该验证覆盖能力声明与实现一致性；未在真实 CI runner 或真实客户端环境重复验收。
2026-11-24 原生 --print-effective-config 内容回归验证记录：此前 `windows-print-effective-config.test.mjs` 只覆盖 Node；原生该功能仅靠参数解析/提权列表间接覆盖，缺少内容断言。现补充两项原生用例：1) `--config` 设置 + `--options-json` 内联设置合并后输出单行 JSON，托管默认值（panel-theme/answer-threads）补齐、配置层与内联值生效、未托管 tiku/unknown 共享键保留、无重复键、`--quiet` 不抑制；读取配置前后内容一致、不创建 `--data-dir` 或额外文件。2) `--no-disk-write` 时输出 `windows-no-disk-write:true`、`windows-log-enabled:false`、extension-enabled true 且不写盘。实跑该文件 5/5 通过（原生用例在设置 `CX_NATIVE_HOST_EXE` 时执行，CI 会注入该变量）。全量 `scripts/*.test.mjs`（78 文件）单元 802 项中 793 通过、0 失败、9 项可选 GUI 显示测试跳过，10 个浏览器回归 79/79，类型检查、扩展构建、Chrome75 release 构建、原生构建、发布包重打与解压自检、发布包校验器、Node/原生自检及 `git diff --check` 全部退出 0。该验证覆盖只读输出与不写盘；未在真实客户端环境重复验收。
2026-11-23 Node 自检只读对齐验证记录：Node `--self-check` 原默认会向 `windows/data/logs` 写入隐式日志（自检副作用、与原生“自检不写日志/诊断/配置”不一致）。现自检分支仅在显式 `--log` 时附加日志文件，默认不创建数据目录/日志；显式 `--report` 仍按用户要求写报告，`--no-disk-write` 继续禁止所有落盘。`windows-host.test.mjs` 的自检用例新增 `--data-dir` 隔离断言：默认自检后数据目录不存在；显式 `--log` 时日志文件存在。实跑 `windows-host.test.mjs` 33/33 通过。全量 `scripts/*.test.mjs`（78 文件）单元 800 项中 791 通过、0 失败、9 项可选 GUI 显示测试跳过，10 个浏览器回归 79/79，类型检查、扩展构建、Chrome75 release 构建、原生构建、发布包重打与解压自检、发布包校验器、Node/原生自检及 `git diff --check` 全部退出 0。该验证覆盖 Node 自检只读行为与显式落盘开关；未在真实 CI runner 或真实客户端环境重复验收。
2026-11-22 发布包完整性自校验工具验证记录：新增无依赖脚本 `windows/share-file/verify-release.mjs`，按同目录 `SHA256SUMS.txt` 逐文件校验 SHA-256；`package-windows.mjs` 新增 `--verifier`（默认 `windows/share-file/verify-release.mjs`），把校验器复制到包根 `verify-release.mjs` 并纳入 payload 与校验清单，`release-info.json` 记录 `verifier`。`windows-release-package.test.mjs` 全链路验证：包内校验器自检退出 0 且输出“发布包完整性校验通过”，篡改已登记文件后退出 1 并报告“摘要不匹配”，released info 断言 `verifier`，zip 条目包含校验器；CI 发布包解压自检新增运行校验器步骤，必需文件列表加入 `verify-release.mjs`，契约测试断言工作流包含该校验器。实跑重建发布包后 `node release/chaoxing-plus-6.2.0-windows/verify-release.mjs` 通过（33 个登记文件）。全量 `scripts/*.test.mjs`（78 文件）单元 800 项中 791 通过、0 失败、9 项可选 GUI 显示测试跳过，10 个浏览器回归 79/79，类型检查、扩展构建、Chrome75 release 构建、原生构建、发布包重打与解压自检、发布包校验器与首跑配置模板验证、Node/原生自检及 `git diff --check` 全部退出 0。该验证覆盖本机发布包完整性工具；未在真实 CI runner 或真实客户端环境重复验收。
2026-11-21 发布包卫生验证记录：发布包自检命令原先未带 `--no-disk-write`，Node 宿主 `--self-check` 会按默认日志策略向包内 `windows/data/logs/host-<epoch>.log` 写日志；实测构建后的发布目录出现该日志文件（属于自检副作用，不是打包内容）。现 CI 与文档的发布包 Node 自检统一改为 `--self-check --no-disk-write --quiet`，`windows-release-package.test.mjs` 新增断言：包内文件列表不得出现 `windows/data/` 前缀或 `.log` 文件。发布包构建后先做自带 checksum 自检、再做只读冒烟，避免包内出现运行期数据目录。全量 `scripts/*.test.mjs`（78 文件）单元 800 项中 791 通过、0 失败、9 项可选 GUI 显示测试跳过，10 个浏览器回归 79/79，类型检查、扩展构建、Chrome75 release 构建、原生构建、发布包重打与解压自检、发布包首跑配置模板生成验证、Node/原生自检及 `git diff --check` 全部退出 0；本轮发布目录复查无 `windows/data`。该验证覆盖本机发布包卫生；未在真实 CI runner 或真实客户端环境重复验收。
2026-11-20 发布包首跑配置模板验证记录：发布包此前未携带 `windows/share-file/config.example.json`，打包后的 Node 宿主首次运行由 `ensureConfigFile()` 读取 `<包根>/windows/share-file/config.example.json` 失败后回退空模板，生成的 `windows/data/config.json` 缺少仓库内的 `settings` 示例块（实测 `hasExampleSettings=false`），与仓库运行行为不一致。现 `windows/share-file/package-windows.mjs` 新增 `--config-example`（默认 `windows/share-file/config.example.json`），校验存在并复制到包内 `windows/share-file/config.example.json`；`windows-release-package.test.mjs` 夹具新增配置模板、全部打包调用传入该路径、断言包内文件内容逐字节一致，Node-only 包同样校验；CI 发布包必需文件检查加入该模板。全量 `scripts/*.test.mjs`（78 文件）单元 800 项中 791 通过、0 失败、9 项可选 GUI 显示测试跳过，10 个浏览器回归 79/79，类型检查、扩展构建、Chrome75 release 构建、原生构建、发布包重打与解压自检、发布包首跑配置模板生成验证（`ensureConfigFile` 生成配置包含 `settings` 示例块）、Node/原生自检及 `git diff --check` 全部退出 0。该验证覆盖打包与首跑配置生成；未在真实客户端环境用全新发布包首次运行到登录页面人工验收。
2026-11-19 发布包调试构建守卫验证记录：本机 `windows/local-features.json` 开启 `injectionLog:true` 时，`npm run release:windows` 仍会打包本地调试构建，违反“发布前必须 `npm run build:windows -- --release`”的规则。现 `windows/share-file/package-windows.mjs` 在打包前读取 `dist-windows/package-manifest.json`，若 `features.injectionLog===true` 则退出 2 并提示先执行 release 构建与重新构建原生宿主；CI 的 Windows 注入资源构建步骤改为 `npm run build:windows -- --release`。`windows-release-package.test.mjs` 新增拒绝调试构建用例（夹具 manifest 注入 `features.injectionLog:true`，断言状态 2 与提示文本），并保留正常夹具包打包回归。实跑当前本机调试 dist 的 `npm run release:windows -- --out release-guard-check` 得到退出 2 与守卫提示；随后按发布顺序 `npm run build:windows -- --release` → `npm run build:native` → `npm run release:windows` 验证打包恢复成功。全量 `scripts/*.test.mjs`（78 文件）单元 800 项中 791 通过、0 失败、9 项可选 GUI 显示测试跳过，10 个浏览器回归 79/79，类型检查、扩展构建、Chrome75 release 构建、原生构建、发布包重打与解压自检、Node/原生自检及 `git diff --check` 全部退出 0。该验证覆盖守卫与发布顺序；未在真实 CI runner 或真实客户端环境重新验收。
2026-11-18 示例配置契约验证记录：`windows/share-file/config.example.json` 此前没有任何测试或宿主回归直接校验，可能与受支持字段/宿主默认值漂移。新增 `windows-config-example.test.mjs`：断言示例文件纯 ASCII、顶层键与受支持字段完全一致（无未实现能力/真实密钥）、共享设置键命名与值类型合法；Node 与原生宿主分别用 `--config <临时副本> --print-effective-config --no-disk-write` 实际解析，要求退出 0、仅一行 JSON、输出托管默认值（panel-theme/answer-mode/answer-key/answer-threads/no-disk-write/extension-enabled）且不创建或改写任何文件；另断言示例中的托管设置与宿主默认值逐项一致。实跑该文件 4 项全过（原生用例在设置 `CX_NATIVE_HOST_EXE` 时执行）。全量 `scripts/*.test.mjs`（78 文件）单元 799 项中 790 通过、0 失败、9 项可选 GUI 显示测试跳过，10 个浏览器回归 79/79，类型检查、扩展构建、Chrome75 构建、原生构建、发布包重打与解压自检、Node/原生自检及 `git diff --check` 全部退出 0。该验证覆盖示例配置与两宿主的只读解析；未在真实 CEF75 客户端用示例配置启动并登录验收。
2026-11-17 原生共享设置重复键修复记录：原生 `--print-effective-config` 与页面配置广播原先先原样输出已捕获的 `settings` 快照，再追加全部类型化托管键，导致同一 JSON 出现重复键（实测 `common.settings.windows-panel-enabled` 出现两次；JSON 解析取最后一次，工具/审计易误判）。修复：`cx_append_shared_settings()` 在捕获共享快照时过滤由类型化字段托管、随后统一输出的 16 个键（`extension-enabled`、`windows-panel-*`、`windows-answer-*`、`windows-show-answer-dialog`、`windows-auto-submit`、`windows-log-enabled`、`windows-no-disk-write`），未托管键（题库地址/密钥、未知共享键、嵌套对象/数组）继续原样保留；输出仍由 `cx_options_effective_settings_json_utf8()` 统一追加托管键，值来自合并后的类型化字段。已编译 `options-tests.exe` 新增重复键计数与未托管键保留回归（`count_occurrences` 断言托管键只出现一次、tiku/unknown 键保留）。实跑原生 `--options-json` + `--print-effective-config --no-disk-write` 验证 `duplicates=0`、`tiku=true`、`unknown=true`；`options-tests.exe` 与 `windows-native-options/config/host` 套件通过（16 项中 15 通过、1 项可选 GUI 跳过）。全量单元 795 项中 786 通过、0 失败、9 项可选 GUI 显示测试跳过，10 个浏览器回归首轮 78/79（`windows-native-lifecycle.browser.mjs` 的 interrupted in-flight injection 用例在并行负载下时序抖动），单独重跑 79/79、0 失败；类型检查、扩展构建、Chrome75 构建、原生构建、发布包重打与解压自检、Node/原生自检及 `git diff --check` 全部退出 0。该验证覆盖编译测试与真实 EXE 输出；页面侧是否收到完全相同设置由现有浏览器回归覆盖，但未在真实 CEF75 客户端登录后人工核对配置广播。
2026-11-16 Node 启动脚本版本检查验证记录：文档与目录注释此前声称 `start-windows.cmd` 会“检查 Node 版本”，但脚本只检查 `node` 是否存在，老版本 Node 会进入宿主后才失败。现两个入口均先执行 `node --version` 并解析主版本，低于 22 时普通入口给出提示并暂停、静默入口以 9009（缺少 node）/9040（无法解析版本）/9041（版本过旧）退出，不再启动宿主。`windows-silent-launcher.test.mjs` 新增两项回归：两个启动脚本均含 `node --version` 与 `LSS 22` 且保持纯 ASCII；通过 `windowsVerbatimArguments` 实际执行 `start-windows.cmd --help`，验证版本检查后正常进入宿主 usage 并退出 0。全量 `scripts/*.test.mjs`（77 文件）单元 795 项中 786 通过、0 失败、9 项可选 GUI 显示测试跳过，10 个浏览器回归 79/79，类型检查、扩展构建、Chrome75 构建、原生构建、发布包重打与解压自检、Node/原生自检及 `git diff --check` 全部退出 0。该验证覆盖脚本逻辑与本机 Node 24 实际执行，未在低于 22 的机器或真实 Windows 桌面双入口人工验收。
2026-11-15 静默启动命令行引用修复记录：`start-windows-silent.cmd` 原先以 `"%~dp0"`（尾反斜杠）传工作目录，Windows 解析会把 `\"` 当作转义引号；现改为 `"%~dp0."` 并传 `"%~dp0windows\node-source\main.mjs"` 绝对脚本路径。`silent-launch.vbs` 的 `QuoteArgument()` 原先只双写内嵌引号，未处理尾反斜杠；现按 Win32 规则把参数尾反斜杠加倍后再加闭引号，并规范化工作目录尾分隔符。新增 `windows-silent-launcher.test.mjs` 回归：静态断言 wscript 行不再使用 `"%~dp0"`；真实启动器探针验证尾反斜杠路径、含空格路径和尾空格参数逐项保真、工作目录尾分隔符被规范化。WSH 的 `WScript.Arguments` 使用自有解析规则、不保留内嵌双引号，因此该入口只传固定 `--hide-console` 与 `%~dp0` 派生路径（可含空格），已在 VBS 注释与文档注明。全量 `scripts/*.test.mjs`（77 文件）中静默启动器 7 项全过；全量单元 793 项中 784 通过、0 失败、9 项可选 GUI 显示测试跳过，10 个浏览器回归 79/79，类型检查、扩展构建、Chrome75 构建、原生构建、发布包重打与解压自检、Node/原生自检及 `git diff --check` 全部退出 0。该验证只覆盖脚本参数保真与静态契约，未在真实 Windows 桌面人工观察静默启动与 UAC 隐藏效果。
2026-11-14 静默预设与 README 一致性验证记录：参数生成器“绝对静默型”预设现同时设置 `hideConsole`，Node 宿主生成的 CLI 会附加 `--hide-console`；原生宿主在套用预设时自动去掉该开关（原生 EXE 为 GUI 子系统、无控制台），不会触发“原生不支持 --hide-console”校验。宿主 JSON schema 仍不接受 `hideConsole`，因此只出现在 CLI，JSON 与命令的其余行为保持一致。README 补充官方静默入口 `start-windows-silent.cmd`、发布包双 Node 入口与 `entrypoints.nodeSilent`、项目结构条目。已实跑 `windows-parameter-generator.test.mjs`（40 项中 37 通过、0 失败、3 项依赖可选浏览器/原生环境的用例跳过）验证 Node 静默预设 CLI 含 `--hide-console` 且 JSON 不含该键、原生静默预设不生成该参数。全量显式展开 77 个 `scripts/*.test.mjs`（792 项中 783 通过、0 失败、9 项可选 GUI 显示测试跳过）、10 个浏览器回归 79/79、类型检查、扩展构建、Chrome75 构建、原生构建、发布包重打与解压自检、Node/原生自检及 `git diff --check` 全部退出 0。该验证只覆盖生成器输出与宿主解析器回归，未在真实 Windows 桌面观察静默预设的实际无黑框效果；真实 CEF75 客户端验收仍未执行。
2026-11-13 官方静默启动入口与发布包集成验证记录：此前 `start-windows-silent-test.cmd` 与 `windows/node-scripts/silent-launch.vbs` 只是本地测试脚手架，发布包不包含，用户无法真正无黑框启动。现改为官方入口 `start-windows-silent.cmd`：通过 `wscript.exe` + 纯 ASCII `silent-launch.vbs` 以窗口样式 0 启动 `node.exe`，并只传 `--hide-console`；不强制客户端序号、不关闭面板、不改变扫描/UAC/注入/日志策略（客户端选择窗口等 UI 仍显示）。`windows/share-file/package-windows.mjs` 新增 `--silent-launcher` 与 `HOST_RUNTIME_SCRIPTS = [..., 'silent-launch.vbs']`，发布包同时包含 `start-windows-silent.cmd` 与 `windows/node-scripts/silent-launch.vbs`，`release-info.json` 的 `entrypoints.nodeSilent` 指向静默入口；`silent-launch.vbs` 从“内部原型/构建期文件”拒绝样例中移除（现为合法运行脚本），改用 `wipe-runtime.mjs` 作为拒绝样例。`windows-silent-launcher.test.mjs` 改为校验官方入口的 `--hide-console` 参数、纯 ASCII、wscript 隐藏启动与参数保真；`windows-release-package.test.mjs` 覆盖新入口文件、`nodeSilent` entrypoint、Node-only 包与拒绝样例。CI 发布包自检新增 `start-windows-silent.cmd` 与 `windows/node-scripts/silent-launch.vbs` 必需文件检查。全量显式展开 77 个 `scripts/*.test.mjs`（792 项中 783 通过、0 失败、9 项可选 GUI 显示测试跳过）、10 个浏览器回归 79/79、类型检查、扩展构建、Chrome75 构建、原生构建、发布包重打（新增两个文件）与解压自检、Node/原生自检及 `git diff --check` 全部退出 0。静默启动仅验证脚本与参数/包装契约，未在真实 Windows 桌面上人工观察无黑框效果与 UAC 隐藏窗口；真实 CEF75 客户端登录后验收仍未执行。
2026-11-12 CI 工作流加固验证记录：`ci.yml` 新增“导出原生编译测试路径”步骤，把全部 20 个 `CX_NATIVE_*` 变量写入 `$GITHUB_ENV` 并校验产物存在，单元测试与浏览器回归步骤改为直接继承（原先浏览器步骤未带这些变量，原生 browser 用例在 CI 会被静默跳过）；发布包冒烟后新增解压入口自检：校验 `release-info.json`/`SHA256SUMS.txt`/`windows\node-source\main.mjs`/`chaoxing_plus.exe` 存在，执行发布包内 Node `--self-check` 与原生 EXE `--self-check --quiet --no-disk-write` 并检查退出码。`windows-release-package.test.mjs` 的 CI 契约测试扩展为断言 `GITHUB_ENV` 导出、全部原生变量、发布包自检命令与 `release-ci/` gitignore。本机实际执行 `npm run release:windows -- --out release-ci`（29 文件）并按 CI 脚本复核四个必需文件、Node/原生自检均退出 0；`release-ci/` 验证后删除。全量显式展开 77 个 `scripts/*.test.mjs`（792 项中 783 通过、0 失败、9 项可选 GUI 显示测试跳过）、10 个浏览器回归首轮 78/79（`windows-native-lifecycle.browser.mjs` 的“interrupted in-flight injection”用例在并行负载下时序抖动），单独重跑 79/79、0 失败；类型检查、扩展构建、Chrome75 构建、原生构建、发布包重打与解压自检、Node/原生自检及 `git diff --check` 全部退出 0。CI 仍未在真实 GitHub Actions runner 上执行，浏览器回归依赖 runner 的 puppeteer 下载与原生工具链，需首次真实运行确认。
2026-11-11 原生 --no-retain-data 诊断目录清理修复记录：原实现只删除 `render-diagnostics.json` 后尝试 `RemoveDirectory`，新增的页面 PNG、窗口 JSON/BMP/PNG 与宿主摘要会让目录非空，导致 `--no-retain-data` 残留本次诊断产物。现改为 `h_delete_created_tree()` 枚举并删除本次唯一诊断运行目录内的所有文件后删除该目录（不触碰运行前已存在文件；仅捕获路径），清理缓冲区使用静态存储避免在深宿主栈帧上再分配 192KB 越过 guard page（此前的局部缓冲区版本会导致宿主 0xC0000005 崩溃）。已编译 `elevation-host-tests.exe` 新增递归清理夹具（6 个诊断文件 + 目录外保留文件），`windows-native-lifecycle.test.mjs` 首项改用真实 `--diagnostics-dir` 并断言 `--no-retain-data` 后诊断目录内无任何文件、默认保留时存在 `render-diagnostics-host.json`。全量显式展开 77 个 `scripts/*.test.mjs`（792 项中 783 通过、0 失败、9 项可选 GUI 显示测试跳过）、10 个浏览器回归 79/79、类型检查、扩展构建、Chrome75 构建、原生构建、发布包重打与解压自检、Node/原生自检及 `git diff --check` 全部退出 0。该验证覆盖 attach 无端点运行的摘要与清理；真实客户端运行产生的窗口截图等文件清理同样由同一目录递归逻辑处理，但真实 CEF75 全流程未人工验收。
2026-11-10 原生宿主级诊断摘要验证记录：原生 `--diagnose` 在每次运行结束时写入 `render-diagnostics-host.json`（`diagnosticsSummary:true`），内容为固定 schema 的宿主级索引：`launchMode`（launch/attach）、`clientPid`、`window`（recorded/screenshot 状态/visible/systemDpi/windowDpi/`dpiStatus`=match|mismatch|unknown/矩形）、`artifacts`（pageDiagnostics/pageScreenshot/windowDiagnostics/windowCaptureBmp/windowCapturePng 布尔）与 `files` 固定文件名；不包含正文、URL、窗口标题或原始配置。页面 JSON/页面 PNG/窗口诊断/窗口 BMP/窗口 PNG 写入成功时分别置位，`--no-diagnose`/`--no-disk-write` 不生成摘要；写失败非致命。已编译 `diagnostics-tests.exe` 新增摘要路径、空摘要、页面产物标记、窗口 DPI mismatch/矩形、文件清单与禁用 no-op 回归；`windows-native-diagnostics.test.mjs` 在真实 Chromium attach 下断言摘要为 `launchMode=attach`、`clientPid=0`、窗口未记录、页面诊断/截图为 true、窗口产物为 false，并断言 `--no-disk-write` 不产生摘要。全量显式展开 77 个 `scripts/*.test.mjs`（792 项中 783 通过、0 失败、9 项可选 GUI 显示测试跳过）、10 个浏览器回归 79/79、类型检查、扩展构建、Chrome75 构建、原生构建、发布包重打与解压自检、Node/原生自检及 `git diff --check` 全部退出 0。摘要仍是原生自定义 schema，不是 Node 同构的合并 `render-diagnostics.json`（`renderDiagnostics:false` 边界保留）；真实 CEF75 客户端上的摘要内容（含真实窗口 DPI/截图状态）未人工验收。
2026-11-09 原生窗口截图 PNG 验证记录：自有启动窗口诊断在保留 `window-capture.bmp` 的同时新增 `window-capture.png`——从同一 24 位 bottom-up 像素缓冲按 PNG 规范生成 8 位 RGB、filter 0 的行数据，使用无 CRT/zlib 依赖的 stored-deflate 与自实现 CRC32/Adler32 编码（IHDR/IDAT/IEND chunk 均带正确 CRC）；`window-diagnostics.json` 的截图状态对两种格式共用。已编译 `diagnostics-tests.exe` 新增窗口 PNG 签名/IHDR 尺寸/CRC/IEND 与数据量断言；Node 侧在 `windows-native-diagnostics.test.mjs` 用 `zlib.inflateSync` 独立解码 IDAT，校验行大小 `height*(1+width*3)` 与每行 filter 0。全量显式展开 77 个 `scripts/*.test.mjs`（792 项中 783 通过、0 失败、9 项可选 GUI 显示测试跳过）、10 个浏览器回归 79/79、类型检查、扩展构建、Chrome75 构建、原生构建、发布包重打与解压自检、Node/原生自检及 `git diff --check` 全部退出 0。窗口 PNG 验证仍基于测试自建窗口；真实 CEF75 客户端的硬件加速窗口截图像素内容未人工验收。
2026-11-08 参数生成器补齐后期 CLI 能力验证记录：离线生成器新增 `--dpi-aware` 与 Node 专属 `--hide-console` 控件，分别导出 CLI 参数；`dpiAware` 同时写入 JSON 配置（两种宿主），`hideConsole` 因宿主 JSON schema 不接受而只保留在 CLI。原生宿主选择 `--hide-console` 或同时选择 `--dpi-aware` 与 `--no-disk-write` 会被实时校验阻止；原生诊断提示更新为页面布局采样 + 页面 PNG 截图 + 自有启动窗口 DPI/BMP，并删除“不含窗口 DPI 和截图”的过期描述。新增浏览器回归：默认控件未勾选、两种宿主导出参数与 JSON 一致、`parseHostArgs` 可解析生成的 Node 参数、原生互斥错误与提示文本。全量显式展开 77 个 `scripts/*.test.mjs`（792 项中 783 通过、0 失败、9 项可选 GUI 显示测试跳过；首轮全量曾有一次 `windows-native-diagnostics.test.mjs` 夹具在并行负载下提前退出，单独重跑与全量重跑均通过，属夹具时序抖动）、10 个浏览器回归 79/79、类型检查、扩展构建、Chrome75 构建、原生构建、发布包重打与解压自检、Node/原生自检及 `git diff --check` 全部退出 0。生成器只验证命令与 JSON 文本，未在真实客户端上执行 `--dpi-aware` 或静默启动；真实高分屏/无控制台观感仍需人工验收。
2026-11-07 原生 UI 高 DPI 感知验证记录：原生 EXE 新增内嵌 `windows/native-source/host.manifest`（`dpiAware=true`、`asInvoker`），并通过 `/MANIFESTINPUT` 只链接到宿主 EXE（测试 EXE 不再继承该 manifest，避免与 `dpi-child.manifest` 版本冲突）；选择窗口与全盘扫描进度窗口改为 96 DPI 基准、按 `GetDpiForSystem` 缩放控件尺寸/间距/字体，`--capabilities` 新增 `highDpiUi:true`。测试用 `CXPLUS_NATIVE_UI_DPI=144` 覆盖 DPI：隐藏选择探针断言 `layoutScale=144`，隐藏进度窗口断言窗口宽度为 `MulDiv(460,144,96)=690`；另新增 EXE 二进制内嵌 manifest 的 `ChaoxingPlus.NativeHost`/`dpiAware`/`asInvoker` 断言。全量显式展开 77 个 `scripts/*.test.mjs`（792 项中 783 通过、0 失败、9 项可选 GUI 显示测试跳过）、10 个浏览器回归 79/79、类型检查、扩展构建、Chrome75 构建、原生构建、发布包重打与解压自检、Node/原生自检及 `git diff --check` 全部退出 0。本机真实 DPI 为 100%，144/150% 缩放只由测试覆盖验证；真实高分屏与真实 CEF75 客户端上的 UI 观感仍未人工验收。
2026-11-06 原生选择窗口取消提示与帮助文本验证记录：原生全盘扫描被取消后，宿主重新打开选择窗口时通过新增的 `notice` 参数显示“已取消全盘扫描，保留原候选；可重试或手动浏览。”标题；`cx_selection_probe` 新增 `noticeShown` 字段并在隐藏探针中断言默认标题、取消提示标题与缺失输出拒绝。原生帮助文本补齐了已接受但未列出的 `--scan-clients`、`--scan-all`、`--no-scan-all`、`--answer-retry`，并修正“不采集窗口 DPI/截图”的过期说明（现为页面截图 + 自有启动窗口 DPI/BMP，不采集正文/URL）；Node 帮助补充 `--no-scan-all`，并新增真实 `--help` 输出回归（`--scan-clients`/`--scan-all`/`--no-scan-all`）。全量显式展开 77 个 `scripts/*.test.mjs`（789 项中 780 通过、0 失败、9 项可选 GUI 显示测试跳过）、10 个浏览器回归 79/79、类型检查、扩展构建、Chrome75 构建、原生构建、发布包重打与解压自检、Node/原生自检及 `git diff --check` 全部退出 0。取消提示只覆盖标题切换与取消回调，真实客户端上点击“全盘扫描→取消”的人工交互仍未验收。
2026-11-05 原生页面截图渲染诊断验证记录：原生宿主新增 `pageScreenshots:true`——首次成功的顶层 bundle 确认后，通过 CDP `Page.captureScreenshot`（`format=png`）采集页面截图；宿主从受限 CDP 回复中提取 base64，经 `cx_diagnostics_write_page_png` 校验 base64 字符/解码尺寸（≤16MB）/PNG 签名/IHDR 块/宽高边界（≤16384）后写入诊断运行目录 `render-diagnostics-page.png`，失败非致命；`--attach` 与自有启动都会采集，`--no-disk-write`/`--no-diagnose` 不创建文件。已编译 `diagnostics-tests.exe` 新增 7 项回归（路径准备、合法 PNG 解码写盘 33 字节、非法 base64 不改写原文件、非 PNG 拒绝、超大尺寸拒绝、禁用 no-op），`windows-native-diagnostics.test.mjs` 真实 Chromium attach 断言 PNG 实际生成、签名/IHDR/尺寸有界、no-disk-write 不产生截图。全量显式展开 77 个 `scripts/*.test.mjs`（789 项中 780 通过、0 失败、9 项可选 GUI 显示测试跳过）、10 个浏览器回归 79/79、类型检查、扩展构建、Chrome75 构建、原生构建、发布包重打与解压自检、Node/原生自检及 `git diff --check` 全部退出 0。该截图来自现代 Chromium 模拟页，真实 CEF75 客户端截图内容与性能仍未人工验收；`renderDiagnostics:false` 仍表示不提供 Node 同构的合并 JSON/系统进程命令行/窗口 PNG。
2026-11-04 原生全盘扫描进度/取消验证记录：原生 EXE 选择流程点击“全盘扫描”后不再阻塞无反馈：`selection.c` 新增独立线程 Win32 进度窗口（稳定类名 `CXPlusNativeScanProgress`，显示已检查目录数/候选数并可取消），`discovery.c` 新增 `progressContext`/`onProgress`/`cancelRequested` 钩子与 `CX_DISCOVERY_RESULT.cancelled`；取消时宿主丢弃本次部分结果、保留并重新显示原候选，`--attach`/无诊断不受影响。首个 `ShowWindow` 会被 `STARTUPINFO.wShowWindow`（Node `spawn(..., {windowsHide:true})`）覆盖为隐藏，已用二次 `ShowWindow(SW_SHOW)` 修复并由 `IsWindowVisible` 断言。已编译 `selection-tests.exe` 默认探针覆盖 9 项（隐藏线程启动、钩子绑定、正常结束、窗口销毁、自动取消、discovery 进度回调、取消回调等），`--scan-progress` 真实窗口冒烟需 `CX_TEST_NATIVE_WINDOW=1` 且全部通过；全量显式展开 77 个 `scripts/*.test.mjs`（789 项中 780 通过、0 失败、9 项可选 GUI 显示测试跳过）、10 个浏览器回归 79/79、类型检查、扩展构建、Chrome75 构建、原生构建、发布包重打与解压自检、Node/原生自检及 `git diff --check` 全部退出 0。排查中还发现并修复一个真实回归：`cx_discovery_resolve_client` 没有 options 时未清零 discovery 进度钩子，导致显式客户端 self-check 调用到野函数指针而崩溃（0xC0000005）；已由 `d_init_progress` 无条件清零并用 `windows-native-self-check.test.mjs`、`windows-native-cli-selection.test.mjs` 回归。真实客户端全盘扫描与真实窗口截图仍未人工验收；自动化只验证测试自有窗口与夹具目录，不能据此宣称真实考试客户端全盘扫描体验已验收。
2026-11-03 原生窗口渲染诊断验证记录：原生宿主新增 `windowDiagnostics:true`——自有启动（非 `--attach`）且开启 `--diagnose` 时，在 CDP 端点就绪后采集客户端窗口 DPI/系统 DPI/窗口矩形/可见性，写入 `window-diagnostics.json`，并用 `PrintWindow` → `BitBlt` best-effort 生成 24 位 `window-capture.bmp`（捕获不到像素时保留正确尺寸的空白 BMP，JSON 标记 `failed`）。窗口枚举、`GetDpiForWindow`/`GetDeviceCaps` 回退、BMP 头与行对齐、JSON 字段均在已编译 `diagnostics-tests.exe` 新增的自建窗口回归中通过；`--attach` 跳过窗口诊断，`renderDiagnostics:false` 的“无 Node 同构合并 JSON/页面与窗口 PNG”边界保留，文档与 AGENTS 同步。全量：显式展开 77 个 `scripts/*.test.mjs`，787 项中 779 通过、0 失败、8 项可选 GUI 显示测试跳过；10 个浏览器回归 79/79 通过；类型检查、扩展构建、Chrome75 构建、`npm run build:native`、发布包重打并解压自检、Node/原生自检及 `git diff --check` 均退出 `0`。浏览器回归首轮出现既有 `cx-debug-log-panel` iframe 加载竞态（about:blank 的 `readyState=complete` 早于 fixture 导航完成）与 `swal-iframe` 偶发超时；已把 iframe 等待条件改为同时校验目标 URL 与 readyState，重跑全绿。本机自建窗口截图方法为 `print-window`，尚未在真实 CEF75 客户端验证截图内容；硬件加速窗口可能为空白，JSON 会如实标记 `failed`，不能据此宣称真实考试客户端窗口截图可用。

原生 Win32 选择窗口的实际显示与自动选择冒烟需单独启用，整个过程中不会启动考试客户端：

```powershell
$env:CX_NATIVE_SELECTION_EXE = (Resolve-Path '.\windows\native-build\bin\selection-tests.exe').Path
$env:CX_TEST_NATIVE_WINDOW = '1'
try {
  node --test scripts/windows-native-selection.test.mjs
} finally {
  Remove-Item Env:CX_NATIVE_SELECTION_EXE, Env:CX_TEST_NATIVE_WINDOW -ErrorAction SilentlyContinue
}
```

原生实际会话通过 `--inject-strategy runtime|script|hybrid` 选择路径：`runtime` 仅使用 `Runtime.evaluate`，`script` 先尝试 DOM script、失败再回退 Runtime，`hybrid` 先尝试 Runtime、失败再回退 DOM script。重试始终遵守 `--inject-retries` 上限；每个上下文的就绪、执行和失效均经过会话任务状态机，不递归重入正在执行的注入。

原生 DOM script 注入必须获得严格的布尔 `true` 执行确认：脚本只有执行到末尾才写入完成标记，CSP 阻止、语法错误、运行时异常、缺少挂载节点以及缺失/非布尔确认均按失败处理并执行所选回退策略。临时 script 和完成标记在检查后移除。配置预置同时传入内嵌 Swal CSS，由实际 bootstrap 安装至顶层文档；浏览器回归验证的是 C 生成的真实表达式与实际 CSS 计算样式。

资源加载上限为单文件 8 MiB，实际 CDP 表达式还受封装和转义容量限制。宿主会在启动客户端前预检 bootstrap/bundle 的执行长度以及配置和 CSS 转义后的表达式长度；即使资源文件能读取，已知超出注入容量时也会先报错，避免启动客户端后才失败。

覆盖内容：

- `windows-host.test.mjs`：配置持久化/共享键过滤、PE 解析、端口选择、CDP 客户端；**mock CDP 服务器**下完整跑通 `bootstrap -> bundle -> 配置回写`。
- `windows-client-discovery.test.mjs`：常规扫描只到根目录+一级子目录、全盘回退触发条件、首个 x86 立即停止、只有 x64 时选首个 x64、`--scan-mode common` 不回退、跳过系统目录/符号链接。
- `windows-host-options.test.mjs`：全部启动参数解析与范围/互斥校验、`--no-disk-write` 覆盖、配置合并顺序、未实现能力显式拒绝、数据保留/删除外部配置、文档示例参数可解析。
- `windows-print-effective-config.test.mjs`：Node 与原生 `--print-effective-config` 均只输出一行合并后共享设置 JSON；Node 断言配置层/内联 JSON/CLI 优先级与不写盘；原生断言托管默认值补齐、配置层与内联设置生效、未托管/未知共享键保留、无重复键、`--no-disk-write` 派生只读设置，且不创建数据目录/额外文件、不改写配置（需设置 `CX_NATIVE_HOST_EXE`，否则原生用例跳过）。- `windows-config-example.test.mjs`：`windows/share-file/config.example.json` 保持纯 ASCII、顶层键/共享设置键受支持且不含未实现能力；Node 与原生宿主均能用 `--config` 实际解析示例配置，`--print-effective-config` 输出单行 JSON、托管默认值不回退且不创建/改写任何文件；示例中的托管设置必须与宿主默认值一致。
- `windows-config-reload.test.mjs`：共享设置逐层保留、配置文件实际监控、CLI/内联覆盖、异步解析失败和关闭后的迟到结果；宿主集成热更新由 `windows-host.test.mjs` 覆盖。
- `windows-injection-lifecycle.test.mjs`：并发注入合并、上下文销毁、关闭后停止重试、CDP 断线关闭会话、新文档注册被拒绝后继续实际上下文注入、首次漏报上下文的定时补注入，以及注册期间关闭只取消不误报降级。
- `windows-injection.browser.mjs`：真实 Chromium CDP 下 runtime/script/hybrid、CSP 回退、注入重试、导航、移除 iframe、断线重连恢复及会话资源释放；使用自动化测试页面，不代表真实 CEF 75 考试页面验收。
- `windows-client-process.test.mjs`：本次宿主客户端子进程的退出/启动错误事件只处理一次，取消观察和已结束进程边界。
- `windows-parameter-generator.test.mjs`：离线生成器加载、普通预设输出可被宿主解析器重新解析、实时校验（互斥、no-disk-write、线程/面板宽度/清理重试、内联 JSON、自毁快捷键冲突）与禁用能力阻止导出；Windows 上实际执行 PowerShell 5.1/7 和安全 cmd 输出，通过预加载器强制宿主停在 `--help`，逐项检查 argv、中文/JSON/shell 字符保真和项目工作目录，不扫描或启动客户端；`startupClean` 只展示设计说明且不生成命令或 JSON。
- `windows-manual-answer-worker.test.mjs`：实际 Chromium 同时执行 Worker TS 与运行期 JS，验证按键等待不消耗搜题截止、实际请求超时与迟到答案隔离、关闭取消、初始化失败收尾、单一监听与并发许可、跨页余量及新重答不继承旧许可；`windows-no-panel-notice.test.mjs` 另以真实方向键事件验证旧名称和 `Arrow*` 名称均可触发。
- `windows-native-endpoint-probe.test.mjs`：编译后宿主通过自有 loopback 服务区分 HTTP 失败、无效 JSON、缺失/错误 Browser 与正常端点；检查固定原因计数、attach 不宣称归属、失败只记录一次及响应原文不入日志。监听归属与进程树错误分类由编译进程检查驱动补充覆盖。
- `windows-native-host.test.mjs`：原生源码边界与构建选项；设置 `CX_NATIVE_HOST_EXE` 后执行 CLI 回归，设置 `CX_NATIVE_INJECTION_EXE` 后执行已编译的实际注入逻辑测试。内部清理器或状态机测试仅证明模块行为，不表示 Node 或原生入口支持启动清理、自毁。
- `windows-native-self-check.test.mjs`：设置 `CX_NATIVE_HOST_EXE` 后验证单独 EXE、中文客户端路径、内嵌/显式资源、容量限制、占用端口和 attach 不连接、配置错误、quiet、字段脱敏和不写业务文件；不执行客户端。
- `windows-native-elevation.test.mjs`：设置 `CX_NATIVE_ELEVATION_EXE`、`CX_NATIVE_ELEVATION_HOST_EXE` 和 `CX_NATIVE_HOST_EXE`，验证标准 UAC 的按需交接、防重复重启、原参数/工作目录/已选客户端保留和取消退出码；不触发真实 UAC。
- `windows-native-dpi.test.mjs`：设置 `CX_NATIVE_DPI_EXE`、`CX_NATIVE_DPI_PROCESS_EXE`、`CX_NATIVE_DPI_CHILD_EXE`、`CX_NATIVE_HOST_EXE`，验证临时兼容层、原值恢复、外部修改与故障处理、参数校验及真实测试子进程 DPI 状态；宿主级 DPI/UAC 顺序另由 `CX_NATIVE_ELEVATION_HOST_EXE` 驱动。
- `windows-native-process-check.test.mjs`：设置 `CX_NATIVE_PROCESS_CHECK_EXE`、`CX_NATIVE_PROCESS_FIXTURE_EXE`、`CX_NATIVE_HOST_EXE`，验证可靠枚举、已有客户端拒绝及仅清理测试自有进程；不启动真实考试客户端。
- `windows-native-assets.test.mjs`：仅复制 EXE/driver 到中文空格目录，逐项比对宿主与 driver 内嵌资源的长度/SHA256，并覆盖外部资源缺失、空文件、超限及禁止落盘解包。
- `windows-native-options.test.mjs`：实际 C 参数测试，覆盖扫描别名和 CLI/JSON 的客户端选择优先级。
- `windows-native-session.test.mjs`：实际 C 会话状态机，覆盖导航和 frame 子树销毁、就绪通知期间不重入、URL 过滤、顶层兜底及容量边界；不以模型通过代替宿主适配器验证。
- `windows-native-selection.test.mjs`：实际 C Win32 控件探针、推荐项与 Unicode 标题；默认探针还覆盖原生全盘扫描进度窗口的隐藏线程生命周期、自动取消、discovery 进度回调与取消回调；`CX_TEST_NATIVE_WINDOW=1` 时显示窗口并测试自动取消、选中有效 Unicode 路径，以及 `--scan-progress` 的真实进度窗口可见性与点击取消，均不启动客户端或执行真实全盘扫描。
- `windows-native-transport.test.mjs`：无 CRT 的传输接口及实际 WebSocket 分段读、零超时、连续控制帧总截止时间回归。
- `windows-native-audit.test.mjs`：`CX_NATIVE_AUDIT_EXE` 驱动实际目录与文件，覆盖中文空格/相对路径、日志防覆盖、UTC UTF-8、quiet/no-log/noDiskWrite、报告 JSON 转义及生成失败保留旧报告、日志真实文件锁写失败后关闭句柄。
- `windows-native-config.test.mjs`：`CX_NATIVE_CONFIG_EXE` 驱动实际 C 配置模块，覆盖解码键规范化、重复合并不膨胀、共享白名单、未知顶层字段保留、中文/空格/相对路径、原文件无效或替换失败时保留原文，以及仅清理自有临时文件。
- `windows-native-injection.browser.mjs` / `windows-native-assets.browser.mjs`：真实 Chromium 执行实际 C 生成的表达式，验证 CSP/异常/语法错误/无挂载节点以及顶层 Swal CSS 安装；不代表 CEF75 登录后页面验收。
- `windows-native-lifecycle.browser.mjs`：已编译原生宿主通过真实 WebSocket 连接现代 Chromium，覆盖三种策略、导航后每文档只执行一次、延迟 about:blank iframe、新 page target、CSP 回退、空白 iframe 开关、非超星页面限制、Browser 不匹配拒绝、断线去重及 console 历史清除后的 iframe 恢复；还覆盖 `--duration` 关闭会话但保留 attach 浏览器。不代表真实 CEF75 人工登录验收。
- `windows-native-audit.browser.mjs`：`CX_NATIVE_HOST_EXE` 驱动现代 Chromium 模拟页面，验证实际日志/报告落盘、quiet/no-log/no-disk-write/no-capture-console、页面异常与 bootstrap 控制事件脱敏、重连累计与停止时存活上下文统计、正常取消不误计错误；不代表真实 CEF75 登录后页面验收。
- `windows-native-config.browser.mjs`：`CX_NATIVE_HOST_EXE` 驱动现代 Chromium 模拟页面，覆盖 EXE 同级/显式配置文件回写、热更新及删除恢复、新宿主接管旧文档、来源/实例/上下文校验、CLI/内联覆盖、大 UTF-8 配置、无效更新事务拒绝、完整快照删除及重加、跨 origin iframe/新文档/新 target/重连、无写盘锁定；不代表真实 CEF75 登录后页面验收。
- `windows-selection-window.test.mjs`：原生选择窗口脚本纯 ASCII 约束、结果合约（选中/取消/自动关闭/错误）、PowerShell 进程参数与 UTF-8 JSON 载荷、WinForms 控件构建探针；`CX_TEST_NATIVE_WINDOW=1` 时额外验证真实窗口显示、默认及最小尺寸下三候选无遮挡且分别可选、全盘扫描按钮和宿主 `--ui gui`/`--select-client` 接线（自动关闭）。WinForms 按逆 Z 顺序停靠，列表须在顶部提示与底部按钮之前加入控件集合，否则提示可能遮住前几项，让完整候选列表看起来只有一项。
- `windows-scan-progress-window.test.mjs`：全盘扫描进度/取消窗口脚本纯 ASCII、payload 与状态校验、Node 控制器状态/取消文件协议与临时目录清理、真实 PowerShell 控件探针；`CX_TEST_NATIVE_WINDOW=1` 时验证真实窗口可见性。`windows-client-discovery.test.mjs` 与 `windows-client-selection.test.mjs` 覆盖进度回调、AbortSignal 取消、取消后保留原候选及窗口关闭时序。原生 EXE 选择流程仍无进度窗口，不能据此宣称两端等价。
- `windows-bootstrap.test.mjs`：共享配置水合、DOMContentLoaded 延迟、`replaceChildren`/`randomUUID` 补丁、总开关、配置同步及来源字段、完整快照删除与重加、延迟属性清理、无写盘删除、同实例重连去重与新实例接管旧发送闭包。
- `windows-chrome75.test.mjs`：构建产物与内置 handler 字符串必须通过 Chrome75 语法闸门（`?.`/`??`/逻辑赋值/私有成员/静态块均不允许）。
- `windows-store-safety.test.mjs`：不透明 origin（about:blank）下 `localStorage` 抛 `SecurityError` 时业务 store 不崩溃；无写盘模式的共享删除事件清理内存并屏蔽旧磁盘值，重新水合可恢复且不回流同步。
- `swal-iframe.browser.mjs`：同源多层 iframe、跨源 iframe、顶层运行时延迟初始化、确认/取消/拒绝/计时器结果回传、面板层级覆盖与不受信来源拒绝。

`npm run build:windows` 本身也带语法闸门，失败会中止构建。

### 真实 Chromium 冒烟（本机无 UAC，可复现）

宿主支持测试专用的 `--attach` 模式（只连接已存在的调试端口，不启动客户端、不校验归属）。可用任意 Chromium 浏览器验证注入链路：

```powershell
# 终端 1：启动带远程调试的 Chromium（示例 Chrome）
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --remote-debugging-port=9333 --remote-allow-origins=* --user-data-dir="$env:TEMP\cxplus-smoke" about:blank

# 终端 2：让宿主附着并注入
node windows\node-source\main.mjs --attach 9333 --duration 5000 --report windows\data\smoke-report.json
```

`about:blank` 只能用于连接和 bootstrap 冒烟，不保证业务 bundle 被注入，也不会显示悬浮面板。需要验证业务注入与面板时，使用本地模拟考试页，并通过 `--host-resolver-rules` 将 `mooc1.chaoxing.com` 映射到该测试页；现成自动化入口是 `scripts/windows-injection.browser.mjs`。在匹配超星考试路径的模拟页上，预期报告为 `totals.bootstraps ≥ 1`、`totals.bundles ≥ 1`、`errors = 0`，且页面标记 `window.__CX_WIN_HOST__`、`window.__CX_WIN_BUNDLE_LOADED__` 为真。这属于实际 Chromium 对模拟页面的验证，仍未验收真实 CEF75 客户端。

### 真实考试客户端验证（需人工）

1. 关闭所有正在运行的 `CXExam.exe`（宿主也会拒绝启动）。
2. 建议先把客户端复制到独立测试目录，并把 `clientPath` 指向副本。
3. 运行 `start-windows.cmd`，UAC 选择“是”。
4. 可使用 `--debug-timeout 120000` 留出人工登录时间。登录页未出现调试端点时可继续登录，不能据此判断不兼容；等待是否出现端点可用及业务包加载记录。
5. 在客户端内登录并打开**考试列表/答题相关页面**（如考试列表页，不要进入真实考试），确认右上角出现「超星学习助手」折叠标题条，展开查看「连接与注入日志」及考试答题功能。如果窗口被手动关闭，请同时说明，避免将该结果误归类为客户端异常退出。
6. 按设计，课程/学习页等非考试页面不再显示面板；如在这些页面看到面板请检查 URL 是否被误判为考试页面。
7. 如需回归，记录 `windows/data/last-report.json` 与 `windows/data/logs/` 下日志。
8. ⚠️ 不要在实际考试中首次验证；先在考试列表页确认面板与设置可用。

### 面板内的连接与注入日志

「连接与注入日志」是仅供本地验证的布尔构建开关，仓库默认 `false`，普通发布构建不显示。本机可在已被 Git 忽略的 `windows/local-features.json` 中设置 `{"injectionLog":true}`，再执行 `npm run build:windows`；将其改为 `false` 可关闭。本地文件不得加入提交，其他机器拉取后没有该文件，默认不显示。`npm run build:windows -- --release` 会强制关闭并忽略本地文件，发布或 push 对应的产物须使用此命令后重新构建原生 EXE；单纯 push 源码不会修改本机已有 EXE。扩展构建始终关闭此 Windows 专用日志区。

本地开启后，Windows 考试悬浮面板显示宿主启动、客户端启动、等待调试连接、端点就绪、页面连接、bootstrap/业务包加载、导航与重连等状态。它使用 12px 字号和独立滚动区域，只保留本次宿主最近 100 条固定事件，时间为距宿主启动的经过时间；不记录页面地址、题目、答案、账号或配置内容。`dist-windows/package-manifest.json` 的 `features.injectionLog` 记录本次构建值，运行时 CLI/JSON 无法打开已关闭的构建开关。

调试连接建立前，宿主无法向客户端页面创建面板。连接并加载面板后才补显示此前记录，因此登录页没有日志区不等于程序未运行。部分客户端可能在登录后才开放端点，这仍须人工观察；日志中的等待提示不是兼容性结论。浏览器断线期间也无法实时刷新页面日志，连接恢复后会重新发送完整快照，导航到新的考试页面同样会回放。

这些记录只在内存中保存，与日志文件及渲染诊断独立。本地构建开关开启时，`--no-log`、`--quiet`、`--no-diagnose` 不关闭面板内日志，`--no-disk-write` 仍可显示且不为此写入 localStorage 或文件；`--no-panel` 则不创建日志区或向页面推送快照。Chrome 扩展保留原有界面与日志行为。

## Chrome 75 兼容策略

- 业务主包由 Vite/Rolldown 以 `target: chrome75` 构建，内置依赖（含 SweetAlert2）一并转译。
- **内置 handler 字符串**用 `Function(...)` 运行期求值，不经过构建转译：`src/projects/tiku-adapter-config.ts` 中的 handler 必须保持 ES2019 语法（禁止 `?.`/`??` 等），由 `windows-chrome75.test.mjs` 强制校验。
- 页面侧补齐：`Element.prototype.replaceChildren`、`Promise.allSettled`、`crypto.randomUUID`。
- 不透明 origin 的 frame（about:blank/srcdoc）中 `localStorage` 访问会抛错，`src/runtime/store.ts` 已做安全兜底（内存值 + 属性镜像）。
- 内核 UA 是客户端自定义字符串（无 `Chrome/75` 字样），业务代码不得用 UA 判断内核。

## 原生 UI 高 DPI 与渲染诊断

原生 EXE 内嵌 `windows/native-source/host.manifest`（`dpiAware=true`、`asInvoker`），选择窗口与全盘扫描进度窗口以 96 DPI 为基准、按 `GetDpiForSystem`（回退 `GetDeviceCaps(LOGPIXELSX)`）缩放控件尺寸、间距与字体，避免高清屏下整体位图缩放导致文字发虚。`--capabilities` 标记 `highDpiUi:true`。测试专用覆盖变量 `CXPLUS_NATIVE_UI_DPI`（96–480）只影响原生窗口布局，不改变 `--dpi-aware` 的客户端兼容层语义；修改窗口布局须运行 `windows-native-selection.test.mjs`（默认探针 + 高 DPI 用例）并检查 EXE 内嵌 manifest 的 `dpiAware`/`asInvoker` 断言。

## 渲染诊断与“悬浮窗附近模糊”排查

本节的系统 DPI、窗口截图和完整诊断产物说明主要适用于 Node 宿主。原生宿主提供页面布局采样（`pageRenderDiagnostics:true`），并在首次顶层 bundle 确认后通过 CDP `Page.captureScreenshot` 生成 `render-diagnostics-page.png`（`pageScreenshots:true`；对 Node 写入的 base64 做长度、base64 字符、PNG 签名/IHDR 与尺寸上限校验后才写盘，失败非致命）；自有启动还会采集客户端窗口 DPI/系统 DPI/窗口矩形/可见性（`windowDiagnostics:true`，`window-diagnostics.json`），并尝试用 `PrintWindow` → `BitBlt` 生成 `window-capture.bmp`（24 位 BMP，best-effort；硬件加速窗口可能为空白，JSON 的 `screenshot.status` 会标记 `captured` 或 `failed`）。`--attach` 调试模式没有本次启动的自有客户端窗口，因此跳过窗口诊断，但仍会采集页面截图。原生仍不生成 Node 同构的合并 JSON、系统进程命令行或窗口 PNG，`renderDiagnostics:false` 的完整宿主诊断边界保留。原生采样文件写入失败属于非致命诊断故障，不应阻断宿主继续运行或客户端启动；`--no-disk-write` 则完全跳过目录和文件创建。

原生采样需使用 `--diagnose` 开启，在首次成功的顶层业务 bundle 确认后执行，每次宿主运行最多尝试一次；子 iframe 的注入不会触发采样。输出位于 `--diagnostics-dir` 下的独立运行子目录，默认基于 `<data-dir>/chaoxing/diagnostics`（默认数据目录即 `.data`），生成 `render-diagnostics.json` 与 `render-diagnostics-page.png`；自有启动并开启诊断时还会生成 `window-diagnostics.json` 与 `window-capture.bmp`。坐标与缩放保留三位小数，CSS 中的 URL 或不允许字符会使该样式值被省略；不读取页面 URL、题目、答案或其他正文。`--diagnose` / `--no-diagnose` 以最后一次 CLI 开关为准并覆盖 JSON；`--no-diagnose` 与 `--no-disk-write` 都阻止创建诊断目录。采样不等待后续异步面板挂载，因此首次顶层文档没有面板时 `topPanel` 为 `null`，不代表后续页面也没有面板。

启动模式默认开启渲染诊断（`--no-diagnose` 可关闭）。每次运行会写入：

```text
windows/data/diagnostics/<时间戳>/
  render-diagnostics.json        # 系统 DPI、窗口 DPI 感知、窗口/进程命令行、页面采样、结论
  render-diagnostics-page.png    # CDP 页面截图（页面自身渲染，含面板）
  render-diagnostics-window.png  # 客户端窗口的屏幕截图（含 Windows DPI 缩放效果）
```

原生宿主开启 `--diagnose` 时，在同一运行子目录写入：

```text
render-diagnostics-page.png  # CDP Page.captureScreenshot；base64/PNG/尺寸校验后写盘（attach 也采集）
window-diagnostics.json      # 仅自有启动：systemDpi/windowDpi/窗口矩形/可见性/截图状态与 BMP 尺寸
window-capture.bmp           # 仅自有启动：24 位 BMP；PrintWindow → BitBlt → 空白兜底，best-effort
window-capture.png           # 仅自有启动：与同一像素一致的 8 位 RGB PNG（无 CRT/zlib 的最小 stored-zlib 编码）
render-diagnostics-host.json # 宿主级诊断摘要：launchMode/clientPid/窗口 DPI 诊断/各产物是否生成/固定文件名
```

`window-diagnostics.json` 的 `screenshot.status` 为 `captured`（`PrintWindow` 或 `BitBlt` 成功）、`failed`（像素未能捕获，BMP/PNG 为空白占位）或 `skipped`（窗口过大）；BMP 与 PNG 来自同一像素缓冲，PNG 使用标准 IHDR/IDAT/IEND 与 stored-zlib 编码，已由 Node `zlib.inflateSync` 独立校验行大小与滤波字节。`--attach` 模式没有自有客户端窗口，不会生成后三个文件。`render-diagnostics-host.json` 在运行结束时写入，汇总 `launchMode`、`clientPid`、窗口 DPI 诊断（match/mismatch/unknown）、窗口矩形/可见性/截图状态，以及页面诊断、页面截图、窗口诊断、窗口 BMP/PNG 是否生成；`--no-diagnose`/`--no-disk-write` 不生成该文件。

诊断内容包括：

- 系统 DPI（systemDpi/scale）与客户端窗口 DPI（`GetDpiForWindow`）；两者不一致说明 Windows 正在**位图缩放整个客户端窗口**，所有文字（包括悬浮窗）都会发虚；
- 页面 `devicePixelRatio`、视口尺寸、`visualViewport`、html/body 的 `zoom/transform/filter`；
- 悬浮窗 `rect`、设备像素对齐（`fractional`）、`backdropFilter`、`boxShadow`、`transform`、背景等计算样式；
- `CSS.supports('backdrop-filter')` 能力、面板数量、`search-infos` 是否注册等。

面板生命周期与上下文日志（排查“进入答题后悬浮面板消失”）：

- `[context] id= frame= origin=`：每个默认执行上下文创建；`[nav] 顶层导航：...`：顶层页面导航（URL 已去掉 query）；
- `[panel] panels= visible= removed= owner=`：顶层 bootstrap 上报的面板数量/可见数/被移除数/owner（面板增删、可见性变化、owner 变更时输出）；
- `[panel] 已提前挂载折叠面板壳 ...`：新文档开始阶段挂载的折叠壳（业务 bundle 会复用同一节点）；
- `[session] 顶层 frame 兜底注入` / `顶层 frame 兜底检查通过`：顶层导航 2.5 秒后自动检查并补注入丢失的 bootstrap/bundle；
- 答题页（`reVersionTestStartNew`）大量 about:blank iframe 不会再抢占顶层面板；顶层面板被 SPA 移除会自动重挂载。

```text
[panel] panels=1 visible=1 removed=0 owner=https://mooc1.chaoxing.com/exam-ans/...   ← 正常
[panel] panels=1 visible=0 removed=0 owner=...                                       ← 被隐藏（看 owner/样式）
[panel] panels=0 visible=0 removed=1 ...                                             ← 被移除（keep-alive 会重挂载）
```

日志里会给出结论行，例如：

```text
[diagnostics] 客户端窗口 DPI 与系统一致（windowDpi=120，systemDpi=120），不会因系统位图缩放发虚
# 或
[diagnostics] 客户端窗口 DPI 感知与系统不一致：Windows 正在位图缩放整个客户端窗口……可用 --dpi-aware 重试
[diagnostics] 页面可疑项 SUBPIXEL_POSITION：面板 rect 与设备像素网格不对齐……
```

修复路径：

1. 如果是 DPI 不一致（125%/150% 缩放 + 客户端 DPI-unaware）：Node 宿主可用 `windows/node-scripts/start-windows-node.cmd --dpi-aware` 启动一次，或在 `windows/data/config.json` 设置 `"dpiAwareness": "system"`。正常启动流程会临时设置 `HKCU\...\AppCompatFlags\Layers` 的 `HIGHDPIAWARE`（等价于“属性 → 兼容性 → 替代高 DPI 缩放行为：应用程序”），进程创建后恢复原值。原生 EXE 的用法、冲突校验和恢复失败边界见“原生临时 DPI 兼容层”，两条实现均不能保证进程崩溃或强制结束后的恢复。
2. 如果是页面可疑项：按 `render-diagnostics.json` 的 findings 修复样式/定位（面板已默认不使用 backdrop-filter、不透明底色、紧凑阴影、位置吸附设备像素网格）。
3. 把 `render-diagnostics.json` + 两张 png + `windows/data/logs/` 最新日志反馈即可定位。

### 已确认案例（2026-10-26）

真实客户端诊断（`windows/data/diagnostics/2026-10-26T09-14-07-497Z/`）显示：

- CEF75 的 `CSS.supports('backdrop-filter','blur(1px)') = true`，旧版面板根节点 `blur(14px)` 与标题栏 `blur(12px)` 会真实生效，模糊面板背后的页面内容——这就是“悬浮窗附近模糊”的直接原因；
- 移除 backdrop-filter、改不透明底色、收紧阴影后，基线运行（未加 `--dpi-aware`）用户确认模糊消失，因此本次不是系统 DPI 位图缩放；
- 同轮采样仍出现面板外宽半设备像素（x=1287.5 @ dpr 1.25），已新增 `snapPanelOuterWidth` 修复；125% 缩放 Chromium 冒烟验证设备坐标 `x=948.0, width=612.0`、`pageDiagnosis=clean`；
- 诊断窗口探测曾因执行过早（启动后约 5.6 秒，CEF 主窗口未创建）而 `unknown`，现已改为 bundle 注入成功后重试，后续运行可拿到 `windowDpi` 与窗口截图。

因此当前样式规则（勿回退）：**不使用 backdrop-filter、使用紧凑阴影、不透明/近不透明底色、fixed 位置与外宽都吸附设备像素网格**。

## 故障排查

| 现象 | 处理 |
| --- | --- |
| `启动客户端需要管理员权限` | 默认仅在客户端普通启动返回 Win32 `740` 后申请 UAC；可添加 `--elevate-on-start` 提前申请，或检查是否配置了 `--no-elevate`。 |
| 原生启动返回 Win32 `740` | 移除 `--no-elevate` 允许系统 UAC 确认，或手动以管理员身份运行原生 EXE；不要自行添加内部 `--elevated` 标记。取消 UAC 的退出码为 `3`，不是启动成功。 |
| 原生 DPI 应用或恢复失败 | 查看 `dpi-override-failed` / `dpi-restore-failed` 报告及当前用户对应的 `Layers` 值；宿主会停止本次启动流程，不能把该失败当作已恢复或继续自动 UAC。`--dpi-aware` 不能与 `--no-disk-write`、`--attach` 同用。 |
| 原生 `client-already-running` / `process-check-failed` | 前者需自行退出已有同名客户端；后者表示无法可靠完成系统进程快照检查，应查看权限或系统错误后重试。宿主不会结束已有客户端，也不会将枚举失败当作无客户端继续启动。 |
| `没有找到可绑定的调试端口` | 检查 `netsh int ipv4 show excludedportrange protocol=tcp`；或把配置 `port` 改为 0 |
| `检测到已有 CXExam 客户端进程` | 全部退出后重试 |
| `调试端点 Browser 与期望不匹配` | 端口被其它 Chromium 占用；换端口或关闭占用程序 |
| `监听进程不是本次启动的客户端` | 说明端口被其他进程接管/客户端启动参数被覆盖；报告完整日志 |
| 注入成功但页面没有面板 | **Windows 端只有考试/答题相关页面才显示面板**（登录/课程/跳转页不显示，属预期）；确认当前 URL 是否匹配考试路径 |
| 跨页面跳转时面板反复消失/出现 | 当前版本已优化：面板只在考试页面创建、新文档提前挂载折叠壳、业务复用同一节点；看日志 `[panel] 已提前挂载折叠面板壳` 与 `[panel]` 行 |
| 进入答题页后面板消失 | 先看日志 `[panel]` 行与 `[session] 顶层 frame 兜底注入`；当前版本已修复：非顶层 frame 抢占 owner、SPA 移除面板、顶层 READY 丢失（见“面板生命周期与上下文日志”） |
| 悬浮窗文字/边缘发虚 | 先看 `windows/data/diagnostics/<时间戳>/render-diagnostics.json` 的 `dpiDiagnosis`；若 `status=mismatch`，用 `--dpi-aware` 重试 |
| 第一次启动 10 秒内没有 target | 客户端首次创建 CEF 浏览器较慢，等待 10-20 秒；宿主会最多等 30 秒 |

## 安全与合规

- 调试端口只绑定 `127.0.0.1`；宿主只连接自己启动的客户端（监听 PID 或其子进程链校验）。
- 已有 `CXExam.exe` 时拒绝启动，避免连接真实考试会话。
- 日志/报告不记录 URL 查询参数、Cookie、答案或账号数据；客户端目录的 `debug.log` 仍可能含页面信息，不要外发。
- 本项目仅用于本机技术研究与自有账号环境；请勿在正式考试中使用。
## 注入通道决策表（2026-10-30）

宿主默认 `--inject-mode auto`，按下表自动决策；所有结论均来自无 UAC 实测。

| 客户端特征 | 选择的通道 | 说明 |
| --- | --- | --- |
| 不导入任何候选载体、或客户端已自行监听端口 | `cdp-port`（命令行开关） | 零文件、零安装 |
| 无 `.themida` 节（两份 4.1.4） | `cdp-port` | 实测真机可见面板 |
| 有 `.themida` 节（4.3.0.4） | `dll-proxy`（settings-only） | 自动安装代理，退出自动还原 |
| 已装代理 + 加壳 | `dll-proxy` | 不会重复安装、也不会在退出时删除 |
| `cdp-port` 拿不到端点（且端口未被他人占用） | 自愈：改用 `dll-proxy` 重试一次 | 触发条件见下 |

### 单 EXE 与内嵌代理（2026-10-30 复盘）

现场反馈：4.3.0.4 客户端（桌面上的 `电子科技大学中山学院考试客户端-4.3.0.4\CXExam.exe`）在选择窗口里"两种注入方式都不可用"；随后要求发布产物**只保留单个 `chaoxing_plus.exe`**。离线探测结论：

| 事实 | 依据 |
| --- | --- |
| 客户端 x86、4.3.0.4，节表含 `.themida`/`.boot` | `--probe-client` 输出 `machine=x86 version=4.3.0.4`、`packed=themida` |
| cdp-port 灰化是正确行为 | 4.3.0.4 实测不响应 `--remote-debugging-port`，只有 dll-proxy 可用 |
| dll-proxy 灰化的根因是 release 目录没有代理 DLL | 当时选择窗口只按 `<宿主目录>\hook\<carrier>.dll` 判定可用性 |

修复内容：

1. **winmm 代理内嵌为 RCDATA**（`CX_RESOURCE_PROXY_WINMM`，见 `assets.rc.in`）；`--install-proxy`/`dll-proxy`/auto 从 EXE 资源释放到客户端目录，`--uninstall-proxy` 还原。`build-windows.ps1` 在 `windows/native-build/hook/winmm.dll` 缺失时自动构建它（仅用于嵌入；`-SkipProxy` 会因缺少嵌入源直接失败）。
2. 发布布局收敛为**单个 EXE**：`build-windows.ps1` 不再往 `release/` 复制 hook，`package-windows.mjs` 不再打包 `hook/` 与 `winmm-proxy.dll`，`release-info.json` 不再写 `proxyDir`。
3. 选择窗口在灰化时**默认不显示原因行**；只有传 `--show-inject-reasons`（调试入口 `start-windows-debug.cmd` 已带）才显示具体原因（加壳 / 非 x86 / 目录不可写 / 无载体 / 缺代理 DLL）。可用性判定顺序为"内嵌代理 → 宿主目录外置代理"。
4. `cx_selection_client_caps()` 首次使用时自行加载载体列表——此前 `--caps` 这类不打开窗口的入口会误报"客户端没有导入可用代理载体"。
5. 新增 `selection-tests.exe --caps <CXExam.exe>` 输出 `caps: injectMask=.. carrierMask=.. reasons=.. embedded=..`，可直接判定真实客户端的灰化原因与内嵌载体。
6. 「代理载体」与注入方式对齐：只有显式选中 `DLL 代理（dll-proxy）` 时才列出具体载体（不可用项灰化）；「自动（推荐）」与「端口命令行」下只剩「自动（按导入表）」并禁用，避免"选了自动却还要挑载体"的误导。载体候选同时包含内嵌代理，单 EXE 在空目录里也能列出 `winmm.dll`。

现场复核：

- `windows\native-build\release\` 只有 `chaoxing_plus.exe`（712192 字节，含内嵌代理）。
- 对该客户端输出 `caps: injectMask=0x2 carrierMask=0x0 reasons=0x1 embedded=winmm.dll` —— 只禁用 `cdp-port`，`dll-proxy` 可选。
- 把单个 EXE 复制到空目录执行 `--install-proxy --client <夹具>`：输出"已释放内嵌代理"，客户端目录出现 21504 字节、以 `MZ` 开头的 `winmm.dll`；`--uninstall-proxy` 清除。
- `assets-tests.exe` 覆盖内嵌代理枚举/加载（PE 头 + NUL 结尾）；`--capabilities` 报 `embeddedResourceCount:5` 与 `embeddedProxy:true`。
- `selection-tests.exe` 断言：默认自动模式载体下拉只有 1 项（「自动（按导入表）」），切到 `dll-proxy` 后项数增加；把该 EXE 单独放进空目录重跑同样通过。


### 自愈触发条件

仅在**端口没有出现监听**时重试；以下情况不重试：

- `listenerSeen=true`（端口上已有监听）；
- `listener-not-owned`（监听属于别的进程）；
- `http-failed`（有监听但 HTTP 不通）；
- 用户显式指定 `--inject-mode cdp-port` 或使用 `--attach`。

### 交付前自检

```powershell
# 单客户端：会走哪条通道、能用哪些载体
.\windows\native-build\bin\chaoxing_plus.exe --probe-client "<客户端>\CXExam.exe"
#   probe: packed=themida
#   probe: channel=dll-proxy
#   probe: proxies=winmm,version,uxtheme,msimg32,sensapi,oledlg,wtsapi32

# 全机：候选数量与通道分布
.\windows\native-build\bin\chaoxing_plus.exe --probe-all --no-disk-write
#   probe-all: candidates=3
#   plan: clients=3 cdp-port=2 dll-proxy=1
```

### 载体选择

`auto` 按客户端导入表，从以下顺序挑第一个可用且不在 KnownDLLs 的载体：

```
winmm → version → uxtheme → msimg32 → sensapi → oledlg → wtsapi32
```

目标位置已有第三方同名 DLL 时自动换下一个；`imm32` 等 KnownDLLs 名字会被拒绝（系统强制从 System32 加载）。
### 选择窗口的能力感知（2026-10-30）

选择窗口在**切换客户端行**时会对该 EXE 做静态探测（PE 节表 + 导入表），据此灰化不可用的选项：

| 探测结果 | 界面表现 |
| --- | --- |
| 含 `.themida` 节（加壳） | 「端口命令行（cdp-port）」显示为灰色并追加「（不可用）」；点选会被拒绝并回弹 |
| 不导入某个载体 DLL | 显式 `dll-proxy` 时「代理载体」里对应项灰化并标注「（不可用）」 |
| 无任何可用载体 | 「DLL 代理（dll-proxy）」灰化 |
| 任一显式通道灰化 | 默认不显示原因；传 `--show-inject-reasons` 后在下拉框上方显示具体原因（加壳 / 非 x86 / 目录不可写 / 无载体 / 缺代理 DLL） |

「代理载体」只在**显式选中 `DLL 代理（dll-proxy）`** 时才展开（列出全部载体，不可用的灰化）；默认的「自动（推荐）」和「端口命令行（cdp-port）」下，该下拉只剩「自动（按导入表）」并禁用——auto 的载体本来由宿主按导入表解析，多列条目只会误导（2026-10-30 用户反馈修正）。

默认仍是「自动（推荐）」——运行时按最优顺序选择：加壳 → `dll-proxy`（自动装代理），否则 `cdp-port`。即"用最合适的注入方式"由 auto 承担，用户只在需要时覆盖。

实现要点：`selection_client_caps()` 读取 PE 节表（判加壳）与导入表（判载体）；两个下拉框使用 `CBS_OWNERDRAWFIXED`，禁用项以 `COLOR_GRAYTEXT` 绘制并在 `CBN_SELCHANGE` 中拒绝选中。载体候选来自「宿主目录 `hook`/同级的代理 DLL」与**内嵌资源**两部分，所以单 EXE 也能列出 `winmm.dll`。提示行由 `selection_reason_text()` 从 `CX_SELECTION_REASON_*` 位生成，默认隐藏、由 `--show-inject-reasons` 开启（`cx_select_client`/`cx_selection_probe` 的 `explainReasons` 参数，探针用 `statusShown` 断言）；同样的判定经 `cx_selection_client_caps()` 暴露，`selection-tests.exe --caps <CXExam.exe>` 会打印 `caps: injectMask=0x.. carrierMask=0x.. reasons=0x.. embedded=..`，用于确认某个真实客户端到底是"哪些通道、因为什么"被灰化。

### 载体可用性四要素（2026-10-30）

「代理载体」下拉在灰化时，判定依据不止"有没有导入"，共四项：

| 检查 | 不满足时的表现 | 原因 |
| --- | --- | --- |
| 客户端导入表里有该 DLL | 该载体灰化 | 不导入就永远不会被加载 |
| 宿主目录存在该载体的代理 DLL，或该载体已内嵌（`winmm.dll`） | 该载体灰化 | 没有代理来源，安装必然失败 |
| 客户端是 x86 | 全部载体灰化 | 代理 DLL 是 x86，x64 客户端无法侧加载 |
| 客户端目录可写 | 全部载体灰化 | dll-proxy 需要往该目录放 DLL |

实测（把 `version.dll`、`uxtheme.dll` 两个代理临时移走后打开界面）：

```
自动（按导入表）
winmm.dll
version.dll（不可用）     ← 灰色
uxtheme.dll（不可用）     ← 灰色
msimg32.dll / sensapi.dll / oledlg.dll / wtsapi32.dll
```

而不是导入表检查那轮：移回文件后同样两项恢复可选，说明判定按文件存在与否实时生效。

补充说明（未做静态预判、由运行时处理）：客户端目录若已有**第三方同名 DLL**，宿主会在安装时自动换下一个载体；KnownDLLs 名单（imm32 等）已从载体表剔除，因此无需在界面重复判断。
### 注入能力检测器（2026-10-30）

界面不再"死记"支持列表，全部改为**直接检测**：

| 检测项 | 方法 | 结果 |
| --- | --- | --- |
| 可用载体 | 扫描宿主目录的 `hook\*.dll`（以及同级的 `*.dll`），取文件名作为候选，再与客户端导入表求交 | 新增/删除代理 DLL 后界面自动增减，无需改代码 |
| KnownDLLs | 读注册表 `HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\KnownDLLs` | 同名 DLL 自动从候选中剔除（如 `imm32`） |
| 加壳 | 扫描**全部节名**匹配 10 类壳特征（themida/winlicense/vmp/upx/aspack/mpress/enigma/obsidium/packed/protect/.boot） | 命中即判为"命令行开关大概率无效" |
| 架构 | PE `FileHeader.Machine` | 非 x86 → 载体全部不可用（代理是 x86） |
| 目录可写 | 在客户端目录创建临时文件（`FILE_FLAG_DELETE_ON_CLOSE`） | 不可写 → 载体全部不可用 |

实测（当前 `windows\native-build\hook` 下 8 个 DLL，其中 imm32 是 KnownDLL）：

```
carrier-count=8            ← 自动 + 7（imm32 已被注册表过滤）
[0] 自动（按导入表）
[1] msimg32.dll
[2] oledlg.dll
[3] sensapi.dll
[4] uxtheme.dll
[5] version.dll
[6] winmm.dll
[7] wtsapi32.dll
```

顺序来自文件系统枚举（字母序），不是代码里写死的顺序——这正是"检测而非硬编码"的直接证据。

宿主侧的 `h_carrier_is_known_dll()` 也改为**优先查注册表**，查不到才回退内置兜底表；`auto` 的加壳判定同样换成上面的通用特征扫描。
