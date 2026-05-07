# Answer Work Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing common answer-results panel so active Chaoxing answering runs can be paused/resumed, the currently selected question can be retried independently, and number/question entries use the agreed blue/yellow/green/red status colors.

**Architecture:** Keep the feature inside the existing `common.work-results` panel and `cx.ts` answering flows instead of introducing a new panel or reworking the worker core. Extract the color/status derivation into one small pure helper for real TDD coverage, add only minimal optional flags to `SimplifyWorkResult`, and let `cx.ts` register runtime controls plus single-question retry callbacks back into `common.ts` so the UI stays generic while the Chaoxing project owns DOM-specific retry/manual-detection behavior.

**Tech Stack:** TypeScript, existing `OCSWorker` runtime, `node:test`, source-assertion regression tests, compiled pure-helper tests through `.tmp-tests`, `npm run build`, `npm run typecheck`.

---

## File Structure

- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\work-results-status.ts`
  - Pure helper for status source/tone derivation and status-label formatting
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\core\worker\interface.ts`
  - Add the minimal optional `manual` / `retrying` flags to `SimplifyWorkResult`
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\common.ts`
  - Store runtime control callbacks
  - Preserve `manual` / `retrying` flags across result refreshes
  - Render pause/continue and retry buttons
  - Apply shared tone logic to numbers view and questions view
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\cx.ts`
  - Register active worker controls with `common.work-results`
  - Add single-question retry callbacks for chapter test and preview-mode work/exam flows
  - Add minimal manual-answer detection and write it back through panel methods
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\work-results-status.test.mjs`
  - Real behavior tests for the pure status helper
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\answer-work-controls-panel.test.mjs`
  - Source assertions for `common.ts` panel controls and shared tone usage
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\cx-answer-retry-wiring.test.mjs`
  - Source assertions for `cx.ts` runtime registration, retry callback wiring, and manual-state sync
- No change needed: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\core\worker\worker.ts`
  - The existing `stop` / `continuate` event handling and `waitForContinuate(...)` loop already satisfy the pause/resume requirement; treat it as a dependency to verify, not a refactor target

---

### Task 1: Add shared work-result status helpers behind failing tests

**Files:**
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\work-results-status.test.mjs`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\work-results-status.ts`
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\core\worker\interface.ts:64-88`
- Test: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\work-results-status.test.mjs`

- [ ] **Step 1: Write the failing helper test**

Create `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\work-results-status.test.mjs` with this content:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const helperModulePath = resolve(process.cwd(), '.tmp-tests', 'work-results-status.js');

async function loadHelperModule() {
  try {
    return await import(pathToFileURL(helperModulePath).href);
  } catch {
    return {};
  }
}

function createResult(overrides = {}) {
  return {
    question: '示例题目',
    type: 'single',
    requested: false,
    resolved: false,
    finish: false,
    manual: false,
    retrying: false,
    searchInfos: [],
    ...overrides
  };
}

test('marks answered results as success tone when usable answers exist', async () => {
  const mod = await loadHelperModule();
  const result = createResult({
    requested: true,
    resolved: true,
    finish: true,
    searchInfos: [{ name: 'tikuAdapter', results: [['题目', '答案', {}]] }]
  });

  assert.equal(typeof mod.resolveWorkResultStatusSource, 'function');
  assert.equal(typeof mod.resolveWorkResultTone, 'function');
  assert.equal(mod.resolveWorkResultStatusSource(result), 'answered');
  assert.equal(mod.resolveWorkResultTone(result, false), 'success');
});

test('marks unresolved results as danger tone when no answers were found', async () => {
  const mod = await loadHelperModule();
  const result = createResult({
    requested: true,
    resolved: false,
    searchInfos: []
  });

  assert.equal(mod.resolveWorkResultStatusSource(result), 'unresolved');
  assert.equal(mod.resolveWorkResultTone(result, false), 'danger');
});

test('marks manual results as yellow before success or failure tones', async () => {
  const mod = await loadHelperModule();
  const result = createResult({
    requested: true,
    resolved: true,
    finish: true,
    manual: true,
    searchInfos: [{ name: 'tikuAdapter', results: [['题目', '答案', {}]] }]
  });

  assert.equal(mod.resolveWorkResultStatusSource(result), 'manual');
  assert.equal(mod.resolveWorkResultTone(result, false), 'manual');
});

