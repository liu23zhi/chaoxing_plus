# Agent Instructions

## 开工前必须汇报

- 每次新任务开始时，先汇报：当前分支、工作区状态（`git status --short --branch`）、以及本轮之前已执行的修改。
- 未完成汇报前，不得继续修改、合并或执行其他高风险 Git 操作。
- 不要上来就合并；先检查并汇报分支关系、冲突风险与功能影响，等待明确确认。

## 禁止擅自提交

- **未获得明确确认前，不要 `commit` / `push` / `merge` / `rebase`**。
- 改完只汇报改动与验证结果，把提交决定交回用户。

## 文档维护

- 必要时同步更新本文件：新增长期约定、发现重复故障的根因或验证命令变化时，记录适用范围与可执行要求，保留仍然有效的规则。
- 未完成的修复、临时调试结果与未经验证的推测不要写成既定事实。

## 验证纪律

- 改了代码就要**实际运行**验证，并把原始输出贴出来，不要只描述"应该没问题"：
  - 全量测试：`node --test scripts/*.test.mjs`
  - 类型检查：`node node_modules/typescript/bin/tsc --noEmit`
- `scripts/*.test.mjs` 通配必须确实展开；新增或删除测试后按实际文件列表核对，不要把数量写死在执行脚本中。只跑单个文件不能代表全量通过。
- PowerShell 可显式展开后执行：`$testFiles = @(Get-ChildItem -LiteralPath scripts -Filter '*.test.mjs' -File | Sort-Object Name | Select-Object -ExpandProperty FullName); $testFiles.Count; node --test @testFiles`。
- 测试数量对不上时，先确认通配展开、再确认是否漏跑——不要凭"看起来都过了"下结论。
- 修改运行时代码或扩展入口后，还要运行 `npm run build`；浏览器弹窗、iframe 与层级问题必须做实际浏览器回归，不能只靠源码字符串断言。
- 项目类型检查使用 TypeScript 7；测试脚本若需 `transpileModule`，从 `@typescript/typescript6` 导入。测试中的单文件 CommonJS 编译统一经 `scripts/test-helpers/tsc-compat.mjs`，不得直接调用 TypeScript 7 CLI（它不提供旧 API，也不支持原有的 `moduleResolution=node` 参数）。
- 汇报命令、退出码和原始结果摘要；明确区分自动化模拟页面验证与真实超星课程页面验证，未做真实课程验证时如实说明。
- `dist/` 是构建产物且已被 `.gitignore` 忽略，**不要手工改 `dist/`**。
- `.tmp-tests*` 目录由测试自行重建，已在 `.gitignore` 内。

## Swal 弹窗与 iframe

- 弹窗统一通过 `src/runtime/message.ts` 的 `$modal` 调用，保留统一的样式、层级和 Promise 结果处理。
- iframe 内的 `z-index` 无法让弹窗覆盖父页面；必须核对弹窗实际所属的 `ownerDocument`，保证由顶层窗口的 Swal 运行时在顶层文档创建弹窗。
- Swal 运行时可能是带 `fire` 方法的函数，不能仅用 `typeof value === 'object'` 判断是否就绪。
- 顶层 Swal 异步初始化时不能立即退回子 iframe；同源页面应复用顶层运行时，跨源页面应通过受校验的消息桥转交顶层处理。
- 跨源消息必须校验来源、消息种类和请求标识；握手等待应有上限，顶层确认接管后不得因用户长时间未操作而触发第二个本地弹窗。确认、取消、拒绝与定时关闭结果必须回传给原调用方。
- 保持扩展主脚本启动不依赖外部 Swal 脚本加载完成，避免阻塞学习流程。
- “全部任务点已完成！”必须使用成功弹窗并显示“知道了”按钮，无自动关闭计时器，禁止点击遮罩或按 Escape 关闭。
- 回归至少覆盖：同源多层 iframe、跨源 iframe、顶层运行时延迟就绪、顶层页面未安装运行时的有限降级、弹窗高于浮动面板、按钮操作与返回值；模拟浏览器结果不能宣称为真实课程验证。

## Product Branding

- The user-visible product name is `超星学习助手`.
- Update every user-visible title when branding changes, including popup document titles, popup headings, floating panel headers, debug/log panel titles, dialog titles, and documentation headings.
- Do not leave legacy visible labels such as `Chaoxing Plus`, `ChaoXing Plus`, or `Pink Console` in UI titles.
- Internal identifiers are not visible titles and may retain their existing names unless explicitly requested: script filenames, storage keys, dataset keys, CSS selectors, and diagnostic log prefixes such as `[Chaoxing Plus]`.
- Before completing a branding change, search case-insensitively for legacy names and related visible-title strings, then update or add focused tests so the old visible title cannot return.

---

## tikuAdapter 对接须知

服务端仓库在 `..\tikuAdapter`（**独立仓库**）。
下面的约定来自真实故障复盘，改动对接代码前先读完。
不能暴露真实路径

### 请求契约（`src/projects/tiku-adapter-config.ts`）

- **普通搜题保留 7 个兼容字段**：`qid` / `question` / `options` / `type` / `courseName` / `extra` / `skipCache`。
  开启深度思考时，异步和旧同步普通搜题均额外传 `deepThinking: true`；关闭时省略该字段。
  `plat` **已彻底移除**（服务端把它删了：该字段所有调用方恒为 `-1`、没有区分度）。
  不要因为看到历史文档或旧日志里有 `plat: -1` 就加回去。
