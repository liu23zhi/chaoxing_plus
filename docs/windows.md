# Windows 端（超星考试客户端 / CEF 75）使用与设计

Windows 6.2.0 第一阶段提供 **普通可审计 Windows 宿主**：它用官方 CEF 远程调试参数启动超星考试客户端，并通过 CDP（Chrome DevTools Protocol）把扩展的业务 bundle 注入到客户端网页主世界。扫描、配置和离线参数生成器属于本阶段；内存执行、删除挂起、启动清理与自毁只保留参数设计和禁用状态。

## 状态与适用对象

| 项 | 状态 |
| --- | --- |
| 目标客户端 | 电子科技大学中山学院 考试客户端 V4.1.4.25512（x86，CEF 75.1.4 / Chromium 75.0.3770.100） |
| 注入方式 | `--remote-debugging-port` + 本地 CDP（仅 127.0.0.1） |
| 宿主运行时 | 完整 Node 宿主：Node.js ≥ 22；原生原型：x86 Win32、无 CRT、四项页面资源内嵌（边界见下文） |
| 自动化验证 | mock CDP 回归、真实 Chromium（非 CEF75）端到端冒烟、Chrome75 语法闸门、类型检查与扩展全量测试 |
| 真实考试客户端整体验证 | **需人工按下方步骤执行一次**（启动需要 UAC，且需要在客户端里登录后观察） |

> 前置结论来自临时注入探针的实测：真实客户端 `CDP_CONFIRMED`、7 个页面上下文注入成功、`/json/version = Chrome/75.0.3770.100`。本 Windows 端的宿主与页面 bootstrap 按同一协议实现。

### 发布与系统兼容边界

Node 宿主当前仍需 Node.js 22+，其客户端选择窗口还使用 PowerShell 5.1 与 WinForms；`start-windows.cmd` 不会安装或内嵌这些运行条件。客户端能启动不代表 Node 宿主前提均已具备。原生 EXE 使用独立的 Win32 选择窗口，不依赖 Node、PowerShell 或 WinForms。

`windows/native/` 是另一条普通运行的原生宿主原型。构建生成 x86 `chaoxing_plus.exe`，现已将 bootstrap、业务 bundle、新文档探针和 SweetAlert2 CSS 作为 RCDATA 嵌入 EXE；默认直接读取资源，不解包旁置文件。已在本机验证把 EXE 单独复制到含中文与空格的空目录后，四项资源的长度及 SHA256 均与构建输入一致；导入表只包含系统 DLL，没有 Node、.NET 或 VC++ Runtime。显式 `--assets <dir>` 可用于调试覆盖，目录结构须与 `dist-windows` 一致，CSS 位于 `vendor/sweetalert2.min.css`；覆盖文件缺失或无效时明确报错，不回退内嵌版本。

原生路径现已通过真实 TCP/WebSocket 适配器持续轮询 page target，为各 target 建立上下文会话，处理导航、新 target、延迟创建的 iframe、上下文销毁、连接关闭与重连重试；首次连接和导航后保留顶层补注入。`runtime`、`script`、`hybrid` 三种注入策略均接入同一生命周期。宿主在本次启动的客户端退出或 `--duration` 到期后关闭会话；默认不结束仍存活的客户端，只有 `--stop-client-on-exit` 或启动失败时结束本次创建的进程，`--attach` 的外部浏览器不在该范围内。

原生宿主在每轮目标刷新及建立 WebSocket 前重新检查监听进程归属；检查失败会关闭现有会话并阻止新连接。只有显式测试参数 `--attach` 跳过归属校验。重连后，已完成 DOM 初始化的上下文通过既有 `requestBundle()` 重发就绪通知，避免 iframe 因 console 历史已清除而一直等待；业务包仍由文档标记去重。当前容量为最多 16 个 page 会话，每页最多 256 个默认上下文、512 个 frame，超过容量的目标不会覆盖仍在使用的状态。

原生客户端选择使用 Win32 控件和 `GetOpenFileNameW`：显示序号、架构、文件版本、完整路径与推荐项，支持双击、确认和手动浏览；扫描无候选时仍可浏览，取消不会启动客户端。所选路径会再次检查有效 PE 和系统架构兼容性。

原生宿主现已接入共享配置同步、持久化、文件热更新、文件日志与运行报告，`--capabilities` 中 `configReload:true`、`configPersistence:true`、`fileLogging:true`、`runReport:true`；渲染诊断仍未接入，`renderDiagnostics:false`。接受部分参数或将设置传入页面不等于实现对应宿主行为，原生宿主仍不与 Node 宿主完整等价。原生版本仍为原型，其构建依赖本机 MSVC x86 工具链和 Windows SDK；x86/x64 客户端适配及旧版 Windows 兼容性仍需在目标干净环境验收。

下文完整参数和 `start-windows.cmd` 示例以 Node 宿主为准；原生原型的具体参数以它自己的 `--help`、`--capabilities` 和已执行测试为准，不默认宣称与 Node 全部等价。两条宿主都不提供启动清理、内存执行、删除挂起或自毁能力；这些请求必须明确拒绝，不能静默降级为普通运行。

普通退出的数据生命周期也尚未在两条入口间对齐：Node 支持 `--no-retain-data`、`--delete-config` 和 `--self-check`；原生原型明确拒绝这些参数及 JSON 中的 `retainData:false`、`deleteConfig:true`，避免接受参数却忽略请求。

三份本地样本的静态审计结果：V4.1.4.25512 的两个学校版本 EXE 相同，V4.3.0.4 的 EXE 不同，三者均为 x86，所带 CEF 均为 `75.1.4+g4210896 / Chromium 75.0.3770.100`。该结论仅代表文件架构与版本，未完成这些客户端在各 Windows 版本上的启动、登录及答题验证。