test('selected tone overrides every other status with blue', async () => {
  const mod = await loadHelperModule();
  const result = createResult({
    requested: true,
    resolved: true,
    finish: true,
    manual: true,
    searchInfos: [{ name: 'tikuAdapter', results: [['题目', '答案', {}]] }]
  });

  assert.equal(mod.resolveWorkResultTone(result, true), 'selected');
});

test('formats manual and retrying labels explicitly', async () => {
  const mod = await loadHelperModule();

  assert.equal(typeof mod.formatWorkResultStatus, 'function');
  assert.equal(mod.formatWorkResultStatus(createResult({ manual: true })), '已人工答题');
  assert.equal(mod.formatWorkResultStatus(createResult({ retrying: true })), '正在重答...');
  assert.equal(
    mod.formatWorkResultStatus(createResult({ requested: true, searchInfos: [] })),
    '未搜索到答案'
  );
});
```

- [ ] **Step 2: Run the helper test and verify RED**

Run:

```bash
npx tsc "src/projects/work-results-status.ts" --outDir ".tmp-tests" --module nodenext --target es2022 --moduleResolution nodenext && node --test "scripts/work-results-status.test.mjs"
```

Expected: FAIL because `src/projects/work-results-status.ts` does not exist yet, so the import fallback returns `{}` and the first `typeof ... === 'function'` assertions fail.

- [ ] **Step 3: Add the minimal helper and extend `SimplifyWorkResult`**

Update `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\core\worker\interface.ts` by changing the `SimplifyWorkResult` block to:

```ts
export interface SimplifyWorkResult {
	/** 题目 */
	question: string;
	/** 题目类型 */
	type: QuestionTypes;
	/** 答题错误信息 */
	error?: string;
	/** 是否完成 */
	finish?: boolean;
	/** 正在等待 查题 线程处理 */
	requested: boolean;
	/** 正在等待 答题 线程处理 */
	resolved: boolean;
	/** 是否存在人工介入 */
	manual?: boolean;
	/** 是否正在单题重答 */
	retrying?: boolean;
	/** 查题信息 */
	searchInfos: {
		/** 题目名 */
		name: SearchInformation['name'];
		/** 题库链接 */
		homepage?: SearchInformation['homepage'];
		/** 题库搜索错误信息 */
		error?: string;
		/** 搜索结果 [题目，答案，额外数据] */
		results: [string, string, object][];
	}[];
}
```

Create `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\work-results-status.ts` with this content:

```ts
import type { SimplifyWorkResult } from '../core/index.js';

export type WorkResultStatusSource = 'idle' | 'answered' | 'unresolved' | 'manual';
export type WorkResultTone = 'selected' | 'manual' | 'success' | 'danger' | 'idle';

function hasAnswerResults(result: SimplifyWorkResult) {
  return result.searchInfos.some((info) => info.results.length > 0);
}

export function resolveWorkResultStatusSource(result: SimplifyWorkResult): WorkResultStatusSource {
  if (result.manual) {
    return 'manual';
  }

  if (result.error) {
    return 'unresolved';
  }

  if (hasAnswerResults(result)) {
    return 'answered';
  }

  if (result.requested && result.searchInfos.length === 0) {
    return 'unresolved';
  }

  return 'idle';
}

export function resolveWorkResultTone(result: SimplifyWorkResult, selected: boolean): WorkResultTone {
  if (selected) {
    return 'selected';
  }

  const source = resolveWorkResultStatusSource(result);
  if (source === 'manual') {
    return 'manual';
  }
  if (source === 'answered') {
    return 'success';
  }
  if (source === 'unresolved') {
    return 'danger';
  }
  return 'idle';
}

export function formatWorkResultStatus(result: SimplifyWorkResult): string {
  if (result.retrying) {
    return '正在重答...';
  }

  if (result.manual) {
    return '已人工答题';
  }

  if (!result.requested && !result.resolved) {
    return '等待搜索中';
  }

  if (result.error) {
    return `失败：${result.error}`;
  }

  if (result.requested && result.searchInfos.length === 0) {
    return '未搜索到答案';
  }

  if (result.finish) {
    return '已完成';
  }

  if (!result.resolved) {
    return '等待答题中';
  }

  return '已搜索但未完成';
}
```

- [ ] **Step 4: Run the helper test again and verify GREEN**

Run:

```bash
npx tsc "src/projects/work-results-status.ts" --outDir ".tmp-tests" --module nodenext --target es2022 --moduleResolution nodenext && node --test "scripts/work-results-status.test.mjs"
```

Expected: PASS. All 5 helper assertions should pass.

- [ ] **Step 5: Commit the helper slice**

Run:

```bash
git add "scripts/work-results-status.test.mjs" "src/projects/work-results-status.ts" "src/core/worker/interface.ts"
git commit -m "$(cat <<'EOF'
feat: add work result status helpers

