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

3. 首次运行会自动创建 `windows/data/config.json`（从模板复制）。未设置 `clientPath` 时，默认先扫描桌面、Program Files、Program Files (x86)、OneDrive Desktop、AppData/ProgramData 等常见根目录，并且每个根目录只进入一级直接子目录；只有常规路径完全没有候选且扫描模式为 `fallback-all` 时，才递归扫描固定磁盘根目录。这里的“任意子文件夹”严格指一级子目录，不会在常规扫描中进入二级或更深目录。也可交互选客户端或直接指定路径：

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
| `clientPath` | 客户端 `CXExam.exe` 绝对路径（必填） |
| `port` | `0` = 自动选择可绑定端口；固定端口不可绑定时宿主会报错，不会静默换端口 |
| `expectedBrowser` | `/json/version` 的 Browser 必须包含的字符串，默认 `Chrome/`，用于避免误连其它浏览器 |
| `stopClientOnExit` | 宿主退出时是否结束本次启动的客户端进程树 |
| `injectBlankFrames` | 是否向 about:blank/srcdoc 等不透明 origin 的 frame 注入（考试页面常用 document.write 生成题目 iframe，默认 true） |
| `captureConsole` | 是否把页面异常/日志转发到宿主日志 |
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
| `--select-client` | 关闭 | 完整扫描后在终端逐项选择；提示时可输入序号或带引号的手动路径。 |
| `--scan-mode common\|fallback-all\|all` | `fallback-all` | `common` 只扫常规根目录及一级直接子目录；`fallback-all` 仅在常规扫描为零结果时递归固定磁盘；`all` 直接递归固定磁盘。 |
| `--scan-all` / `--no-scan-all` | 默认 fallback-all | `--scan-all` 启用常规无结果后的递归回退；`--no-scan-all` 将扫描限制为常规路径。 |
| `--scan-clients` / `--rescan` | 关闭 | 忽略配置中的现有客户端路径并执行扫描；当前宿主没有持久扫描缓存，故 `--rescan` 不涉及缓存清理。 |
| `--no-scan-cache` | 关闭 | 不读取或写入扫描缓存；当前宿主尚未实现扫描缓存。 |
| `--ui auto\|cli` | `auto` | `cli` 使用终端交互；`auto` 优先使用已配置客户端路径，否则在交互终端提示选择、在非交互环境使用推荐候选。`gui` 当前未实现，显式指定会报错。 |

常规扫描依次检查用户桌面、OneDrive Desktop、Program Files、Program Files (x86)、AppData/ProgramData 等常见根目录，以及所有可访问固定磁盘根目录；每个根目录只检查根目录自身和一级子目录。跳过符号链接、不可访问目录和 Windows 系统目录。常规扫描找到候选后不再递归全盘，即使候选只有 x64 也一样。普通自动选择时，递归回退按固定磁盘和子目录的确定性顺序遍历，记住首个 x64，发现首个 x86 后停止；未发现 x86 时选首个 x64。为支持用户显式选择，`--client-index`、`--select-client` 和 `--list-clients` 会完整枚举全盘结果。宿主可在 32/64 位 Windows 运行 x86 客户端，并在 64 位 Windows 运行 x64 客户端；自动推荐仍优先 x86。仓库提供的真实目标客户端是 x86，x64 CEF 客户端尚未做真实客户端验证。

选择参数互斥：`--client` 不可与 `--client-index`、`--client-first`、`--select-client` 或 `--list-clients` 同用；`--client-index` 不可与 `--client-first`、`--select-client` 或 `--list-clients` 同用；`--select-client` 与 `--list-clients` 不可同用。扫描模式可以和 `--client` 同时出现，但指定路径会优先并跳过扫描。

#### 配置和数据

| 参数 | 默认/范围 | 行为 |
| --- | --- | --- |
| `--config <path>` | `windows/data/config.json` | 读取并更新指定的宿主 JSON 配置文件。 |
| `--options-json <json>` | 未指定 | 将内联 JSON 对象合并为配置；也可使用 `--options-json @<file.json>` 从文件读取。顶层必须是 JSON 对象，指定的文件不存在或无法解析时会在启动前报错。 |
| `--data-dir <path>` | `windows/data` | 设置宿主配置、日志和诊断的默认数据目录；明确指定 `--config` 时配置文件路径仍以 `--config` 为准。 |
| `--no-disk-write` | 关闭 | 不创建/更新配置，不写日志、诊断、运行报告或宿主临时业务文件；并关闭扫描缓存。不会阻止 CXExam 页面自身写入 localStorage，也不能保证 OS 错误或 UAC 提示静默。 |
| `--retain-data` / `--no-retain-data` | 当前不支持 | 数据保留/清理生命周期尚未实现，参数会直接报错，避免被误当成有效设置。 |
| `--delete-config` | 当前不支持 | 不会删除外部配置；参数会直接报错。 |

配置合并顺序为：内置默认值 < 默认宿主配置 `windows/data/config.json` < 同目录 `chaoxing-plus.json` < `--config` 指定配置 < `--options-json` < 独立命令行参数。使用 `--no-disk-write` 时仍可读取现有配置，但所有宿主侧写入都关闭。配置只会向页面共享键白名单同步。

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