- 鉴权用 `Authorization: Bearer <key>`（`createTikuAdapterAuthorizationHeader`），密钥不拼进 URL。
- 端点由 `createTikuAdapterSearchUrl` / `createTikuAdapterSearchTaskUrl` /
  `createTikuAdapterSearchStatusUrl` / `createTikuAdapterSearchHealthUrl` /
  `createTikuAdapterAIFallbackUrl` / `createTikuAdapterAIFallbackTaskUrl` /
  `createTikuAdapterAIFallbackStatusUrl` 统一生成，
  不要手写路径字符串。
- `qid` 为空字符串；`courseName` / `extra` 为空字符串。

### 题型映射：不要用"猜"的

`data.type` 的映射是：

| chaoxing 题型                        | tikuAdapter type |
| ------------------------------------ | ---------------- |
| `single`                           | 0                |
| `multiple`                         | 1                |
| `judgement`                        | 3                |
| `completion` / `fill` / `line` | 2                |
| 其它（含`reader`、`unknown`）    | **4**      |

注意最后一行是**兜底**：识别不出的题型会落到 4（简答/阅读理解），不会被丢弃。
服务端按 `type` 决定答案判定方式，因此**类型传错会直接导致答案错乱**（例如把 `type=3` 当 `type=0`）。

### `skipCache` 语义

handler 返回 `boolean | undefined`：`true` 跳过、`false` 与 `undefined` 都正常使用缓存。

- 它同时作用于**两层缓存**：client 本地的 `searchAnswerInCaches`，以及服务端的结果缓存。
- 只有已拿到答案却未完成答题、需要换一个答案时才传 `true`；手动单题重答也按上次结果判断。
  网络超时、`Failed to fetch`、状态查询失败及无答案后的重试保持缓存与服务端并发合并可用，
  否则前次任务仍在运行时可能再次请求上游并重复计费。
- 搜题错误（包括超时、网络或接口异常）和无答案结果都不能进入本地 `answerCache`；
  读取时发现旧错误或空答案缓存也要删除。两者仍要分别作为接口失败和正常无答案处理。
- 本地答案缓存按普通搜题 / 深度思考分区；旧持久化条目没有模式标记时归普通搜题。
  深度思考只绕开普通缓存，不自行设置 `skipCache`；服务端缓存仍按请求字段的原有语义使用。
- 不要用 `Boolean(x)` 把 `undefined` 压成 `false` 再判断——那会让"没有意见"和"明确要用缓存"混为一谈。

### 服务端缓存会改变"重复请求"的观察结果

服务端按 `用户 + 题面 + 选项 + 题型 + 深度思考模式 + 渠道` 缓存 10 分钟，且**命中不再计费**。因此：

- 同一用户重复问**完全相同**的题目会命中缓存，上游调用次数为 0，
  这与"客户端每次都发请求"并不矛盾。
- **选项或题面有任何差异**（哪怕只多一条噪音）都会导致缓存不命中、重新计费。
  写测试时若复用同一道题，要意识到这会互相影响。

### AI 兜底

- 默认走**异步任务**（`preferAsyncTask: true`）：`POST /ai-fallback/tasks` → 轮询
  `GET /ai-fallback/status?taskId=`（间隔 2500ms）。异步任务端点报错时不得静默回退到
  同步 `POST /ai-fallback`；只有显式关闭异步任务时才使用同步端点。
- 普通异步搜题前每题执行 `/search/health`，并实际查询响应中的 `statusUrl`；只有健康
  探测失败或普通任务**创建**返回 404 才使用旧同步 `/search`。创建成功后的状态查询失败
  不得回退同步，仍由轮询层累计连续 3 次失败。健康探测 401/403 不回退同步。
- 普通和 AI 异步**创建**重试须复用同一 `Idempotency-Key` 与请求体；状态查询每轮只发
  一次，由轮询层独占重试计数。显式同步 AI 请求在无法确认幂等时不盲目重发。
- `src/core/utils/request.js` 是当前构建的实际运行路径；修改通用请求重试或超时逻辑时，
  同步维护 `request.ts` 和 `request.js`，并检查构建产物。超时必须中止在途 `fetch`。
  通用请求仅对 GET/HEAD 或带服务端幂等键的请求允许多次尝试；未知副作用的 POST
  即使配置了 `retry` 也只请求一次。
- **普通搜题与 AI 兜底的任务状态地址允许任意来源**：服务端返回绝对 `statusUrl` 时，客户端
  按该地址轮询并使用现有 Bearer 鉴权。不得擅自增加同源限制，也不要把跨来源状态地址列为安全问题；
  普通搜题与 AI 兜底的回归测试都应覆盖绝对跨来源地址。
- 超时常量：搜索 240s、兜底请求 180s、普通搜题及兜底各自轮询最长 600s。
- 错误码：`AI_UNAVAILABLE` / `NO_ANSWER` / `UPSTREAM_ERROR` / `INVALID_INPUT` /
  `UNSAFE_TO_ANSWER` / `INSUFFICIENT_BALANCE`。**区分它们**，不要统一提示"失败"。
- 服务端可能返回 `warnings`（例如"模型未配置价格"）：**只走管理员调试日志**，
  绝不进入面向用户的界面。

#### 兜底的历史坑：别再用 `question` 判空

服务端曾把非客观题（填空/连线/简答/阅读，type 2/4/-4）的自由文本答案误判为"未找到答案"
（`NO_ANSWER`），根因是它要求答案必须命中选项。现已修复，但这提醒我们：
**同一个问题走 `/search` 与走 `/ai-fallback` 的结果可能不同**，
排查时不要假设两条链路等价。

### 选项（`options`）污染

抓取页面选项时会把富文本编辑器（UEditor）与 jQuery 初始化源码一起带进来。
线上实测一次请求 **55 条 options 里绝大多数是 JS 源码**，后果是：
挤掉真实选项、让 AI 分心、单次响应被拖到 **36.9 秒**，进而触发客户端超时重发
——而超时重发会造成**同一道题被重复查询**。

