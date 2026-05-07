# Tiku Adapter BaseURL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a default tikuAdapter integration that lets Chaoxing Plus users configure `baseurl` and `key` in the existing learning / answering panel, then automatically search `POST {baseurl}/adapter-service/search` with `Authorization: Bearer <key>`.

**Architecture:** Keep the new integration inside the existing `CommonProject` settings and panel flow so `cx.ts`, `commonWork(...)`, result rendering, and cache writing can continue to reuse the current answering pipeline. A new pure helper module will own baseurl normalization, config validation, request URL/header generation, question-type mapping, and default `AnswererWrapper` creation; UI persistence stays in `common.ts`, while missing-config warnings are centralized in `utils/work.ts` so both work/exam and chapter-test flows get the same behavior.

**Tech Stack:** TypeScript, Node.js, Vite `define` injection, existing `AnswererWrapper` runtime, `node:test`, source-assertion regression tests, `npm run typecheck`, `npm run build`.

---

## File Structure

- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\build.mjs`
  - Inject compile-time default `baseurl` with Vite `define`
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\types.d.ts`
  - Declare the injected global `__DEFAULT_TIKU_BASE_URL__`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\tiku-adapter-config.ts`
  - Pure helper for baseurl normalization, config validation, type mapping, URL/header generation, and default wrapper creation
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\common.ts`
  - Persist `baseurl` / `key`
  - Render the new panel section
  - Inject the dynamic default wrapper into `getWorkOptions()` before `cx.ts` consumes it
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\utils\work.ts`
  - Replace the generic empty-wrapper warning with config-aware `baseurl` / `key` prompts
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\tiku-adapter-config.test.mjs`
  - Pure helper regression tests compiled through `.tmp-tests`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\tiku-adapter-wiring.test.mjs`
  - Source assertions for build wiring, panel controls, storage keys, helper usage, and warning text
- No change needed: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\cx.ts`
  - It already reads `getWorkOptions()` and passes those options to chapter/work/exam flows, so injecting the default wrapper upstream keeps the change smaller and fixes the earlier `commonWork(...)` early-return problem.

---

### Task 1: Add the pure tikuAdapter helper behind failing tests

**Files:**
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\tiku-adapter-config.test.mjs`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\tiku-adapter-config.ts`
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\types.d.ts`
- Test: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\tiku-adapter-config.test.mjs`

- [ ] **Step 1: Write the failing helper test**

Create `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\tiku-adapter-config.test.mjs` with this content:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const helperModulePath = resolve(process.cwd(), '.tmp-tests', 'tiku-adapter-config.js');

async function loadHelperModule() {
  try {
    return await import(pathToFileURL(helperModulePath).href);
  } catch {
    return {};
  }
}

test('normalizes baseurl by trimming whitespace and trailing slashes', async () => {
  const mod = await loadHelperModule();

  assert.equal(typeof mod.normalizeTikuAdapterBaseUrl, 'function');
  assert.equal(mod.normalizeTikuAdapterBaseUrl(' https://example.com/// '), 'https://example.com');
});

test('resolves search url from normalized baseurl', async () => {
  const mod = await loadHelperModule();

  assert.equal(typeof mod.createTikuAdapterSearchUrl, 'function');
  assert.equal(
    mod.createTikuAdapterSearchUrl('https://adapter.local/'),
    'https://adapter.local/adapter-service/search'
  );
});

test('creates bearer authorization header text', async () => {
  const mod = await loadHelperModule();

  assert.equal(typeof mod.createTikuAdapterAuthorizationHeader, 'function');
  assert.equal(mod.createTikuAdapterAuthorizationHeader('  secret-key  '), 'Bearer secret-key');
});

test('reports missing key as an unavailable config', async () => {
  const mod = await loadHelperModule();

  assert.equal(typeof mod.getTikuAdapterConfigProblem, 'function');
  assert.equal(
    mod.getTikuAdapterConfigProblem({
      baseurl: 'https://adapter.local',
      key: ''
    }),
    'missing-key'
  );
});

