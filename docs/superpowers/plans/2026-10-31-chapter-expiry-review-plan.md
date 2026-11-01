# Chapter Expiry Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. 下方 Task 1-7 保留实施前的步骤和接口设想，实施结果以文末的合并实施记录为准；未逐项留存的先红证据不补勾为已验证。

**Goal:** 修复章节测验延期流程中已经复现的调度、提交、弹窗和重试问题，保证普通任务先处理，最终提交有明确证据，过期只终止对应任务。

**Architecture:** 保留现有章节队列和课程队列，补齐扫描依据、任务结果与导航策略。提交阶段改用携带任务及尝试身份的结果，按窗口统一管理请求和原生弹窗监听；手动决定由课程会话协调。避免扩展原生/Node 宿主或修改其它仓库。

**Tech Stack:** TypeScript 7；测试转译使用 `@typescript/typescript6`；Node test runner；Puppeteer/Chromium；Vite；Chrome 75 构建闸门。

**Spec:** [AGENTS.md](../../../AGENTS.md) 的“章节测验截止与延期”“Swal 弹窗与 iframe”“验证纪律”，以及本对话中的跳转、正常重试、静态延期和最终过期识别要求。本文件同时保存合并后的审查证据与实施约束。

## Global Constraints

- 实施前审查基线：`codex/campus-offline-map`，提交 `194673d`。用户后续已要求实施修复；本文件的历史审查定位不代表修改后的当前行号。
- 面板暂停/继续按钮始终显示且可点击，包括尚无活动 worker 的情况。暂停意图属于当前标签页，同标签 URL 导航后保留；新标签页及 `window.open` 不继承。暂停不是永久拒绝手动答题，明确点击继续应恢复当前标签页的处理。
- 静态截止仅按实际题目文档内的状态结构精确识别；静态命中只延期，不消耗答题次数。
- 先检查课程内正常任务，最后回访延期任务。真实提交的普通失败沿用正常重试设置，默认首次加 3 次重试；不得改成固定总共 3 次。
- `此作业已过期！` 等明确的服务端拒绝或有任务归属的原生过期弹窗，立即终止对应任务并关闭其确认层。
- `next` 只向后续子任务推进，最后一个子任务结束后进入下一章，正常扫描不回跳早先子任务或章节；`job` 按未完成任务导航；`manually` 不自动跨章或切换子任务页。最终延期回访与普通推进分开处理。
- 任务身份包含课程、班级、章节、tab 和 job；提交还包含 attempt 和 request 身份。相同 job 字符串在不同作用域下互不影响。
- 保留 Windows `no-auto-submit`、`no-disk-write` 和 Chrome 75 兼容性。不将任务状态扩展到宿主共享配置，不修改冻结的 Node 宿主。
- 不手工修改 `dist/`、`dist-windows/`。不执行 push、merge、rebase；提交决定仍交给用户。
- 本地 Chromium 和模拟页面不等于真实超星课程验收。测试只访问本地服务，并负责关闭自建浏览器和服务器。

## Review Focus

- 多章节、多 tab、多 job 及重复 job ID：新增普通任务必须使旧检查依据失效，原已终止任务不能被重新激活。
- 共享 parent/top 的两个任务交错响应：B 的过期、原生弹窗和取消操作不能终止 A。
- 缺失提交函数、异步预检查、预先 open 的 XHR、超时和迟到回调：没有完成证据不得标记成功或写缓存。
- 保存、禁用自动答题、手动取消与页面重载：不能无限重答、虚耗次数、错误放弃或重复询问；无落盘模式不能为了恢复状态写盘。
- 两套原生 DOM 确认层、跨源 iframe、延迟运行时及重复使用模板：只关闭对应层，保留其它提示和后续交互。

## 合并审查清单

以下为实施前的审查证据：旧项来自上一轮 8 项 review；新增项来自当时的只读补查。所有行当时均已取得源码路径及本地复现；F16 的恢复范围在 Task 7 定义。F14 使用真实调度和搜索函数，worker 仅替换成生产保存分支的返回形状，未运行真实搜题服务。修复状态与接口取舍见文末合并实施记录。

