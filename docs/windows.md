# Windows 端（超星考试客户端 / CEF 75）使用与设计

本仓库除 Chrome 扩展外，新增了一套 **Windows 宿主**：它用官方 CEF 远程调试参数启动超星考试客户端，并通过 CDP（Chrome DevTools Protocol）把扩展的业务 bundle 注入到客户端网页主世界。

## 状态与适用对象

| 项 | 状态 |
| --- | --- |
| 目标客户端 | 电子科技大学中山学院 考试客户端 V4.1.4.25512（x86，CEF 75.1.4 / Chromium 75.0.3770.100） |
| 注入方式 | `--remote-debugging-port` + 本地 CDP（仅 127.0.0.1） |
| 宿主运行时 | Node.js ≥ 22（使用内置 `fetch` / `WebSocket`，不新增依赖） |
| 自动化验证 | mock CDP 回归、真实 Chromium（非 CEF75）端到端冒烟、Chrome75 语法闸门、类型检查与扩展全量测试 |
| 真实考试客户端整体验证 | **需人工按下方步骤执行一次**（启动需要 UAC，且需要在客户端里登录后观察） |

> 前置结论来自临时注入探针的实测：真实客户端 `CDP_CONFIRMED`、7 个页面上下文注入成功、`/json/version = Chrome/75.0.3770.100`。本 Windows 端的宿主与页面 bootstrap 按同一协议实现。

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
- `windows/host/trampoline.js`：新文档启动探针（`Runtime.addScriptToEvaluateOnNewDocument`），只负责通知宿主“这里有新文档”，covering 真实客户端上出现过的“文档已导航但没收到 executionContextCreated”的时序。
- 业务 bundle：`dist-windows/chaoxing-plus.windows.js`，即把现有 `src/index.ts` 以 `target: chrome75` 重新构建（内置 SweetAlert2 一并转译、页面样式由宿主注入）。

## 目录

```text
windows/
  config.example.json          配置模板（不含任何真实路径/密钥）
  bootstrap/windows-bootstrap.js  页面侧平台层（无 chrome.*）
  host/main.mjs                宿主入口（启动、CDP、注入、配置、报告）
  host/cdp.mjs                 最小 CDP 客户端（fetch + 内置 WebSocket）
  host/inject.mjs              每个页面 target 的会话与注入生命周期
  host/launch.mjs              提权、端口、PE、进程、监听归属
  host/config.mjs              配置持久化、共享键过滤、广播
  host/chrome75-syntax.mjs     Chrome75 语法闸门（构建与测试共用）
  host/trampoline.js           新文档探针
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

3. 首次运行会自动创建 `windows/data/config.json`（从模板复制）。未设置 `clientPath` 时，启动会扫描桌面、Program Files、AppData/ProgramData 与各盘根目录并递归查找；默认选第一个 x86 客户端。也可交互选客户端或直接指定路径：

   ```json
   { "clientPath": "D:\\考试客户端\\CXExam.exe", "port": 0, "settings": { "common.settings.extension-enabled": true } }
   ```

   > 首次验证建议指向客户端目录的**测试副本**；与真实账号环境隔离。

   常用启动参数（`start-windows.cmd` 会透传参数）：

   ```powershell
   .\start-windows.cmd --list-clients
   .\start-windows.cmd --select-client
   .\start-windows.cmd --client-index 2 --panel --panel-expanded --panel-top 24 --panel-right 24 --panel-width 520
   .\start-windows.cmd --client "D:\\Exam\\CXExam.exe" --answer-mode manual --answer-key Ctrl+Shift+A --answer-threads 1 --hide-answer-dialog --no-log
   ```

   `--client-index` 从扫描列表的 1 开始；`--answer-threads` 限制为 1-4。手动模式按组合键后放行对应数量的题目搜题/作答；不会自动保存或提交。自动模式按原流程运行。

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
| `clientPath` | 客户端 `CXExam.exe` 绝对路径（必填） |
| `port` | `0` = 自动选择可绑定端口；固定端口不可绑定时宿主会报错，不会静默换端口 |
| `expectedBrowser` | `/json/version` 的 Browser 必须包含的字符串，默认 `Chrome/`，用于避免误连其它浏览器 |
| `stopClientOnExit` | 宿主退出时是否结束本次启动的客户端进程树 |
| `injectBlankFrames` | 是否向 about:blank/srcdoc 等不透明 origin 的 frame 注入（考试页面常用 document.write 生成题目 iframe，默认 true） |
| `captureConsole` | 是否把页面异常/日志转发到宿主日志 |
| `dpiAwareness` | `""`（默认）/`"system"`；`system` 会在启动客户端时临时加 Windows `HIGHDPIAWARE` 兼容层（启动后立即恢复注册表原值），用于修复系统缩放 125%/150% 下整个客户端窗口被位图缩放导致的模糊 |
| `settings` | 共享配置快照（`common.settings.*`、`cx.new.*` 等），会被水合到所有 frame；面板里修改的设置也会回写到这里 |

支持的启动参数还包括 `--panel/--no-panel`、`--panel-collapsed/--panel-expanded`、`--panel-top`、`--panel-right`、`--panel-width`、`--answer-mode auto|manual`、`--answer-key`、`--show-answer-dialog/--hide-answer-dialog`、`--answer-threads`、`--log/--no-log`。`--execution-mode` 仅接受 `normal`；内存执行、删除挂起及快捷键/全屏自毁参数会被拒绝。

已知限制：Windows 端没有扩展 popup，目前通过编辑 `config.json` 或在页面内面板修改设置；`common.settings.extension-enabled=false` 时不会注入业务 bundle。

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
node --test scripts/windows-host.test.mjs scripts/windows-bootstrap.test.mjs scripts/windows-chrome75.test.mjs scripts/windows-store-safety.test.mjs
node windows/host/main.mjs --self-check
```

