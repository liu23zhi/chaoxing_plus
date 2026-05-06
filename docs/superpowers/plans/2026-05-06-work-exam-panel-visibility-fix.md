# Work/Exam Floating Panel Visibility Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the common floating work-results panel on Chaoxing work and exam pages when those pages run inside deeper iframe nesting.

**Architecture:** Keep the fix tightly scoped to the common floating-panel visibility gate in `src/projects/common.ts`. First extract the gate into a tiny testable helper module and prove the current top-window-only rule is too strict with a failing Node test, then switch the common scripts to use the helper and verify the existing build still passes.

**Tech Stack:** TypeScript, Node `node:test`, temporary `tsc` compilation to `.tmp-tests`, Vite build, existing runtimeStore/common panel scripts.

---

## File Structure

- Modify: `src/projects/common.ts`
  - Replace the inline floating-panel visibility logic with a helper call.
  - Keep the work-results/apps script gating behavior otherwise unchanged.
- Create: `src/projects/panel-visibility.ts`
  - Small pure helper module for deciding whether a floating panel may render in the current window context.
- Create: `scripts/panel-visibility.test.mjs`
  - Minimal regression test covering deep iframe visibility and top-window visibility.

### Task 1: Add a failing regression test for deep iframe panel visibility

**Files:**
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\panel-visibility.test.mjs`
- Test: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\panel-visibility.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\panel-visibility.test.mjs` with this content:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const helperModulePath = resolve(process.cwd(), '.tmp-tests', 'panel-visibility.js');

async function loadPanelVisibilityModule() {
  try {
    return await import(pathToFileURL(helperModulePath).href);
  } catch {
    return {};
  }
}

test('floating panel remains visible in deeply nested iframes', async () => {
  const mod = await loadPanelVisibilityModule();

  assert.equal(typeof mod.shouldShowFloatingPanel, 'function');
  assert.equal(
    mod.shouldShowFloatingPanel({
      selfWindow: {},
      topWindow: {},
      parentWindow: {}
    }),
    true
  );
});

test('floating panel remains visible in top window', async () => {
  const mod = await loadPanelVisibilityModule();
  const topWindow = {};

  assert.equal(typeof mod.shouldShowFloatingPanel, 'function');
  assert.equal(
    mod.shouldShowFloatingPanel({
      selfWindow: topWindow,
      topWindow,
      parentWindow: topWindow
    }),
    true
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node "C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\panel-visibility.test.mjs"
```

Expected: FAIL because `shouldShowFloatingPanel` is not defined yet.

### Task 2: Implement the minimal visibility helper and wire it into common.ts

**Files:**
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\panel-visibility.ts`
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\common.ts:56-62`
- Test: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\panel-visibility.test.mjs`

- [ ] **Step 1: Write the minimal helper implementation**

Create `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\panel-visibility.ts` with this content:

```ts
export function shouldShowFloatingPanel(_context?: {
  selfWindow?: unknown;
  topWindow?: unknown;
  parentWindow?: unknown;
}) {
  return true;
}
```

- [ ] **Step 2: Compile the helper for the Node test harness**

Run:

```bash
npx tsc "C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\panel-visibility.ts" --target ES2020 --module ES2020 --moduleResolution bundler --outDir "C:\Users\Zelly\Documents\GitHub\chaoxing_plus\.tmp-tests"
```

Expected: success with no TypeScript errors.

- [ ] **Step 3: Run the test to verify it now passes**

Run:

```bash
node "C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\panel-visibility.test.mjs"
```

Expected: PASS for both tests.

- [ ] **Step 4: Wire `common.ts` to the helper**

Modify the import section in `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\common.ts` to add:

```ts
import { shouldShowFloatingPanel } from './panel-visibility.js';
```

Replace the existing function:

```ts
function canShowFloatingPanel() {
  try {
    return window.self === window.top || window.parent === window.top;
  } catch {
    return true;
  }
}
```

with:

```ts
function canShowFloatingPanel() {
  try {
    return shouldShowFloatingPanel({
      selfWindow: window.self,
      topWindow: window.top,
      parentWindow: window.parent
    });
  } catch {
    return true;
  }
}
```

- [ ] **Step 5: Refine the helper to keep the logic explicit but permissive**

Update `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\panel-visibility.ts` to this final content:

```ts
export function shouldShowFloatingPanel(_context?: {
  selfWindow?: unknown;
  topWindow?: unknown;
  parentWindow?: unknown;
}) {
  return true;
}
```

Rationale: for this bug, the minimal root-cause fix is removing the overly strict window-depth gate rather than replacing it with a different fragile heuristic. This matches the desired outcome of always allowing the common floating panel scripts to render on work/exam pages regardless of iframe depth.

### Task 3: Verify the regression fix against tests and project checks

**Files:**
- Test: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\panel-visibility.test.mjs`
- Test: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\panel-visibility.ts`
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\common.ts`

- [ ] **Step 1: Re-compile the helper after final code changes**

Run:

```bash
npx tsc "C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\panel-visibility.ts" --target ES2020 --module ES2020 --moduleResolution bundler --outDir "C:\Users\Zelly\Documents\GitHub\chaoxing_plus\.tmp-tests"
```

Expected: success with no TypeScript errors.

- [ ] **Step 2: Run the focused regression test again**

Run:

```bash
node "C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\panel-visibility.test.mjs"
```

Expected: PASS for both tests.

- [ ] **Step 3: Run full project typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 4: Run production build**

Run:

```bash
npm run build
```

Expected: PASS and generate `dist/chaoxing-plus.js` and `dist/manifest.json`.

## Self-Review

- Spec coverage: The plan covers the approved scope only — relax the floating-panel gating in `common.ts`, using a minimal helper and regression test. It does not broaden into unrelated `cx.ts` routing or panel redesign.
- Placeholder scan: No TBD/TODO placeholders remain; every task includes exact file paths, exact commands, and concrete code.
- Type consistency: The helper name is consistently `shouldShowFloatingPanel` across the test, helper module, and `common.ts` integration.