| ID | 优先级 | 来源 | 问题与复现结果 | 定位 | 任务 |
| --- | --- | --- | --- | --- | --- |
| F01 | P1 | 旧 | 未发现延期任务前，未加载的普通页被记为已检查；以后直接回访，普通任务仍未完成，课程却 settled | `src/projects/cx.ts:3346` | 2 |
| F02 | P1 | 旧 | 提交超时只 reject，不中止在途请求；迟到响应仍弹“此作业已过期！” | `src/projects/cx-chapter-submission.ts:196` | 4 |
| F03 | P2 | 旧 | 只关闭 Marking 模板；原 HTML 的 `#confirmSubWin.AlertCon02` 与 `.mask` 仍可见 | `src/projects/cx-chapter-dialog.ts:17` | 6 |
| F04 | P2 | 修正 | next 在最后一个子任务按列表开头寻找未检查 tab，回到前面子任务而未进入下一章；后续同章子任务本身是允许的 | `src/projects/cx.ts:3370` | 3 |
| F05 | P2 | 旧 | 目录为空时补入当前章，并立即回访提交，没有等待目录就绪 | `src/projects/cx.ts:3144` | 2 |
| F06 | P2 | 旧 | 两个重叠 helper 结束后 alert/confirm/fetch/XHR open 都未恢复原值 | `src/projects/cx.ts:733`；`src/projects/cx-chapter-submission.ts:209` | 4 |
| F07 | P2 | 旧 | 跨源任务 iframe 无法共享手动拒绝；本地双端口复现 prompts=2 | `src/projects/cx.ts:2006` | 7 |
| F08 | P2 | 旧 | `{status:true,data:{msg:'此作业已过期！'}}` 被误判为过期 | `src/projects/cx.ts:569` | 5 |
| F09 | P1 | 新 | A 提交成功，B 从共享 top 提交过期；只有 A 的 helper 活跃，A 仍被判过期 | `src/projects/cx-chapter-submission.ts:28`；`src/projects/cx.ts:677` | 4 |
| F10 | P1 | 新 | 提交函数缺失，POST=0，却得到 chapterFinished=true、cacheWrites=1 | `src/projects/cx.ts:4874`；`src/projects/cx.ts:4966` | 4 |
| F11 | P1 | 新 | 已检查且已离开的章节新增普通 tab，旧 inspected 状态不失效；新增任务未执行就回访并 settled | `src/projects/cx-deferred-course.ts:75` | 2 |
| F12 | P2 | 新 | 延期切章绕过闯关和重复跳转保护；点击无效时连续 5 次重试，守卫调用为 0 | `src/projects/cx.ts:3217`；`src/projects/cx.ts:3377` | 3 |
| F13 | P2 | 新 | 延期结束后提前返回，`backToFirstWhenFinish:true` 不再返回首章 | `src/projects/cx.ts:3212` | 3 |
| F14 | P1 | 新 | 保存或 no-auto-submit 返回 finished=false 后释放 searchedJobs，无界重新答题；配置总共 2 次仍连续执行 6 次，测试主动截停 | `src/projects/cx.ts:3993`；`src/projects/cx.ts:4977` | 1 |
| F15 | P2 | 新 | 关闭自动答题后，延期任务因无 func 被按 missing 访问 3 次并永久放弃；实际答题和尝试均为 0 | `src/projects/cx.ts:3399` | 1 |
| F16 | P2 | 新 | 真正顶层 reload 后，terminalExpired、attempts 和 declined 全部丢失；旧 rebuild 测试仅新建 VM 并保留同一个 DOM 属性表 | `src/projects/cx.ts:3090`；`src/projects/cx.ts:2007` | 7 |

合并说明：异步预检查后才 POST、XHR 在安装监控前已 open，均并入 F10 的“最终提交必须有证据”，不重复计数。保存路径直接覆盖 `frameWindow.alert` 且未恢复的源码事实并入 F06。跨源限制不能直接认定为用户原课程重复提示的根因；原 HTML 未提供足够来源信息。

## Task 1: 区分保存、禁用和真实失败

**Files:** Modify `src/projects/cx.ts`、`src/projects/cx-deferred-chapters.ts`；Test `scripts/cx-deferred-study.test.mjs`、`scripts/cx-deferred-chapters.test.mjs`，新增 `scripts/cx-chapter-outcomes.test.mjs`。

