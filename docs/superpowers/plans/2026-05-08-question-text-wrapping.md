# Question Text Wrapping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make long question text wrap automatically in the common panel so long titles and question strings never overflow panel width.

**Architecture:** Keep the existing inline-style rendering model in `src/projects/common.ts` and add one tiny helper dedicated to question-text wrapping. Apply that helper only to question-text render sites in the work-result detail view and tiku/cached question list items, then lock the behavior with source-assertion tests.

**Tech Stack:** TypeScript, inline DOM style mutation, Node `node:test`, source-assertion test files in `scripts/`.

---

## File Structure

- Modify: `src/projects/common.ts`
  - Add one small helper for wrapping question text.
  - Apply that helper to the selected work-result title node.
  - Apply that helper to the question text displayed under tiku/cached answer entries.
- Modify: `scripts/tiku-adapter-wiring.test.mjs`
  - Add assertions that the shared question-wrap helper exists and is used by the targeted question nodes.

No new runtime files, no CSS files, and no layout changes are needed.

### Task 1: Add a shared question-text wrapping helper

**Files:**
- Modify: `src/projects/common.ts:545-560`
- Test: `scripts/tiku-adapter-wiring.test.mjs`

- [ ] **Step 1: Write the failing test**

In `scripts/tiku-adapter-wiring.test.mjs`, add a focused test that asserts the source now contains a shared wrapping helper and the three exact wrap styles:

```js
test('common panel defines a shared wrap style for long question text', async () => {
  const source = await readFile(commonPath, 'utf8');

  assert.equal(source.includes('function applyQuestionTextWrapStyle(element: HTMLElement)'), true);
  assert.equal(source.includes("element.style.whiteSpace = 'normal';"), true);
  assert.equal(source.includes("element.style.overflowWrap = 'anywhere';"), true);
  assert.equal(source.includes("element.style.wordBreak = 'break-word';"), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test "scripts/tiku-adapter-wiring.test.mjs"
```

Expected: FAIL because `src/projects/common.ts` does not yet contain `applyQuestionTextWrapStyle(...)` or the new style lines.

- [ ] **Step 3: Write minimal implementation**

In `src/projects/common.ts`, add the helper near the other small DOM utility helpers, for example immediately after `createElement(...)`:

```ts
function applyQuestionTextWrapStyle(element: HTMLElement) {
  element.style.whiteSpace = 'normal';
  element.style.overflowWrap = 'anywhere';
  element.style.wordBreak = 'break-word';
}
```

Do not add extra options, parameters, or unrelated style logic.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test "scripts/tiku-adapter-wiring.test.mjs"
```

Expected: PASS for the new helper test. If other tests in the file fail, stop and fix them before moving on.

- [ ] **Step 5: Commit**

```bash
git add scripts/tiku-adapter-wiring.test.mjs src/projects/common.ts
git commit -m "feat: add question text wrap helper"
```

### Task 2: Apply the helper to work-result and tiku question text nodes

**Files:**
- Modify: `src/projects/common.ts:687-710`
- Modify: `src/projects/common.ts:821-839`
- Test: `scripts/tiku-adapter-wiring.test.mjs`

- [ ] **Step 1: Write the failing test**

Extend `scripts/tiku-adapter-wiring.test.mjs` with one focused test that asserts the selected work-result title and tiku result question both call the helper:

```js
test('common panel applies the shared wrap style to work-result and tiku question text', async () => {
  const source = await readFile(commonPath, 'utf8');

  assert.equal(source.includes("const title = createElement('div', { text: result.question || '未识别题目' });"), true);
  assert.equal(source.includes('applyQuestionTextWrapStyle(title);'), true);
  assert.equal(source.includes("const question = createElement('div', { text: entry[0] || '' });"), true);
  assert.equal(source.includes('applyQuestionTextWrapStyle(question);'), true);
});
```

This test should stay focused on question text nodes only. Do not include answer text assertions.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test "scripts/tiku-adapter-wiring.test.mjs"
```

Expected: FAIL because the helper calls do not exist yet.

- [ ] **Step 3: Write minimal implementation**

In `src/projects/common.ts`, apply the helper at the two known render sites.

For the selected work-result title block, update it to:

```ts
const title = createElement('div', { text: result.question || '未识别题目' });
title.style.fontWeight = '700';
title.style.lineHeight = '1.6';
title.style.color = '#0f172a';
applyQuestionTextWrapStyle(title);
```

For the tiku result question block, replace the one-off word-break-only styling with the shared helper:

```ts
const question = createElement('div', { text: entry[0] || '' });
question.style.fontSize = '12px';
question.style.color = '#64748b';
question.style.marginTop = '6px';
applyQuestionTextWrapStyle(question);
```

Do not change the answer node or panel width.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test "scripts/tiku-adapter-wiring.test.mjs"
```

Expected: PASS with all tests in the file green.

- [ ] **Step 5: Run typecheck to verify no regressions**

Run:

```bash
npm run typecheck
```

Expected: PASS with `tsc --noEmit` exiting successfully.

- [ ] **Step 6: Commit**

```bash
git add scripts/tiku-adapter-wiring.test.mjs src/projects/common.ts
git commit -m "fix: wrap long question text in common panel"
```

## Self-Review

- **Spec coverage:**
  - Shared helper for question text wrapping: covered in Task 1.
  - Apply to selected work-result title: covered in Task 2.
  - Apply to tiku/cached question list item text: covered in Task 2.
  - Minimal source-assertion tests: covered in Tasks 1 and 2.
- **Placeholder scan:** No TBD/TODO markers or omitted code steps remain.
- **Type consistency:** `applyQuestionTextWrapStyle(element: HTMLElement)` is defined once and referenced consistently in later steps.