因此 `data.options` 的 handler 会在提交前按行剔除代码噪音，规则见源码注释：

- 命中代码符号（`function foo(` / `=>` / `$(` / `.parent(` / `.removeClass(` / `.css(` /
  `UEDITOR_CONFIG` / `.edui-` / `addListener(` / `contentChange` 等）
- 以上述关键字开头（`var` / `let` / `const` / `if` / `else` / `window.` / `document.` /
  `editor1.` / `$.` / `//` / `/*` / `} else` / `.identifier(` 等）
- 纯符号行（不含任何字母或数字）
- 以 ASCII 分号 `;` 结尾的 JS 语句行

**关键安全网**：过滤后若一条不剩（整题选项恰好长得像代码），
必须**回退为原始列表**，绝不返回空数组。

⚠️ 已知的理论误删风险：以 `if `/`else ` 开头或以 `;` 结尾的**真实选项**会被判为噪音。
概率低且有回退兜底；若要收敛风险，可去掉这两条规则，但需同步更新测试。

### 测试注意事项

- `data` 里的 handler 是**字符串**，用 `Function(handler)()` 求值后才得到函数。
  写断言时不要直接 `Function(src)`（会拿到未转义的 TS 源码文本）。
- 编译产物在 `.tmp-tests-tiku-cjs/`；断言 handler 行为前确认它**不是陈旧产物**
  （对比产物与 `src/` 的修改时间，或看 handler 里是否含最新逻辑）。
- 新增过滤/映射规则时，至少覆盖：正常输入不误删、噪音被剔除、全噪音回退、空输入。

### 汇报口径

- 汇报"改了哪个仓库的哪些文件"。本项目与 `tikuAdapter` 是**两个独立仓库**，
  改这一个不要顺手改另一个。
- 汇报事实，不要把推测写成结论。例如"我没找到某文件的引用"应说成
  "在本仓库全量搜索无匹配"，而不是"该文件引用了不存在的 X"。

---

## Windows 端（CEF 75 / CDP 注入）

`windows/` 是超星考试客户端（CEF 75.1.4 / Chromium 75.0.3770.100）的宿主实现，设计说明见 `docs/windows.md`。

### 必须遵守的边界

- **Chrome 75 语法闸门**：`npm run build:windows` 会拒绝 `?.` / `??` / 逻辑赋值 / 私有类成员 / 静态块等语法。
  - 业务主包由构建按 `target: chrome75` 自动转译；`windows/bootstrap/windows-bootstrap.js`、`windows/host/trampoline.js` 必须手工保持 ES2019/ES5 可解析。
  - `src/projects/tiku-adapter-config.ts` 等**运行期 `Function(...)` 求值的 handler 字符串不会经过构建转译**，新增/修改 handler 时必须保持 ES2019 语法（禁止 `?.`、`??`）。
- `dist-windows/` 与 `windows/data/` 是构建产物/本机配置，均已 gitignore；不要手工修改或提交。
- 宿主只连接自己启动、且监听 PID 校验通过的本机客户端；不要加入“自动连接任意端口/进程”的默认行为。`--attach` 仅供测试/调试。
- 页面配置通道只允许共享键（`common.settings.*`、`cx.new.*` 等，见 `windows/host/config.mjs`）；不要把逐题缓存写进宿主配置。
- 页面侧在 about:blank/srcdoc 等不透明 origin 中访问 `localStorage` 会抛 `SecurityError`，业务 runtime store 必须保持容错（已有 `windows-store-safety` 测试）。
- **Node 宿主的客户端选择窗口**（`--ui gui` / `--select-client`）：由 `windows/host/selection-window.ps1`（Windows PowerShell 5.1+ WinForms，不新增 npm 依赖）实现，Node 封装在 `windows/host/selection-window.mjs`。
  - `.ps1` 必须保持**纯 ASCII**：Windows PowerShell 5.1 对无 BOM 的 `.ps1` 按 ANSI/OEM 解码，中文字面量会让整段脚本语法错误；所有界面文案一律经 Node 写入的 UTF-8 JSON 传入（已在 `windows-selection-window.test.mjs` 断言）。
  - 窗口结果合约：输出文件 JSON `{path,cancelled,error}`；`--self-check` 只构建控件（`-Probe`，不显示窗口）；`--ui gui` 在非 Windows/窗口不可用时必须显式报错，不得静默降级。
  - 自动化验证：`node --test scripts/windows-selection-window.test.mjs`（含 WinForms 控件探针）；真实窗口冒烟用 `CX_TEST_NATIVE_WINDOW=1`，并依赖 `CXPLUS_SELECTION_AUTO_CLOSE_MS` 自动关闭，禁止在自动化中阻塞等待人工点击。
