# Chaoxing Plus OCSJS CX-Only Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `chaoxing_plus` from an MV3 extension into a single-platform script-style project whose structure and behavior closely mirror `ocsjs`'s Chaoxing module while preserving only Chaoxing functionality.

**Architecture:** Replace the current `background + content + popup` extension-centered entrypoints with an `ocsjs`-style `src/index.ts` + `src/projects/cx.ts` centered runtime. Introduce a minimal local runtime that can host `Project`/`Script`-style modules, then migrate Chaoxing study, work, redirect, compatibility, and UI support logic in stages until the old MV3-only structure can be removed.

**Tech Stack:** TypeScript, Vite build script, local script runtime, DOM APIs, SweetAlert2, lodash, md5, typr.js, lightweight Node build tooling.

---

## File Structure

### Files to create

- `docs/superpowers/plans/2026-05-02-chaoxing-plus-ocsjs-cx-only-implementation.md` — this implementation plan.
- `src/index.ts` — new script-style application entry that wires runtime + projects.
- `src/runtime/project.ts` — `Project` registration abstraction.
- `src/runtime/script.ts` — `Script` abstraction with match/config/lifecycle support.
- `src/runtime/start.ts` — runtime bootstrap for matching and activating scripts.
- `src/runtime/store.ts` — local storage/config state layer.
- `src/runtime/message.ts` — notification / modal wrapper layer.
- `src/runtime/dom.ts` — common DOM helpers needed by runtime and migrated modules.
- `src/runtime/cors.ts` — top-window and cross-frame helpers.
- `src/runtime/gm.ts` — local compatibility layer for `unsafeWindow`, metadata, and request shims.
- `src/projects/cx.ts` — Chaoxing project port and orchestration center.
- `src/projects/common.ts` — shared single-platform scripts/settings/workflow support.
- `src/projects/background.ts` — local logging/debug support used by cx/common.
- `src/projects/index.ts` — exports for defined local projects.
- `src/core/index.ts` — local core exports.
- `src/core/answer-wrapper/index.ts` — local answer-wrapper entry.
- `src/core/answer-wrapper/interface.ts` — answer-wrapper types.
- `src/core/answer-wrapper/answer.wrapper.parser.ts` — parser logic port.
- `src/core/answer-wrapper/answer.wrapper.handler.ts` — answer-wrapper handler logic port.
- `src/core/worker/index.ts` — worker exports.
- `src/core/worker/interface.ts` — worker types.
- `src/core/worker/worker.ts` — local `OCSWorker` implementation.
- `src/core/worker/question.resolver.ts` — question resolver port.
- `src/core/worker/utils.ts` — worker helpers.
- `src/core/utils/index.ts` — core utility exports.
- `src/core/utils/dom.ts` — core DOM search helpers.
- `src/core/utils/request.ts` — request helpers.
- `src/core/utils/string.ts` — string helpers.
- `src/utils/index.ts` — shared script utility exports.
- `src/utils/configs.ts` — reusable config descriptors.
- `src/utils/study.ts` — wait-for-media / wait-for-element helpers.
- `src/utils/work.ts` — work-control/result simplification helpers.
- `src/utils/render.ts` — render/panel helper layer.
- `src/utils/markdown.ts` — markdown helper if required by common UI.
- `src/render.ts` — `RenderScript` equivalent.
- `src/elements/search.infos.ts` — local custom element for answer search results.
- `src/types/global.d.ts` — runtime globals for injected / page-bound access.
- `scripts/build-userscript-manifest.mjs` — optional builder that outputs script-style metadata/assets if needed.

### Files to modify

- `package.json` — replace extension-oriented scripts/deps with script-style runtime/build dependencies.
- `tsconfig.json` — align compilation targets, includes, and path layout with the new source tree.
- `build.mjs` — replace MV3 content/background/popup pipeline with script-style bundle pipeline.
- `README.md` — update from extension usage to script-style architecture and usage.
- `public/manifest.json` — remove when MV3 output is retired, or stop referencing it from the build.
- `public/page-hooks.js` — keep only if still required by migrated Chaoxing hacks.
- `public/vendor/swal-bridge.js` — keep/remove based on final message layer choice.

### Files to delete

- `src/background/index.ts`
- `src/content/index.ts`
- `src/content/cx/video.ts`
- `src/content/cx/study.ts`
- `src/content/cx/work.ts`
- `src/content/panel/panel.ts`
- `src/content/utils/dom.ts`
- `src/content/utils/logger.ts`
- `src/popup/index.html`
- `src/popup/popup.ts`
- `src/popup/popup.css`
- `src/shared/constants.ts`
- `src/shared/types.ts`
- `src/shared/swal.ts`
- `public/manifest.json` (if the build fully stops targeting MV3)

---

### Task 1: Reframe the package as a script-style project

**Files:**
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\package.json`
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\tsconfig.json`
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\build.mjs`
- Test: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\package.json`

- [ ] **Step 1: Write the failing package-shape check as a manual diff target**

Create a scratch checklist in your notes before editing:

```text
Expected package changes:
- remove popup/background/extension wording from scripts
- add script-style build entry
- add runtime dependencies needed by local ocsjs-style port
- keep TypeScript + Vite buildability
```

- [ ] **Step 2: Run the current build to capture the old extension assumption**

Run: `npm run build`
Expected: PASS, producing MV3 extension output under `dist/`, confirming the current build is still extension-oriented.

- [ ] **Step 3: Rewrite `package.json` for the new architecture**

Replace `package.json` with:

```json
{
  "name": "chaoxing-plus",
  "version": "2.0.0",
  "description": "单平台版 ocsjs 风格超星脚本工程",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node build.mjs --watch",
    "build": "node build.mjs",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/chrome": "^0.1.37",
    "@types/lodash": "^4.17.16",
    "@types/md5": "^2.3.5",
    "@types/node": "^24.0.0",
    "typescript": "^5.4.5",
    "vite": "^5.4.0"
  },
  "dependencies": {
    "lodash": "^4.17.21",
    "md5": "^2.3.0",
    "sweetalert2": "^11.26.24",
    "typr.js": "^1.0.0"
  }
}
```

- [ ] **Step 4: Rewrite `tsconfig.json` to target the new source layout**

Replace `tsconfig.json` with:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "moduleResolution": "bundler",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": false,
    "sourceMap": false,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 5: Replace `build.mjs` with a single-entry script build**