Extract shared answer-result tone logic and add minimal manual/retrying flags
so the panel can color results consistently and expose retry state safely.
EOF
)"
```

---

### Task 2: Add pause/continue, retry button, and shared tone rendering in `common.ts`

**Files:**
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\answer-work-controls-panel.test.mjs`
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\common.ts:1-16`
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\common.ts:45-52`
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\common.ts:585-810`
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\common.ts:1454-1593`
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\common.ts:1880-1905`
- Test: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\answer-work-controls-panel.test.mjs`

- [ ] **Step 1: Write the failing panel wiring test**

Create `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\answer-work-controls-panel.test.mjs` with this content:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const commonPath = resolve(process.cwd(), 'src', 'projects', 'common.ts');

test('common work results panel renders pause continue and retry controls', async () => {
  const source = await readFile(commonPath, 'utf8');

  assert.equal(source.includes("const pauseButton = createElement('button', { text: isPaused ? '继续答题' : '暂停答题' });"), true);
  assert.equal(source.includes("const retryButton = createElement('button', { text: result.retrying ? '正在重答...' : '重答本题' });"), true);
  assert.equal(source.includes('setRuntimeControls(controls: WorkResultsRuntimeControls)'), true);
  assert.equal(source.includes('clearRuntimeControls()'), true);
  assert.equal(source.includes('patchResult(index: number, patch: Partial<SimplifyWorkResult>)'), true);
});

test('common work results panel uses the shared tone helper for number and question views', async () => {
  const source = await readFile(commonPath, 'utf8');

  assert.equal(source.includes("const tone = resolveWorkResultTone(result, index === state.workResults.currentResultIndex);"), true);
  assert.equal(source.includes("if (tone === 'manual')"), true);
  assert.equal(source.includes("if (tone === 'danger')"), true);
  assert.equal(source.includes("item.style.borderLeft = index === state.workResults.currentResultIndex ? '4px solid #2563eb' : '4px solid transparent';"), true);
  assert.equal(source.includes('formatWorkResultStatus(result)'), true);
});
```

- [ ] **Step 2: Run the panel test and verify RED**

Run:

```bash
node --test "scripts/answer-work-controls-panel.test.mjs"
```

Expected: FAIL because `common.ts` does not yet include the new runtime-control methods, pause button text, retry button text, or shared tone helper usage.

- [ ] **Step 3: Implement the minimal `common.ts` runtime/UI changes**

Update the imports at the top of `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\common.ts` to include the new helper:

```ts
import {
  formatWorkResultStatus,
  resolveWorkResultTone
} from './work-results-status.js';
```

Right below `const QUESTION_CACHE_KEY = 'common.apps.question-caches';`, add the runtime control type:

```ts
type WorkResultsRuntimeControls = {
  isRunning: () => boolean;
  isStopped: () => boolean;
  stop: () => void;
  continuate: () => void;
  retryQuestion: (index: number) => Promise<SimplifyWorkResult | undefined>;
  canRetryQuestion?: (index: number) => boolean;
};
```

Extend `state.workResults` so it keeps the active runtime controls:

```ts
  workResults: {
    results: runtimeStore.get(WORK_RESULTS_KEY, [] as SimplifyWorkResult[]),
    currentResultIndex: 0,
    type: runtimeStore.get(WORK_RESULTS_VIEW_KEY, 'numbers' as WorkResultsView),
    questionPositionSyncHandlerType: undefined as QuestionPositionSyncHandlerType | undefined,
    runtimeControls: undefined as WorkResultsRuntimeControls | undefined,
    ui: createDefaultWorkResultsPanelUiState()
  },
```

Replace the old `getResultTone(...)` / `formatStatus(...)` usage with these helpers:

```ts
function mergeIncomingWorkResults(results: SimplifyWorkResult[]) {
  return results.map((item, index) => ({
    ...item,
    manual: item.manual ?? state.workResults.results[index]?.manual ?? false,
    retrying: item.retrying ?? false
  }));
}

