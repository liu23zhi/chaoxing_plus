# Agent Instructions

## 开工前必须汇报

- 每次新任务开始时，先汇报：当前分支、工作区状态（`git status --short --branch`）、以及本轮之前已执行的修改。
- 未完成汇报前，不得继续修改、合并或执行其他高风险 Git 操作。
- 不要上来就合并；先检查并汇报分支关系、冲突风险与功能影响，等待明确确认。

## 禁止擅自提交

- **未获得明确确认前，不要 `commit` / `push` / `merge` / `rebase`**。
- 改完只汇报改动与验证结果，把提交决定交回用户。

## 验证纪律

- 改了代码就要**实际运行**验证，并把原始输出贴出来，不要只描述"应该没问题"：
  - 全量测试：`node --test scripts/*.test.mjs`
  - 类型检查：`node node_modules/typescript/bin/tsc --noEmit`
- `scripts/*.test.mjs` 通配必须确实展开（22 个测试文件）。只跑单个文件不能代表全量通过。
- 测试数量对不上时，先确认通配展开、再确认是否漏跑——不要凭"看起来都过了"下结论。
- `dist/` 是构建产物且已被 `.gitignore` 忽略，**不要手工改 `dist/`**。
- `.tmp-tests*` 目录由测试自行重建，已在 `.gitignore` 内。

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

- **请求体只有 7 个字段**：`qid` / `question` / `options` / `type` / `courseName` / `extra` / `skipCache`。
  `plat` **已彻底移除**（服务端把它删了：该字段所有调用方恒为 `-1`、没有区分度）。
  不要因为看到历史文档或旧日志里有 `plat: -1` 就加回去。
- 鉴权用 `Authorization: Bearer <key>`（`createTikuAdapterAuthorizationHeader`），密钥不拼进 URL。
- 端点由 `createTikuAdapterSearchUrl` / `createTikuAdapterAIFallbackUrl` /
  `createTikuAdapterAIFallbackTaskUrl` / `createTikuAdapterAIFallbackStatusUrl` 统一生成，
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
- 只有**明确要重查**时才传 `true`（用户点重试、已拿到答案后的自动重试、搜题错误后的自动重试）。
- 搜题错误（包括超时、网络或接口异常）不能进入本地 `answerCache`；读取时发现旧错误缓存也要删除。
  无错误的“无答案”结果仍沿用既有缓存规则，不要把“无答案”和“接口失败”混为一谈。
- 不要用 `Boolean(x)` 把 `undefined` 压成 `false` 再判断——那会让"没有意见"和"明确要用缓存"混为一谈。

### 服务端缓存会改变"重复请求"的观察结果

服务端按 `用户 + 题面 + 选项 + 题型 + 渠道` 缓存 10 分钟，且**命中不再计费**。因此：

- 同一用户重复问**完全相同**的题目会命中缓存，上游调用次数为 0，
  这与"客户端每次都发请求"并不矛盾。
- **选项或题面有任何差异**（哪怕只多一条噪音）都会导致缓存不命中、重新计费。
  写测试时若复用同一道题，要意识到这会互相影响。

### AI 兜底

- 默认走**异步任务**（`preferAsyncTask: true`）：`POST /ai-fallback/tasks` → 轮询
  `GET /ai-fallback/status?taskId=`（间隔 2500ms）。`tasks` 返回 404 时回退到同步
  `POST /ai-fallback`。
- 超时常量：搜索 240s、兜底请求 180s、兜底轮询总时长 300s。
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