Replace `build.mjs` with:

```js
import { createRequire } from 'module';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { copyFileSync, mkdirSync, existsSync } from 'fs';

process.env.VITE_CJS_IGNORE_WARNING = '1';
const _require = createRequire(import.meta.url);
const { build } = _require('vite');

const __dirname = dirname(fileURLToPath(import.meta.url));
const watchMode = process.argv.includes('--watch');

function copyStaticFiles() {
  mkdirSync('dist', { recursive: true });

  if (existsSync('public/page-hooks.js')) {
    copyFileSync('public/page-hooks.js', 'dist/page-hooks.js');
  }

  if (existsSync('public/vendor/swal-bridge.js')) {
    mkdirSync('dist/vendor', { recursive: true });
    copyFileSync('public/vendor/swal-bridge.js', 'dist/vendor/swal-bridge.js');
  }

  if (existsSync('node_modules/sweetalert2/dist/sweetalert2.min.css')) {
    mkdirSync('dist/vendor', { recursive: true });
    copyFileSync('node_modules/sweetalert2/dist/sweetalert2.min.css', 'dist/vendor/sweetalert2.min.css');
  }

  if (existsSync('node_modules/sweetalert2/dist/sweetalert2.all.min.js')) {
    mkdirSync('dist/vendor', { recursive: true });
    copyFileSync('node_modules/sweetalert2/dist/sweetalert2.all.min.js', 'dist/vendor/sweetalert2.all.min.js');
  }
}

async function main() {
  copyStaticFiles();

  await build({
    configFile: false,
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
}

main().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
```

- [ ] **Step 6: Install the new dependencies**

Run: `npm install`
Expected: PASS, `package-lock.json` updated with lodash/md5/typr.js/node types.

- [ ] **Step 7: Run typecheck to confirm the repo now fails for missing new entry/runtime files**

Run: `npm run typecheck`
Expected: FAIL with errors such as `Cannot find module './index.ts'` or missing imports because the new runtime tree has not been created yet.

- [ ] **Step 8: Commit the package/build pivot**

```bash
git add package.json package-lock.json tsconfig.json build.mjs
git commit -m "refactor: pivot build toward script runtime"
```

### Task 2: Create the runtime skeleton and new application entry

**Files:**
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\index.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\runtime\project.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\runtime\script.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\runtime\start.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\index.ts`
- Test: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\index.ts`

- [ ] **Step 1: Write the failing typecheck target by referencing the future runtime API**

Put this target shape in your notes:

```ts
start(definedProjects());
```

Expected failure before implementation: `definedProjects` / `start` do not exist.

- [ ] **Step 2: Create `src/runtime/project.ts`**

```ts
import type { ScriptInstanceMap } from './script.js';

export interface ProjectDefinition {
  name: string;
  domains: string[];
  scripts: ScriptInstanceMap;
}

export class Project {
  static create(definition: ProjectDefinition): ProjectDefinition {
    return definition;
  }
}
```

- [ ] **Step 3: Create `src/runtime/script.ts`**

```ts
export type MatchRule = [string, string | RegExp];

export interface ScriptConfigMap {
  [key: string]: unknown;
}

export interface ScriptContext {
  projectName: string;
}

export interface ScriptDefinition<TConfig extends ScriptConfigMap = ScriptConfigMap> {
  name: string;
  namespace?: string;
  matches: MatchRule[];
  hideInPanel?: boolean | (() => boolean);
  configs?: TConfig;
  methods?: () => Record<string, unknown>;
  onstart?: (ctx: ScriptContext) => void | Promise<void>;
  onactive?: (ctx: ScriptContext) => void | Promise<void>;
  oncomplete?: (ctx: ScriptContext) => void | Promise<void>;
  onrender?: (ctx: ScriptContext) => void | Promise<void>;
}

export type ScriptInstanceMap = Record<string, ScriptDefinition>;

export class Script<TConfig extends ScriptConfigMap = ScriptConfigMap> {
  constructor(public definition: ScriptDefinition<TConfig>) {}
}
```

- [ ] **Step 4: Create `src/runtime/start.ts`**

```ts
import type { ProjectDefinition } from './project.js';
import type { MatchRule, ScriptDefinition } from './script.js';

function matchesRule(rule: MatchRule, url: string): boolean {
  const [, pattern] = rule;
  return typeof pattern === 'string' ? url.includes(pattern) : pattern.test(url);
}

function matchesScript(script: ScriptDefinition, url: string): boolean {
  return script.matches.some((rule) => matchesRule(rule, url));
}

function matchesDomain(project: ProjectDefinition, hostname: string): boolean {
  if (project.domains.length === 0) return true;
  return project.domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

export async function start(projects: ProjectDefinition[]): Promise<void> {
  const url = window.location.href;
  const hostname = window.location.hostname;

  for (const project of projects) {
    if (!matchesDomain(project, hostname)) continue;

    for (const script of Object.values(project.scripts)) {
      if (!matchesScript(script, url)) continue;
      const ctx = { projectName: project.name };
      await script.onstart?.(ctx);
      await script.onactive?.(ctx);
      await script.oncomplete?.(ctx);
    }
  }
}
```

- [ ] **Step 5: Create `src/projects/index.ts`**

```ts
import type { ProjectDefinition } from '../runtime/project.js';

export function definedProjects(): ProjectDefinition[] {
  return [];
}
```

- [ ] **Step 6: Create `src/index.ts`**

```ts
import { start } from './runtime/start.js';
import { definedProjects } from './projects/index.js';

start(definedProjects()).catch((err) => {
  console.error('[chaoxing-plus] startup failed', err);
});
```

- [ ] **Step 7: Run typecheck to verify the new runtime skeleton passes**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Run build to verify `dist/chaoxing-plus.js` is generated**

Run: `npm run build`
Expected: PASS with `dist/chaoxing-plus.js` present.

- [ ] **Step 9: Commit the runtime skeleton**

```bash
git add src/index.ts src/runtime/project.ts src/runtime/script.ts src/runtime/start.ts src/projects/index.ts dist
git commit -m "feat: add local script runtime skeleton"
```

### Task 3: Add storage, message, and utility runtime layers

**Files:**
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\runtime\store.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\runtime\message.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\runtime\dom.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\runtime\cors.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\runtime\gm.ts`
- Test: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\runtime\*.ts`