- **原生 EXE 的客户端选择窗口**：由 `windows/native/selection.c` 使用 Win32 控件和 `GetOpenFileNameW` 实现，不依赖 Node、PowerShell、WinForms 或 CRT。保留序号、架构、版本、完整路径和推荐项；无候选仍可浏览；选中路径必须重新校验有效 PE 和系统架构，取消不得启动客户端。编译 `selection-tests.exe` 后设置 `CX_NATIVE_SELECTION_EXE` 运行 `scripts/windows-native-selection.test.mjs`；隐藏控件探针无需显示窗口，真实显示/取消/选择冒烟需显式设置 `CX_TEST_NATIVE_WINDOW=1`，自动取消变量为 `CXPLUS_NATIVE_SELECTION_AUTO_CLOSE_MS`。测试不得执行所选客户端。
- **Node 参数生成器的进程参数传递**：Windows PowerShell 5.1 的普通原生命令调用及 `start-windows.cmd` 的 `%*` 转交都可能丢失内联 JSON 双引号。生成器使用 `ProcessStartInfo`、`UseShellExecute=false` 和逐项 Win32 参数引用，直接启动 Node，并显式设置项目工作目录；不要改回批处理转交。修改命令生成时必须实际执行 PowerShell 5.1/7 输出，检查 JSON、中文、引号、尾反斜杠与 shell 字符逐项保真，测试以 `--help` 停止，不得启动考试客户端。
- Node 的标准 UAC 重启同样须将逐项 Win32 引用后的完整参数串传给 `Start-Process -ArgumentList`；不能直接传原始字符串数组（该 API 只以空格拼接）。修改时运行 `scripts/windows-elevation-arguments.test.mjs`，用不提权的 PowerShell 5.1/7 子进程复核 JSON、空参数、中文、引号、尾反斜杠、路径及工作目录，测试不得请求 UAC 或启动客户端。
- **Windows 无参数启动必须先选客户端**：Node 实际入口将真正无参数转换为显式 `--ui gui`，原生入口由无参数状态强制完整扫描与 GUI；已保存客户端路径不能绕过。带参数仍保持配置优先级。UAC 交接必须传实际选择，已完成的扫描/序号请求不能在子实例再执行；Node 的 `--no-scan-cache` 也会触发扫描，须与 CLI 扫描族一起处理，明确 `--client` 还须覆盖低层配置的 `rescan` / `noScanCache`。修改时运行 client-selection、host、elevation-arguments 及已编译 native-elevation 回归。
- 真实考试客户端验证需要 UAC 与人工登录，不能在自动化测试里宣称已完成；汇报时明确区分“mock CDP / 真实 Chromium 冒烟（宿主链路）”“原生选择窗口冒烟”与“真实 CEF 75 客户端页面验证”。
- **登录阶段的人工观察（2026-10-28）**：用户确认客户端登录页未加载答题脚本，完成登录后才正常加载并出现悬浮面板，并明确要求只记录、不修复此行为。停留登录页时无脚本/无面板不能单独判定注入失败，应允许人工登录后再观察；该反馈未标明本次客户端序号，不扩展为三份样本都已验收。区分用户可见业务加载、技术 bootstrap、CDP 端点及面板显示，不由其中一个阶段反推其他阶段；不要把等待日志中的“可能需登录”写成已证实的端点开放条件。

### Windows 相关验证命令

```bash
npm run typecheck
npm run build
npm run build:windows
node --test scripts/windows-host.test.mjs scripts/windows-bootstrap.test.mjs scripts/windows-chrome75.test.mjs scripts/windows-store-safety.test.mjs scripts/windows-selection-window.test.mjs
node windows/host/main.mjs --self-check
node windows/host/main.mjs --capabilities
node --test scripts/windows-injection.browser.mjs
```

Node 宿主的 WinForms 选择窗口交互冒烟（会实际弹窗、自动关闭，仅本机手动执行）：

```powershell
$env:CX_TEST_NATIVE_WINDOW='1'; node --test scripts/windows-selection-window.test.mjs; Remove-Item Env:CX_TEST_NATIVE_WINDOW
```

新增 Windows 行为时，按 repo 既有约定补充 `scripts/windows-*.test.mjs`，并保证全量 `scripts/*.test.mjs` 通过；修改扩展主包共用代码（如 `src/runtime/store.ts`）后必须同时跑扩展构建与全量测试。

### 渲染诊断与“悬浮窗模糊”类问题

- 启动模式默认写渲染诊断到 `windows/data/diagnostics/<时间戳>/`（`render-diagnostics.json` + page/window png）。排查模糊、缩放、面板定位问题时保留并分析这些产物，`--no-diagnose` 只用于确认正常。
- 悬浮窗样式保持：**不使用 backdrop-filter、使用紧凑阴影、不透明或近不透明底色、fixed 位置与外宽都吸附设备像素网格**；`scripts/pink-panel-ui.test.mjs` 有对应回归断言（2026-10-26 真实客户端确认：CEF75 支持 backdrop-filter，旧面板 blur 即“悬浮窗附近模糊”的根因）。
- `--dpi-aware` / `dpiAwareness: "system"` 的 `HIGHDPIAWARE` 兼容层只允许“启动前临时写入 → CreateProcess → 立即恢复”，禁止持久修改 `AppCompatFlags\Layers`。
- 判断 DPI 模糊：`dpiDiagnosis.status=mismatch`（窗口 DPI ≠ 系统 DPI）说明 Windows 在位图缩放整个客户端窗口；`pageDiagnosis.findings` 非空说明是页面样式/定位问题。真实客户端上的结论只能来自人工运行后的诊断文件，不要把本地 Chromium 冒烟当成真实 CEF75 结论。

### Windows 默认折叠与面板生命周期

- **Windows 面板考试专用化**：Windows 端只服务考试/答题场景，业务侧通过 `isWindowsHostRuntime()`（检测 bootstrap 注入的 `window.__CX_WIN_HOST__`）：
  - 只在考试路径创建面板（`isWindowsExamRelatedUrl`：`/exam-ans/`、`/exam/test/`、`/mooc2/exam`、`/reVersionTestStartNew`、`/examcode/`）；登录/课程/跳转页不显示面板；
  - 默认折叠；裁剪学习相关功能（媒体控制、学习流程、任务能力、完成后动作、日志窗口、题库缓存列表区块），保留答题结果、题库配置、考试自动交卷、AI 搜题等考试功能。