**Interfaces:** 保留非章节任务的现有返回契约。章节结果增加明确的 `disposition: 'completed' | 'saved' | 'deferred' | 'manual' | 'disabled' | 'not-ready' | 'missing' | 'retryable-failure' | 'terminal-expired'`；`SearchJobResult` 增加 `blocked?: { jobId: string; reason: 'disabled' | 'not-ready' | 'missing' }`。`DeferredChapterTask` 增加 `pauseReason?: 'saved' | 'disabled' | 'not-ready' | 'manual'`，暂停任务仍为 deferred。选择器忽略暂停项；仅剩暂停项时课程动作返回 `{ type: 'paused' }`，不得宣告 settled。真实任务终态仍由现有 ledger 管理。

- [ ] **Step 1:** 加入 `save stops automatic rescanning`、`no-auto-submit does not repeat answering`、`disabled deferred job stays resumable` 回归。前两项使用真实 `searchJob` 和其释放逻辑；自动轮次不得超过 1 次保存，不能仅断言一个 stub 的返回值。空 answererWrappers 也必须有限暂停。禁用场景断言 attempts=0、missingVisits=0、state=deferred，再启用后可继续；仅剩 saved/disabled 时断言 paused 而非 settled。
- [ ] **Step 2:** 运行上述测试，保存当前失败输出，分别证明无限重扫和错误 missing 计数。
- [ ] **Step 3:** 在生产保存分支返回 saved；本轮处理后暂停该答题任务并继续其它可处理内容，禁止重新搜题/保存。disabled/manual/not-ready 均不进入失败或缺失计数；只有确认实际缺失才使用现有有限 missing 预算。重新启用设置或确认加载完成只解除对应的暂停原因；manual/saved 必须由用户明确恢复或开启新一轮处理，不能通过自动重扫清空暂停状态。
- [ ] **Step 4:** 运行 `node --test --test-concurrency=4 scripts/cx-chapter-outcomes.test.mjs scripts/cx-deferred-chapters.test.mjs scripts/cx-deferred-study.test.mjs`，要求全部通过，普通失败仍受 `1 + getUnfinishedQuestionRetryAttempts()` 限制。

## Task 2: 给正常扫描增加有效依据

**Files:** Modify `src/projects/cx.ts`、`src/projects/cx-deferred-course.ts`、`src/projects/cx-deferred-chapters.ts`；Test `scripts/cx-deferred-course.test.mjs`、`scripts/cx-deferred-study.test.mjs`。

**Interfaces:** 保持目录数组调用兼容，章节 metadata 增加可选 `normalSignature`，检查记录增加可选 `inspectedSnapshots`（稳定目录任务标识及未完成计数）。`chooseCourseDeferredAction(state, currentChapterId, chapters, chapterStates, mode)` 增加 mode 和 blocked/paused 结果；空目录不能作为课程就绪证据。读取旧状态时兼容缺失的快照字段。

**Ruling:** 用户澄清 next 不得回走，因此取消原计划的自动 remaining 扫描阶段。到课程末尾仍有早先普通任务未检查时暂停并提示手动处理，不能自动回跳或提前回访延期任务；代价是从课程中部开始时可能需要人工补查前面的普通任务。

- [ ] **Step 1:** 加入 F01、F05、F11 回归。断言首次发现 expiry 前的未就绪普通页不能持久标为 inspected；空目录时 submissions=0；已处理章节在离开后新增普通任务时，late-normal 必须早于第一次 retry。
- [ ] **Step 2:** 用当前实现运行以上三个反例并保留失败结果。
- [ ] **Step 3:** 无论是否已有延期队列，只有真实完成或确认没有普通待处理内容时才能记录检查。目录未知时有界等待，耗尽后暂停；不得把当前章兜底节点当成全课程目录。记录检查时所依据的目录签名和 tab 集合；发现未完成数量增加、新 tab、新章节或目录版本变化时，使对应普通检查失效，保留原有终态和尝试次数。
- [ ] **Step 4:** next 只选后续同章 tab，最后 tab 进入后续章节；课程末尾缺少早先普通检查证据时暂停。job 可以检查同章剩余 tab 及早先普通章节。全部普通任务检查后才允许 retry。
- [ ] **Step 5:** 运行两个测试文件，断言多章、多 tab、多 job、相同 job ID、动态增加/移除任务均不提前回访，不重新激活 terminalExpired。

## Task 3: 统一延期与普通导航策略