function patchWorkResult(index: number, patch: Partial<SimplifyWorkResult>) {
  if (!state.workResults.results[index]) {
    return;
  }

  const next = state.workResults.results.slice();
  next[index] = {
    ...next[index],
    ...patch
  };
  setWorkResults(next);
}
```

Then update `setWorkResults(...)` so it preserves `manual` and `retrying` flags:

```ts
function setWorkResults(results: SimplifyWorkResult[]) {
  state.workResults.results = mergeIncomingWorkResults(results);
  if (state.workResults.currentResultIndex >= state.workResults.results.length) {
    state.workResults.currentResultIndex = Math.max(state.workResults.results.length - 1, 0);
  }
  runtimeStore.set(WORK_RESULTS_KEY, state.workResults.results);
  renderWorkResultsPanel();
}
```

Replace `createStatusBadge(...)` and the detail status text usage so they use `resolveWorkResultTone(result, false)` and `formatWorkResultStatus(result)`:

```ts
function createStatusBadge(result: SimplifyWorkResult) {
  const tone = resolveWorkResultTone(result, false);
  const badge = createElement('div', { text: formatWorkResultStatus(result) });
  badge.style.display = 'inline-flex';
  badge.style.alignItems = 'center';
  badge.style.width = 'fit-content';
  badge.style.padding = '5px 10px';
  badge.style.borderRadius = '999px';
  badge.style.fontSize = '12px';
  badge.style.fontWeight = '700';

  if (tone === 'manual') {
    badge.style.background = 'rgba(250, 204, 21, 0.14)';
    badge.style.color = '#a16207';
    return badge;
  }

  if (tone === 'success') {
    badge.style.background = 'rgba(34, 197, 94, 0.12)';
    badge.style.color = '#15803d';
    return badge;
  }

  if (tone === 'danger') {
    badge.style.background = 'rgba(239, 68, 68, 0.12)';
    badge.style.color = '#b91c1c';
    return badge;
  }

  badge.style.background = 'rgba(148, 163, 184, 0.12)';
  badge.style.color = '#64748b';
  return badge;
}
```

Inside `createWorkResultsDetail(...)`, add the retry action row right after `container.append(titleWrap);`:

```ts
  const runtimeControls = state.workResults.runtimeControls;
  const selectedIndex = state.workResults.currentResultIndex;
  const canRetry = Boolean(
    runtimeControls?.retryQuestion && (runtimeControls.canRetryQuestion?.(selectedIndex) ?? true)
  );

  const detailActions = createElement('div');
  detailActions.style.display = 'flex';
  detailActions.style.gap = '8px';
  detailActions.style.flexWrap = 'wrap';

  const retryButton = createElement('button', { text: result.retrying ? '正在重答...' : '重答本题' });
  retryButton.disabled = !canRetry || Boolean(result.retrying);
  retryButton.onclick = async () => {
    if (!runtimeControls || !canRetry || result.retrying) {
      return;
    }

    patchWorkResult(selectedIndex, { retrying: true, error: undefined, manual: false });
    try {
      const retried = await runtimeControls.retryQuestion(selectedIndex);
      if (retried) {
        patchWorkResult(selectedIndex, {
          ...retried,
          retrying: false,
          manual: false
        });
      } else {
        patchWorkResult(selectedIndex, { retrying: false });
      }
    } catch (err) {
      patchWorkResult(selectedIndex, {
        retrying: false,
        error: (err as Error).message || String(err)
      });
    }
  };

  applyActionButtonStyle(retryButton, 'primary');
  detailActions.append(retryButton);
  container.append(detailActions);
```

In `createWorkResultsPanel()`, insert the runtime pause/continue control before the existing type/clear buttons:

```ts
  const runtimeControls = state.workResults.runtimeControls;
  if (runtimeControls?.isRunning()) {
    const isPaused = runtimeControls.isStopped();
    const pauseButton = createElement('button', { text: isPaused ? '继续答题' : '暂停答题' });
    pauseButton.onclick = () => {
      if (isPaused) {
        runtimeControls.continuate();
      } else {
        runtimeControls.stop();
      }
      renderWorkResultsPanel();
    };
    applyActionButtonStyle(pauseButton, 'primary');
    heroActions.append(pauseButton);
  }