test('maps current chaoxing question types to tikuAdapter numeric types', async () => {
  const mod = await loadHelperModule();

  assert.equal(typeof mod.resolveTikuAdapterQuestionType, 'function');
  assert.equal(mod.resolveTikuAdapterQuestionType('single'), 0);
  assert.equal(mod.resolveTikuAdapterQuestionType('multiple'), 1);
  assert.equal(mod.resolveTikuAdapterQuestionType('judgement'), 3);
  assert.equal(mod.resolveTikuAdapterQuestionType('completion'), 2);
  assert.equal(mod.resolveTikuAdapterQuestionType('line'), 2);
  assert.equal(mod.resolveTikuAdapterQuestionType('unknown'), 4);
});

test('creates a post fetch wrapper with bearer auth and adapter search url', async () => {
  const mod = await loadHelperModule();

  assert.equal(typeof mod.createTikuAdapterAnswererWrapper, 'function');
  const wrapper = mod.createTikuAdapterAnswererWrapper({
    baseurl: 'https://adapter.local/',
    key: 'demo-key'
  });

  assert.equal(wrapper.url, 'https://adapter.local/adapter-service/search');
  assert.equal(wrapper.method, 'post');
  assert.equal(wrapper.type, 'fetch');
  assert.equal(wrapper.contentType, 'json');
  assert.deepEqual(wrapper.headers, {
    Authorization: 'Bearer demo-key'
  });
});
```

- [ ] **Step 2: Run the helper test and watch it fail**

Run:

```bash
npx tsc "src/projects/tiku-adapter-config.ts" --outDir ".tmp-tests" --module nodenext --target es2022 --moduleResolution nodenext && node --test "scripts/tiku-adapter-config.test.mjs"
```

Expected: FAIL because `src/projects/tiku-adapter-config.ts` does not exist yet, so the compiled helper module is missing and the first `typeof ... === 'function'` assertions fail.

- [ ] **Step 3: Add the minimal helper and injected-global declaration**

Update `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\types.d.ts` to:

```ts
declare module 'typr.js';
declare const __DEFAULT_TIKU_BASE_URL__: string;
```

Create `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\tiku-adapter-config.ts` with this content:

```ts
import type { AnswererWrapper } from '../core/answer-wrapper/interface.js';

export const TIKU_ADAPTER_BASEURL_KEY = 'common.settings.tiku-adapter.baseurl';
export const TIKU_ADAPTER_KEY_KEY = 'common.settings.tiku-adapter.key';

export type TikuAdapterConfigProblem = 'missing-baseurl' | 'invalid-baseurl' | 'missing-key';

export type TikuAdapterConfig = {
  baseurl: string;
  key: string;
};

export const DEFAULT_TIKU_BASE_URL = normalizeTikuAdapterBaseUrl(
  typeof __DEFAULT_TIKU_BASE_URL__ === 'string' ? __DEFAULT_TIKU_BASE_URL__ : ''
);

export function normalizeTikuAdapterBaseUrl(raw: string): string {
  return String(raw ?? '')
    .trim()
    .replace(/\/+$/, '');
}