“单文件”和“旧系统兼容”需要分别验收：[Node 24 官方平台要求](https://github.com/nodejs/node/blob/v24.12.0/BUILDING.md)为 Windows 10 / Server 2016 起，Windows 发布架构为 x64/arm64；[SEA 打包](https://nodejs.org/download/release/v24.12.0/docs/api/single-executable-applications.html)不能降低这一系统要求。[Go 1.21 起](https://go.dev/doc/go1.21#windows)也以 Windows 10 / Server 2016 为最低要求，原设计的 Go 1.22+ 静态构建不能据此宣称覆盖 Windows 7。Chromium 75 [官方构建说明](https://github.com/chromium/chromium/blob/75.0.3770.100/build/config/win/BUILD.gn)仍以 Windows 7 为受支持系统；样本 PE 头的 `5.1` 声明不能证明客户端支持 Windows XP。

后续普通单文件宿主仍须补齐与 Node 的参数行为差异，并在明确的 x86/x64、旧版和现代 Windows 干净环境中验证。当前 CDP 使用 TCP/WebSocket 通信，宿主与客户端无需相同位数；没有必要仅为页面注入拆分两套业务资源。现代 Chromium 自动化已覆盖原生实际 WebSocket 注入、导航、iframe、新 target、CSP 回退和限时关闭；历史探针和样式诊断只证明当时记录的局部行为，**本次 Windows 6.2.0 第一阶段尚未完成真实 CEF75 客户端端到端验收**。

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

原生宿主普通运行默认将日志写入 `<进程工作目录>/.data/logs/windows-host-<UTC时间>-<宿主PID>.log`。`--data-dir` 可更改数据目录；相对数据目录和 `--report` 路径均以创建审计对象时的进程工作目录为基准，支持中文与空格。日志使用 `CREATE_NEW`，重名时选择带序号的新文件，不覆盖已有会话日志。这里的默认目录与 Node 宿主的 `windows/data` 不同；不声明扩展 UNC 路径 `\\?\UNC\...` 支持。

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
start-windows.cmd
  -> windows/host/main.mjs
     1. 读取 windows/data/config.json（clientPath / port / settings）
     2. 需要管理员：自动用 UAC 重启自身（--elevated），否则提示手动提权
     3. 选端口：优先配置端口，否则按候选表用 bind() 实测（Windows 保留端口会 bind 失败）
     4. 检查是否已有 CXExam.exe 进程：有则拒绝启动，避免连接真实考试会话
     5. CreateProcess(clientPath, --remote-debugging-port=N --remote-debugging-address=127.0.0.1)
     6. 等待 /json/version，校验 Browser 前缀；用 Get-NetTCPConnection 校验监听 PID == 本次启动的 PID
     7. 轮询 /json/list，为每个 page target 建立 WebSocket：
          Page.enable -> Page.getFrameTree -> Runtime.enable
          Page.addScriptToEvaluateOnNewDocument(trampoline)
          executionContextCreated -> Runtime.evaluate(bootstrap)
          bootstrap console=ready   -> Runtime.evaluate(业务 bundle)
          console=config-sync       -> 写入 config.json 并广播到所有 frame
```

页面侧：

- `windows/bootstrap/windows-bootstrap.js`：建立 `window.__CX_WIN_HOST__`、把宿主配置水合进 `localStorage` 与 `documentElement` 属性（供现有 `runtimeStore` 读取）、安装 Chrome75 缺失 API 的补丁、在 DOMContentLoaded 后通知宿主注入业务 bundle。
- `windows/host/trampoline.js`：新文档启动探针（`Page.addScriptToEvaluateOnNewDocument`），只负责通知宿主“这里有新文档”，覆盖真实客户端上出现过的“文档已导航但没收到 executionContextCreated”的时序。该命令被拒绝时，Node 宿主记录明确降级日志，继续当前上下文注入并保留顶层补注入；会话关闭或连接断开仍按取消处理。
- 业务 bundle：`dist-windows/chaoxing-plus.windows.js`，即把现有 `src/index.ts` 以 `target: chrome75` 重新构建（内置 SweetAlert2 一并转译、页面样式由宿主注入）。

## 目录

```text
windows/
  config.example.json          配置模板（不含任何真实路径/密钥）
  bootstrap/windows-bootstrap.js  页面侧平台层（无 chrome.*）
  host/main.mjs                宿主入口（启动、CDP、注入、配置、报告）
  host/options.mjs             启动参数解析、互斥/范围校验与配置覆盖
  host/client-discovery.mjs    CXExam.exe 常规扫描、全盘回退、候选选择与短期扫描缓存
  host/diagnostics.mjs         渲染诊断采样、DPI/页面结论
  host/cdp.mjs                 最小 CDP 客户端（fetch + 内置 WebSocket）
  host/inject.mjs              每个页面 target 的会话与注入生命周期
  host/launch.mjs              提权、端口、PE、进程、监听归属
  host/client-process.mjs      只观察本次宿主创建的客户端子进程生命周期
  host/owned-files.mjs         自有文件范围的内部辅助模块，不代表启用启动清理
  host/wipe.mjs                启动清理内部原型；第一阶段入口禁用
  host/self-destruct.mjs       自毁内部状态机；第一阶段入口禁用，无系统事件适配器
  host/config.mjs              配置持久化、共享键过滤、广播
  host/chrome75-syntax.mjs     Chrome75 语法闸门（构建与测试共用）
  host/trampoline.js           新文档探针
  host/selection-window.ps1    Windows 原生客户端选择窗口（PowerShell + WinForms，纯 ASCII）
  host/selection-window.mjs    原生选择窗口的 Node 封装、结果校验与 self-check 探针
  parameter-generator.html     离线单文件启动参数生成器（不联网、不执行命令、不保存输入）
  native/                      普通运行的原生宿主原型，四项资源内嵌
  native/assets.c              内嵌资源读取与显式外部资源覆盖，不解包写盘
  native/selection.c           无 CRT 的 Win32 候选选择、文件浏览与隐藏控件探针
  native/session.c             上下文/导航/就绪任务状态机与取消代次
  native/host-session.inc      原生 target 轮询、真实 WebSocket 会话与生命周期适配
  native/host-config.inc       原生配置排队、启动优先级、文件热更新与串行广播
  native/config-store.c        共享 JSON 规范合并、变更键选择与配置文件安全替换
  native/audit.c               无 CRT 的 UTC 固定事件日志、独立 JSON 运行报告与写入失败降级
  native/build.ps1             x86 构建、RCDATA 与导入表审计；-BuildTests 生成 C 测试程序
  data/                        本地配置与日志（gitignore）：config.json / logs/
build.windows.mjs              Windows 构建（target chrome75 + 语法闸门 + manifest）
start-windows.cmd              推荐入口（检查 Node 版本后启动宿主）
```

`dist-windows/` 为构建产物（已 gitignore），包含：

```text
chaoxing-plus.windows.js  windows-bootstrap.js  trampoline.js
vendor/sweetalert2.min.css  config.example.json  package-manifest.json
```

## 快速开始

1. 安装 Node.js 22+。Windows 宿主当前以 Node 脚本运行，不是独立打包的 exe。
2. 构建（本机开发时）：

   ```powershell
   npm run build:windows
   ```

3. 首次普通运行会自动创建 `windows/data/config.json`（从模板复制，`--no-disk-write` 时不创建）。未设置 `clientPath` 时，常规扫描依次检查桌面、OneDrive Desktop、Program Files、Program Files (x86)、AppData/ProgramData 和所有可访问固定磁盘根目录；每个根目录只检查自身和一级直接子目录。只有常规路径完全没有候选且扫描模式为 `fallback-all` 时，才递归扫描固定磁盘根目录。这里的“任意子文件夹”严格指一级子目录，不会在常规扫描中进入二级或更深目录。也可交互选客户端或直接指定路径：

   ```json
   { "clientPath": "D:\\考试客户端\\CXExam.exe", "port": 0, "settings": { "common.settings.extension-enabled": true } }
   ```

   > 首次验证建议指向客户端目录的**测试副本**；与真实账号环境隔离。

   常用启动参数（`start-windows.cmd` 会透传参数）：

   ```powershell
   .\start-windows.cmd --list-clients
   .\start-windows.cmd --select-client
   .\start-windows.cmd --ui gui
   .\start-windows.cmd --client-index 2 --panel --panel-expanded --panel-top 24 --panel-right 24 --panel-width 520
   .\start-windows.cmd --client "D:\\Exam\\CXExam.exe" --answer-mode manual --answer-key Ctrl+Shift+A --answer-threads 1 --hide-answer-dialog --no-log
   ```

   `--client-index` 从扫描列表的 1 开始；`--scan-mode common` 只扫描常规根目录及一级子目录，`--scan-mode fallback-all`（默认）在常规无结果时追加全盘递归，`--scan-mode all` 强制全盘递归。`--answer-threads` 限制为 1-4。手动模式按组合键后放行对应数量的题目搜题/作答；不会自动保存或提交。自动模式按原流程运行。

4. 启动：

   ```powershell
   .\start-windows.cmd
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
   node windows/host/main.mjs --report windows\data\last-report.json
   ```

## 配置项

| 键 | 说明 |
| --- | --- |
| `clientPath` | 客户端 `CXExam.exe` 绝对路径；未配置时按扫描规则选择 |
| `port` | `0` = 自动选择可绑定端口；固定端口不可绑定时宿主会报错，不会静默换端口 |
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

### 完整启动参数

命令行参数优先级高于 JSON 配置。重复的标量开关以命令行中最后一次设置为准；`--self-check`、`--help`、`--list-clients` 等动作型开关按各自语义执行。

#### 客户端扫描和选择

| 参数 | 默认/范围 | 行为 |
| --- | --- | --- |
| `--client <path>` | 未指定 | 直接启动指定的 `CXExam.exe`，跳过扫描；仍会检查 PE 架构。 |
| `--client-index <n>` | 未指定，`n >= 1` | 启动扫描结果第 n 个；常规候选按完整路径排序，全盘候选按遍历顺序。为确保序号可用，全盘扫描会完整枚举候选，不在首个 x86 提前停止。 |
| `--client-first` | 关闭 | 选择推荐候选；常规扫描结果中 x86 优先，同架构按路径排序。 |
| `--list-clients` | 关闭 | 列出候选和架构后退出，不启动客户端。 |
| `--select-client` | 关闭 | 扫描后显示 **Windows 原生选择窗口**（候选列表 + “手动浏览”选择任意位置的 `CXExam.exe`）；窗口不可用时回退终端逐项选择，非交互终端回退推荐候选；用户取消时以退出码 3 结束，不启动客户端。 |
| `--scan-mode common\|fallback-all\|all` | `fallback-all` | `common` 只扫常规根目录及一级直接子目录；`fallback-all` 仅在常规扫描为零结果时递归固定磁盘；`all` 直接递归固定磁盘。 |
| `--scan-all` / `--no-scan-all` | 默认 fallback-all | `--scan-all` 启用常规无结果后的递归回退；`--no-scan-all` 将扫描限制为常规路径。 |
| `--scan-clients` / `--rescan` | 关闭 | 忽略配置中的现有客户端路径并执行扫描；扫描结果默认缓存到数据目录的 `scan-cache.json`，`--rescan` 仍会执行本次实时扫描并更新缓存。 |
| `--no-scan-cache` | 关闭 | 不读取或写入扫描缓存；实时扫描仍照常执行。 |
| `--ui auto\|gui\|cli` | `auto` | `gui` 使用 Windows 原生选择窗口；`cli` 使用终端交互；`auto` 优先使用已配置客户端路径，否则交互终端提示选择，Windows 非交互环境默认显示原生选择窗口，其他非交互环境使用推荐候选。显式 `--client` 在三种界面模式下均跳过扫描和选择窗口。Windows `auto` 窗口不可用时回退推荐候选；需要窗口时，`gui` 在非 Windows 平台或窗口不可用时直接报错。`--quiet` 或 `--client-first` 会关闭 `auto` 原生选择窗口并使用推荐候选。 |

此处参数表描述 Node 宿主。它的选择窗口使用 Windows 自带的 PowerShell（5.1+）与 WinForms，不新增 npm 依赖：窗口列出扫描到的 `CXExam.exe`（架构、完整路径），支持双击/按钮确认与“手动浏览”选择任意 `CXExam.exe`，取消返回 `cancelled`。`windows/host/selection-window.ps1` **必须保持纯 ASCII**（Windows PowerShell 5.1 对无 BOM 的 `.ps1` 按 ANSI/OEM 解析，中文文案会破坏语法），所有界面文案经 UTF-8 JSON 传入；`--self-check` 会构建一次窗口控件做冒烟（不显示窗口），`--capabilities` 的 `supported.nativeClientSelection` 在 Windows 上为 true。自动化验证可用环境变量 `CXPLUS_SELECTION_AUTO_CLOSE_MS=<ms>` 让窗口自动关闭（仅测试/调试，避免无人值守阻塞）。

原生 EXE 的 `--ui gui` / `--select-client` 则调用 `windows/native/selection.c`，没有 PowerShell 子进程。其隐藏控件探针由 `selection-tests.exe` 执行；实际显示、取消和选择 Unicode 路径的交互冒烟需显式设置 `CX_TEST_NATIVE_WINDOW=1`，测试通过 `CXPLUS_NATIVE_SELECTION_AUTO_CLOSE_MS` 自动取消，避免等待人工操作。该测试不会执行所选客户端。

常规扫描依次检查用户桌面、OneDrive Desktop、Program Files、Program Files (x86)、AppData/ProgramData 等常见根目录，以及所有可访问固定磁盘根目录；每个根目录只检查根目录自身和一级子目录。跳过符号链接、不可访问目录和 Windows 系统目录。常规扫描找到候选后不再递归全盘，即使候选只有 x64 也一样。普通自动选择时，递归回退按固定磁盘和子目录的确定性顺序遍历，记住首个 x64，发现首个 x86 后停止；未发现 x86 时选首个 x64。为支持用户显式选择，`--client-index`、`--select-client` 和 `--list-clients` 会完整枚举全盘结果。架构校验允许 x86 Windows 选择 x86 客户端，x64 Windows 选择 x86/x64 客户端；这不代表当前 Node 宿主已覆盖所有这些系统。自动推荐优先 x86，x64 CEF 客户端尚未做真实客户端验证。

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

显式 `--ui gui` / `--ui cli` 会忽略低优先级配置中的客户端路径，进入扫描与选择；显式 `--client` 仍优先直接启动。JSON 配置中，更高层的 `gui` / `cli` 覆盖低层路径，同层或更高层的 `clientPath` 仍生效；最终界面模式改回 `auto` 时可继续使用原有配置路径。

配置文件热更新和页面设置同步继续按相同优先级合并并校验，不会覆盖命令行或内联 JSON 指定的设置；未覆盖的共享设置可以更新。无效更新保留上一份有效配置。客户端、数据目录、日志、诊断、注入策略等宿主启动选项需要重启才能生效；`noDiskWrite` 是本次运行锁定的写入策略，不能通过热更新改变。

普通退出会先停止注入与监视、关闭配置和日志写入，再按本轮产物登记收尾。显式报告路径如果在本轮被写入并登记，也属于本轮清理对象；未登记的用户文件和 CXExam 文件不在清理范围。`--delete-config` 是单独的显式授权，只删除 `--config` 指定的外部配置，不能由 `--no-retain-data` 推导出来，也不能与 `--no-disk-write` 同用。

#### CEF 注入兼容参数

| 参数 | 默认/范围 | 行为 |
| --- | --- | --- |
| `--expected-browser <text>` | `Chrome/` | 校验 `/json/version` 的 Browser 字段；不匹配时中止，防止误连其它 Chromium。 |
| `--inject-strategy hybrid\|runtime\|script` | `hybrid` | `runtime` 直接在目标 execution context 执行；`script` 创建临时 DOM `<script>` 执行并在失败时回退 runtime；`hybrid` 先 runtime、失败后 script。两种方式都只针对已验证的本机 CDP target。 |
| `--inject-retries <n>` | `2`，`0-5` | 每一轮注入路径失败后重试；每次切换策略都会写诊断日志。 |
| `--inject-blank-frames` / `--no-inject-blank-frames` | 开启 | 是否向 `about:blank`、`srcdoc` 和其它不透明 frame 注入。 |
| `--capture-console` / `--no-capture-console` | 开启 | 是否转发页面 console、异常和 bundle 诊断到宿主日志。 |
| `--debug-timeout <ms>` | `30000`，`1000-120000` | 等待本次启动客户端调试端点的最长时间。 |
| `--target-poll-interval <ms>` | `1000`，`250-10000` | `/json/list` target 枚举间隔；较小值更快发现导航 target，但会增加请求。 |
| `--bundle-timeout <ms>` | `120000`，`1000-300000` | 单次 bootstrap/bundle CDP 执行超时。 |

参考项目中的 `cef-hook` 是当前进程内的 CEF/Detours hook，不能安全地作为通用外部注入器复用；本宿主因此采用“启动客户端时注入受控远程调试参数 + 校验 Browser/PID/端口归属 + CDP 多路径页面注入”。宿主不会自动连接任意已有端口；`--attach` 仅用于测试/调试。

CDP 断开时关闭旧页面会话；target 仍存在则在下一轮枚举重新连接。初次连接、重连和顶层导航后都会延迟检查 bootstrap/bundle，避免已有 bootstrap 不再发送 `ready` 时漏注入。同一执行上下文的并发 `ready` 合并为一次业务注入；上下文销毁或会话关闭后，迟到结果作废，停止后续策略切换及重试。DOM script 注入使用执行完成标记识别 CSP 阻止或脚本异常，失败后按所选策略回退，不把无异常的 CDP 响应当作脚本已成功执行。配置广播使用 `{kind:"config", values:...}` 包装；原生宿主的完整快照另带 `replace:true` 以删除已移除的旧共享键，不带该标记时保留增量合并语义。同实例重连复用已有配置桥水合最新完整快照，不重复安装监听或面板。

运行报告累计保留历次 target 会话的统计；断线重连或页面关闭不会抹去此前成功注入的计数，也不会因此误报“没有完成任何业务注入”。

#### 面板和答题

| 参数 | 默认/范围 | 行为 |
| --- | --- | --- |
| `--panel` / `--no-panel` | 面板由 Windows 页面规则决定，默认考试页显示 | 启用或关闭业务悬浮面板；关闭后 bootstrap 折叠壳也不会挂载。 |
| `--panel-collapsed` / `--panel-expanded` | 默认折叠 | 设置首次出现时的展开状态。 |
| `--panel-top <px>` / `--panel-right <px>` | `16`，`0-10000` | 设置面板距视口上边和右边的距离。 |
| `--panel-width <px>` | `460`，`320-800` | 设置面板宽度。 |
| `--panel-theme <name>` | `pink` | 预留主题名；当前页面仍使用内置主题样式。 |
| `--answer-mode auto\|manual` | `auto` | 自动模式按页面设置流程运行；manual 由快捷键为题目处理发放许可。 |
| `--answer-key <shortcut>` | `F8` | 手动模式快捷键；示例 `Ctrl+Alt+Shift+S`。仅支持一个基础按键，可组合 Ctrl/Alt/Shift/Win。 |
| `--answer-threads <n>` | `4`，`1-4` | 每次手动许可放行/并行处理的题目数量；超出范围或非整数直接报错。 |
| `--answer-countdown <sec>` | `5`，整数 `0-3600` | 自动模式开始前的倒计时秒数；`0` 不自动倒计时，等待用户确认。 |
| `--answer-retry <n>` | 默认 `3`，`0-20` | 设置单题额外重试次数；必须为整数，`0` 表示不额外重试。 |
| `--show-answer-dialog` / `--hide-answer-dialog` | 显示 | 控制自动答题确认弹窗。 |
| `--no-auto-submit` | 关闭 | 禁止 Windows 宿主自动提交，章节、作业和考试改为保存；未指定时保留配置文件及业务默认行为。 |

#### 日志、诊断和运行

| 参数 | 默认/范围 | 行为 |
| --- | --- | --- |
| `--log` / `--no-log` | 写入宿主日志 | 开启或关闭宿主日志文件。 |
| `--quiet` | 关闭 | 减少常规控制台输出；参数错误、OS/UAC 提示不一定静默。 |
| `--diagnose` / `--no-diagnose` | 正式启动默认开启 | 开启或关闭渲染诊断。命令行开关覆盖 JSON 值。 |
| `--diagnostics-dir <path>` | `windows/data/diagnostics/<timestamp>` | 指定诊断图片和 JSON 的输出目录。 |
| `--report <path>` | 不生成 | 将运行报告写入指定路径。 |
| `--execution-mode normal` | `normal` | 当前唯一支持的执行模式。`memory`、`delete-suspend`、`--memory-exec` 和 `--delete-suspend` 会明确报错，不会静默降级。 |
| `--stop-client-on-exit` | 关闭 | 宿主退出时结束本次启动的客户端进程树。 |
| `--dpi-aware` | 关闭 | 本次启动临时添加 HIGHDPIAWARE 兼容层，进程创建后立即恢复原注册表值。 |
| `--port <n>` | `0` | `0` 使用自动端口；`1-65535` 指定端口。 |
| `--assets <dir>` | `dist-windows` | 指定注入资源目录。 |
| `--duration <ms>` | 不限时 | 测试模式运行指定时长后退出。 |
| `--attach <port>` | 不启用 | 仅测试/调试连接已存在端点；不会启动客户端或校验进程归属。 |
| `--self-check` / `--help` | 关闭 | 只做环境检查或输出参数帮助。 |
| `--capabilities` | 关闭 | 输出机器可读的能力标记。Node 宿主列出普通运行、扫描、参数生成器与（Windows）原生选择窗口；启动清理、内存执行、删除挂起和自毁均标记为不支持，并保留设计 schema。原生宿主单独输出自身能力，不得把两者的已支持项合并推断。 |
| `--no-elevate` | 关闭 | 非管理员时直接报错，不自动申请 UAC（便于自动化/调试）。 |

#### 禁用能力的参数设计

以下是后续阶段的 schema 和设计默认值，**不是本阶段可执行功能**。Node 与原生入口都必须拒绝启动清理、内存执行、删除挂起和自毁请求。内部清理器或状态机的单元测试不代表发布入口已支持；本阶段也不自动把自毁请求转换为另一种执行模式。

| 能力或参数 | 设计值 | 当前行为 |
| --- | --- | --- |
| `--execution-mode memory`、`--memory-exec` | 内存执行 | 启动前报错。 |
| `--execution-mode delete-suspend`、`--delete-suspend` | 删除挂起 | 启动前报错。 |
| `--wipe-owned-files-on-start` | 关闭 | 设计为启动清理宿主登记的自有文件；当前拒绝，不执行删除。 |
| `--wipe-failure-policy retry\|background\|ignore\|abort` | `retry` | 设计为删除失败处理策略；当前拒绝。 |
| `--wipe-retries <1-20>` | `5` | 设计为启动阶段有限尝试上限；当前拒绝。 |
| `--wipe-retry-delay <ms>` | `200`，`50-5000` | 设计为启动尝试间隔；当前拒绝。 |
| `--wipe-runtime-retry` / `--no-wipe-runtime-retry` | 开启 | 设计为启动失败后是否继续非阻塞重试；当前拒绝。 |
| `--wipe-runtime-interval <sec>` | `30`，`1-86400` | 设计为运行期间重试间隔；当前拒绝。 |
| `--self-destruct-key <shortcut>` | 可重复，默认无 | 自毁快捷键尚未实现，报错。 |
| `--self-destruct-on-fullscreen-exit` | 关闭 | 全屏/进程退出监控尚未实现，报错。 |
| `--self-destruct-delay <ms>` | `0` | 自毁延迟尚未实现，报错。 |
| `--no-self-destruct-confirm` | 关闭 | 自毁确认控制尚未实现，报错。 |

这些能力只做 schema、范围与冲突说明；显式通过 CLI、内联 JSON、配置文件或共享 Windows 设置请求它们时都报错，包括单独指定 `--wipe-retries` 等调优参数。生成器不得把包含这些请求的配置导出为可运行命令。

后续清理策略设计：`retry` 最多尝试 5 次，失败继续普通流程，并在启用运行期重试时每 30 秒后台尝试；`background` 首次失败后立即转入后台重试；`ignore` 尝试一次后忽略失败；`abort` 删除失败即中止，不启动客户端。上述重试次数和间隔均可按 schema 调整，本阶段不执行这些策略。未来清理必须限定自有登记路径，永远不删除 `CXExam.exe`、客户端安装目录或未登记用户文件。

后续自毁监控设计必须先确认本次 CXExam 已启动并获得 PID；只有观察到进入全屏后，退出全屏才能触发。已启动但尚未全屏就结束时可以按进程结束处理，从未成功启动时不得误触发；多个事件只收尾一次。本阶段不安装自毁热键、全屏监视或自删除操作。普通数据退出清理与这些设计能力分别处理。

已知限制：Windows 端没有扩展 popup，目前通过编辑 `config.json` 或在页面内面板修改设置；`common.settings.extension-enabled=false` 时不会注入业务 bundle。

### Windows 参数生成器与启动示例

`windows/parameter-generator.html` 是离线单文件参数生成器，可在浏览器中打开，生成 PowerShell、cmd、JSON 配置和参数摘要。启动脚本默认根据 HTML 所在位置定位到项目根目录的 `start-windows.cmd`，也可在页面中修改；单独复制 HTML 时需自行指定实际启动器路径。页面不联网、不执行命令、不保存输入。

页面按客户端扫描 / 配置和数据 / 执行模式 / 面板 / 答题 / 日志与诊断 / 启动清理 / 自毁分组，提供 8 个预设。绝对静默型只生成下方第一阶段普通启动子集；友好交互型、懒人型、手动答题型、仅扫描型、直接路径型和全盘扫描型均为普通运行。**启动清理型（`startupClean`）是不可执行的设计预设**：选中后说明缺失能力并清空命令与 JSON 输出，不能生成去掉清理开关的普通命令冒充清理启动。

实时校验包括客户端选择互斥、`--no-disk-write` 冲突、答题线程/面板宽度/清理重试范围、内联 JSON 的范围/枚举/类型、`--delete-config` 与 `--config` 关联、归一化后的答题/自毁快捷键冲突、非法序号和以 `--` 开头的参数值。只导出已支持的普通启动、扫描、面板、答题、日志、诊断和普通数据生命周期参数；面板主题仍为预留接口。启动清理、内存执行、删除挂起和自毁控件显示“当前宿主不可执行”，即使从内联 JSON 或程序化方式请求也必须阻止导出。生成结果由宿主解析器回归校验。

常规路径扫描会检查桌面、OneDrive Desktop、Program Files、Program Files (x86)、AppData/ProgramData，以及所有可识别固定磁盘根目录；每个根目录只检查根目录自身和一级直接子目录。若常规扫描找到候选，默认不递归全盘。常规无候选时 `fallback-all` 才递归固定磁盘；`all` 直接全盘扫描。扫描结果会按模式写入数据目录的 `scan-cache.json`，缓存默认 5 分钟有效；命中前逐个检查文件仍存在且 PE 架构未变化，任何候选失效、缓存过期或解析失败都会自动实时重扫。`--no-scan-cache` 和 `--no-disk-write` 都完全禁止缓存读写。`--ui cli`、`--ui gui` 或 `--select-client` 会显示完整候选列表；`--select-client`/`--ui gui` 使用 Windows 原生选择窗口（支持手动浏览），即使扫描没有候选也可以手动浏览。终端提示则支持输入列表序号或带引号的手动 `CXExam.exe` 路径。`--ui auto` 优先使用配置中的客户端路径；没有配置路径时，交互终端提示选择，Windows 非交互环境显示原生选择窗口，quiet/client-first 模式则直接使用推荐候选。

#### 启动示例

以下保留完整目标设计，并提供多种本阶段可执行的普通启动示例。目标设计中的启动清理、内存执行和自毁参数当前均会明确报错；生成器不会为这些请求导出可运行命令。

**1. 绝对静默型**

最终目标设计（不可执行示例）：虽然原生原型现已内嵌资源，以下内存执行、启动清理和自毁仍未实现；Node 与原生入口都会明确拒绝，不会静默降级。

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
& ".\start-windows.cmd" `
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

**2. 友好交互型**

```powershell
& ".\start-windows.cmd" `
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
& ".\start-windows.cmd" `
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
& ".\start-windows.cmd" `
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
& ".\start-windows.cmd" --scan-mode common --list-clients --no-log --quiet
```

行为：只扫描常见路径（根目录和一级子目录），列出架构和路径后退出；不启动 CXExam。`--list-clients` 的候选列表不受 `--quiet` 抑制。

**6. 强制全盘扫描型**

```powershell
& ".\start-windows.cmd" --scan-mode all --list-clients --no-log
```

行为：跳过常规扫描限制，递归扫描所有固定磁盘；跳过系统目录和符号链接；只列出候选，不启动 CXExam。

**7. 配置文件型**

```powershell
& ".\start-windows.cmd" `
  --config "C:\Tools\chaoxing-plus.json" `
  --client-first `
  --panel `
  --answer-mode auto
```

**8. 内联 JSON 型**

```powershell
& ".\start-windows.cmd" `
  --options-json '{"scanMode":"fallback-all","clientFirst":true,"panel":true,"answerMode":"auto","answerThreads":4}'
```

其他常用组合：指定客户端和自定义数据目录：

```powershell
& ".\start-windows.cmd" `
  --client "D:\Exam\CXExam.exe" `
  --data-dir "D:\CXPlusData" `
  --panel `
  --panel-width 520 `
  --log
```

三份本地样本都使用同名 `CXExam.exe`，下面演示直接指定文件或安装目录的参数写法，**不代表已完成这三个版本的实际注入验收**。传入目录时，Node 宿主只检查目录根部和一级直接子目录中的 `CXExam.exe`，不会递归进入二级目录；这些是示例路径，不是用户本机安装路径：

```powershell
# 电子科技大学中山学院客户端
& ".\start-windows.cmd" --client "C:\ExamClients\电子科技大学中山学院 考试客户端_V4.1.4.25512(2023.06.09)" --inject-strategy hybrid

# 超星考试客户端 V4.3.0.4
& ".\start-windows.cmd" --client "C:\ExamClients\超星考试客户端_V4.3.0.4" --inject-strategy script --inject-retries 3

# 河南应用技术职业学院客户端
& ".\start-windows.cmd" --client "C:\ExamClients\河南应用技术职业学院 考试客户端_V4.1.4.25512(2023.06.09)" --inject-strategy runtime
```

路径必须最终解析为文件名为 `CXExam.exe` 的有效 PE；宿主会读取 PE machine，校验 x86/x64 兼容性，并只连接本次启动客户端声明的本机 CDP 端口。`hybrid` 在直接执行业务源码失败后尝试 DOM script；严格 CSP 可能阻止 DOM script，此时按策略回退 runtime。两条路径都依赖 CDP `Runtime.evaluate`，不能解决目标完全不支持该命令的问题。这些策略都是页面内 CDP 注入，不是任意进程的 DLL 注入。

数据生命周期示例（普通退出时清理本轮登记的宿主产物，并删除显式指定的外部配置）：

```powershell
& ".\start-windows.cmd" `
  --config "C:\Tools\chaoxing-plus.json" `
  --no-retain-data `
  --delete-config
```

以上标明可执行的示例全部使用普通运行，不启用启动清理、内存执行、删除挂起或自毁。手动答题使用快捷键，自动模式按默认业务流程处理题目。`--no-disk-write` 关闭宿主日志、配置持久化、诊断、报告以及本项目业务 store 的本地持久化；CXExam 自身或其它页面脚本仍可能写盘。`--no-retain-data` 仅在普通退出时清理本轮登记产物，`--delete-config` 只删除显式 `--config` 指定的文件，两者都不等于启动清理或自毁。参数错误、环境检查或权限提示仍可能输出。

Windows 端与 Chrome 扩展的差异：

- **面板只在考试/答题相关页面出现**：登录页（passport2）、考试登录跳转（cflogin）、课程/学习页等不再创建面板，避免跨页面跳转时面板反复消失/出现。匹配路径：`/exam-ans/`、`/exam/test/`、`/mooc2/exam`、`/reVersionTestStartNew`、`/examcode/`。
- **面板默认折叠，且只保留考试答题功能**：Windows 宿主注入的 bootstrap 会设置 `window.__CX_WIN_HOST__`，业务侧据此：
  - 把「超星学习助手」面板初始化为折叠状态（只显示标题条，点击标题条展开/折叠）；
  - 裁剪掉学习相关功能：媒体控制、学习流程、任务能力、完成后动作、日志窗口、题库缓存列表区块；
  - 保留：答题结果与题目详情、重答本题、暂停/继续答题、自动答题、AI 兜底搜题及失败行为、考试自动交卷、本地题库缓存开关、题库配置（baseurl/令牌）、AI 搜题设置组。
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

node windows/host/main.mjs --capabilities
node windows/host/main.mjs --self-check
git diff --check
```

原生原型的编译验证另行执行，不能用 Node 测试代替。需先具备 MSVC x86 工具链、Windows SDK 和已构建的 `dist-windows` 资源：

```powershell
npm run build:windows
powershell -NoProfile -ExecutionPolicy Bypass -File .\windows\native\build.ps1 -BuildTests

$env:CX_NATIVE_HOST_EXE = (Resolve-Path '.\windows\native\.tmp-native-host\bin\chaoxing_plus.exe').Path
$env:CX_NATIVE_INJECTION_EXE = (Resolve-Path '.\windows\native\.tmp-native-host\bin\injection-tests.exe').Path
$env:CX_NATIVE_ASSETS_EXE = (Resolve-Path '.\windows\native\.tmp-native-host\bin\assets-tests.exe').Path
$env:CX_NATIVE_OPTIONS_EXE = (Resolve-Path '.\windows\native\.tmp-native-host\bin\options-tests.exe').Path
$env:CX_NATIVE_SESSION_EXE = (Resolve-Path '.\windows\native\.tmp-native-host\bin\session-tests.exe').Path
$env:CX_NATIVE_SELECTION_EXE = (Resolve-Path '.\windows\native\.tmp-native-host\bin\selection-tests.exe').Path
$env:CX_NATIVE_TRANSPORT_EXE = (Resolve-Path '.\windows\native\.tmp-native-host\bin\transport-tests.exe').Path
$env:CX_NATIVE_AUDIT_EXE = (Resolve-Path '.\windows\native\.tmp-native-host\bin\audit-tests.exe').Path
$env:CX_NATIVE_CONFIG_EXE = (Resolve-Path '.\windows\native\.tmp-native-host\bin\config-store-tests.exe').Path
try {
  node --test scripts/windows-native-host.test.mjs scripts/windows-native-assets.test.mjs scripts/windows-native-options.test.mjs scripts/windows-native-session.test.mjs scripts/windows-native-selection.test.mjs scripts/windows-native-transport.test.mjs scripts/windows-native-audit.test.mjs scripts/windows-native-config.test.mjs
  node --test scripts/windows-native-injection.browser.mjs scripts/windows-native-assets.browser.mjs scripts/windows-native-lifecycle.browser.mjs scripts/windows-native-audit.browser.mjs scripts/windows-native-config.browser.mjs
} finally {
  Remove-Item Env:CX_NATIVE_HOST_EXE, Env:CX_NATIVE_INJECTION_EXE, Env:CX_NATIVE_ASSETS_EXE, Env:CX_NATIVE_OPTIONS_EXE, Env:CX_NATIVE_SESSION_EXE, Env:CX_NATIVE_SELECTION_EXE, Env:CX_NATIVE_TRANSPORT_EXE, Env:CX_NATIVE_AUDIT_EXE, Env:CX_NATIVE_CONFIG_EXE -ErrorAction SilentlyContinue
}
```

`-BuildTests` 编译实际原生宿主注入代码与确定性 mock CDP 传输，输出 `injection-tests.exe`，同时生成 `assets-tests.exe`、`options-tests.exe`、`json-tests.exe`、`session-tests.exe`、`selection-tests.exe`、`transport-tests.exe`、`audit-tests.exe` 和 `config-store-tests.exe`。`CX_NATIVE_INJECTION_EXE` 启用策略顺序、重试上限、CDP 请求 ID 及执行确认测试；`CX_NATIVE_ASSETS_EXE` 启用资源字节校验；`CX_NATIVE_OPTIONS_EXE` 启用实际 C 参数回归；`CX_NATIVE_SESSION_EXE` 检查导航、iframe、取消代次、配置任务和启用恢复；`CX_NATIVE_SELECTION_EXE` 构建真实 Win32 隐藏控件；`CX_NATIVE_TRANSPORT_EXE` 检查分段 WebSocket 消息、零超时和控制帧截止时间；`CX_NATIVE_AUDIT_EXE` 检查真实日志/报告文件、中文路径、quiet/noDiskWrite、UTF-8/JSON 转义和文件失败降级；`CX_NATIVE_CONFIG_EXE` 检查共享键解码去重、容量边界、真实文件 patch、原文件保留和自有临时文件清理。未设置对应变量时会显示跳过，不能称为已完成编译验证。`json-tests.exe` 可直接执行验证 JSON 解析。`CX_NATIVE_HOST_EXE` 用于原生 CLI、现代 Chromium 生命周期、审计及配置回归，`--capabilities` 校验内嵌资源并报告 `embeddedResources:true`、资源数量以及 `configReload:true`/`configPersistence:true`/`fileLogging:true`/`runReport:true`。`build/pe-imports.txt` 是导入表审计记录；这些测试仍不等同于真实客户端验收。

2026-10-28 本轮验证记录：显式展开 55 个 `scripts/*.test.mjs`，560/560 通过、0 跳过；原有 6 个浏览器回归文件共 50/50 通过，新增原生配置浏览器回归 8/8 通过，合计 58 项。类型检查、扩展构建、Chrome75 构建、原生 `-BuildTests` 均退出 0；Node 宿主 self-check 为 0 失败、0 警告。本轮原生 EXE 为 498176 字节，导入表仅含 Windows 系统 DLL。编译后的故障回归先失败、修复后通过，覆盖写盘失败期间不丢失更新的内存配置；浏览器回归覆盖新宿主接管旧文档，以及默认/显式配置文件删除后的不同恢复行为。自有宿主、浏览器和监听端口已关闭。以上为本地驱动、mock CDP 与现代 Chromium 自动化证据，尚未执行真实 CEF75 客户端登录后验证；后续执行时应重新展开测试文件并报告当次实际数量。

原生 Win32 选择窗口的实际显示与自动选择冒烟需单独启用，整个过程中不会启动考试客户端：

```powershell
$env:CX_NATIVE_SELECTION_EXE = (Resolve-Path '.\windows\native\.tmp-native-host\bin\selection-tests.exe').Path
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
- `windows-config-reload.test.mjs`：共享设置逐层保留、配置文件实际监控、CLI/内联覆盖、异步解析失败和关闭后的迟到结果；宿主集成热更新由 `windows-host.test.mjs` 覆盖。
- `windows-injection-lifecycle.test.mjs`：并发注入合并、上下文销毁、关闭后停止重试、CDP 断线关闭会话、新文档注册被拒绝后继续实际上下文注入、首次漏报上下文的定时补注入，以及注册期间关闭只取消不误报降级。
- `windows-injection.browser.mjs`：真实 Chromium CDP 下 runtime/script/hybrid、CSP 回退、注入重试、导航、移除 iframe、断线重连恢复及会话资源释放；使用自动化测试页面，不代表真实 CEF 75 考试页面验收。
- `windows-client-process.test.mjs`：本次宿主客户端子进程的退出/启动错误事件只处理一次，取消观察和已结束进程边界。
- `windows-parameter-generator.test.mjs`：离线生成器加载、普通预设输出可被宿主解析器重新解析、实时校验（互斥、no-disk-write、线程/面板宽度/清理重试、内联 JSON、自毁快捷键冲突）与禁用能力阻止导出；`startupClean` 只展示设计说明且不生成命令或 JSON。
- `windows-native-host.test.mjs`：原生源码边界与构建选项；设置 `CX_NATIVE_HOST_EXE` 后执行 CLI 回归，设置 `CX_NATIVE_INJECTION_EXE` 后执行已编译的实际注入逻辑测试。内部清理器或状态机测试仅证明模块行为，不表示 Node 或原生入口支持启动清理、自毁。
- `windows-native-assets.test.mjs`：仅复制 EXE/driver 到中文空格目录，逐项比对宿主与 driver 内嵌资源的长度/SHA256，并覆盖外部资源缺失、空文件、超限及禁止落盘解包。
- `windows-native-options.test.mjs`：实际 C 参数测试，覆盖扫描别名和 CLI/JSON 的客户端选择优先级。
- `windows-native-session.test.mjs`：实际 C 会话状态机，覆盖导航和 frame 子树销毁、就绪通知期间不重入、URL 过滤、顶层兜底及容量边界；不以模型通过代替宿主适配器验证。
- `windows-native-selection.test.mjs`：实际 C Win32 控件探针、推荐项与 Unicode 标题；`CX_TEST_NATIVE_WINDOW=1` 时显示窗口并测试自动取消、选中有效 Unicode 路径，均不启动客户端。
- `windows-native-transport.test.mjs`：无 CRT 的传输接口及实际 WebSocket 分段读、零超时、连续控制帧总截止时间回归。
- `windows-native-audit.test.mjs`：`CX_NATIVE_AUDIT_EXE` 驱动实际目录与文件，覆盖中文空格/相对路径、日志防覆盖、UTC UTF-8、quiet/no-log/noDiskWrite、报告 JSON 转义及生成失败保留旧报告、日志真实文件锁写失败后关闭句柄。
- `windows-native-config.test.mjs`：`CX_NATIVE_CONFIG_EXE` 驱动实际 C 配置模块，覆盖解码键规范化、重复合并不膨胀、共享白名单、未知顶层字段保留、中文/空格/相对路径、原文件无效或替换失败时保留原文，以及仅清理自有临时文件。
- `windows-native-injection.browser.mjs` / `windows-native-assets.browser.mjs`：真实 Chromium 执行实际 C 生成的表达式，验证 CSP/异常/语法错误/无挂载节点以及顶层 Swal CSS 安装；不代表 CEF75 登录后页面验收。
- `windows-native-lifecycle.browser.mjs`：已编译原生宿主通过真实 WebSocket 连接现代 Chromium，覆盖三种策略、导航后每文档只执行一次、延迟 about:blank iframe、新 page target、CSP 回退、空白 iframe 开关、非超星页面限制、Browser 不匹配拒绝、断线去重及 console 历史清除后的 iframe 恢复；还覆盖 `--duration` 关闭会话但保留 attach 浏览器。不代表真实 CEF75 人工登录验收。
- `windows-native-audit.browser.mjs`：`CX_NATIVE_HOST_EXE` 驱动现代 Chromium 模拟页面，验证实际日志/报告落盘、quiet/no-log/no-disk-write/no-capture-console、页面异常与 bootstrap 控制事件脱敏、重连累计与停止时存活上下文统计、正常取消不误计错误；不代表真实 CEF75 登录后页面验收。
- `windows-native-config.browser.mjs`：`CX_NATIVE_HOST_EXE` 驱动现代 Chromium 模拟页面，覆盖 EXE 同级/显式配置文件回写、热更新及删除恢复、新宿主接管旧文档、来源/实例/上下文校验、CLI/内联覆盖、大 UTF-8 配置、无效更新事务拒绝、完整快照删除及重加、跨 origin iframe/新文档/新 target/重连、无写盘锁定；不代表真实 CEF75 登录后页面验收。
- `windows-selection-window.test.mjs`：原生选择窗口脚本纯 ASCII 约束、结果合约（选中/取消/自动关闭/错误）、PowerShell 进程参数与 UTF-8 JSON 载荷、WinForms 控件构建探针；`CX_TEST_NATIVE_WINDOW=1` 时额外验证真实窗口显示与宿主 `--ui gui`/`--select-client` 接线（自动关闭）。
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
node windows\host\main.mjs --attach 9333 --duration 5000 --report windows\data\smoke-report.json
```

`about:blank` 只能用于连接和 bootstrap 冒烟，不保证业务 bundle 被注入，也不会显示悬浮面板。需要验证业务注入与面板时，使用本地模拟考试页，并通过 `--host-resolver-rules` 将 `mooc1.chaoxing.com` 映射到该测试页；现成自动化入口是 `scripts/windows-injection.browser.mjs`。在匹配超星考试路径的模拟页上，预期报告为 `totals.bootstraps ≥ 1`、`totals.bundles ≥ 1`、`errors = 0`，且页面标记 `window.__CX_WIN_HOST__`、`window.__CX_WIN_BUNDLE_LOADED__` 为真。这属于实际 Chromium 对模拟页面的验证，仍未验收真实 CEF75 客户端。

### 真实考试客户端验证（需人工）

1. 关闭所有正在运行的 `CXExam.exe`（宿主也会拒绝启动）。
2. 建议先把客户端复制到独立测试目录，并把 `clientPath` 指向副本。
3. 运行 `start-windows.cmd`，UAC 选择“是”。
4. 等待日志出现 `调试端点可用：Chrome/75.0.3770.100` 与 `[inject] 已注入业务 bundle`。
5. 在客户端内登录并打开**考试列表/答题相关页面**（如考试列表页，不要进入真实考试），确认右上角出现「超星学习助手」折叠标题条，点击标题条展开后只包含考试答题相关功能（答题结果、题库配置、考试设置）。
6. 按设计，课程/学习页等非考试页面不再显示面板；如在这些页面看到面板请检查 URL 是否被误判为考试页面。
7. 如需回归，记录 `windows/data/last-report.json` 与 `windows/data/logs/` 下日志。
8. ⚠️ 不要在实际考试中首次验证；先在考试列表页确认面板与设置可用。

## Chrome 75 兼容策略

- 业务主包由 Vite/Rolldown 以 `target: chrome75` 构建，内置依赖（含 SweetAlert2）一并转译。
- **内置 handler 字符串**用 `Function(...)` 运行期求值，不经过构建转译：`src/projects/tiku-adapter-config.ts` 中的 handler 必须保持 ES2019 语法（禁止 `?.`/`??` 等），由 `windows-chrome75.test.mjs` 强制校验。
- 页面侧补齐：`Element.prototype.replaceChildren`、`Promise.allSettled`、`crypto.randomUUID`。
- 不透明 origin 的 frame（about:blank/srcdoc）中 `localStorage` 访问会抛错，`src/runtime/store.ts` 已做安全兜底（内存值 + 属性镜像）。
- 内核 UA 是客户端自定义字符串（无 `Chrome/75` 字样），业务代码不得用 UA 判断内核。

## 渲染诊断与“悬浮窗附近模糊”排查

启动模式默认开启渲染诊断（`--no-diagnose` 可关闭）。每次运行会写入：

```text
windows/data/diagnostics/<时间戳>/
  render-diagnostics.json        # 系统 DPI、窗口 DPI 感知、窗口/进程命令行、页面采样、结论
  render-diagnostics-page.png    # CDP 页面截图（页面自身渲染，含面板）
  render-diagnostics-window.png  # 客户端窗口的屏幕截图（含 Windows DPI 缩放效果）
```

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

1. 如果是 DPI 不一致（125%/150% 缩放 + 客户端 DPI-unaware）：用 `start-windows.cmd --dpi-aware` 启动一次，或在 `windows/data/config.json` 设置 `"dpiAwareness": "system"`。宿主会临时写入 `HKCU\...\AppCompatFlags\Layers` 的 `~ HIGHDPIAWARE`（等价于“属性 → 兼容性 → 替代高 DPI 缩放行为：应用程序”），进程启动后立即恢复原值，不持久改系统设置。
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
| `启动客户端需要管理员权限` | 用 `start-windows.cmd`（会自动 UAC），或右键“以管理员身份运行”终端后执行 `npm run windows` |
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

- 调试端口只绑定 `127.0.0.1`；宿主只连接自己启动的客户端（监听 PID 校验）。
- 已有 `CXExam.exe` 时拒绝启动，避免连接真实考试会话。
- 日志/报告不记录 URL 查询参数、Cookie、答案或账号数据；客户端目录的 `debug.log` 仍可能含页面信息，不要外发。
- 本项目仅用于本机技术研究与自有账号环境；请勿在正式考试中使用。