```

Then replace the numbers-view and questions-view item styling with shared tone handling:

```ts
        const tone = resolveWorkResultTone(result, index === state.workResults.currentResultIndex);
        button.style.minWidth = '38px';
        button.style.height = '38px';
        button.style.borderRadius = '12px';
        button.style.border = '1px solid rgba(148, 163, 184, 0.2)';
        button.style.cursor = 'pointer';
        button.style.fontWeight = '700';
        button.style.boxShadow = '0 6px 18px rgba(15, 23, 42, 0.05)';

        if (tone === 'selected') {
          button.style.background = 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)';
          button.style.borderColor = '#2563eb';
          button.style.color = '#fff';
        } else if (tone === 'manual') {
          button.style.background = 'rgba(254, 249, 195, 0.96)';
          button.style.borderColor = '#facc15';
          button.style.color = '#854d0e';
        } else if (tone === 'success') {
          button.style.background = 'rgba(240, 253, 244, 0.96)';
          button.style.borderColor = '#4ade80';
          button.style.color = '#15803d';
        } else if (tone === 'danger') {
          button.style.background = 'rgba(254, 242, 242, 0.96)';
          button.style.borderColor = '#f87171';
          button.style.color = '#b91c1c';
        } else {
          button.style.background = 'rgba(255,255,255,0.96)';
          button.style.color = '#334155';
        }
```

```ts
        const tone = resolveWorkResultTone(result, index === state.workResults.currentResultIndex);
        item.style.textAlign = 'left';
        item.style.padding = '12px';
        item.style.borderRadius = '14px';
        item.style.cursor = 'pointer';
        item.style.boxShadow = '0 8px 22px rgba(15, 23, 42, 0.05)';
        item.style.borderLeft = index === state.workResults.currentResultIndex ? '4px solid #2563eb' : '4px solid transparent';

        if (tone === 'selected') {
          item.style.border = '1px solid rgba(37, 99, 235, 0.24)';
          item.style.background = 'rgba(239, 246, 255, 0.98)';
        } else if (tone === 'manual') {
          item.style.border = '1px solid rgba(250, 204, 21, 0.45)';
          item.style.background = 'rgba(254, 252, 232, 0.96)';
        } else if (tone === 'success') {
          item.style.border = '1px solid rgba(74, 222, 128, 0.45)';
          item.style.background = 'rgba(240, 253, 244, 0.96)';
        } else if (tone === 'danger') {
          item.style.border = '1px solid rgba(248, 113, 113, 0.4)';
          item.style.background = 'rgba(254, 242, 242, 0.96)';
        } else {
          item.style.border = '1px solid rgba(226, 232, 240, 0.95)';
          item.style.background = 'rgba(255,255,255,0.96)';
        }
```

Finally, extend `common.work-results.methods()` with the new runtime methods:

```ts
          setRuntimeControls(controls: WorkResultsRuntimeControls) {
            state.workResults.runtimeControls = controls;
            renderWorkResultsPanel();
          },
          clearRuntimeControls() {
            state.workResults.runtimeControls = undefined;
            setWorkResults(
              state.workResults.results.map((item) => ({
                ...item,
                retrying: false
              }))
            );
          },
          patchResult(index: number, patch: Partial<SimplifyWorkResult>) {
            patchWorkResult(index, patch);
          },
```

- [ ] **Step 4: Run the panel test again and verify GREEN**

Run:

```bash
node --test "scripts/answer-work-controls-panel.test.mjs"
```

Expected: PASS. Both source-assertion tests should pass.

- [ ] **Step 5: Commit the panel slice**

Run:

```bash
git add "scripts/answer-work-controls-panel.test.mjs" "src/projects/common.ts"
git commit -m "$(cat <<'EOF'
feat: add answer work panel controls

Add pause/resume, selected-question retry, and unified result tones to the
existing common answer results panel without introducing a new panel.
EOF
)"
```

---

### Task 3: Wire active worker controls, single-question retry, and manual-state sync in `cx.ts`

**Files:**
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\cx-answer-retry-wiring.test.mjs`
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\cx.ts:183-190`
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\cx.ts:1345-1513`
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\cx.ts:1559-1738`
- Test: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\cx-answer-retry-wiring.test.mjs`