export function isValidTikuAdapterBaseUrl(raw: string): boolean {
  const normalized = normalizeTikuAdapterBaseUrl(raw);
  if (!normalized) {
    return false;
  }

  try {
    const url = new URL(normalized);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function resolveTikuAdapterBaseUrl(raw: string, fallback = DEFAULT_TIKU_BASE_URL): string {
  const preferred = normalizeTikuAdapterBaseUrl(raw);
  const fallbackValue = normalizeTikuAdapterBaseUrl(fallback);
  const candidate = preferred || fallbackValue;
  return isValidTikuAdapterBaseUrl(candidate) ? candidate : '';
}

export function createTikuAdapterSearchUrl(baseurl: string): string {
  const normalized = resolveTikuAdapterBaseUrl(baseurl);
  return normalized ? `${normalized}/adapter-service/search` : '';
}

export function createTikuAdapterAuthorizationHeader(key: string): string {
  return `Bearer ${String(key ?? '').trim()}`;
}

export function resolveTikuAdapterQuestionType(type: string | undefined): number {
  switch (type) {
    case 'single':
      return 0;
    case 'multiple':
      return 1;
    case 'judgement':
      return 3;
    case 'completion':
    case 'fill':
    case 'line':
      return 2;
    case 'reader':
    case 'unknown':
    default:
      return 4;
  }
}

export function getTikuAdapterConfigProblem(config: TikuAdapterConfig): TikuAdapterConfigProblem | undefined {
  const baseurl = normalizeTikuAdapterBaseUrl(config.baseurl);
  const key = String(config.key ?? '').trim();

  if (!baseurl) {
    return 'missing-baseurl';
  }

  if (!isValidTikuAdapterBaseUrl(baseurl)) {
    return 'invalid-baseurl';
  }

  if (!key) {
    return 'missing-key';
  }

  return undefined;
}

export function createTikuAdapterAnswererWrapper(config: TikuAdapterConfig): AnswererWrapper {
  const baseurl = resolveTikuAdapterBaseUrl(config.baseurl);
  const key = String(config.key ?? '').trim();
  const problem = getTikuAdapterConfigProblem({ baseurl, key });

  if (problem) {
    throw new Error(problem);
  }

  return {
    url: createTikuAdapterSearchUrl(baseurl),
    name: 'tikuAdapter',
    homepage: baseurl,
    method: 'post',
    contentType: 'json',
    type: 'fetch',
    headers: {
      Authorization: createTikuAdapterAuthorizationHeader(key)
    },
    data: {
      qid: '',
      plat: -1,
      question: {
        handler: `return (env) => String(env.title ?? '').trim()`
      },
      options: {
        handler: `return (env) => String(env.options ?? '').split(/\\n+/).map((item) => item.trim()).filter(Boolean)`
      },
      type: {
        handler: `return (env) => {
          const value = String(env.type ?? 'unknown');
          return value === 'single'
            ? 0
            : value === 'multiple'
              ? 1
              : value === 'judgement'
                ? 3
                : value === 'completion' || value === 'fill' || value === 'line'
                  ? 2
                  : 4;
        }`
      },
      courseName: '',
      extra: ''
    },
    handler: `return (res) => {
      const question = typeof res?.question === 'string' ? res.question : '';
      const answerText = typeof res?.answer?.answerText === 'string' ? res.answer.answerText.trim() : '';
      if (answerText) {
        return [question, answerText, { source: 'tikuAdapter' }];
      }

      const bestAnswer = Array.isArray(res?.answer?.bestAnswer)
        ? res.answer.bestAnswer.map((item) => String(item).trim()).filter(Boolean)
        : [];
      if (bestAnswer.length > 0) {
        return [question, bestAnswer.join('#'), { source: 'tikuAdapter' }];
      }

      const firstAllAnswer = Array.isArray(res?.answer?.allAnswer)
        ? res.answer.allAnswer.find((item) => Array.isArray(item) && item.map((value) => String(value).trim()).filter(Boolean).length > 0)
        : undefined;
      if (firstAllAnswer) {
        return [question, firstAllAnswer.join('#'), { source: 'tikuAdapter' }];
      }

      return undefined;
    }`
  };
}
```

- [ ] **Step 4: Re-run the helper test and verify it passes**

Run:

```bash
npx tsc "src/projects/tiku-adapter-config.ts" --outDir ".tmp-tests" --module nodenext --target es2022 --moduleResolution nodenext && node --test "scripts/tiku-adapter-config.test.mjs"
```

Expected: PASS for all helper assertions, proving the pure functions and wrapper shape are correct before touching runtime UI.

- [ ] **Step 5: Commit the helper slice**

Run:

```bash
git add src/types.d.ts src/projects/tiku-adapter-config.ts scripts/tiku-adapter-config.test.mjs
git commit -m "$(cat <<'EOF'
feat: 增加题库适配配置辅助模块

先用纯函数封装 baseurl、key、题型映射和默认 wrapper 生成，给后续面板接线与运行时校验提供稳定基础。
EOF
)"
```

---

### Task 2: Wire the compile-time default, panel UI, and runtime warnings through failing source assertions

**Files:**
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\tiku-adapter-wiring.test.mjs`
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\build.mjs`
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\common.ts`
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\utils\work.ts`
- Test: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\tiku-adapter-wiring.test.mjs`

- [ ] **Step 1: Write the failing source-assertion test**

Create `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\tiku-adapter-wiring.test.mjs` with this content:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const buildScriptPath = resolve(process.cwd(), 'build.mjs');
const commonPath = resolve(process.cwd(), 'src', 'projects', 'common.ts');
const workUtilPath = resolve(process.cwd(), 'src', 'utils', 'work.ts');
const typesPath = resolve(process.cwd(), 'src', 'types.d.ts');

test('build script injects the default tiku baseurl define', async () => {
  const source = await readFile(buildScriptPath, 'utf8');

  assert.equal(source.includes('process.env.DEFAULT_TIKU_BASE_URL'), true);
  assert.equal(source.includes('__DEFAULT_TIKU_BASE_URL__'), true);
  assert.equal(source.includes('define:'), true);
});

test('type declarations expose the injected tiku baseurl global', async () => {
  const source = await readFile(typesPath, 'utf8');

  assert.equal(source.includes('declare const __DEFAULT_TIKU_BASE_URL__: string;'), true);
});

test('common panel renders tiku adapter baseurl, key, and jump controls', async () => {
  const source = await readFile(commonPath, 'utf8');

  assert.equal(source.includes('题库配置'), true);
  assert.equal(source.includes('baseurl'), true);
  assert.equal(source.includes('key'), true);
  assert.equal(source.includes('跳转'), true);
});

test('common settings build answerer wrappers from stored tiku adapter config', async () => {
  const source = await readFile(commonPath, 'utf8');

  assert.equal(source.includes('createTikuAdapterAnswererWrapper'), true);
  assert.equal(source.includes('TIKU_ADAPTER_BASEURL_KEY'), true);
  assert.equal(source.includes('TIKU_ADAPTER_KEY_KEY'), true);
  assert.equal(source.includes('resolveTikuAdapterBaseUrl'), true);
});

test('empty-wrapper warning explains whether baseurl or key is missing', async () => {
  const source = await readFile(workUtilPath, 'utf8');

  assert.equal(source.includes('请先填写题库 key。'), true);
  assert.equal(source.includes('请先填写正确的题库 baseurl。'), true);
  assert.equal(source.includes('getTikuAdapterConfigProblem'), true);
});
```

- [ ] **Step 2: Run the wiring test and watch it fail**

Run:

```bash
node --test "scripts/tiku-adapter-wiring.test.mjs"
```

Expected: FAIL because `build.mjs` does not yet inject the compile-time default, `common.ts` does not yet render the new `baseurl` / `key` / `跳转` section, and `utils/work.ts` still only prints the generic empty-wrapper warning.

- [ ] **Step 3: Implement the build wiring, panel section, dynamic wrapper injection, and config-aware warnings**

Update `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\build.mjs` with these changes:

```js
import { createRequire } from 'module';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { copyFileSync, mkdirSync, existsSync, writeFileSync } from 'fs';

process.env.VITE_CJS_IGNORE_WARNING = '1';
const _require = createRequire(import.meta.url);
const { build } = _require('vite');

const __dirname = dirname(fileURLToPath(import.meta.url));
const watchMode = process.argv.includes('--watch');
const defaultTikuBaseUrl = process.env.DEFAULT_TIKU_BASE_URL ?? '';

async function main() {
  await build({
    configFile: false,
    define: {
      __DEFAULT_TIKU_BASE_URL__: JSON.stringify(defaultTikuBaseUrl)
    },
    build: {
      watch: watchMode ? {} : null,
      lib: {
        entry: resolve(__dirname, 'src/index.ts'),
        formats: ['iife'],
        name: 'ChaoxingPlusScript',
        fileName: () => 'chaoxing-plus.js'
      },
      rollupOptions: {
        output: {
          entryFileNames: 'chaoxing-plus.js',
          inlineDynamicImports: true
        }
      },
      outDir: 'dist',
      emptyOutDir: true
    }
  });

  copyStaticFiles();
}
```

Update the imports at the top of `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\common.ts` to include the helper:

```ts
import {
  DEFAULT_TIKU_BASE_URL,
  TIKU_ADAPTER_BASEURL_KEY,
  TIKU_ADAPTER_KEY_KEY,
  createTikuAdapterAnswererWrapper,
  getTikuAdapterConfigProblem,
  isValidTikuAdapterBaseUrl,
  resolveTikuAdapterBaseUrl
} from './tiku-adapter-config.js';
```

Replace `getWorkOptions()` in `common.ts` with:

```ts
function getStoredTikuAdapterConfig() {
  const baseurl = runtimeStore.get(TIKU_ADAPTER_BASEURL_KEY, DEFAULT_TIKU_BASE_URL);
  const key = runtimeStore.get(TIKU_ADAPTER_KEY_KEY, '');

  return {
    baseurl: typeof baseurl === 'string' ? baseurl : DEFAULT_TIKU_BASE_URL,
    key: typeof key === 'string' ? key : ''
  };
}

function getWorkOptions(): CommonWorkOptions {
  const stored = runtimeStore.get(WORK_OPTIONS_KEY, defaultWorkOptions);
  const tikuConfig = getStoredTikuAdapterConfig();
  const resolvedBaseurl = resolveTikuAdapterBaseUrl(tikuConfig.baseurl, DEFAULT_TIKU_BASE_URL);
  const dynamicProblem = getTikuAdapterConfigProblem({
    baseurl: resolvedBaseurl,
    key: tikuConfig.key
  });

  const dynamicWrapper = dynamicProblem
    ? undefined
    : createTikuAdapterAnswererWrapper({
        baseurl: resolvedBaseurl,
        key: tikuConfig.key
      });

  return {
    ...stored,
    answererWrappers: dynamicWrapper ? [dynamicWrapper] : []
  };
}
```

Add this new section builder to `common.ts` near the other panel helpers:

```ts
function createTikuAdapterConfigSection() {
  const stored = getStoredTikuAdapterConfig();

  const container = createElement('div');
  applySectionCardStyle(container, {
    padding: '14px',
    background: 'rgba(248, 250, 252, 0.86)',
    border: '1px solid rgba(148, 163, 184, 0.18)'
  });
  container.style.display = 'grid';
  container.style.gap = '12px';

  const header = createElement('div');
  header.style.display = 'grid';
  header.style.gap = '6px';

  const title = createElement('div', { text: '题库配置' });
  title.style.fontSize = '15px';
  title.style.fontWeight = '800';
  title.style.color = '#0f172a';

  const description = createElement('div', {
    text: '默认对接 POST {baseurl}/adapter-service/search，并使用 Authorization: Bearer <key>。本地保存优先于编译期默认地址。'
  });
  description.style.fontSize = '12px';
  description.style.color = '#64748b';
  description.style.lineHeight = '1.7';

  header.append(title, description);

  const baseurlWrap = createElement('div');
  baseurlWrap.style.display = 'grid';
  baseurlWrap.style.gap = '8px';

  const baseurlLabel = createElement('label', { text: 'baseurl' });
  baseurlLabel.style.fontSize = '12px';
  baseurlLabel.style.fontWeight = '700';
  baseurlLabel.style.color = '#334155';

  const baseurlRow = createElement('div');
  baseurlRow.style.display = 'flex';
  baseurlRow.style.gap = '8px';
  baseurlRow.style.flexWrap = 'wrap';

  const baseurlInput = document.createElement('input');
  baseurlInput.type = 'text';
  baseurlInput.value = stored.baseurl || DEFAULT_TIKU_BASE_URL;
  baseurlInput.placeholder = DEFAULT_TIKU_BASE_URL || 'https://your-tiku.example.com';
  baseurlInput.style.flex = '1';
  baseurlInput.style.minWidth = '220px';
  baseurlInput.style.padding = '10px 12px';
  baseurlInput.style.borderRadius = '12px';
  baseurlInput.style.border = '1px solid rgba(226, 232, 240, 0.95)';
  baseurlInput.style.background = 'rgba(255,255,255,0.98)';
  baseurlInput.oninput = () => {
    runtimeStore.set(TIKU_ADAPTER_BASEURL_KEY, baseurlInput.value);
  };

  const jumpButton = createElement('button', { text: '跳转' });
  applyActionButtonStyle(jumpButton, 'default');
  jumpButton.onclick = async () => {
    const normalized = resolveTikuAdapterBaseUrl(baseurlInput.value, DEFAULT_TIKU_BASE_URL);
    if (!isValidTikuAdapterBaseUrl(normalized)) {
      await $modal.alert('请先填写正确的题库 baseurl。');
      return;
    }

    window.open(normalized, '_blank', 'noopener,noreferrer');
  };

  baseurlRow.append(baseurlInput, jumpButton);
  baseurlWrap.append(baseurlLabel, baseurlRow);

  const keyWrap = createElement('div');
  keyWrap.style.display = 'grid';
  keyWrap.style.gap = '8px';

  const keyLabel = createElement('label', { text: 'key' });
  keyLabel.style.fontSize = '12px';
  keyLabel.style.fontWeight = '700';
  keyLabel.style.color = '#334155';

  const keyInput = document.createElement('input');
  keyInput.type = 'password';
  keyInput.value = stored.key;
  keyInput.placeholder = '请输入访问令牌';
  keyInput.style.padding = '10px 12px';
  keyInput.style.borderRadius = '12px';
  keyInput.style.border = '1px solid rgba(226, 232, 240, 0.95)';
  keyInput.style.background = 'rgba(255,255,255,0.98)';
  keyInput.oninput = () => {
    runtimeStore.set(TIKU_ADAPTER_KEY_KEY, keyInput.value);
  };

  keyWrap.append(keyLabel, keyInput);
  container.append(header, baseurlWrap, keyWrap);
  return container;
}
```

In `createWorkResultsPanel()` inside `common.ts`, insert the new section before the cache section so users can configure the service in the existing floating panel:

```ts
  container.append(resultsSection);
  container.append(createTikuAdapterConfigSection());

  const cacheSection = createElement('div');
```

Update `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\utils\work.ts` to make the warning path config-aware:

```ts
import { runtimeStore } from '../runtime/index.js';
import { $modal } from '../runtime/message.js';
import {
  DEFAULT_TIKU_BASE_URL,
  TIKU_ADAPTER_BASEURL_KEY,
  TIKU_ADAPTER_KEY_KEY,
  getTikuAdapterConfigProblem,
  resolveTikuAdapterBaseUrl
} from '../projects/tiku-adapter-config.js';
import type { SimplifyWorkResult } from '../core/index.js';

function getTikuAdapterWarningMessage() {
  const storedBaseurl = runtimeStore.get(TIKU_ADAPTER_BASEURL_KEY, DEFAULT_TIKU_BASE_URL);
  const storedKey = runtimeStore.get(TIKU_ADAPTER_KEY_KEY, '');

  const baseurl = resolveTikuAdapterBaseUrl(typeof storedBaseurl === 'string' ? storedBaseurl : '', DEFAULT_TIKU_BASE_URL);
  const key = typeof storedKey === 'string' ? storedKey.trim() : '';
  const problem = getTikuAdapterConfigProblem({ baseurl, key });

  if (problem === 'missing-key') {
    return '请先填写题库 key。';
  }

  if (problem === 'missing-baseurl' || problem === 'invalid-baseurl') {
    return '请先填写正确的题库 baseurl。';
  }

  return '当前未配置题库';
}

export function answerWrapperEmptyWarning(_duration: number) {
  const message = getTikuAdapterWarningMessage();
  console.warn(`[chaoxing-plus] ${message}`);
  void $modal.alert(message);
}
```

This is the critical integration choice: do **not** patch `cx.ts` call sites one by one. By resolving the dynamic wrapper in `common.ts` and making `answerWrapperEmptyWarning(...)` config-aware in `utils/work.ts`, both `commonWork(...)` and `chapter(...)` share the same behavior with minimal churn.

- [ ] **Step 4: Re-run the wiring test and verify it passes**

Run:

```bash
node --test "scripts/tiku-adapter-wiring.test.mjs"
```

Expected: PASS for build injection, type declaration, panel controls, helper-based wrapper creation, and the new missing-config warning text.

- [ ] **Step 5: Commit the UI and runtime wiring slice**

Run:

```bash
git add build.mjs src/projects/common.ts src/utils/work.ts scripts/tiku-adapter-wiring.test.mjs
git commit -m "$(cat <<'EOF'
feat: 接入默认题库 baseurl 与 key 配置

在现有学习答题面板中增加题库配置区，并把默认 tikuAdapter wrapper 注入到全局 work options，同时为缺失 key 或非法 baseurl 提供明确提示。
EOF
)"
```

---

### Task 3: Run the full verification set and perform the manual checks

**Files:**
- Test: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\tiku-adapter-config.test.mjs`
- Test: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\tiku-adapter-wiring.test.mjs`
- Verify build: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\build.mjs`
- Verify runtime integration through the browser extension manually

