# 超星可见内容兜底答题与 AI Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修正 `chaoxing_plus` 在 `/knowledge/cards` 页面中因标准 attachment/job 识别失败而误跳过可见题目的问题，并让 `tikuAdapter` 提供统一 AI fallback 服务与稳定错误结构，支持 AI 未配置时的安全降级。

**Architecture:** 在 `chaoxing_plus` 中保留现有超星学习主链与章节答题器，把新能力收敛到“可见题目兜底入口 + 更保守的收尾判定 + AI fallback 调用适配”三处。 在 `tikuAdapter` 中复用现有 AI search 配置能力，新增独立的 AI fallback controller/service 返回统一成功/失败结构，而不是让前端直接复用当前 search AI mode 的隐式语义。

**Tech Stack:** TypeScript、Node `node:test`、超星学习脚本 `src/projects/cx.ts`、题库适配配置 `src/projects/tiku-adapter-config.ts`、Go Gin controller/service、现有 `ChatGptClient`、现有 AI search 配置记录。

---

## File Structure

### `chaoxing_plus`

- Modify: `src/projects/cx.ts`
  - 增加“可见题目兜底”识别结果与决策逻辑。
  - 收紧“页面任务点已完成，即将跳转”的触发条件。
  - 在章节测试搜题链路中接入 AI fallback 调用。
- Modify: `src/projects/tiku-adapter-config.ts`
  - 新增 AI fallback 请求工具与统一响应解析。
- Modify: `src/projects/common.ts`
  - 增加超星学习配置项：可见题目兜底答题、AI 兜底搜题、AI 失败后行为。
- Modify: `scripts/tiku-adapter-wiring.test.mjs`
  - 增加 source-assertion，锁定新配置项与 AI fallback 接线。
- Create: `scripts/cx-visible-content-fallback.test.mjs`
  - 用最小源码断言锁定 `cx.ts` 中的兜底路径与保守收尾语义。

### `tikuAdapter`

- Modify: `internal/controller/ai_search_config.go`
  - 复用现有 AI config 读取逻辑，必要时抽出共享 helper。
- Modify: `internal/controller/search.go`
  - 若已有 AI 搜索 helper 可复用，则提炼最小共享能力，不直接把 fallback 语义塞进现有 `/adapter-service/search` 成功流。
- Modify: `internal/service/ai_search_config.go`
  - 提供“AI 是否可用/已配置”的标准解析入口。
- Create: `internal/controller/ai_fallback.go`
  - 暴露统一 AI fallback endpoint。
- Create: `internal/controller/ai_fallback_test.go`
  - 覆盖未配置 AI、参数错误、正常返回、上游失败等情况。
- Create: `internal/service/ai_fallback.go`
  - 统一封装 AI fallback 请求与标准结果结构。
- Create: `internal/service/ai_fallback_test.go`
  - 覆盖结果结构与错误码归一化。
- Modify: 路由注册文件（以实际项目路由文件为准，预计在 `cmd` 或 `internal/router` 中）
  - 注册 AI fallback endpoint。

不拆大文件，不做与本次需求无关的超星主链重构。

### Task 1: 锁定 `chaoxing_plus` 的可见题目兜底入口与保守收尾语义

**Files:**
- Create: `scripts/cx-visible-content-fallback.test.mjs`
- Modify: `src/projects/cx.ts:914-1203`

- [ ] **Step 1: Write the failing test**

在 `scripts/cx-visible-content-fallback.test.mjs` 新建最小源码断言测试文件，写入：

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const cxPath = resolve(process.cwd(), 'src', 'projects', 'cx.ts');