- [ ] **Step 1: Write the failing `cx.ts` wiring test**

Create `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\cx-answer-retry-wiring.test.mjs` with this content:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const cxProjectPath = resolve(process.cwd(), 'src', 'projects', 'cx.ts');

test('cx registers runtime stop continue and retry controls with the common work results panel', async () => {
  const source = await readFile(cxProjectPath, 'utf8');

  assert.equal(source.includes('workResultsMethods().setRuntimeControls?.({'), true);
  assert.equal(source.includes("stop: () => worker.emit('stop')"), true);
  assert.equal(source.includes("continuate: () => worker.emit('continuate')"), true);
  assert.equal(source.includes('retryQuestion: async (index) =>'), true);
  assert.equal(source.includes("worker.on('done', clearRuntimeControls);"), true);
  assert.equal(source.includes("worker.on('close', clearRuntimeControls);"), true);
});

test('cx syncs manual-answer state back into the common result entries', async () => {
  const source = await readFile(cxProjectPath, 'utf8');

  assert.equal(source.includes('function detectManualAnswer(root: HTMLElement, type:'), true);
  assert.equal(source.includes('workResultsMethods().patchResult?.(currentIndex, { manual: detectManualAnswer('), true);
  assert.equal(source.includes('manual: false,'), true);
});
```

- [ ] **Step 2: Run the `cx.ts` wiring test and verify RED**

Run:

```bash
node --test "scripts/cx-answer-retry-wiring.test.mjs"
```

Expected: FAIL because `cx.ts` does not yet register runtime controls, expose retry callbacks, or push `manual` patches back into `common.work-results`.

- [ ] **Step 3: Implement the minimal `cx.ts` runtime registration and retry flow**

First, extend `workResultsMethods()` so `cx.ts` can call the new `common.ts` methods:

```ts
function workResultsMethods() {
  return (CommonProject.scripts.workResults.methods?.call({} as any) ?? {}) as {
    init?: (opts?: { questionPositionSyncHandlerType?: 'cx' }) => void;
    setResults?: (results: unknown) => void;
    appendResults?: (results: unknown) => void;
    updateWorkStateByResults?: (results: unknown) => void;
    patchResult?: (index: number, patch: Partial<SimplifyWorkResult>) => void;
    setRuntimeControls?: (controls: {
      isRunning: () => boolean;
      isStopped: () => boolean;
      stop: () => void;
      continuate: () => void;
      retryQuestion: (index: number) => Promise<SimplifyWorkResult | undefined>;
      canRetryQuestion?: (index: number) => boolean;
    }) => void;
    clearRuntimeControls?: () => void;
    createWorkResultsPanel?: () => HTMLElement;
  };
}
```

Add a small helper near `getQuestionType(...)` for minimal manual detection:

```ts
function detectManualAnswer(root: HTMLElement, type: ReturnType<typeof getQuestionType>) {
  if (type === 'single' || type === 'multiple' || type === 'judgement') {
    return Array.from(root.querySelectorAll('input[type="radio"], input[type="checkbox"], label input')).some((input) => {
      const element = input as HTMLInputElement;
      return element.checked || element.getAttribute('checked') === 'checked';
    }) || root.querySelector('[aria-checked="true"]') !== null;
  }

  if (type === 'completion' || type === 'fill' || type === 'reader') {
    return Array.from(root.querySelectorAll('textarea')).some((input) => (input as HTMLTextAreaElement).value.trim()) ||
      Array.from(root.querySelectorAll('iframe')).some((frame) => frame.contentDocument?.body?.innerText?.trim()) ||
      Array.from(root.querySelectorAll('.filling_answer, .reading_answer')).some((el) => el.textContent?.trim());
  }

  if (type === 'line') {
    return root.querySelector('.line_answer_ct .selectBox [class*="active"]') !== null;
  }

  return false;
}
```

In the chapter-test branch, extract the worker factory so the main run and retry path reuse the same handlers:

```ts
    const createChapterWorker = (questionRoots: HTMLElement[]) =>
      new OCSWorker({
        root: questionRoots,
        elements: {
          title: '.Zy_TItle .clearfix',
          options: 'ul li .after,ul li textarea,ul textarea,ul li label:not(.before)',
          type: 'input[id^="answertype"]',
          lineAnswerInput: '.line_answer input[name^=answer]',
          lineSelectBox: '.line_answer_ct .selectBox '
        },
        thread: thread ?? 1,
        answerSeparators: answerSeparators.split(',').map((s) => s.trim()),
        answerMatchMode: answerMatchMode === 'includes' ? 'similar' : answerMatchMode,
        answerer: (elements, ctx) => {
          const title = chapterTestTaskQuestionTitleTransform(elements.title);
          if (!title) {
            throw new Error('题目为空，请查看题目是否为空，或者忽略此题');
          }

          const typeInput = elements.type[0] as HTMLInputElement | undefined;
          const provider = async () => {
            await sleep((period ?? 3) * 1000);
            return defaultAnswerWrapperHandler(answererWrappers, {
              type: (typeInput ? getQuestionType(parseInt(typeInput.value)) : undefined) || 'unknown',
              title,
              options:
                ctx.type === 'completion'
                  ? ''
                  : ctx.elements.options.map((o) => optimizationElementWithImage(o, true).innerText).join('\n')
            });
          };

          const searchInCaches = appsMethods().searchAnswerInCaches;
          return searchInCaches ? searchInCaches(title, provider) : provider();
        },
        work: async (ctx) => {
          const { elements, searchInfos } = ctx;
          const typeInput = elements.type[0] as HTMLInputElement | undefined;
          const type = typeInput ? getQuestionType(parseInt(typeInput.value)) : undefined;

          if (type && (type === 'completion' || type === 'multiple' || type === 'judgement' || type === 'single')) {
            const resolver = createDefaultQuestionResolver(ctx)[type];
            const handler = async (questionType: typeof type, answer: string, option: HTMLElement | undefined) => {
              if ((questionType === 'judgement' || questionType === 'single' || questionType === 'multiple') && option) {
                const checked =
                  option.parentElement?.querySelector('label input')?.getAttribute('checked') === 'checked' ||
                  option.parentElement?.getAttribute('aria-checked') === 'true';
                if (!checked) {
                  option.click();
                }
              } else if (questionType === 'completion' && option && answer.trim()) {
                const text = option.parentElement?.querySelector('textarea');
                const textareaFrame = option.parentElement?.querySelector('iframe');
                if (text) {
                  text.value = answer;
                }
                if (textareaFrame?.contentDocument) {
                  textareaFrame.contentDocument.body.innerHTML = answer;
                }
                option.parentElement?.parentElement?.querySelector<HTMLElement>('[onclick*=saveQuestion]')?.click();
              }
            };

            return resolver(searchInfos, elements.options.map((option) => optimizationElementWithImage(option)), handler as any);
          }

          if (type === 'line') {
            for (const answers of searchInfos.map((info) => info.results.map((res) => res.answer))) {
              let ans = answers;
              if (ans.length === 1) {
                ans = splitAnswer(ans[0]);
              }
              if (ans.filter(Boolean).length !== 0 && elements.lineAnswerInput) {
                for (let index = 0; index < elements.lineSelectBox.length; index++) {
                  const box = elements.lineSelectBox[index];
                  if (ans[index]) {
                    box.querySelector<HTMLElement>(`li[data="${ans[index]}"] a`)?.click();
                    await sleep(200);
                  }
                }
                return { finish: true };
              }
            }
          }

          return { finish: false };
        },
        async onResultsUpdate(curr, currentIndex, res) {
          const simplified = simplifyWorkResult(res, chapterTestTaskQuestionTitleTransform);
          workResultsMethods().setResults?.(simplified);
          workResultsMethods().updateWorkStateByResults?.(res);

          const currentRoot = questionRoots[currentIndex];
          const typeInput = currentRoot?.querySelector<HTMLInputElement>('input[id^="answertype"]');
          const type = typeInput ? getQuestionType(parseInt(typeInput.value)) : undefined;
          if (currentRoot) {
            workResultsMethods().patchResult?.(currentIndex, { manual: detectManualAnswer(currentRoot, type) });
          }

          if (curr.result?.finish) {
            appsMethods().addQuestionCacheFromWorkResult?.(simplified.filter((_, index) => index === res.indexOf(curr)));
          }
        },
        async onElementSearched(elements) {
          const typeInput = elements.type[0] as HTMLInputElement | undefined;
          const type = typeInput ? getQuestionType(parseInt(typeInput.value)) : undefined;
          if (type === 'judgement') {
            elements.options.forEach((option) => {
              const opt = option?.textContent?.trim() || '';
              if (opt.includes('对') || opt.includes('错')) {
                return;
              }
              if (opt === 'True' || opt === '對') {
                option.textContent = '√';
              } else if (opt === 'False' || opt === '錯') {
                option.textContent = 'x';
              } else {
                const ri = option.querySelector('.ri');
                const span = document.createElement('span');
                span.innerText = ri ? '√' : '×';
                option.appendChild(span);
              }
            });
          }
        }
      });