- [ ] **Step 1: Run the helper regression test**

Run:

```bash
npx tsc "src/projects/tiku-adapter-config.ts" --outDir ".tmp-tests" --module nodenext --target es2022 --moduleResolution nodenext && node --test "scripts/tiku-adapter-config.test.mjs"
```

Expected: PASS. This confirms pure helper behavior for normalization, URL assembly, bearer headers, config validation, question-type mapping, and wrapper shape.

- [ ] **Step 2: Run the wiring regression test**

Run:

```bash
node --test "scripts/tiku-adapter-wiring.test.mjs"
```

Expected: PASS. This confirms the compile-time default hook, type declaration, panel controls, helper consumption, and precise missing-config prompts remain wired.

- [ ] **Step 3: Run the repository verification commands**

Run:

```bash
npm run typecheck && npm run build
```

Expected:
- `npm run typecheck` exits with code `0`
- `npm run build` exits with code `0`
- `dist/chaoxing-plus.js` is rebuilt successfully

- [ ] **Step 4: Perform the manual browser verification**

Check all of these in the built extension:

```text
1. 第一次打开页面时，如果本地没有保存 baseurl，则输入框显示编译期默认 URL。
2. 修改 baseurl 与 key 后刷新页面，它们仍然保留。
3. 点击“跳转”按钮时，会打开当前输入框里的 baseurl。
4. baseurl 非法时，“跳转”按钮会弹出“请先填写正确的题库 baseurl。”。
5. key 为空时，章节测试和作业/考试都会被阻断，并提示“请先填写题库 key。”。
6. baseurl 与 key 都完整时，请求会命中 POST {baseurl}/adapter-service/search。
7. 请求头中包含 Authorization: Bearer <key>。
8. 返回结果后，现有答题结果面板与题库缓存仍然正常更新。
```