**Files:** Modify `src/projects/cx.ts`；Test `scripts/cx-deferred-study.test.mjs`、`scripts/cx-visible-content-fallback.test.mjs`。

**Interfaces:** `routeDeferredCourse(context, opts: StudyOptions): Promise<'scan' | 'retry' | 'settled' | 'none' | 'paused'>` 接收完整设置，所有调用方必须 await；新增内部 `navigateStudyTarget(context, target, opts): Promise<'navigated' | 'paused' | 'stale'>`，供两条调度路径共用。target 为章节或 tab 的稳定身份，不使用数组旧下标确认目标。

- [ ] **Step 1:** 加入 next 后续同章 tab、最后 tab 进入下一章且不回跳、手动模式零自动导航、点击无效 3 次后暂停、倒计时内人工切换取消导航、延期结束执行 backToFirst 的回归；先运行确认原错误失败。
- [ ] **Step 2:** 将实际点击、闯关检查、重复停留检查和有限失败计数收敛到共用导航入口。每次异步等待后核对原课程、章、tab 及文档代次，旧操作不得跳转新页面。3 次无效导航后暂停并只提示一次。
- [ ] **Step 3:** 按 Task 2 的扫描阶段执行 next/job；manually 只显示下一目标，不自动切换。队列收尾执行 `backToFirstWhenFinish` 等原完成策略；回首章不得清空已放弃记录或重试预算。
- [ ] **Step 4:** 运行延期主流程和现有导航测试，确保无延期时原行为、完成成功弹窗及用户设置仍有效。

## Task 4: 让提交结果有归属、有完成证据

**Files:** Modify `src/projects/cx.ts`、`src/projects/cx-chapter-submission.ts`；Test `scripts/cx-chapter-submission.test.mjs`、`scripts/cx-chapter-dialog.test.mjs`，新增 `scripts/cx-submission-lifecycle.test.mjs`。

**Interfaces:** 用 `ChapterSubmissionIdentity { courseId, classId, chapterId, tabKey, jobId, attemptId }` 绑定每次尝试；监控通知携带 identity、requestId、ownerWindow 和响应。helper 接收 `phase: 'open-confirmation' | 'submit'`，返回有类型的 `ChapterSubmissionOutcome`：`'confirmation-ready' | 'submitted' | 'terminal-expired' | 'retryable-failure' | 'not-started' | 'cancelled'`，不得继续用 false 同时表示成功和未发请求。

- [ ] **Step 1:** 加入 A 成功/B 过期串扰、两提交函数缺失、函数只在 parent、异步预检查、预先 open 的 XHR、超时迟到回调、并发 hook 完整恢复的 Chromium 回归；先跑当前实现取得失败输出。F10 必须断言 POST=0 时 complete=false、cacheWrites=0。
- [ ] **Step 2:** 按已知 form/URL/body 中的 job/work 及课程字段关联请求，支持 URLSearchParams、FormData、字符串和 fetch Request clone；不得消费页面原请求体。共享 parent/top 上的未知归属请求或原生弹窗不得终止当前任务。原始请求与 callback 结果都带 request/attempt 身份。
- [ ] **Step 3:** open-confirmation 阶段允许只出现确认层；submit 阶段必须观察到匹配请求的完成，或同一任务明确的页面完成证据。缺函数、无请求、结果未知只能等待、暂停或正常失败，不可完成或写缓存。明确成功后才提交缓存。
- [ ] **Step 4:** 为同一窗口安装唯一的共享 hook 注册表，调用者订阅并持有独立 token；包括多 iframe 和重复脚本实例。最后一个订阅退出才恢复原函数，并保护页面之后安装的新 wrapper。删除保存分支中永久将 alert 赋为空函数的路径。
- [ ] **Step 5:** 最终提交的一次尝试共用 30000ms 截止。超时、取消、异常退出时，中止本次拥有的 XHR/fetch 并收尾 callback，再释放监听；不触碰其它任务请求。服务端是否已接收不靠 abort 推断，重试前先核对该任务页面完成证据。旧尝试迟到结果不可覆盖新尝试或新文档。
- [ ] **Step 6:** 运行三个 Chromium 测试文件，断言 A 不受 B 影响、所有全局函数恢复、无额外 POST、超时后无过期弹窗漏出；普通失败仍按正常次数重试。