```

Use that factory both for the normal worker and the retry callback, then register runtime controls:

```ts
    const worker = createChapterWorker(roots);
    const clearRuntimeControls = () => workResultsMethods().clearRuntimeControls?.();

    workResultsMethods().setRuntimeControls?.({
      isRunning: () => worker.isRunning,
      isStopped: () => worker.isStop,
      stop: () => worker.emit('stop'),
      continuate: () => worker.emit('continuate'),
      canRetryQuestion: (index) => Boolean(roots[index]),
      retryQuestion: async (index) => {
        const root = roots[index];
        if (!root) {
          return undefined;
        }

        const retryWorker = createChapterWorker([root]);
        const retriedResults = await retryWorker.doWork();
        return {
          ...simplifyWorkResult(retriedResults, chapterTestTaskQuestionTitleTransform)[0],
          manual: false,
          retrying: false
        };
      }
    });

    worker.on('done', clearRuntimeControls);
    worker.on('close', clearRuntimeControls);
```

Repeat the same pattern inside `workOrExam(...)`, but only when `preview_mode` is true. Build a `createWorkOrExamWorker(questionRoots: HTMLElement[])` helper from the existing worker config, then register controls like this:

```ts
  if (preview_mode) {
    const liveRoots = () => Array.from(document.querySelectorAll<HTMLElement>('.questionLi'));
    const clearRuntimeControls = () => workResultsMethods().clearRuntimeControls?.();

    workResultsMethods().setRuntimeControls?.({
      isRunning: () => worker.isRunning,
      isStopped: () => worker.isStop,
      stop: () => worker.emit('stop'),
      continuate: () => worker.emit('continuate'),
      canRetryQuestion: (index) => Boolean(liveRoots()[index]),
      retryQuestion: async (index) => {
        const root = liveRoots()[index];
        if (!root) {
          return undefined;
        }

        const retryWorker = createWorkOrExamWorker([root]);
        const retriedResults = await retryWorker.doWork();
        return {
          ...simplifyWorkResult(retriedResults, workOrExamQuestionTitleTransform)[0],
          manual: false,
          retrying: false
        };
      }
    });

    worker.on('done', clearRuntimeControls);
    worker.on('close', clearRuntimeControls);
  }