- [ ] **Step 1: Write the failing typecheck target for the utility exports**

Use this target import block in your notes:

```ts
import { runtimeStore } from './runtime/store.js';
import { $message, $modal } from './runtime/message.js';
import { defineTopFunction } from './runtime/cors.js';
import { $gm } from './runtime/gm.js';
```

Expected failure before implementation: modules do not exist.

- [ ] **Step 2: Create `src/runtime/store.ts`**

```ts
const memoryStore = new Map<string, unknown>();

export const runtimeStore = {
  get<T>(key: string, fallback?: T): T | undefined {
    if (memoryStore.has(key)) {
      return memoryStore.get(key) as T;
    }

    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;

    try {
      return JSON.parse(raw) as T;
    } catch {
      return (raw as T) ?? fallback;
    }
  },
  set<T>(key: string, value: T): void {
    memoryStore.set(key, value);
    localStorage.setItem(key, JSON.stringify(value));
  },
  remove(key: string): void {
    memoryStore.delete(key);
    localStorage.removeItem(key);
  }
};
```

- [ ] **Step 3: Create `src/runtime/message.ts`**

```ts
import Swal from 'sweetalert2';

function toast(icon: 'info' | 'success' | 'warning' | 'error', content: string, duration = 3000) {
  console[icon === 'warning' ? 'warn' : icon === 'error' ? 'error' : 'log'](`[chaoxing-plus] ${content}`);
  void Swal.fire({
    toast: true,
    position: 'top-end',
    timer: duration,
    showConfirmButton: false,
    icon,
    title: content
  });
}

export const $message = {
  info(content: string) {
    toast('info', content);
  },
  success(content: string) {
    toast('success', content);
  },
  warn(content: string) {
    toast('warning', content, 5000);
  },
  error(content: string) {
    toast('error', content, 5000);
  }
};

export const $modal = {
  async alert(content: string): Promise<void> {
    await Swal.fire({ icon: 'info', text: content, confirmButtonText: '知道了' });
  },
  async confirm(content: string): Promise<boolean> {
    const result = await Swal.fire({
      icon: 'question',
      text: content,
      showCancelButton: true,
      confirmButtonText: '确认',
      cancelButtonText: '取消'
    });
    return result.isConfirmed;
  }
};
```

- [ ] **Step 4: Create `src/runtime/dom.ts`**

```ts
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function observeDOM(target: ParentNode, callback: () => void): () => void {
  const observer = new MutationObserver(() => callback());
  observer.observe(target, { childList: true, subtree: true, attributes: true });
  return () => observer.disconnect();
}

export function cleanText(input: Element | string): string {
  const value = typeof input === 'string' ? input : input.textContent ?? '';
  return value.replace(/\s+/g, ' ').trim();
}
```

- [ ] **Step 5: Create `src/runtime/cors.ts`**

```ts
export function defineTopFunction<TArgs extends unknown[]>(fn: (...args: TArgs) => void) {
  return (...args: TArgs) => {
    try {
      if (window.top && window.top !== window) {
        fn(...args);
        return;
      }
    } catch {
      // ignore and fall through
    }
    fn(...args);
  };
}
```

- [ ] **Step 6: Create `src/runtime/gm.ts`**

```ts
export const $gm = {
  unsafeWindow: window,
  getInfos(): undefined {
    return undefined;
  },
  getMetadataFromScriptHead(_key: string): string[] {
    return [];
  }
};
```

- [ ] **Step 7: Run typecheck to verify the utility layer compiles**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit the runtime utilities**

```bash
git add src/runtime/store.ts src/runtime/message.ts src/runtime/dom.ts src/runtime/cors.ts src/runtime/gm.ts
git commit -m "feat: add runtime storage and ui helpers"
```

### Task 4: Port the local core answer-wrapper and worker modules

**Files:**
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\core\index.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\core\answer-wrapper\index.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\core\answer-wrapper\interface.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\core\answer-wrapper\answer.wrapper.parser.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\core\answer-wrapper\answer.wrapper.handler.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\core\worker\index.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\core\worker\interface.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\core\worker\worker.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\core\worker\question.resolver.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\core\worker\utils.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\core\utils\index.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\core\utils\dom.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\core\utils\request.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\core\utils\string.ts`
- Test: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\core\**\*.ts`

- [ ] **Step 1: Copy the OCSJS core source files into the local `src/core/` tree**

Source files to port directly from `C:\Users\Zelly\Documents\GitHub\ocsjs\packages\core\src\`:

```text
core/answer-wrapper/answer.wrapper.handler.ts
core/answer-wrapper/answer.wrapper.parser.ts
core/answer-wrapper/index.ts
core/answer-wrapper/interface.ts
core/worker/index.ts
core/worker/interface.ts
core/worker/question.resolver.ts
core/worker/utils.ts
core/worker/worker.ts
core/utils/dom.ts
core/utils/index.ts
core/utils/request.ts
core/utils/string.ts
index.ts
utils/common.ts
utils/const.ts
utils/index.ts
utils/string.ts
```

When copying, place them under `src/core/` and keep filenames aligned with the spec.

- [ ] **Step 2: Rewrite any workspace-package imports to local relative imports**

Example replacement pattern to apply in copied files:

```ts
// before
import { request } from '@ocsjs/core';

// after
import { request } from '../utils/request.js';
```

And for index exports:

```ts
export * from './answer-wrapper/index.js';
export * from './worker/index.js';
export * from './utils/index.js';
```

- [ ] **Step 3: Add `src/core/index.ts` as the local public surface**

```ts
export * from './answer-wrapper/index.js';
export * from './worker/index.js';
export * from './utils/index.js';
```

- [ ] **Step 4: Run typecheck to capture the first wave of unresolved local dependencies**

Run: `npm run typecheck`
Expected: FAIL with unresolved imports from the newly copied core modules, which identifies remaining path rewrites or missing helper files.

- [ ] **Step 5: Finish path rewrites and remove unusable dependencies one file at a time**

Apply these concrete rules while editing copied files:

```text
- replace '@ocsjs/core' imports with relative local imports under src/core
- remove playwright-only imports and code paths not used by cx.ts runtime
- keep answer-wrapper, worker, request, dom-search, and string utilities intact
- export only APIs that cx/common/work code will actually consume
```

- [ ] **Step 6: Re-run typecheck until the local core passes**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit the local core port**

```bash
git add src/core
git commit -m "feat: port local ocsjs-style core modules"
```

### Task 5: Port reusable config, study, work, render, and element helpers

**Files:**
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\utils\index.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\utils\configs.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\utils\study.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\utils\work.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\utils\render.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\render.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\elements\search.infos.ts`
- Test: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\utils\*.ts`

- [ ] **Step 1: Create `src/render.ts` as the local render-script placeholder**

```ts
export const RenderScript = {
  name: '🖼️ 窗口设置'
};
```

- [ ] **Step 2: Port `src/utils/configs.ts` with simplified local config objects**

Create `src/utils/configs.ts` with:

```ts
export const playbackRate = {
  label: '视频倍速',
  options: [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.5, 4, 6, 8, 16],
  defaultValue: '1'
};