- [ ] **Step 5: Commit the verification pass**

Run:

```bash
git add scripts/tiku-adapter-config.test.mjs scripts/tiku-adapter-wiring.test.mjs build.mjs src/types.d.ts src/projects/tiku-adapter-config.ts src/projects/common.ts src/utils/work.ts
git commit -m "$(cat <<'EOF'
test: 验证默认题库接线

补齐默认题库接入后的回归测试与构建验证，确保 baseurl、key、默认 wrapper 和提示链路一起稳定工作。
EOF
)"
```

---

## Notes for the Implementer

- Keep `src/projects/tiku-adapter-config.ts` pure. Do not move `runtimeStore` reads into that helper; persistence belongs in `common.ts` and warning-time lookups belong in `utils/work.ts`.
- Do not change `src/projects/cx.ts` unless the upstream `getWorkOptions()` injection proves insufficient. Right now it is the cleanest integration point because both work/exam and study flows already funnel through it.
- Treat the generated default wrapper as the only active `answererWrappers` source in this scope. This change intentionally hides the low-level wrapper array from the panel so users only configure `baseurl` and `key`.
- Keep the jump button independent from `key`; only `baseurl` validity should control it.
- Prefer explicit user-facing messages over silent `console.warn(...)` when configuration is incomplete.