```

Also patch manual state during preview-mode result refreshes:

```ts
      const currentRoot = Array.from(document.querySelectorAll<HTMLElement>('.questionLi'))[currentIndex];
      const typeInput = currentRoot?.querySelector<HTMLInputElement>(type === 'exam' ? 'input[name^="type"]' : 'input[id^="answertype"]');
      const questionType = typeInput ? getQuestionType(parseInt(typeInput.value)) : undefined;
      if (currentRoot) {
        workResultsMethods().patchResult?.(currentIndex, { manual: detectManualAnswer(currentRoot, questionType) });
      }
```

- [ ] **Step 4: Run the focused test first, then run the full verification set**

Run the focused wiring test first:

```bash
node --test "scripts/cx-answer-retry-wiring.test.mjs"
```

Expected: PASS.

Then run the full regression/verification command:

```bash
npm run build && node --test "scripts/work-results-status.test.mjs" "scripts/answer-work-controls-panel.test.mjs" "scripts/cx-answer-retry-wiring.test.mjs" "scripts/cx-work-panel.test.mjs" && npm run typecheck
```

Expected: PASS. Build succeeds, all four test files pass, and type-checking stays green.

- [ ] **Step 5: Commit the `cx.ts` integration slice**

Run:

```bash
git add "scripts/cx-answer-retry-wiring.test.mjs" "src/projects/cx.ts"
git commit -m "$(cat <<'EOF'
feat: wire chaoxing answer runtime controls

Register active worker controls with the common panel so users can pause,
resume, and retry a selected question without restarting the full run.
EOF
)"
```

---