## Task 5: 统一响应状态优先级

**Files:** Modify `src/projects/cx.ts`，必要时将解析函数移入专用 `src/projects/cx-chapter-response.ts`；Test `scripts/cx-chapter-expiry.test.mjs`、`scripts/cx-chapter-submission.test.mjs`。

**Interfaces:** `classifyChapterSubmissionResponse(value: unknown): 'success' | 'terminal-expired' | 'retryable-failure' | 'unknown'` 供 Task 4 使用；保留 cycle/depth 防护以及原生文本与结构化响应的区别。

- [ ] **Step 1:** 加入显式 success 配合 data/error 历史过期文案的回归，断言 success；保留 false/0/字符串失败状态、JSON 字符串、已知包装对象、数组、原生文本、HTTP 错误体和普通登录过期的覆盖。先跑 F08 反例确认失败。
- [ ] **Step 2:** 在应用结果节点先识别明确状态。该节点显式成功时，不递归扫描其它字段的过期文本；无应用状态的已知包装节点才逐层展开。明确失败但不是任务过期时返回 retryable-failure；不靠全页或任意文本包含“过期”归类。
- [ ] **Step 3:** 运行两个测试文件，确保宽格式兼容保留，同时不错误终止成功任务或登录失效场景。

## Task 6: 精确关闭两套已知确认层

**Files:** Modify `src/projects/cx-chapter-dialog.ts`；Test `scripts/cx-chapter-dialog.test.mjs`。

**Interfaces:** `dismissChapterSubmissionDialog` 接收 Task 4 的拥有者/任务上下文，返回是否实际关闭；只处理可关联到本任务的已知确认层。结构匹配器分别覆盖 Marking 与 AlertCon02。

- [ ] **Step 1:** 添加原 HTML 脱敏后的 `#confirmSubWin.AlertCon02`、`#tipContent`、“确定”及“取消”/`hideWindow()` 结构，运行实际 helper 过期路径，断言 popup 和关联 mask 均隐藏、取消回调一次、submit 回调和新增 POST 均为 0；先确认当前版本失败。
- [ ] **Step 2:** 按实际 ownerDocument 走对应取消或关闭回调，回调未关闭时仅清理这套确认层的关联遮罩；不可批量隐藏 `.mask` 或同页其它弹窗。关闭时再次核对模板身份，避免取消回调刚显示的新提示被隐藏。
- [ ] **Step 3:** 复测 top/iframe 两种拥有者、真实 a 标签、多层 iframe、隐藏模板、残留遮罩、模板复用和跨任务互不影响。普通失败的确认交互仍可用于下一次正常重试。

## Task 7: 共享手动决定并定义重载边界

**Files:** Modify `src/projects/cx.ts`；Create `src/projects/cx-course-session.ts`、`scripts/cx-course-session.test.mjs`；Test `scripts/cx-expiry-browser.test.mjs`、`scripts/windows-store-safety.test.mjs`。仅在确有可复用传输接口时复用 `src/runtime/message.ts` 的桥接能力，不将课程业务状态塞进 Swal options。

**Interfaces:** `CourseSessionScope { courseId: string; classId: string }`；`CourseSessionSnapshot { version: 1; runId: string; scope: CourseSessionScope; manualDecision: 'pending' | 'accepted' | 'declined' | undefined; chapterStates: Record<string, ChapterDeferredState>; courseState: CourseDeferredState }`。会话模块提供 `readCourseSession(scope): Promise<CourseSessionSnapshot | undefined>`、`updateCourseSession(scope, command): Promise<CourseSessionSnapshot>`、`beginCourseRun(scope): Promise<CourseSessionSnapshot>` 和 `requestManualAnswerDecision(scope): Promise<boolean>`。command 为可序列化的 `record-inspection`、`reserve-attempt`、`record-result`、`set-manual-decision` 操作，携带 runId、对应任务身份及操作数据；不能把 updater 函数放入 postMessage。顶层按最新快照串行应用命令，保护终态和尝试计数。