- **Chrome 扩展必须保持完整面板与默认展开**：扩展不注入 `__CX_WIN_HOST__`，不得把 Windows 裁剪逻辑写成无条件分支；`pink-panel-ui.test.mjs` 会同时断言 Windows 分支裁剪与扩展分支保留完整分组。
- Windows 的 `--no-panel` 同时抑制 `showTopCenterNotice`（包括手动答题就绪及按键反馈），但仍须清除先前提示并保留快捷键放行和监听清理；扩展提示不受旧 Windows 设置影响。修改时运行 `scripts/windows-no-panel-notice.test.mjs` 的真实 Chromium DOM 回归，不能仅用源码字符串判断。
- 手动授权必须在 `beforeSearch` 等待，不能消耗实际搜题截止；真实请求超时和迟到结果隔离仍须保留。`worker.ts` 与实际构建可解析的 `worker.js` 同步维护；`settled` 表示成功或失败均已收尾，初始化失败不得伪发 `done`。许可控制器按活跃 Worker 共用一个键盘监听，关闭须取消等待；同一分页 Worker 保留未用许可，新重答 Worker 不继承旧余量。修改时运行 `scripts/windows-manual-answer-worker.test.mjs` 的双运行时 Chromium 回归，覆盖长等待、请求截止、关闭、失败清理、跨页及重答；快捷键方向名同时支持 `ArrowUp/Down/Left/Right` 与旧 `Up/Down/Left/Right`，拒绝 `F08` 等前导零别名。
- **提前挂载折叠壳**：`windows/bootstrap/windows-bootstrap.js` 在考试页面新文档开始时挂载 `panel-common-work-results` 折叠壳（`data-cx-win-panel-shell=1`），业务 `createPanelRoot` 复用同一节点；不要改壳 id 或删除壳 keep-alive/点击展开标记逻辑。
- **面板所有权只能由顶层 frame 占用**：`claimTopWindowPanelOwnership()` 必须先判断 `window.self === window.top`，非顶层 frame 直接返回 false、绝不写顶层 `data-chaoxing-plus-panel-owner`。答题页大量 about:blank iframe 被注入时，子 frame 抢占 owner 会隐藏顶层面板（2026-10-26 实测问题）。
- **顶层面板必须可自愈**：`ensureTopPanelKeepAlive(root)` 用 MutationObserver 在面板被 SPA 替换 body 移除后重新 append；不要删除该逻辑。
- **顶层注入兜底**：`windows/host/inject.mjs` 在顶层 `Page.frameNavigated` 后 2.5 秒检查 `__CX_WIN_HOST__` / `__CX_WIN_BUNDLE_LOADED__` 并补注入；新增导航相关逻辑时不要移除 `scheduleTopFrameEnsure()`。
- 面板生命周期日志（`[context]`、`[nav]`、`[panel]`、`[panel] 已提前挂载折叠面板壳`）是排查“面板消失/闪烁”的主要依据；改动日志字段时同步更新 `docs/windows.md`。

### Windows 配置与重连回归