test('cx study exposes visible-content fallback states and avoids treating visible questions as completed', async () => {
  const source = await readFile(cxPath, 'utf8');

  assert.equal(source.includes("type VisibleContentState = 'standard-job' | 'finished-job' | 'visible-nonjob' | 'visible-unmapped' | 'empty'"), true);
  assert.equal(source.includes('visibleContentState !== \'empty\''), true);
  assert.equal(source.includes('检测到页面存在可处理内容，但当前未识别为标准任务点。'), true);
  assert.equal(source.includes('页面任务点已完成，即将跳转。'), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test "scripts/cx-visible-content-fallback.test.mjs"
```

Expected: FAIL because `cx.ts` 还没有 `VisibleContentState`、保守收尾条件和新提示语。

- [ ] **Step 3: Write minimal implementation**

在 `src/projects/cx.ts` 中做最小实现：

1. 在 `study()` / `searchJob()` 附近新增显式状态类型：

```ts
type VisibleContentState = 'standard-job' | 'finished-job' | 'visible-nonjob' | 'visible-unmapped' | 'empty';
```

2. 让 `searchJob()` 返回时能同时提供“是否存在可见内容但未形成标准 job”的信息；可通过新增 `searchJobState(...)` helper 或扩展现有返回值完成，但必须保持最小改动。

3. 收尾前根据状态分支：

```ts
if (visibleContentState !== 'empty') {
  const msg = '检测到页面存在可处理内容，但当前未识别为标准任务点。';
  showTopCenterNotice(msg, { duration: 0, tone: 'warning' });
  $message.warn({ content: msg, duration: 0 });
  $console.warn(msg);
  return;
}
```

保留原有：

```ts
const msg = '页面任务点已完成，即将跳转。';
```

仅在 `visibleContentState === 'empty'` 时触发。

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test "scripts/cx-visible-content-fallback.test.mjs"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/cx-visible-content-fallback.test.mjs src/projects/cx.ts
git commit -m "$(cat <<'EOF'
修复：收紧超星页面完成判定
EOF
)"
```

### Task 2: 让章节测试在可见题目但非标准任务点时进入现有答题链路

**Files:**
- Modify: `scripts/cx-visible-content-fallback.test.mjs`
- Modify: `src/projects/cx.ts:1064-1160`

- [ ] **Step 1: Write the failing test**

向 `scripts/cx-visible-content-fallback.test.mjs` 追加：

```js
test('cx chapter test fallback runs when TiMu is visible without a standard job attachment', async () => {
  const source = await readFile(cxPath, 'utf8');

  assert.equal(source.includes('enableVisibleQuestionFallback'), true);
  assert.equal(source.includes("visibleContentState === 'visible-nonjob' || visibleContentState === 'visible-unmapped'"), true);
  assert.equal(source.includes('await JobRunner.chapter(root, opts.workOptions);'), true);
  assert.equal(source.includes('正在尝试兜底处理当前可见题目'), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test "scripts/cx-visible-content-fallback.test.mjs"
```

Expected: FAIL because 还没有显式的可见题目兜底配置与提示。

- [ ] **Step 3: Write minimal implementation**

在 `src/projects/cx.ts` 中：

1. 在 study 配置和 `StudyOptions` 中新增：

```ts
enableVisibleQuestionFallback: {
  label: '可见题目兜底答题',
  attrs: { type: 'checkbox', title: '当页面中存在题目但未识别成标准任务点时，仍尝试进入章节测试答题。' },
  defaultValue: true
}
```

2. 在章节测试分支中，当检测到 `.TiMu` 但 `workType` 不是标准 `job`，且状态为 `visible-nonjob` 或 `visible-unmapped`，并且 `enableVisibleQuestionFallback` 为真时，复用原来的：

```ts
func = async () => {
  const msg = '正在尝试兜底处理当前可见题目';
  $message.info(msg);
  $console.log(msg);
  await JobRunner.chapter(root, opts.workOptions);
};
```

不要创建新的答题器，也不要改 `JobRunner.chapter(...)` 的题目填写主逻辑。

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test "scripts/cx-visible-content-fallback.test.mjs"
```

Expected: PASS.

- [ ] **Step 5: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/cx-visible-content-fallback.test.mjs src/projects/cx.ts
git commit -m "$(cat <<'EOF'
修复：为超星可见题目添加兜底答题
EOF
)"
```

### Task 3: 为 `chaoxing_plus` 接入 AI fallback 配置与请求适配

**Files:**
- Modify: `scripts/tiku-adapter-wiring.test.mjs`
- Modify: `src/projects/tiku-adapter-config.ts`
- Modify: `src/projects/common.ts`
- Modify: `src/projects/cx.ts`

- [ ] **Step 1: Write the failing test**

在 `scripts/tiku-adapter-wiring.test.mjs` 追加：

```js
test('tiku adapter config exposes AI fallback request helpers and standardized error parsing', async () => {
  const source = await readFile(commonPath, 'utf8');
  const configSource = await readFile(resolve(process.cwd(), 'src', 'projects', 'tiku-adapter-config.ts'), 'utf8');

  assert.equal(source.includes('AI 兜底搜题'), true);
  assert.equal(source.includes('AI 兜底失败后行为'), true);
  assert.equal(configSource.includes('createTikuAdapterAIFallbackUrl'), true);
  assert.equal(configSource.includes('requestTikuAdapterAIFallback'), true);
  assert.equal(configSource.includes('type TikuAdapterAIFallbackErrorCode ='), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test "scripts/tiku-adapter-wiring.test.mjs"
```

Expected: FAIL because 新配置项与 AI fallback helper 还不存在。

- [ ] **Step 3: Write minimal implementation**

1. 在 `src/projects/common.ts` 的超星学习设置区新增：

```ts
enableAIFallbackAnswer: {
  label: 'AI 兜底搜题',
  attrs: { type: 'checkbox', title: '普通题库失败后，允许调用 tikuAdapter AI fallback。' },
  defaultValue: false
},
aiFallbackFailureAction: {
  label: 'AI 兜底失败后行为',
  options: [
    ['pause', '停留当前页'],
    ['skip', '继续后续流程']
  ],
  defaultValue: 'pause'
}
```

2. 在 `src/projects/tiku-adapter-config.ts` 中新增：

```ts
export type TikuAdapterAIFallbackErrorCode = 'AI_UNAVAILABLE' | 'NO_ANSWER' | 'UPSTREAM_ERROR' | 'INVALID_INPUT' | 'UNSAFE_TO_ANSWER';

export function createTikuAdapterAIFallbackUrl(baseurl: string): string {
  const normalized = resolveTikuAdapterBaseUrl(baseurl);
  return normalized ? `${normalized}/adapter-service/ai-fallback` : '';
}

export async function requestTikuAdapterAIFallback(...) { /* 最小 fetch 封装与标准结果解析 */ }
```

3. 在 `src/projects/cx.ts` 的章节测试搜索 provider 中，保持原有缓存/普通题库顺序；仅在普通 provider 无结果时，且 `enableAIFallbackAnswer` 为真时，再调用 `requestTikuAdapterAIFallback(...)`。

AI fallback 的失败不应直接抛成“页面已完成”；只把结构化错误交给上层失败策略使用。

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test "scripts/tiku-adapter-wiring.test.mjs"
```

Expected: PASS.

- [ ] **Step 5: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/tiku-adapter-wiring.test.mjs src/projects/common.ts src/projects/tiku-adapter-config.ts src/projects/cx.ts
git commit -m "$(cat <<'EOF'
功能：接入题库 AI 兜底搜题配置
EOF
)"
```

### Task 4: 为 AI 未配置与 AI 失败场景锁定前端降级行为

**Files:**
- Modify: `scripts/cx-visible-content-fallback.test.mjs`
- Modify: `src/projects/cx.ts`
- Modify: `src/projects/tiku-adapter-config.ts`

- [ ] **Step 1: Write the failing test**

向 `scripts/cx-visible-content-fallback.test.mjs` 追加：

```js
test('cx fallback flow does not treat AI_UNAVAILABLE as page completion', async () => {
  const source = await readFile(cxPath, 'utf8');

  assert.equal(source.includes('AI 兜底未配置，已跳过 AI 搜题'), true);
  assert.equal(source.includes("error.code === 'AI_UNAVAILABLE'"), true);
  assert.equal(source.includes('检测到题目但当前无法安全自动作答，请手动处理。'), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test "scripts/cx-visible-content-fallback.test.mjs"
```

Expected: FAIL because 前端还没有结构化处理 `AI_UNAVAILABLE`。

- [ ] **Step 3: Write minimal implementation**

在 `src/projects/cx.ts` 中：

- 对 AI fallback 结果做结构化分支。
- 当 `error.code === 'AI_UNAVAILABLE'` 时：

```ts
$console.warn('AI 兜底未配置，已跳过 AI 搜题');
```

- 当普通题库与 AI fallback 最终都无法给出答案时：

```ts
const msg = '检测到题目但当前无法安全自动作答，请手动处理。';
showTopCenterNotice(msg, { duration: 0, tone: 'warning' });
$message.warn({ content: msg, duration: 0 });
$console.warn(msg);
```

- 仅当配置 `aiFallbackFailureAction === 'skip'` 时，才允许继续后续流程；默认 `pause`。

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test "scripts/cx-visible-content-fallback.test.mjs"
```

Expected: PASS.

- [ ] **Step 5: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/cx-visible-content-fallback.test.mjs src/projects/cx.ts src/projects/tiku-adapter-config.ts
git commit -m "$(cat <<'EOF'
修复：为题库 AI 兜底添加安全降级
EOF
)"
```

### Task 5: 为 `tikuAdapter` 新增统一 AI fallback 服务与错误码

**Files:**
- Create: `internal/service/ai_fallback.go`
- Create: `internal/service/ai_fallback_test.go`
- Create: `internal/controller/ai_fallback.go`
- Create: `internal/controller/ai_fallback_test.go`
- Modify: 路由注册文件（按项目实际位置）

- [ ] **Step 1: Write the failing test**

在 `internal/service/ai_fallback_test.go` 新建测试，覆盖最小行为：

```go
func TestBuildAIFallbackResultUnavailable(t *testing.T) {
    result := BuildAIFallbackUnavailableResult()

    if result.Success {
        t.Fatal("expected unavailable result to be unsuccessful")
    }
    if result.Error.Code != "AI_UNAVAILABLE" {
        t.Fatalf("expected AI_UNAVAILABLE, got %s", result.Error.Code)
    }
}
```

在 `internal/controller/ai_fallback_test.go` 新建测试，覆盖 HTTP 层：

```go
func TestAIFallbackReturnsUnavailableWhenAIIsNotConfigured(t *testing.T) {
    // 构造 gin router + handler，mock service 返回 AI_UNAVAILABLE
    // 断言 status 200 或 400 之外的统一 JSON 结构按设计返回
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
go test ./internal/service ./internal/controller
```

Expected: FAIL because 新 service/controller 还不存在。

- [ ] **Step 3: Write minimal implementation**

在 `internal/service/ai_fallback.go` 中定义统一结果结构：

```go
type AIFallbackErrorCode string

const (
    AIFallbackErrorAIUnavailable AIFallbackErrorCode = "AI_UNAVAILABLE"
    AIFallbackErrorNoAnswer      AIFallbackErrorCode = "NO_ANSWER"
    AIFallbackErrorUpstream      AIFallbackErrorCode = "UPSTREAM_ERROR"
    AIFallbackErrorInvalidInput  AIFallbackErrorCode = "INVALID_INPUT"
    AIFallbackErrorUnsafe        AIFallbackErrorCode = "UNSAFE_TO_ANSWER"
)
```

以及：

```go
type AIFallbackResult struct {
    Success bool              `json:"success"`
    Result  *AIFallbackAnswer `json:"result"`
    Error   *AIFallbackError  `json:"error"`
}
```

复用 `BuildAISearchRequestConfigWithDB(...)` 和现有 `ChatGptClient`；当未配置 `BaseURL`/`APIKey`/`Model` 或 config disabled 时，返回 `AI_UNAVAILABLE`。

在 `internal/controller/ai_fallback.go` 中提供独立 endpoint，接收题目、题型、选项并返回统一 JSON。

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
go test ./internal/service ./internal/controller
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add internal/service/ai_fallback.go internal/service/ai_fallback_test.go internal/controller/ai_fallback.go internal/controller/ai_fallback_test.go
git commit -m "$(cat <<'EOF'
功能：新增统一 AI 兜底服务
EOF
)"
```

### Task 6: 让 `tikuAdapter` AI fallback 复用现有 AI 配置并标准化失败返回

**Files:**
- Modify: `internal/service/ai_search_config.go`
- Modify: `internal/controller/ai_search_config.go`
- Modify: `internal/controller/search.go`
- Modify: 路由注册文件（按项目实际位置）
- Modify: `internal/controller/ai_fallback_test.go`
- Modify: `internal/service/ai_fallback_test.go`

- [ ] **Step 1: Write the failing test**

追加服务层测试：

```go
func TestResolveAIFallbackAvailabilityUsesExistingAISearchConfig(t *testing.T) {
    // 构造 enabled=false / 缺 baseUrl / 缺 apiKey / 缺 model 四种情况
    // 断言都返回 AI_UNAVAILABLE
}
```

追加 controller 测试：

```go
func TestAIFallbackReturnsNoAnswerWhenModelReturnsUncertainAnswer(t *testing.T) {
    // mock ChatGptClient 结果为“不确定”
    // 断言 error.code == NO_ANSWER
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
go test ./internal/service ./internal/controller
```

Expected: FAIL because 现有 AI config 还没有抽成 fallback 可复用的 availability 判定，也没有 `NO_ANSWER` 归一化。

- [ ] **Step 3: Write minimal implementation**

1. 在 `internal/service/ai_search_config.go` 新增最小 helper，例如：

```go
func IsAISearchConfigUsable(config AISearchRequestConfig) bool {
    return strings.TrimSpace(config.BaseURL) != "" && strings.TrimSpace(config.APIKey) != "" && strings.TrimSpace(config.Model) != ""
}
```

2. 在 AI fallback service 中：
   - 使用该 helper 判断是否可用
   - 将 “不确定” / 空答案 / 空数组 统一归一为 `NO_ANSWER`
   - 将上游 HTTP/解析错误统一归一为 `UPSTREAM_ERROR`

3. 路由注册 AI fallback endpoint。

不要改现有 `/adapter-service/search` 正常成功流的返回结构；只提炼最小共享 helper。

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
go test ./internal/service ./internal/controller
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add internal/service/ai_search_config.go internal/controller/ai_search_config.go internal/controller/search.go internal/service/ai_fallback.go internal/service/ai_fallback_test.go internal/controller/ai_fallback_test.go
git commit -m "$(cat <<'EOF'
调整：统一题库 AI 兜底错误返回
EOF
)"
```

## Self-Review

- **Spec coverage:**
  - 可见题目兜底入口：Task 1 + Task 2。
  - 收紧“页面已完成”语义：Task 1。
  - AI 仅作最后一级搜题来源：Task 3。
  - `tikuAdapter` 统一 AI fallback 服务：Task 5。
  - AI 未配置时安全降级：Task 4 + Task 6。
- **Placeholder scan:**
  - 所有任务都给出了明确文件、测试、命令、预期输出，没有 TBD/TODO。
- **Type consistency:**
  - `VisibleContentState`、`TikuAdapterAIFallbackErrorCode`、`AIFallbackResult` 在各任务中命名保持一致。