- [ ] **Step 1:** 加入两个跨源 iframe 共享 pending/declined、跨源消息伪造、真正 page.reload 恢复终态和次数、存储拒绝和 no-disk-write 的 Chromium 回归。先确认 prompts=2 和 reload 清空状态的反例；不得用只换 VM 的测试替代 page.reload。
- [ ] **Step 2:** 顶层课程会话拥有唯一的人工决定。跨源使用有上限的握手和经过 origin、event.source、消息类型、requestId、scope 校验的消息桥；另一任务等同一个决定，不重复开窗。初始化须等待快照，不能先用空 DOM 状态开始处理；取消后停止自动答题，顶层接管后不能因用户久未操作而开第二个弹窗。无法确认课程身份或桥接失败时暂停，不自行新开一个决定窗口。
- [ ] **Step 3:** 标准模式按 tab 内课程会话使用 sessionStorage 保存版本化状态；同一次运行的页面恢复不重开终态，不清零次数，不重问 declined。课程/班级隔离；只有明确开始新的课程运行才重置该运行状态。
- [ ] **Step 4:** Windows no-disk-write 或存储不可用时只使用内存协调，不写 sessionStorage/localStorage/宿主配置。已有决定、尝试或终态时禁止程序自动顶层重载，转为暂停；用户主动新文档在此模式下是新的内存运行，不能宣称能恢复已消失的页面状态。不要为此扩展冻结宿主。
- [ ] **Step 5:** 运行 session、iframe 和 store safety 测试。断言同一运行 prompts=1；标准模式真正 reload 后次数与终态不变；无落盘模式写入次数为 0，自动恢复不会偷偷开启新一轮。

## 实施顺序与集成验证

1. 先落地各项失败回归；优先 Task 1 和 Task 4，防止无界重答、错误完成和跨任务误放弃。
2. Task 2 完成后接 Task 3，统一普通扫描和导航；Task 5、6 可独立写测试，再接 Task 4 的结果。
3. Task 7 接入统一会话状态。各任务修改 `cx.ts` 时串行整合，不能让多个实现者覆盖同一文件的状态契约。
4. 每项结束先跑对应行为测试。最终增加本地课程端到端页面：多章、多 tab、多 job、同 job ID、动态增加任务、受限跳转、两个并发提交、双模板、真正重载；从实际构建入口启动，覆盖环境准备、study 和提交 callback 的联动。不能只保留源码字符串断言或 AST stub。
5. 显式展开全部测试文件并执行下面命令，记录文件数、实际测试数、退出码、跳过原因及原始摘要；新增测试后不沿用写死的数量。

```powershell
$testFiles = @(Get-ChildItem -LiteralPath scripts -Filter '*.test.mjs' -File | Sort-Object Name | Select-Object -ExpandProperty FullName)
$testFiles.Count
node --test --test-concurrency=4 @testFiles
node node_modules/typescript/bin/tsc --noEmit
npm run build
npm run build:windows
git diff --check
```

6. 验证通过后同步 AGENTS.md 中实际生效的状态、重载和导航约定；不把计划或未验证推测写成已修复事实。按是否允许提交记录最终提交号；不自动推送或合并。

## 实施前验证基线

- 同一提交上一轮全量基线：显式展开 103 个测试文件，1039 tests / 899 pass / 0 fail / 140 skipped，退出 0；类型检查、普通构建、Chrome 75 构建和 diff check 均退出 0。此为实施前结果，不代表本次最终验证。
- 只读审查阶段重新运行 7 个截止/延期/提交/弹层相关文件：97 tests / 97 pass / 0 fail / 0 skipped，退出 0。当时未包含本文件列出的失败反例，也未修改业务代码；此描述仅适用于实施前阶段。
- 当时的新增反例通过内存提取实际实现或本地 Chromium 验证。后续已实现运行时修复并持久新增行为和浏览器回归，不能再沿用“本轮未修改业务代码”的结论。

## 合并实施记录

Task 1-7 的运行时改动及对应回归已完成。此处合并记录最终实现，不将上面的计划步骤逐项改成已验证，也不追认没有独立输出的先红过程。