覆盖内容：

- `windows-host.test.mjs`：配置持久化/共享键过滤、PE 解析、端口选择、CDP 客户端；**mock CDP 服务器**下完整跑通 `bootstrap -> bundle -> 配置回写`。
- `windows-bootstrap.test.mjs`：共享配置水合、DOMContentLoaded 延迟、`replaceChildren`/`randomUUID` 补丁、总开关、配置同步、重复注入去重。
- `windows-chrome75.test.mjs`：构建产物与内置 handler 字符串必须通过 Chrome75 语法闸门（`?.`/`??`/逻辑赋值/私有成员/静态块均不允许）。
- `windows-store-safety.test.mjs`：不透明 origin（about:blank）下 `localStorage` 抛 `SecurityError` 时业务 store 不崩溃。

`npm run build:windows` 本身也带语法闸门，失败会中止构建。

### 真实 Chromium 冒烟（本机无 UAC，可复现）

宿主支持测试专用的 `--attach` 模式（只连接已存在的调试端口，不启动客户端、不校验归属）。可用任意 Chromium 浏览器验证注入链路：

```powershell
# 终端 1：启动带远程调试的 Chromium（示例 Chrome）
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --remote-debugging-port=9333 --remote-allow-origins=* --user-data-dir="$env:TEMP\cxplus-smoke" about:blank

# 终端 2：让宿主附着并注入
node windows\host\main.mjs --attach 9333 --duration 5000 --report windows\data\smoke-report.json
```

预期报告：`totals.bootstraps ≥ 1`、`totals.bundles ≥ 1`、`errors = 0`；页面内 `window.__CX_WIN_HOST__`、`window.__CX_WIN_BUNDLE_LOADED__` 为真。注意：about:blank 与普通页面按设计**不会**出现悬浮面板，只有考试相关路径才会挂载折叠标题条；需要验证面板可把 `about:blank` 换成考试路径（或用 `--host-resolver-rules` 把 `mooc1.chaoxing.com` 映射到本地测试页）。

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