- Windows 6.2.0 第一阶段仅支持普通运行；内存执行、删除挂起、启动清理和自毁必须在 CLI/JSON/配置入口显式拒绝，并在 capability 和生成器中保持禁用。未接入的设计模型及其单元测试通过，不代表发布入口支持该能力。
- 原生 JSON 的能力拒绝须检查完整 token 树（共享 settings、对象及数组），先解码键并规范化 Windows 前缀、大小写、连字符和下划线，不能只拒绝顶层键后静默保留嵌套请求。保持普通 `normal` 与显式关闭值的既有语义，非法层不得修改已合并设置；实跑 `CX_NATIVE_OPTIONS_EXE`/`CX_NATIVE_HOST_EXE` 对应 `windows-native-options.test.mjs` 的内联、@file 和配置文件回归。
- 配置合并必须保留前层未被覆盖的共享 `settings`；跨字段冲突及 `noDiskWrite` 派生规则在全部层合并后校验，不能提前用低优先级层拒绝最终有效配置。
- 配置文件热更新必须重新应用 CLI 与内联 JSON 优先级；不能直接以磁盘原始值替换已生效的页面配置。修改此链路时运行 `scripts/windows-config-reload.test.mjs` 及宿主集成测试。
- 宿主广播配置须使用 `{kind: "config", values: settings}` 消息包装；原生完整快照加 `replace:true`，缺失旧共享键须同时清理闭包、DOM/延迟属性队列，并通过 `chaoxing-plus:shared-store-remove` 通知 runtimeStore 清理内存及标记删除，禁止重新读回旧 localStorage；重新水合该键须解除删除标记。不带 `replace:true` 仍为增量合并。无写盘策略下不得为删除而触碰 localStorage，非共享键不删，删除通知不得回流同步。回归必须检查真实 bootstrap 的 DOM 属性、配置闭包及 runtimeStore 默认值，不能只断言发出了 `Runtime.evaluate`。同实例重连复用原配置桥并按完整快照水合，不重复安装页面监听；本次启动的 `noDiskWrite` 策略须在热更新及页面同步中保持一致。
- 原生配置默认读取 EXE 同级 `chaoxing-plus.json`，显式 `--config` 为回写目标，相对路径按进程工作目录解析；不得套用 Node 的默认配置路径或随 `--data-dir` 改动配置位置。合并顺序为默认值、EXE 同级文件、显式配置、`--options-json` 启动快照、CLI；`--options-json @file` 不参与热更新。1500ms 文件监测须保留启动内联 JSON/CLI 优先级，热更新仅更新共享页面设置，启动 `noDiskWrite` 与日志策略锁定。
- 默认配置文件被删除视为空层并回落默认值及更高优先级参数；显式 `--config` 文件被删除或不可读取须保留最后有效快照。新宿主实例接管旧文档时必须更新原 bridge 的发送闭包身份和完整快照，不能只修改 `HOST.instance` 外观；保留实际双宿主依次接管的浏览器回归，监听器、面板和已完成业务包不得重复安装。
- 原生页面 `config-sync` 须验证固定 source、本轮唯一 instance 及仍存活、已登记且 bootstrap 完成的默认上下文（或实际 bootstrap 完成的顶层 fallback），只接收共享白名单；事件回调只验证排队，不得重入 CDP 或配置文件 I/O。配置任务与 bootstrap/bundle 串行并保留 generation/token 失效规则，关闭后恢复开启须继续未完成且已就绪的 bundle，不能重复注入已完成文档。
- 原生配置回写按 250ms 去抖，对当前文件做共享 patch，保留未覆盖的共享键与未知顶层字段；完整生成 UTF-8 自有临时文件后替换，失败保留原文件并仅清理自有临时文件。重复解码键须规范合并，不能靠不断追加 JSON 片段保留优先级。写盘失败继续使用内存并保留待保存修改，待保存 patch 优先，未落盘前不能发布外部文件快照覆盖更新的内存配置；保留已编译故障回归 `failed config write cannot discard newer memory`。
- CDP 断线后必须关闭旧会话并允许对同一存活 target 重连；首次连接和重连也必须安排顶层注入兜底，不能仅依赖导航或历史 console `ready` 回放。
- Node 页面控制消息须来自仍存活、已登记且已开始 bootstrap 的默认上下文，并匹配固定 `source` 与本轮 `instance`；初始化前的 trampoline `boot-request` 可以不带两项标识，但只带一项或不匹配时必须拒绝。初始 frame 树和后续事件均须维护父子关系，父 frame 移除时清理整个子树的上下文与在途注入状态。
- Node 普通运行在 target 刷新和每次 WebSocket 建连前必须复核本次启动 PID 的监听归属，失败立即关闭旧会话；定时轮询不得重叠。target 地址只允许同端口 IPv4 回环或 localhost（连接时固定到 IPv4）；显式 attach 仅跳过 PID 校验。WebSocket 进入 CLOSING 时须立即取消请求并发出一次断线通知，保留 `scripts/windows-cdp-transport.test.mjs` 的真实 loopback 回归。
- 注入生命周期变更须运行 `scripts/windows-injection-lifecycle.test.mjs` 和实际 Chromium 的 `scripts/windows-injection.browser.mjs`，覆盖并发去重、上下文销毁、关闭后停止重试以及重连恢复；自动化测试页面仍不能替代真实 CEF 75 考试页面验收。
- 原生构建为无 CRT 的 x86 Win32 EXE，默认将 `dist-windows` 的四项资源内嵌为 RCDATA，不允许以运行时解包写盘代替；显式 `--assets` 覆盖缺失时不得静默回退。修改原生注入、资源加载、配置或审计须执行 `windows/native/build.ps1 -BuildTests`；除 `injection-tests.exe`、`assets-tests.exe`、`options-tests.exe`、`json-tests.exe` 外，还应生成 `session-tests.exe`、`selection-tests.exe`、`transport-tests.exe`、`audit-tests.exe`、`config-store-tests.exe`。分别设置 `CX_NATIVE_HOST_EXE`、`CX_NATIVE_INJECTION_EXE`、`CX_NATIVE_ASSETS_EXE`、`CX_NATIVE_OPTIONS_EXE`、`CX_NATIVE_SESSION_EXE`、`CX_NATIVE_SELECTION_EXE`、`CX_NATIVE_TRANSPORT_EXE`、`CX_NATIVE_AUDIT_EXE`、`CX_NATIVE_CONFIG_EXE` 后运行对应 `scripts/windows-native-*.test.mjs`，并运行 `scripts/windows-native-injection.browser.mjs`、`scripts/windows-native-assets.browser.mjs`、`scripts/windows-native-lifecycle.browser.mjs`、`scripts/windows-native-audit.browser.mjs` 和 `scripts/windows-native-config.browser.mjs`。配置变更还须运行 `scripts/windows-bootstrap.test.mjs`、`scripts/windows-store-safety.test.mjs`，覆盖删除、重加、未就绪文档和 noDiskWrite。完整命令见 `docs/windows.md`；跳过的编译测试不能汇报为通过。
- 原生 DOM script 执行须同时检查完成标记和严格布尔确认；CDP 无异常不代表 CSP 允许脚本执行。原生入口的生命周期和参数支持须分别验收，不得以 Node 宿主通过或参数可解析推导原生实现完整。
- 原生 `session.c` 管理上下文就绪、导航、frame 子树销毁和取消代次，`host-session.inc` 负责真实 target 轮询、WebSocket、重连及顶层兜底；保持三种注入策略的顺序：`runtime` 只用 Runtime，`script` 先 DOM script 后 Runtime，`hybrid` 先 Runtime 后 DOM script。修改生命周期须同时运行已编译会话/传输测试和 `windows-native-lifecycle.browser.mjs`，不能只测纯状态模型或 C 生成的表达式。
- 原生目标刷新与 WebSocket 建连前都须重新验证本次启动进程的监听归属；失败时关闭既有会话，不能沿用首次验证结果重连。iframe 重连不得依赖 console 历史 ready：成功复用 bootstrap 后，DOM 已就绪时通过现有 `requestBundle()` 恢复通知，业务包继续按文档标记去重；须保留清空 console 历史后的实际浏览器回归。
- 原生 HTTP 与 WebSocket Upgrade 的连接、发送、分块接收和最终确认须共享一次总截止，不能逐次 recv 重置时间；调用方传入剩余 `debug-timeout`/`duration` 预算，握手后须再次检查取消，迟到连接不得创建会话或发送 CDP。修改时实跑已编译的 `windows-native-transport.test.mjs` 与 `windows-native-host.test.mjs`，保留慢版本响应、慢 target 列表、分块响应、慢/分块 Upgrade 和取消后关闭回归。
- CEF75 普通启动的 `--port`/JSON `port` 只允许 `0` 自动或 `1024-65534`；显式测试 `--attach` 仍允许 `1-65535`。保持最终配置层校验和启动前防御，生成器同步范围；运行宿主/原生参数及生成器回归，不能以可绑定推导 CEF75 接受该端口。
- 原生原型已接入持续会话、Win32 选择、共享配置同步/持久化/热更新、文件日志、运行报告和页面布局采样（`pageRenderDiagnostics:true`）。完整宿主渲染诊断仍不支持（`renderDiagnostics:false`，不采集窗口 DPI 或截图）；内存执行、删除挂起、启动清理、自毁仍须显式拒绝。现代 Chromium 中真实 WebSocket 的自动化结果不代表真实 CEF75 客户端登录后验收，也不能证明旧 Windows 干净环境兼容性。
- 原生构建当前使用 `/Gs9999999`，不生成栈探针；大路径、环境变量、表达式和控件缓冲区须使用堆或静态存储，避免大栈帧跨过 Windows guard page。修改默认扫描根目录时须实际执行已编译的 `--list-clients --scan-mode common --quiet` 回归，不能只使用人工提供根目录的测试。
- 原生扫描缓存使用独立 `native-scan-cache-v1.bin`，仅复用完整非空常规扫描；`--list-clients` 保持实时且不读写缓存。缓存须有界、校验真实范围/系统架构/PE/文件指纹/父目录排除及 reparse，失败非致命；`--no-disk-write`/`--no-scan-cache` 禁读写，`--rescan` 绕过读取。修改时编译 `discovery-cache-driver.exe` 和 `discovery-cache-host-tests.exe`，设置 `CX_NATIVE_CACHE_EXE`、`CX_NATIVE_CACHE_HOST_EXE`、`CX_DISCOVERY_TEST_DRIVER` 并运行 `windows-native-cache.test.mjs`、`windows-native-discovery.test.mjs` 与宿主回归。
- 无 CRT 测试程序也须遵守栈限制，`CX_OPTIONS` 等大对象不能放在测试函数栈上。GUI 子系统测试程序须由 Node `spawnSync` 或 `Start-Process -Wait` 等待并检查实际退出码；PowerShell 直接调用后遗留的 `$LASTEXITCODE` 不构成通过证据。
- 原生 `--self-check` 必须在普通 `h_run()` 之前独立返回；不得自动扫描常见根目录或全盘、启动客户端、申请 UAC、连接 CDP、创建日志/诊断/报告/配置。显式客户端目录按既有一级规则解析。保留权限真实状态、显式外部资源不回退、普通注入容量限制、实际 loopback bind 后关闭、quiet 静默和参数错误退出 `2`；设置 `CX_NATIVE_HOST_EXE` 实跑 `scripts/windows-native-self-check.test.mjs`。自检通过不能当作客户端启动或 CEF 页面验收证据。
- 原生 UAC 仅由普通 `proc_launch` 返回 Win32 `740` 触发，使用标准 `runas` 重启同一宿主，不能只提权客户端而丢失进程归属。`--no-elevate`、已重启标记、实际已提升 token 或权限查询失败均阻止重复申请；内部已选路径必须经真实 token 校验并重新验证 PE，不能重新扫描/打开选择窗口。保留原始 argv 和工作目录，父实例先释放资源、跳过交接阶段报告后再等待子实例；取消返回 `3`。修改此链路后生成 `elevation-tests.exe`、`elevation-host-tests.exe`，设置 `CX_NATIVE_ELEVATION_EXE`、`CX_NATIVE_ELEVATION_HOST_EXE`、`CX_NATIVE_HOST_EXE` 实跑 `scripts/windows-native-elevation.test.mjs`；调用替身测试不能宣称真实 UAC 人工批准或 CEF 登录后验证。
- 原生 DPI 参数须实际接入普通启动；JSON `dpiAwareness` 只接受空字符串或 `system`，同层 `dpiAware` 布尔优先，不能仅加入合法键名单而忽略类型和语义。临时兼容层必须在进程创建返回后立即恢复原 type/raw bytes（包含失败和 `740`），恢复失败不进入 UAC 或注入，并只停止本次已启动的 owned 客户端；不可覆盖已检测到的外部改值或删除整个 Layers 键。原生 `--dpi-aware` 与 `--no-disk-write`/`--attach` 显式互斥。修改后设置 `CX_NATIVE_DPI_EXE`、`CX_NATIVE_DPI_PROCESS_EXE`、`CX_NATIVE_DPI_CHILD_EXE`、`CX_NATIVE_HOST_EXE` 运行 `scripts/windows-native-dpi.test.mjs`，并保留已编译宿主恢复顺序回归；字符串原值以实际 `RegQueryValueExW` 读回为准，不能假设畸形 `REG_SZ` 的写入字节未经系统规范化。测试子进程的真实 DPI 状态不能替代真实 CEF 客户端页面验收。
- 原生普通启动须在 DPI 修改前可靠检查已有同名客户端；进程快照创建/First/Next 失败不能按零进程继续。提升后的宿主和 `proc_launch` 仍需复查，不结束已有进程；晚冲突须先恢复临时 DPI 再退出。快照与创建不是原子操作，PID/创建时间/监听归属校验仍须保留。修改后生成 `process-check-tests.exe`、`process-fixture.exe`，设置 `CX_NATIVE_PROCESS_CHECK_EXE`、`CX_NATIVE_PROCESS_FIXTURE_EXE`、`CX_NATIVE_HOST_EXE` 运行 `scripts/windows-native-process-check.test.mjs`，并保留 `CX_NATIVE_ELEVATION_HOST_EXE` 的宿主顺序回归；fixture 只允许创建和结束测试自有进程。
- 原生页面诊断只在首次成功的顶层 bundle 确认后尝试一次，不能把子 iframe 的任务触发为顶层采样。保持字段白名单、三位小数量化、URL 样式拒绝和失败非致命；`--no-diagnose` 必须覆盖配置中的 `diagnose:true`，正反 CLI 开关最后一次生效，`--no-disk-write` 禁止创建诊断目录。修改此链路后设置 `CX_NATIVE_DIAGNOSTICS_EXE=<diagnostics-tests.exe>` 与 `CX_NATIVE_HOST_EXE=<chaoxing_plus.exe>` 运行 `node --test scripts/windows-native-diagnostics.test.mjs`，保留真实 Chromium 的分数 DPR、CSS URL canary 和文件失败回归。