| 任务 | 实施结果与主要回归 |
| --- | --- |
| 1：任务结果与暂停 | 章节结果区分 completed、saved、deferred、manual、disabled、not-ready、missing、retryable-failure 和 terminal-expired；保存、禁用和未就绪不会无界重新答题或消耗缺失预算。ledger 记录具体 pauseReason，仅剩暂停任务时不宣告全部完成。`cx-chapter-outcomes`、`cx-deferred-chapters`、`cx-deferred-study` 覆盖结果与计数。 |
| 2：正常扫描依据 | 目录元数据使用 normalSignature，课程检查记录保存 inspectedSnapshots 的签名和未完成数；空目录、未映射内容或未完成附件不能作为已检查证据。新增普通任务使对应检查失效，已放弃状态和尝试次数仍保留。`cx-deferred-course`、`cx-deferred-study` 覆盖调度。 |
| 3：导航 | 普通与延期导航共用守卫，异步等待后核对上下文并限制无效点击。next 仅前往后续同章子任务，最后子任务进入下一章；课程末尾若缺少早先普通任务检查证据则暂停，不回走。job 按未完成任务推进，manually 不自动切页；延期结束保留完成策略。`cx-deferred-navigation.browser` 使用本地 Chromium 验证实际导航。 |
| 4：提交证据与归属 | 提交监听按任务、尝试和请求关联，窗口级共享 hook 支持订阅清理；最终尝试共用截止时间，收尾中止本次拥有的请求并隔离迟到结果。无请求、缺函数和未知结果不会完成任务或写缓存。`cx-chapter-submission`、`cx-upload-flow.browser` 与 `cx-chapter-outcomes` 覆盖真实上传调用链及生命周期。 |
| 5：响应优先级 | 显式成功优先于同一结果中的历史过期文案；对象、JSON 字符串及已知包装格式仍兼容。明确作业过期立即终止对应任务，普通失败保留正常重试；不将登录过期当作作业过期。`cx-chapter-expiry`、`cx-chapter-submission` 覆盖。 |
| 6：确认层关闭 | 精确支持 Marking 与 AlertCon02 两套已知模板，在实际 ownerDocument 优先执行取消/关闭回调，只清理关联遮罩，并保留其它提示及后续模板复用。`cx-chapter-dialog` 的实际 DOM 回归覆盖。 |
| 7：课程会话 | 新增 cx-course-session，顶层统一人工决定并校验跨源桥接的来源、请求与作用域；接管后的等待不会再次本地弹窗。DOM ledger 镜像与版本化 sessionStorage 恢复终态、次数及拒绝决定；按扩展 tabIdentity 分区，避免新标签复制存储后继承旧决定。no-disk-write 或存储失败时只保留内存，并通过 canReload 阻止程序丢失状态后自动重启。`cx-course-session` 覆盖真实 reload、跨源与存储边界。 |

实际接口与原计划有以下差异，属于保持兼容和缩小改动面的取舍：

- 提交 helper 增加 `phase: 'open-confirmation' | 'submit'`，保留现有 boolean 返回契约；没有整体替换为上面设想的 `ChapterSubmissionOutcome` 联合返回值。调用方结合提交观察结果和任务 disposition 判断完成、重试或终止，不能仅凭 boolean 推断已提交。
- 会话入口为 `initializeCourseSession`，返回 `ready`、`requestManualDecision`、`resumeManualDecision`、`persist` 和 `canReload`。保留现有 DOM ledger 的原子读写，由会话模块镜像、验证并持久化；未采用计划中的 generic command updater、`updateCourseSession(scope, command)` 或通用命令调度层。异步结果写回前仍须重读最新 ledger，保护终态和计数。
- 提交流程浏览器用例落在 `cx-upload-flow.browser.test.mjs` 等实际测试文件中，未创建计划设想的 `cx-submission-lifecycle.test.mjs`；响应识别沿用现有模块，没有为计划中的分类函数额外建立通用模块。

用户后续暂停要求的实施结果：

- 面板按钮始终可点击；无 worker 时先记录暂停意图，新 worker 注册后立即应用。控件点击读取当前 worker，失效 worker 不复活；继续操作清理当前标签页的手动/保存暂停原因，并通过活动运行守卫避免重复启动。
- 新增 tab-answer-pause 页面控制器和小型扩展 background。background 使用 `sender.tab.id` 隔离暂停状态，写入 `chrome.storage.session`，标签关闭时清理；入口在主包启动前完成恢复，同一标签的导航、重载、跨源页面和 iframe 共享该状态。新标签的 tabId 不同，不继承源标签暂停。
- 入口同时提供 tabIdentity，课程 session 用它分区 sessionStorage，即使 `window.open` 复制了源标签的存储，新标签也独立决定是否自动答题。暂停更新先在当前页同步生效，异步回执不得覆盖更新的本地意图。
- background 读取失败时暂停且标记不持久；写入失败保留本次请求的内存状态，入口标记 memory，已暂停时 canReload 为 false。不使用 localStorage、storage.local 或宿主共享配置保存此状态。非扩展/原生内存模式不承诺跨新文档恢复，不能为此绕过 no-disk-write。
- `answer-work-controls-browser`、`tab-answer-pause` 与 `cx-runtime-integration.browser` 覆盖面板、扩展和整包联动；pageshow.persisted 的恢复分支有合成事件回归，不能据此宣称真实 BFCache 往返已验收。