export const volume = {
  label: '音量调节',
  defaultValue: 0
};

export const workNotes = {
  defaultValue: '自动答题前请在题库配置中设置可用题库。'
};

export const dropdownStyle = {
  labelClassName: 'checkbox-label',
  providerClassName: 'checkbox-input'
};
```

- [ ] **Step 3: Port `src/utils/study.ts`**

Create `src/utils/study.ts` with:

```ts
import { sleep } from '../runtime/dom.js';

export async function waitForMedia(options?: {
  videoSelector?: string;
  audioSelector?: string;
  root?: HTMLElement | Document;
  timeout?: number;
  filter?: (video: HTMLVideoElement | HTMLAudioElement) => boolean;
}) {
  const deadline = Date.now() + (options?.timeout ?? 3 * 60 * 1000);
  while (Date.now() < deadline) {
    const media = (options?.root || document).querySelector<HTMLVideoElement | HTMLAudioElement>(
      `${options?.videoSelector || 'video'},${options?.audioSelector || 'audio'}`
    );
    if (media && (!options?.filter || options.filter(media))) {
      return media;
    }
    await sleep(200);
  }
  throw new Error('视频/音频未找到，或者加载超时。');
}

export async function waitForElement(
  selector: string | (() => HTMLElement | undefined),
  opts?: { timeout_seconds?: number; check_period_ms?: number }
) {
  const deadline = Date.now() + ((opts?.timeout_seconds ?? 10) * 1000);
  while (Date.now() < deadline) {
    const result = typeof selector === 'function' ? selector() : document.querySelector<HTMLElement>(selector);
    if (result) return result;
    await sleep(opts?.check_period_ms ?? 1000);
  }
  return undefined;
}
```

- [ ] **Step 4: Port `src/utils/work.ts` with the minimum helpers required by `cx.ts`**

Create `src/utils/work.ts` with:

```ts
import type { SimplifyWorkResultLike } from './index.js';

export function optimizationElementWithImage(root: HTMLElement, cloneNode = false): HTMLElement {
  const clone = cloneNode ? (root.cloneNode(true) as HTMLElement) : root;
  for (const img of Array.from(clone.querySelectorAll('img'))) {
    const span = document.createElement('span');
    span.innerText = img.src;
    span.style.fontSize = '0px';
    img.after(span);
  }
  return clone;
}

export function removeRedundantWords(text: string, words: string[]): string {
  return words.filter(Boolean).reduce((acc, word) => acc.replaceAll(word.trim(), ''), text);
}