### 原生日志与运行报告

- 面板内「连接与注入日志」由构建布尔 `__CXPLUS_WINDOWS_INJECTION_LOG__` 控制，仓库默认关闭；仅通过 gitignored `windows/local-features.json` 的 `injectionLog:true` 在本机开启，不得提交本地配置。扩展构建始终关闭，发布前执行 `npm run build:windows -- --release` 强制关闭后再构建原生 EXE；`package-manifest.json` 的 `features.injectionLog` 须与实际 bundle 一致。修改此链路须实跑 `scripts/windows-build-features.test.mjs`，并在发布关闭和本机开启两种真实构建下运行 `scripts/windows-host-log.test.mjs` 的 built-bundle 浏览器用例。
- 宿主面板诊断只传最近 100 条固定事件码及序号、经过时间、级别；不得传任意日志文本、路径、URL、Token、题目或答案。bootstrap 验证固定 source、本轮 instance、完整快照格式，接管新宿主须清旧记录；日志不走配置持久化或 localStorage。只向已确认 bootstrap 完成的顶层文档投递，回调只入队，原生 CDP 发送须串行且检查严格 true；发送失败非致命并节流重试，导航、关闭、重连须取消旧文档状态。`--no-panel` 禁止 UI 和投递，`--no-disk-write` 仍允许内存记录。修改须运行 bootstrap、memory-diagnostics、host-log、注入生命周期及 Node/原生实际 Chromium 回归，不能宣称为真实 CEF75 登录后验收。
- `windows/native/audit.c` 使用无 BOM 的 UTF-8 单行日志，包含 UTC 时间、级别及事件种类；宿主只传入预先脱敏的固定事件，不得加入原始配置 JSON、Token、题目、答案或 URL 查询参数/片段。页面 console/异常只输出省略原文的固定事件；关闭 `captureConsole` 不得阻断注入就绪或 bootstrap 控制错误。
- 原生普通运行默认数据目录为进程工作目录下的 `.data`，日志位于其 `logs/windows-host-<UTC时间>-<宿主PID>.log`；`--data-dir` 与 `--report` 的相对路径按审计对象创建时的进程工作目录解析，不能套用 Node 的 `windows/data` 默认值。日志使用 `CREATE_NEW`，不覆盖已有会话文件。
- `--quiet` 只抑制控制台，不能关闭文件日志或显式报告；`--no-log` 只关闭日志文件，报告独立；`--no-disk-write` 必须禁止日志、报告及相应目录创建。`--list-clients` 即使默认 log=true 也不创建日志，仅显式 `--report` 才输出报告，列表不得混入审计事件。日志创建/写入失败不阻止主流程，写入失败须关闭该句柄并继续控制台事件，不反复重试。报告完整生成及 UTF-8 校验失败时保留原报告，写入失败只返回错误，不宣称原子替换。
- 报告 `totals.contexts` 是停止时仍存活的默认上下文数量；`bootstraps`/`bundles` 按完成 ACK 历史累计，导航、关闭或重连不得清零。`pageSessions` 累计成功连接，`reconnects` 统计同 target 成功重连；`errors` 累计页面异常、bootstrap 控制错误、注入/连接错误及最终失败，不累计 `console.error` 告警，正常停止取消在途任务不得误计执行错误。成功状态表示流程执行结果，允许伴随页面告警或非零错误计数。报告保留 UTC 起止时间、`launch|attach`、归属校验、成功状态与停止原因；`ownershipVerified` 表示本轮曾实际成功校验，不是结束时快照，调试 `--attach` 始终为 false。
- 初始端点等待的 `endpointProbe` 只记录固定 enum、饱和计数和确证状态；不得解析错误文案猜原因或记录远端响应。查询失败的 `listenerSeen=false` 不等于无监听，attach 不宣称归属，停止原因与探测失败分类分开；仅最终失败写一次摘要。进程树 `Process32NextW` 非 `ERROR_NO_MORE_FILES` 须失败关闭，不能信任部分枚举。修改时实跑已编译的 `windows-native-endpoint-probe.test.mjs`、进程检查、宿主及审计回归。
- 修改审计文件处理须运行 `CX_NATIVE_AUDIT_EXE=<audit-tests.exe>` 对应的 `node --test scripts/windows-native-audit.test.mjs`；修改宿主事件或统计接线还须设置 `CX_NATIVE_HOST_EXE` 并运行 `node --test scripts/windows-native-audit.browser.mjs`，保留 quiet/no-log/no-disk-write、脱敏、重连统计与正常取消回归。现代 Chromium 模拟页面不代表真实 CEF75 人工验收。