以下参数是后续能力的设计项，本阶段**全部拒绝，不会运行或静默忽略**：

| 未发布参数 | 设计值 | 当前行为 |
| --- | --- | --- |
| `--execution-mode memory`、`--memory-exec` | 内存执行 | 启动前报错。 |
| `--execution-mode delete-suspend`、`--delete-suspend` | 删除挂起 | 启动前报错。 |
| `--wipe-owned-files-on-start` | 关闭 | 启动清理未实现，报错。 |
| `--wipe-failure-policy retry\|background\|ignore\|abort` | `retry` | 失败策略尚未实现，报错。 |
| `--wipe-retries <1-20>` | `5` | 重试次数尚未实现，报错。 |
| `--wipe-retry-delay <ms>` | `200` | 启动重试间隔尚未实现，报错。 |
| `--wipe-runtime-retry` / `--no-wipe-runtime-retry` | 开启 | 运行期重试尚未实现，报错。 |
| `--wipe-runtime-interval <sec>` | `30` | 运行期重试间隔尚未实现，报错。 |
| `--self-destruct-key <shortcut>` | 可重复，默认无 | 自毁快捷键尚未实现，报错。 |
| `--self-destruct-on-fullscreen-exit` | 关闭 | 全屏/进程退出监控尚未实现，报错。 |
| `--self-destruct-delay <ms>` | `0` | 自毁延迟尚未实现，报错。 |
| `--no-self-destruct-confirm` | 关闭 | 自毁确认控制尚未实现，报错。 |

JSON 中使用这些未发布字段时同样会报错。配置生成器将它们标记为未发布；“启动清理型”预设不会输出命令。

`--wipe-*`、`--self-destruct-*`、`--retain-data`、`--no-retain-data` 和 `--delete-config` 当前都不会执行清理或自毁，宿主会拒绝相应 CLI/JSON 配置。只有普通进程启动路径可用；请勿把面板隐藏或 `--quiet` 当成进程隐蔽/自毁能力。

已知限制：Windows 端没有扩展 popup，目前通过编辑 `config.json` 或在页面内面板修改设置；`common.settings.extension-enabled=false` 时不会注入业务 bundle。

### Windows 参数生成器与启动示例

`windows/parameter-generator.html` 是离线单文件参数生成器，可在浏览器中打开，生成 PowerShell、cmd 和 JSON 配置。启动脚本默认根据 HTML 所在位置定位到项目根目录的 `start-windows.cmd`，也可在页面中修改；单独复制 HTML 时需自行指定实际启动器路径。它只导出当前宿主支持的普通启动、扫描、面板、答题、日志和诊断参数，不执行命令、不保存输入。内存执行、删除挂起、启动清理和自毁选项不会由页面生成；启动清理预设会阻止命令导出。

常规路径扫描会检查桌面、OneDrive Desktop、Program Files、Program Files (x86)、AppData/ProgramData，以及所有可识别固定磁盘根目录；每个根目录只检查根目录自身和一级直接子目录。若常规扫描找到候选，默认不递归全盘。常规无候选时 `fallback-all` 才递归固定磁盘；`all` 直接全盘扫描。`--ui cli` 或 `--select-client` 会显示完整候选列表；交互提示支持输入列表序号或带引号的手动 `CXExam.exe` 路径。`--ui auto` 优先使用配置中的客户端路径；没有配置路径时，交互终端提示选择，非交互环境使用推荐候选。`--ui gui` 当前会明确报错。

绝对静默预设的安全子集（关闭宿主一般日志、面板和宿主侧持久化，以快捷键手动放行一题；不承诺所有错误都静默，且不包含内存执行/自毁；CXExam 自身的浏览器存储仍不受此开关控制）：

```powershell
& ".\start-windows.cmd" `
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

友好交互型：

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
  --diagnose
```

懒人型普通启动（默认选择推荐扫描候选，x86 优先）：

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

手动答题型（终端选择候选客户端，每次快捷键放行 2 道题）：

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

仅扫描常规路径并列出候选：

```powershell
& ".\start-windows.cmd" --scan-mode common --list-clients --no-log --quiet
```

强制全盘扫描并列出候选：

```powershell
& ".\start-windows.cmd" --scan-mode all --list-clients --no-log
```

指定客户端和自定义数据目录：

```powershell
& ".\start-windows.cmd" `
  --client "D:\Exam\CXExam.exe" `
  --data-dir "D:\CXPlusData" `
  --panel `
  --panel-width 520 `
  --log
```

通过配置文件或内联 JSON 指定面板配置：

```powershell
& ".\start-windows.cmd" --config ".\chaoxing-plus.json" --panel
& ".\start-windows.cmd" --options-json '{"panel":true,"panelTop":24,"panelWidth":520}'
```

以上示例不启用内存执行、自毁或启动清理；手动答题示例会启用答题快捷键，自动模式按默认业务流程处理题目。使用 `--no-disk-write` 时，宿主日志、配置持久化、诊断和报告写入关闭；CXExam 页面自身的 localStorage 不受该选项控制。参数错误、环境检查或权限提示仍可能输出。

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