最终复核还补入旧操作与成绩证据保护：`waitForTabAnswerContinue` 在入口、循环及出口核对文档归属；章节 upload 捕获初始 context/jobId，同一 document 切换任务后旧操作也不能提交。当前 jobId 不符时，在查找父窗口入口前直接终止。AI 二次提交后重新检查及格线，仍不及格则返回 retryable-failure，不关闭提示或写缓存。新增回归覆盖旧文档、旧任务、父窗口入口以及 AI 二次未过/已过；其中二次未过及同标签不同 job 的问题均留存修前失败、修后通过输出，完整结果见下。

## 本次验证与验收边界

已留存的整包目标验证命令：

```powershell
node --test --test-concurrency=4 scripts/cx-runtime-integration.browser.test.mjs scripts/tab-answer-pause.test.mjs scripts/manifest-permissions.test.mjs
```

原始摘要：

```text
tests 19
suites 0
pass 19
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 14936.1336
exit 0
```

其中整包用例加载实际 `dist/chaoxing-plus.js`、扩展入口、background 和 vendor，运行真实 CommonProject、worker 与 Swal；本地拦截页面及搜题请求。已验证按钮常驻可点击、同标签 URL 导航保留暂停、独立新标签不继承暂停、手动拒绝后显示继续、一次继续恢复实际搜题，以及 `window.open` 复制存储后新标签仍有独立人工决定。扩展目标还覆盖跨源 iframe、service worker 重启、快速切换、存储错误和消息校验；manifest 目标确认构建产物与权限范围。

- 最终全量：显式展开 111 个 `scripts/*.test.mjs` 文件，以 `node --test --test-concurrency=4 @testFiles` 执行，退出码 0。原始摘要如下；当时的完整输出保存在本机忽略文件 `.tmp-tests-final-complete.log`，该临时日志现已清理。140 项跳过主要是需要显式提供已编译原生测试 EXE 或窗口环境的既有条件用例，不能视为这些原生场景已验收。

```text
tests 1135
suites 0
pass 995
fail 0
cancelled 0
skipped 140
todo 0
duration_ms 117137.5283
test_exit=0
```

- `node node_modules/typescript/bin/tsc --noEmit`：退出 0，无诊断。
- `npm run build`：退出 0，62 modules transformed，主包 370.36 kB。
- `npm run build:windows`：退出 0，主包 389624 字节；主包、bootstrap 与 trampoline 均通过 Chrome 75 语法闸门。
- `git diff --check`：退出 0，无空白错误，仅存在 Git 行尾转换提示。
- 所有上述浏览器验证均为本地 Chromium 模拟页面；未执行真实超星课程、真实 CEF 75 客户端或真实服务端提交验收。异步预检查的契约反例不代表已确认当前真实网页采用该时序。测试创建的浏览器、临时扩展目录与本地服务由测试负责清理。
- 未执行 commit、push、merge 或 rebase，改动留在当前工作区供用户审阅。

## Plan Self-Review

- [x] F01-F16 全部映射到具体任务，旧项和新项已去重；附属时序并入 F10，全局 alert 覆盖并入 F06。
- [x] next、job、manually、backToFirst、闯关守卫、正常重试、手动决定和两套弹层均有明确验收。
- [x] 提交阶段、任务身份和缓存完成条件使用同一契约；保存不等于提交成功，未知不等于成功。
- [x] 真正重载与替换 VM 分开验证；标准模式与 no-disk-write 的边界已写明，不引入宿主状态写入。
- [x] 实施前计划与实施后结果已分开记录；不追认每一个计划步骤都已留存先红证据，局部结果与最终全量、类型和双构建结果分别记录。