export function splitAnswer(answer: string): string[] {
  return answer.split(/[#,，;；\n]/).map((item) => item.trim()).filter(Boolean);
}

export function simplifyWorkResult(results: SimplifyWorkResultLike[]): SimplifyWorkResultLike[] {
  return results;
}

export function answerWrapperEmptyWarning(_duration: number) {
  console.warn('[chaoxing-plus] answer wrappers are empty');
}

export const workNotes = { defaultValue: '自动答题前请配置题库。' };
```

- [ ] **Step 5: Create `src/utils/render.ts` and `src/elements/search.infos.ts`**

`src/utils/render.ts`

```ts
export function ensurePanelRoot(id = 'chaoxing-plus-panel-root'): HTMLElement {
  let root = document.getElementById(id);
  if (!root) {
    root = document.createElement('div');
    root.id = id;
    document.body.appendChild(root);
  }
  return root;
}
```

`src/elements/search.infos.ts`

```ts
export class SearchInfosElement extends HTMLElement {
  infos: Array<{ name: string; homepage: string; results: Array<[string, string, Record<string, unknown>]>; error?: string }> = [];
  question = '';
  connectedCallback(): void {
    this.innerHTML = `
      <div class="search-info-title">${this.question || '无题目'}</div>
      ${this.infos.map((info) => `
        <details open>
          <summary><a href="${info.homepage}" target="_blank">${info.name}</a></summary>
          ${(info.results || []).map((item) => `<div><strong>答案：</strong><code>${item[1]}</code></div>`).join('')}
        </details>
      `).join('')}
    `;
  }
}
```

- [ ] **Step 6: Create `src/utils/index.ts` to expose shared local helper types**

```ts
export interface SimplifyWorkResultLike {
  requested?: boolean;
  resolved?: boolean;
  error?: string;
  type?: string;
  question?: string;
  finish?: boolean;
  searchInfos?: Array<{
    name: string;
    homepage: string;
    error?: string;
    results: Array<[string, string, Record<string, unknown>]>;
  }>;
}

export * from './configs.js';
export * from './study.js';
export * from './work.js';
export * from './render.js';
```

- [ ] **Step 7: Register the custom element in `src/index.ts`**

Add this block near the top of `src/index.ts`:

```ts
import { SearchInfosElement } from './elements/search.infos.js';

if (!customElements.get('search-infos')) {
  customElements.define('search-infos', SearchInfosElement);
}
```

- [ ] **Step 8: Run typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 9: Commit the local helper layer**

```bash
git add src/render.ts src/utils src/elements/search.infos.ts src/index.ts
git commit -m "feat: add shared cx helper modules"
```

### Task 6: Implement the local background/common project scaffolding

**Files:**
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\background.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\common.ts`
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\index.ts`
- Test: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\*.ts`

- [ ] **Step 1: Create `src/projects/background.ts`**

```ts
import { Project } from '../runtime/project.js';
import { $message } from '../runtime/message.js';

type LogType = 'log' | 'info' | 'debug' | 'warn' | 'error';

function pushLog(type: LogType, content: string): void {
  console[type === 'debug' ? 'log' : type](`[chaoxing-plus] ${content}`);
}

export const $console = {
  log(content: string) {
    pushLog('log', content);
  },
  info(content: string) {
    pushLog('info', content);
  },
  warn(content: string) {
    pushLog('warn', content);
    $message.warn(content);
  },
  error(content: string) {
    pushLog('error', content);
    $message.error(content);
  }
};

export const BackgroundProject = Project.create({
  name: '后台',
  domains: [],
  scripts: {}
});
```

- [ ] **Step 2: Create `src/projects/common.ts` with single-platform settings support**

```ts
import { Project } from '../runtime/project.js';
import { runtimeStore } from '../runtime/store.js';

export interface CommonWorkOptions {
  period: number;
  thread: number;
  upload: 'save' | 'submit';
  answererWrappers: Array<Record<string, unknown>>;
  stopSecondWhenFinish: number;
  redundanceWordsText: string;
  answerSeparators: string;
  answerMatchMode: 'exact' | 'includes' | 'similar';
}

const SETTINGS_KEY = 'cx.common.settings';

const defaultWorkOptions: CommonWorkOptions = {
  period: 3,
  thread: 1,
  upload: 'save',
  answererWrappers: [],
  stopSecondWhenFinish: 3,
  redundanceWordsText: '',
  answerSeparators: '#,|,;,；',
  answerMatchMode: 'includes'
};

function getWorkOptions(): CommonWorkOptions {
  return runtimeStore.get<CommonWorkOptions>(SETTINGS_KEY, defaultWorkOptions) ?? defaultWorkOptions;
}

export const CommonProject = Project.create({
  name: '通用',
  domains: [],
  scripts: {
    settings: {
      name: '⚙️ 全局设置',
      matches: [['所有页面', /.*/]],
      namespace: 'common.settings',
      methods: () => ({
        getWorkOptions,
        notificationBySetting(content: string) {
          console.info(`[chaoxing-plus] ${content}`);
        }
      })
    },
    workResults: {
      name: '📄 答题结果',
      matches: [['所有页面', /.*/]],
      namespace: 'common.work-results',
      methods: () => ({
        init() {},
        setResults() {},
        appendResults() {},
        updateWorkStateByResults() {},
        createWorkResultsPanel() {
          const div = document.createElement('div');
          div.textContent = '答题结果面板';
          return div;
        }
      })
    },
    render: {
      name: '🖼️ 渲染',
      matches: [['所有页面', /.*/]],
      namespace: 'common.render',
      methods: () => ({
        pin() {},
        normal() {},
        minimize() {}
      })
    },
    apps: {
      name: '🔎 拓展应用',
      matches: [['所有页面', /.*/]],
      namespace: 'common.apps',
      methods: () => ({
        searchAnswerInCaches<T>(_title: string, provider: () => Promise<T>) {
          return provider();
        },
        addQuestionCacheFromWorkResult() {}
      })
    }
  }
});
```

- [ ] **Step 3: Export the local projects in `src/projects/index.ts`**

Replace `src/projects/index.ts` with:

```ts
import type { ProjectDefinition } from '../runtime/project.js';
import { BackgroundProject } from './background.js';
import { CommonProject } from './common.js';

export { BackgroundProject } from './background.js';
export { CommonProject } from './common.js';

export function definedProjects(): ProjectDefinition[] {
  return [CommonProject, BackgroundProject];
}
```

- [ ] **Step 4: Run typecheck to verify the project scaffolding compiles**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit the project scaffolding**

```bash
git add src/projects/background.ts src/projects/common.ts src/projects/index.ts
git commit -m "feat: add common and background project scaffolding"
```

### Task 7: Port `CXProject` skeleton and register all Chaoxing script slots

**Files:**
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\cx.ts`
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\index.ts`
- Test: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\cx.ts`

- [ ] **Step 1: Create the failing `CXProject` registration target**

Add this expected export block to your notes:

```ts
export { CXProject } from './projects/cx.js';
```

Expected failure before implementation: `cx.ts` does not exist.

- [ ] **Step 2: Create `src/projects/cx.ts` with the full script registry skeleton**

Create this file:

```ts
import { Project } from '../runtime/project.js';

export const CXProject = Project.create({
  name: '超星学习通',
  domains: [
    'chaoxing.com',
    'edu.cn',
    'org.cn',
    'xueyinonline.com',
    'hnsyu.net',
    'qutjxjy.cn',
    'ynny.cn',
    'hnvist.cn',
    'fjlecb.cn',
    'gdhkmooc.com',
    'cugbonline.cn',
    'zjelib.cn',
    'cqrspx.cn',
    'neauce.com',
    'zhihui-yun.com',
    'cqie.cn',
    'ccqmxx.com',
    'jxgmxy.com',
    'jnzyjsxy.cn',
    'sslibrary.com'
  ],
  scripts: {
    env: {
      name: '环境准备脚本',
      matches: [['所有页面', /.*/]],
      hideInPanel: true,
      onstart() {}
    },
    guide: {
      name: '💡 使用提示',
      matches: [
        ['首页', 'https://www.chaoxing.com'],
        ['旧版个人首页', 'chaoxing.com/space/index'],
        ['新版个人首页', 'chaoxing.com/base'],
        ['学习页面', 'chaoxing.com/mycourse'],
        ['新版学习页面', 'chaoxing.com/mooc2-ans/mycourse']
      ],
      namespace: 'cx.guide',
      oncomplete() {}
    },
    study: {
      name: '🖥️ 课程学习',
      namespace: 'cx.new.study',
      matches: [
        ['任务点页面', '/knowledge/cards'],
        ['阅读任务点', '/readsvr/book/mooc']
      ],
      onactive() {}
    },
    work: {
      name: '✍️ 作业考试脚本',
      matches: [
        ['作业页面', '/mooc2/work/dowork'],
        ['考试整卷预览页面', '/mooc2/exam/preview']
      ],
      namespace: 'cx.new.work',
      oncomplete() {}
    },
    autoRead: {
      name: '🖥️ 自动阅读',
      matches: [
        ['阅读页面', '/ztnodedetailcontroller/visitnodedetail'],
        ['课程目录', /chaoxing.com\/course\/\d+\.html/],
        ['课程目录', /chaoxing.com\/mooc-ans\/course\/\d+\.html/],
        ['积分课阅读课程目录', '/mooc-ans/zt/portal']
      ],
      namespace: 'cx.new.auto-read',
      oncomplete() {}
    },
    pageRedirect: {
      name: '章节页面自动切换脚本',
      matches: [['课程任务页面', 'pageHeader=0']],
      hideInPanel: true,
      oncomplete() {}
    },
    versionRedirect: {
      name: '版本切换脚本',
      matches: [
        ['', 'mooc2=0'],
        ['', 'mycourse/studentcourse'],
        ['', 'work/getAllWork'],
        ['', 'work/doHomeWorkNew'],
        ['', 'exam/test?'],
        ['', 'mooc-ans/mycourse/studentstudy']
      ],
      hideInPanel: true,
      oncomplete() {}
    },
    examRedirect: {
      name: '考试整卷预览脚本',
      matches: [
        ['新版考试页面', 'exam-ans/exam/test/reVersionTestStartNew'],
        ['新版考试页面2', 'mooc-ans/exam/test/reVersionTestStartNew']
      ],
      hideInPanel: true,
      oncomplete() {}
    },
    rateHack: {
      name: '屏蔽倍速限制',
      matches: [['', '/ananas/modules/video/']],
      hideInPanel: true,
      onstart() {}
    },
    copyHack: {
      name: '屏蔽复制粘贴限制',
      matches: [['所有页面', /.*/]],
      hideInPanel: true,
      oncomplete() {}
    },
    studyDispatcher: {
      name: '课程学习调度器',
      matches: [['课程学习页面', '/mycourse/studentstudy']],
      namespace: 'cx.new.study-dispatcher',
      hideInPanel: true,
      oncomplete() {}
    },
    cxSecretFontRecognize: {
      name: '繁体字识别',
      matches: [
        ['题目页面', 'work/doHomeWorkNew'],
        ['考试整卷预览', '/mooc2/exam/preview'],
        ['作业', '/mooc2/work/dowork']
      ],
      hideInPanel: true,
      oncomplete() {}
    },
    jfkGuide: {
      name: '💡 积分课使用提示',
      matches: [['积分课页面', '/plaza']],
      namespace: 'cx.jfk.guide',
      oncomplete() {}
    }
  }
});
```

- [ ] **Step 3: Register `CXProject` in `src/projects/index.ts`**

Replace `src/projects/index.ts` with:

```ts
import type { ProjectDefinition } from '../runtime/project.js';
import { BackgroundProject } from './background.js';
import { CommonProject } from './common.js';
import { CXProject } from './cx.js';

export { BackgroundProject } from './background.js';
export { CommonProject } from './common.js';
export { CXProject } from './cx.js';

export function definedProjects(): ProjectDefinition[] {
  return [CXProject, CommonProject, BackgroundProject];
}
```

- [ ] **Step 4: Run typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit the Chaoxing project skeleton**

```bash
git add src/projects/cx.ts src/projects/index.ts
git commit -m "feat: add cx project script registry"
```

### Task 8: Port `CXAnalyses`, environment prep, and redirect logic into `cx.ts`

**Files:**
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\cx.ts`
- Test: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\cx.ts`

- [ ] **Step 1: Copy the `env`, `guide`, `pageRedirect`, `versionRedirect`, `examRedirect`, and `CXAnalyses` code blocks from OCSJS `cx.ts`**

Source: `C:\Users\Zelly\Documents\GitHub\ocsjs\packages\scripts\src\projects\cx.ts`

Copy these concrete sections:

```text
- top window resolution logic near the original env script
- guide oncomplete logic
- pageRedirect oncomplete logic
- versionRedirect oncomplete logic
- examRedirect oncomplete logic
- CXAnalyses object
```

- [ ] **Step 2: Replace OCSJS-only calls with local equivalents**

Apply the following replacements while porting:

```ts
// before
$message.info('...')

// after
$console.info('...')
```

```ts
// before
CommonProject.scripts.render.methods.pin(this)

// after
// temporarily no-op until render panel is upgraded
```

```ts
// before
$gm.unsafeWindow.getTeacherAjax(...)

// after
(window as typeof window & { getTeacherAjax?: (...args: string[]) => void }).getTeacherAjax?.(...args)
```

- [ ] **Step 3: Add the top-level mutable `topWindowRef` and exported `CXAnalyses` to `cx.ts`**

Use this local scaffold near the top of the file:

```ts
let topWindowRef: Window = globalThis.top;

export const CXAnalyses = {
  isInSpecialMode() {
    return Array.from(topWindowRef?.document.querySelectorAll('.catalog_points_sa,.catalog_points_er') || []).length !== 0;
  },
  isInFinalTab() {
    const tabs = Array.from<HTMLElement>(topWindowRef?.document.querySelectorAll('.prev_ul li') || []);
    if (tabs.length === 0) return true;
    return tabs[tabs.length - 1].classList.contains('active');
  },
  isInFinalChapter() {
    return Array.from(topWindowRef?.document.querySelectorAll('.posCatalog_select') || [])
      .pop()
      ?.classList.contains('posCatalog_active');
  },
  getChapterInfos() {
    return Array.from(topWindowRef?.document.querySelectorAll('[onclick^="getTeacherAjax"]') || []).map((el) => ({
      element: el as HTMLElement,
      chapterId: el.getAttribute('onclick')?.match(/\('(.*)','(.*)','(.*)'\)/)?.[3],
      unFinishCount: parseInt((el.parentElement?.querySelector('.jobUnfinishCount') as HTMLInputElement | null)?.value || '0')
    }));
  },
  scrollToActiveChapter() {
    const activeChapter = topWindowRef?.document.querySelector<HTMLElement>('.posCatalog_active');
    activeChapter?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
};
```

- [ ] **Step 4: Run typecheck to catch unresolved redirect/helper dependencies**

Run: `npm run typecheck`
Expected: FAIL with any unresolved helper usage introduced by the port.

- [ ] **Step 5: Fix the unresolved imports and re-run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit the navigation and analysis port**

```bash
git add src/projects/cx.ts
git commit -m "feat: port cx environment and redirect flow"
```

### Task 9: Port study task search and execution flow

**Files:**
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\cx.ts`
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\utils\study.ts`
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\utils\work.ts`
- Test: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\cx.ts`

- [ ] **Step 1: Copy the `study()`, `searchIFrame()`, `searchJob()`, and `JobRunner.media/read/timereader/readPPTWithAudio/hyperlink` sections from OCSJS `cx.ts`**

Source: `C:\Users\Zelly\Documents\GitHub\ocsjs\packages\scripts\src\projects\cx.ts`

Port the exact functions into the local `cx.ts`, then rewrite imports/usages to local modules.

- [ ] **Step 2: Add the local `Attachment`, `Job`, and `VideoQuizStrategy` types to `cx.ts`**

Use these definitions:

```ts
type VideoQuizStrategy = 'random' | 'ignore';

type Attachment = {
  isPassed: boolean | undefined;
  job: boolean | undefined;
  jobid?: string;
  property: {
    mid: string;
    _jobid: string;
    module: 'insertbook' | 'insertdoc' | 'insertflash' | 'work' | 'insertaudio' | 'insertvideo';
    name?: string;
    author?: string;
    bookname?: string;
    publisher?: string;
    title?: string;
  };
};

type Job = {
  mid: string;
  attachment: Attachment;
  func: (() => Promise<void>) | undefined;
};
```

- [ ] **Step 3: Replace OCSJS helper calls with local helpers while porting**

Concrete replacements:

```ts
// before
await $.sleep(1000)

// after
await sleep(1000)
```

```ts
// before
domSearch(...)

// after
import and use domSearch from local src/core/utils/dom.ts
```

```ts
// before
playMedia(() => media.play())

// after
import { playMedia } from '../utils/index.js'
```

- [ ] **Step 4: Extend `src/utils/index.ts` with `playMedia`**

Append:

```ts
export async function playMedia(playFunction: () => Promise<void> | undefined | void): Promise<boolean> {
  try {
    const result = playFunction();
    if (result) {
      await result;
    }
    return true;
  } catch (err) {
    console.error('[chaoxing-plus] 播放失败', err);
    return false;
  }
}
```

- [ ] **Step 5: Hook `study` and `studyDispatcher` scripts to the migrated functions**

Update the `study` and `studyDispatcher` entries inside `CXProject.scripts` so they call the ported functions:

```ts
study: {
  // ...existing metadata
  async onactive() {
    await study({
      playbackRate: 1,
      volume: 0,
      videoQuizStrategy: 'random',
      mode: 'next',
      restudy: false,
      forceLearn: false,
      backToFirstWhenFinish: false,
      enableMedia: true,
      enablePPT: true,
      enableChapterTest: true,
      enableHyperlink: true,
      notifyWhenHasFaceRecognition: true,
      workOptions: CommonProject.scripts.settings.methods().getWorkOptions()
    });
  }
}
```

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck`
Expected: FAIL initially for any remaining utility gaps from the study port.

- [ ] **Step 7: Fill the missing utility gaps and re-run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Build the bundle**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 9: Commit the study-flow port**

```bash
git add src/projects/cx.ts src/utils/index.ts src/utils/study.ts src/utils/work.ts
git commit -m "feat: port cx study task execution flow"
```

### Task 10: Port work/exam flows and question-resolution pipeline

**Files:**
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\cx.ts`
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\common.ts`
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\utils\work.ts`
- Test: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\cx.ts`

- [ ] **Step 1: Copy `workOrExam()`, `getQuestionType()`, `readerAndFillHandle()`, and `JobRunner.chapter()` from OCSJS `cx.ts`**

Source: `C:\Users\Zelly\Documents\GitHub\ocsjs\packages\scripts\src\projects\cx.ts`

Port the functions into local `cx.ts`, then rewrite imports to the local `src/core` and `src/utils` modules.

- [ ] **Step 2: Add a minimal `commonWork()` helper to `src/utils/work.ts`**

Append this implementation:

```ts
import type { CommonWorkOptions } from '../projects/common.js';

export function commonWork(
  _script: unknown,
  options: {
    workerProvider: (opts: CommonWorkOptions) => unknown;
    enable_control_panel?: boolean;
  }
): void {
  const workOptions: CommonWorkOptions = {
    period: 3,
    thread: 1,
    upload: 'save',
    answererWrappers: [],
    stopSecondWhenFinish: 3,
    redundanceWordsText: '',
    answerSeparators: '#,|,;,；',
    answerMatchMode: 'includes'
  };
  options.workerProvider(workOptions);
}
```

- [ ] **Step 3: Add cache-backed answer lookup support to `src/projects/common.ts`**

Inside the `apps.methods` object, replace the placeholder methods with:

```ts
const cache = new Map<string, unknown>();

searchAnswerInCaches<T>(title: string, provider: () => Promise<T>) {
  if (cache.has(title)) {
    return Promise.resolve(cache.get(title) as T);
  }
  return provider().then((result) => {
    cache.set(title, result);
    return result;
  });
},
addQuestionCacheFromWorkResult(result: unknown) {
  cache.set(`result:${Date.now()}`, result);
}
```

- [ ] **Step 4: Wire the `work` script in `CXProject` to call `commonWork()`**

Replace the `work.oncomplete` body with:

```ts
async oncomplete() {
  const isExam = /\/exam\/preview/.test(location.href);
  commonWork(this, {
    workerProvider: (opts) => workOrExam(isExam ? 'exam' : 'work', { ...opts, preview_mode: true }),
    enable_control_panel: true
  });
}
```

- [ ] **Step 5: Run typecheck to capture the remaining worker/workflow gaps**

Run: `npm run typecheck`
Expected: FAIL until all imported worker/core symbols are wired correctly.

- [ ] **Step 6: Finish the import rewrites and rerun typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Run build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 8: Commit the work/exam port**

```bash
git add src/projects/cx.ts src/projects/common.ts src/utils/work.ts
git commit -m "feat: port cx work and exam workflow"
```

### Task 11: Port font-recognition, copy-unlock, face-recognition, and rate-hack compatibility logic

**Files:**
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\cx.ts`
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\runtime\gm.ts`
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\utils\index.ts`
- Test: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\cx.ts`

- [ ] **Step 1: Copy `mappingRecognize()`, `loadTyprMapping()`, `rateHack()`, `hasFaceRecognition()`, `hasNewFaceRecognition()`, `waitForNewFaceRecognition()`, and `waitForFaceRecognition()` from OCSJS `cx.ts`**

Port the exact logic into local `cx.ts`, then replace imports and helpers with local equivalents.

- [ ] **Step 2: Add a fetch-backed request shim to `src/runtime/gm.ts`**

Append:

```ts
export async function gmRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  return (await response.json()) as T;
}
```

- [ ] **Step 3: Add `enableCopy()` to `src/utils/index.ts`**

Append:

```ts
export function enableCopy(elements: Array<HTMLElement | Document>) {
  for (const target of elements) {
    const originalSelect = target.onselectstart;
    const originalCopy = target.oncopy;
    const originalPaste = target.onpaste;
    const originalKeydown = target.onkeydown;

    target.onselectstart = (event: Event) => {
      originalSelect?.call(target, event as never);
      event.stopPropagation();
      return true;
    };
    target.oncopy = (event: ClipboardEvent) => {
      originalCopy?.call(target, event as never);
      event.stopPropagation();
      return true;
    };
    target.onpaste = (event: ClipboardEvent) => {
      originalPaste?.call(target, event as never);
      event.stopPropagation();
      return true;
    };
    target.onkeydown = (event: KeyboardEvent) => {
      originalKeydown?.call(target, event as never);
      event.stopPropagation();
      return true;
    };
  }
}
```

- [ ] **Step 4: Attach the migrated compatibility functions to the `rateHack`, `copyHack`, and `cxSecretFontRecognize` scripts**

Update the corresponding script entries in `cx.ts` so they call the ported functions directly.

- [ ] **Step 5: Run typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit the compatibility port**

```bash
git add src/projects/cx.ts src/runtime/gm.ts src/utils/index.ts
git commit -m "feat: port cx compatibility and anti-restriction hooks"
```

### Task 12: Remove the obsolete MV3 extension code and switch the README

**Files:**
- Delete: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\background\index.ts`
- Delete: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\content\index.ts`
- Delete: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\content\cx\video.ts`
- Delete: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\content\cx\study.ts`
- Delete: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\content\cx\work.ts`
- Delete: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\content\panel\panel.ts`
- Delete: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\content\utils\dom.ts`
- Delete: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\content\utils\logger.ts`
- Delete: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\popup\index.html`
- Delete: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\popup\popup.css`
- Delete: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\popup\popup.ts`
- Delete: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\shared\constants.ts`
- Delete: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\shared\swal.ts`
- Delete: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\shared\types.ts`
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\README.md`
- Test: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\README.md`

- [ ] **Step 1: Delete the obsolete MV3-specific source tree**

Delete these paths:

```text
src/background/index.ts
src/content/
src/popup/
src/shared/
```

- [ ] **Step 2: Replace the README header and usage model**

Rewrite `README.md` to start with:

```md
# Chaoxing Plus — 单平台版 OCSJS 风格超星脚本

本项目已从 Manifest V3 浏览器扩展重构为仅保留超星平台功能的脚本型工程，内部结构尽量贴近 `ocsjs` 的 `cx.ts` 及其依赖链。

## 当前定位

- 仅保留超星学习通功能
- 以 `CXProject` 为核心组织学习、答题、跳章和兼容逻辑
- 不再以 popup / background / content script 三段式扩展结构为主
```

Then add a short development section:

```md
## 开发

```bash
npm install
npm run typecheck
npm run build
```

构建产物输出到 `dist/chaoxing-plus.js`。
```

- [ ] **Step 3: Run typecheck and build after deleting the old source tree**

Run: `npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit the codebase cleanup**

```bash
git add README.md src build.mjs package.json tsconfig.json
git add -u
git commit -m "refactor: remove obsolete mv3 extension structure"
```

### Task 13: Final verification against the approved spec

**Files:**
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\docs\superpowers\specs\2026-05-02-chaoxing-plus-ocsjs-cx-only-design.md` (only if you discover a necessary clarifying note)
- Test: repository-wide

- [ ] **Step 1: Run the full verification commands**

Run:

```bash
npm run typecheck
npm run build
```

Expected:

```text
Both commands pass with no TypeScript errors and a generated dist/chaoxing-plus.js bundle.
```

- [ ] **Step 2: Manually verify the required architecture markers in the source tree**

Check that these files exist:

```text
src/index.ts
src/projects/cx.ts
src/projects/common.ts
src/projects/background.ts
src/runtime/project.ts
src/runtime/script.ts
src/core/worker/worker.ts
src/elements/search.infos.ts
```

Expected: all present.

- [ ] **Step 3: Manually verify the old extension entrypoints are gone**

Check that these paths do not exist:

```text
src/popup
src/content/index.ts
src/background/index.ts
src/shared/constants.ts
```

Expected: all absent.

- [ ] **Step 4: Compare the resulting `src/projects/cx.ts` to the approved spec scope**

Use this checklist:

```text
- env script present
- study script present
- studyDispatcher present
- work script present
- redirect scripts present
- rateHack / copyHack / font-recognition present
- CXAnalyses present
- study()/searchJob()/JobRunner present
- workOrExam()/chapter workflow present
```

Expected: all checked.

- [ ] **Step 5: Commit the final verified state**

```bash
git add -u
git add src docs/superpowers/specs README.md dist
git commit -m "feat: finish cx-only ocsjs-style refactor"
```

---

## Self-Review

### Spec coverage

- **单平台脚本型架构** — covered by Tasks 1, 2, 12, and 13.
- **`CXProject` 为核心** — covered by Tasks 7, 8, 9, 10, and 11.
- **保留超星完整主链路** — covered by Tasks 8 through 11.
- **补齐最小运行时** — covered by Tasks 2, 3, 5, and 6.
- **删除 MV3 外壳和无关结构** — covered by Task 12.
- **类型检查 / 构建验收** — covered by Tasks 1, 2, 5, 7, 9, 10, 11, 12, and 13.

No spec gap remains unassigned to a task.

### Placeholder scan

- Removed vague “implement later” wording.
- Each task names exact files.
- Each verification step has exact commands.
- Each code-writing step includes concrete code to add or concrete source blocks to port.

### Type consistency

- `ProjectDefinition` / `ScriptDefinition` introduced in Task 2 are the same types referenced in Tasks 6 and 7.
- `CommonWorkOptions` introduced in Task 6 is reused in Task 10.
- `CXProject` is introduced in Task 7 and extended in Tasks 8–11.
- The final entrypoint remains `src/index.ts` throughout the plan.
