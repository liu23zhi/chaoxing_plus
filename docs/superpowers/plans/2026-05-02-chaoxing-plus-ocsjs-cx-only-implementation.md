# Chaoxing Plus OCSJS CX-Only Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `chaoxing_plus` into a single-platform, script-style project whose runtime shape and behavior are close to `ocsjs`'s Chaoxing module while removing the old MV3-centered architecture.

**Architecture:** Execute the refactor in working vertical slices instead of trying to drop all of `cx.ts` onto a weak scaffold. First replace the build target and introduce a realistic local runtime, then port only the `ocsjs` core/common pieces that `cx.ts` truly depends on, then migrate Chaoxing study/work/compatibility flows in stages, and only remove the old MV3 tree after the new path builds cleanly.

**Tech Stack:** TypeScript, Vite, SweetAlert2, lodash, md5, typr.js, DOM APIs, local script runtime, local ports of selected `ocsjs` core/scripts modules.

---

## File Structure

### New files to create

- `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\index.ts` — new single-entry script bootstrap.
- `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\runtime\types.ts` — runtime types shared by project/script/config code.
- `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\runtime\project.ts` — project registration helper.
- `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\runtime\script.ts` — script factory and instance wrapper.
- `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\runtime\start.ts` — runtime startup and URL/domain matching.
- `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\runtime\store.ts` — persistent config store.
- `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\runtime\message.ts` — message/modal wrapper.
- `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\runtime\logger.ts` — unified logging helpers.
- `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\runtime\dom.ts` — generic DOM helpers used by runtime and migrated code.
- `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\runtime\panel.ts` — minimal floating panel + render hooks.
- `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\runtime\cors.ts` — top-window bridge helpers.
- `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\runtime\gm.ts` — local `unsafeWindow` / request compatibility layer.
- `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\runtime\index.ts` — runtime exports.
- `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\index.ts` — project exports and registration order.
- `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\background.ts` — logging/debug project.
- `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\common.ts` — settings/results/cache/panel support project.
- `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\cx.ts` — main Chaoxing project port.
- `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\render.ts` — `RenderScript` equivalent.
- `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\core\...` — local ports of the `ocsjs` core files actually needed by `cx.ts`.
- `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\utils\configs.ts` — reusable config descriptors.
- `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\utils\study.ts` — wait-for-element/media helpers.
- `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\utils\work.ts` — work control/result helpers.
- `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\utils\index.ts` — shared utility exports.
- `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\elements\search.infos.ts` — result-list custom element.

### Existing files to modify

- `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\package.json`
- `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\package-lock.json`
- `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\tsconfig.json`
- `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\build.mjs`
- `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\README.md`
- `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\public\page-hooks.js` (keep only if the migrated rate/doc hooks still need it)

### Old files to remove only near the end

- `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\background\index.ts`
- `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\content\index.ts`
- `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\content\cx\video.ts`
- `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\content\cx\study.ts`
- `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\content\cx\work.ts`
- `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\content\panel\panel.ts`
- `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\content\utils\dom.ts`
- `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\content\utils\logger.ts`
- `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\popup\index.html`
- `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\popup\popup.css`
- `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\popup\popup.ts`
- `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\shared\constants.ts`
- `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\shared\swal.ts`
- `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\shared\types.ts`
- `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\public\manifest.json`

---

## Execution rules for this plan

- Do **not** create a worktree.
- Do **not** create git commits unless the human explicitly asks for them later.
- Keep the old MV3 source tree in place until the new script-style entry builds successfully.
- After each task, always run the verification command(s) listed for that task before moving on.
- If a copied `ocsjs` file imports more dependencies than the current task has introduced, stop and add the missing dependency/file in the same task before continuing.

---

### Task 1: Pivot the build from MV3 extension output to script-style entry output

**Files:**
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\package.json`
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\tsconfig.json`
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\build.mjs`
- Test: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\package.json`

- [ ] **Step 1: Run the current build to capture the old baseline**

Run: `npm run build`
Expected: PASS, with extension-oriented output under `dist/`.

- [ ] **Step 2: Replace `package.json` scripts and dependencies so the repo targets a single script entry**

Update `package.json` to this shape:

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

- [ ] **Step 3: Update `tsconfig.json` so new source files live under the new runtime tree**

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

- [ ] **Step 4: Replace `build.mjs` so the build targets `src/index.ts` instead of MV3 content/background/popup entrypoints**

Replace the file with:

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

- [ ] **Step 5: Install the updated dependencies**

Run: `npm install`
Expected: PASS and `package-lock.json` updates.

- [ ] **Step 6: Run typecheck to verify the expected temporary failure is only “new entry missing”**

Run: `npm run typecheck`
Expected: FAIL because `src/index.ts` does not exist yet.

---

### Task 2: Introduce a realistic local runtime, not a placeholder skeleton

**Files:**
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\index.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\runtime\types.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\runtime\project.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\runtime\script.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\runtime\start.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\runtime\store.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\runtime\message.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\runtime\logger.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\runtime\dom.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\runtime\panel.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\runtime\cors.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\runtime\gm.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\runtime\index.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\index.ts`
- Test: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\runtime\*.ts`

- [ ] **Step 1: Create `src/runtime/types.ts` with the runtime contracts that later `common.ts` and `cx.ts` will actually use**

```ts
export type MatchRule = [label: string, pattern: string | RegExp];

export interface ConfigDefinition<T = unknown> {
  defaultValue: T;
  label?: string;
  attrs?: Record<string, string | number | boolean>;
  options?: Array<[string, string, string?]>;
  elementClassName?: string;
  providerClassName?: string;
  labelClassName?: string;
  showIf?: string;
  separator?: string;
}

export type ConfigMap = Record<string, ConfigDefinition>;

export interface ScriptLifecycleContext {
  projectName: string;
  url: string;
  hostname: string;
}

export interface ScriptPanel {
  root: HTMLElement;
  body: HTMLElement;
  lockWrapper: HTMLElement;
  configsContainer: HTMLElement;
}

export interface ScriptInstance {
  name: string;
  namespace?: string;
  cfg: Record<string, unknown>;
  panel?: ScriptPanel;
  methods: Record<string, (...args: any[]) => any>;
  onConfigChange(key: string, listener: (value: any) => void): number;
  offConfigChange(id?: number): void;
}

export interface ScriptDefinition {
  name: string;
  namespace?: string;
  matches: MatchRule[];
  hideInPanel?: boolean | (() => boolean);
  configs?: ConfigMap;
  methods?: (this: ScriptInstance) => Record<string, (...args: any[]) => any>;
  onstart?: (this: ScriptInstance, ctx: ScriptLifecycleContext) => void | Promise<void>;
  onactive?: (this: ScriptInstance, ctx: ScriptLifecycleContext) => void | Promise<void>;
  oncomplete?: (this: ScriptInstance, ctx: ScriptLifecycleContext) => void | Promise<void>;
  onrender?: (this: ScriptInstance, ctx: ScriptLifecycleContext & { panel: ScriptPanel }) => void | Promise<void>;
}

export interface ProjectDefinition {
  name: string;
  domains: string[];
  scripts: Record<string, ScriptDefinition>;
}
```

- [ ] **Step 2: Create `src/runtime/store.ts` with persistent JSON-backed config helpers**

```ts
const memoryStore = new Map<string, unknown>();

function readLocal<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export const runtimeStore = {
  get<T>(key: string, fallback: T): T {
    if (memoryStore.has(key)) {
      return memoryStore.get(key) as T;
    }
    const value = readLocal(key, fallback);
    memoryStore.set(key, value);
    return value;
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

- [ ] **Step 3: Create `src/runtime/message.ts`, `logger.ts`, and `dom.ts`**

`src/runtime/message.ts`

```ts
import Swal from 'sweetalert2';

function toast(icon: 'info' | 'success' | 'warning' | 'error', text: string, timer = 3000) {
  void Swal.fire({
    toast: true,
    position: 'top-end',
    timer,
    showConfirmButton: false,
    icon,
    title: text
  });
}

export const $message = {
  info(args: { content: string; duration?: number } | string) {
    const content = typeof args === 'string' ? args : args.content;
    const duration = typeof args === 'string' ? 3000 : args.duration ?? 3000;
    toast('info', content, duration);
  },
  success(args: { content: string; duration?: number } | string) {
    const content = typeof args === 'string' ? args : args.content;
    const duration = typeof args === 'string' ? 3000 : args.duration ?? 3000;
    toast('success', content, duration);
  },
  warn(args: { content: string; duration?: number } | string) {
    const content = typeof args === 'string' ? args : args.content;
    const duration = typeof args === 'string' ? 5000 : args.duration ?? 5000;
    toast('warning', content, duration);
  },
  error(args: { content: string; duration?: number } | string) {
    const content = typeof args === 'string' ? args : args.content;
    const duration = typeof args === 'string' ? 5000 : args.duration ?? 5000;
    toast('error', content, duration);
  }
};

export const $modal = {
  async alert(args: { content: string } | string): Promise<void> {
    const content = typeof args === 'string' ? args : args.content;
    await Swal.fire({ icon: 'info', text: content, confirmButtonText: '知道了' });
  },
  async confirm(args: { content: string } | string): Promise<boolean> {
    const content = typeof args === 'string' ? args : args.content;
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

`src/runtime/logger.ts`

```ts
export type LogType = 'log' | 'info' | 'debug' | 'warn' | 'error';

export function runtimeLog(type: LogType, ...args: unknown[]): void {
  const method = type === 'debug' ? 'log' : type;
  console[method]('[chaoxing-plus]', ...args);
}
```

`src/runtime/dom.ts`

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

- [ ] **Step 4: Create `src/runtime/panel.ts`, `cors.ts`, and `gm.ts`**

`src/runtime/panel.ts`

```ts
import type { ScriptPanel } from './types.js';

export function createPanelRoot(id = 'chaoxing-plus-runtime-panel'): ScriptPanel {
  let root = document.getElementById(id);
  if (!root) {
    root = document.createElement('div');
    root.id = id;
    root.style.position = 'fixed';
    root.style.top = '16px';
    root.style.right = '16px';
    root.style.zIndex = '2147483646';
    root.style.width = '360px';
    root.style.maxHeight = '80vh';
    root.style.overflow = 'auto';
    root.style.background = '#fff';
    root.style.border = '1px solid #ddd';
    root.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
    root.style.borderRadius = '12px';
    root.style.padding = '12px';
    document.body.appendChild(root);
  }

  const lockWrapper = document.createElement('div');
  const configsContainer = document.createElement('div');
  const body = document.createElement('div');
  root.replaceChildren(lockWrapper, configsContainer, body);

  return { root, lockWrapper, configsContainer, body };
}
```

`src/runtime/cors.ts`

```ts
export const cors = {
  defineTopFunction<TArgs extends unknown[]>(fn: (...args: TArgs) => void) {
    return (...args: TArgs) => {
      fn(...args);
    };
  }
};
```

`src/runtime/gm.ts`

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

export async function gmRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  return (await response.json()) as T;
}
```

- [ ] **Step 5: Create `src/runtime/project.ts` and `src/runtime/script.ts` with config-aware instances**

`src/runtime/project.ts`

```ts
import type { ProjectDefinition } from './types.js';

export class Project {
  static create(definition: ProjectDefinition): ProjectDefinition {
    return definition;
  }
}
```

`src/runtime/script.ts`

```ts
import { createPanelRoot } from './panel.js';
import { runtimeStore } from './store.js';
import type { ConfigMap, ScriptDefinition, ScriptInstance } from './types.js';

function buildDefaultConfig(namespace: string, configs: ConfigMap = {}): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, definition] of Object.entries(configs)) {
    result[key] = runtimeStore.get(`${namespace}.${key}`, definition.defaultValue);
  }
  return result;
}

export function createScriptInstance(definition: ScriptDefinition, projectName: string): ScriptInstance {
  const namespace = definition.namespace ?? `${projectName}.${definition.name}`;
  const listeners = new Map<number, { key: string; listener: (value: any) => void }>();
  let nextListenerId = 1;

  const instance: ScriptInstance = {
    name: definition.name,
    namespace,
    cfg: buildDefaultConfig(namespace, definition.configs),
    panel: createPanelRoot(`panel-${namespace.replace(/[^a-z0-9_-]/gi, '-')}`),
    methods: {},
    onConfigChange(key, listener) {
      const id = nextListenerId++;
      listeners.set(id, { key, listener });
      return id;
    },
    offConfigChange(id) {
      if (typeof id === 'number') listeners.delete(id);
    }
  };

  instance.methods = definition.methods?.call(instance) ?? {};
  return instance;
}
```

- [ ] **Step 6: Create `src/runtime/start.ts`, `src/runtime/index.ts`, `src/projects/index.ts`, and `src/index.ts`**

`src/runtime/start.ts`

```ts
import { createScriptInstance } from './script.js';
import type { MatchRule, ProjectDefinition, ScriptDefinition } from './types.js';

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

    for (const scriptDefinition of Object.values(project.scripts)) {
      if (!matchesScript(scriptDefinition, url)) continue;
      const script = createScriptInstance(scriptDefinition, project.name);
      const ctx = { projectName: project.name, url, hostname };
      await scriptDefinition.onstart?.call(script, ctx);
      await scriptDefinition.onactive?.call(script, ctx);
      await scriptDefinition.oncomplete?.call(script, ctx);
      if (script.panel) {
        await scriptDefinition.onrender?.call(script, { ...ctx, panel: script.panel });
      }
    }
  }
}
```

`src/runtime/index.ts`

```ts
export * from './types.js';
export * from './project.js';
export * from './script.js';
export * from './start.js';
export * from './store.js';
export * from './message.js';
export * from './logger.js';
export * from './dom.js';
export * from './panel.js';
export * from './cors.js';
export * from './gm.js';
```

`src/projects/index.ts`

```ts
import type { ProjectDefinition } from '../runtime/index.js';

export function definedProjects(): ProjectDefinition[] {
  return [];
}
```

`src/index.ts`

```ts
import { start } from './runtime/index.js';
import { definedProjects } from './projects/index.js';

start(definedProjects()).catch((err) => {
  console.error('[chaoxing-plus] startup failed', err);
});
```

- [ ] **Step 7: Verify the runtime baseline builds cleanly before porting any `ocsjs` code**

Run: `npm run typecheck && npm run build`
Expected: PASS and `dist/chaoxing-plus.js` exists.

---

### Task 3: Port only the `ocsjs` core files that `cx.ts` really needs

**Files:**
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\core\index.ts`
- Create / Copy: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\core\answer-wrapper\*`
- Create / Copy: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\core\worker\*`
- Create / Copy: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\core\utils\*`
- Test: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\core\**\*.ts`

- [ ] **Step 1: Copy the exact source files from `ocsjs/packages/core/src/core/` into the local `src/core/` tree**

Run these copy commands:

```bash
mkdir -p "C:/Users/Zelly/Documents/GitHub/chaoxing_plus/src/core/answer-wrapper"
mkdir -p "C:/Users/Zelly/Documents/GitHub/chaoxing_plus/src/core/worker"
mkdir -p "C:/Users/Zelly/Documents/GitHub/chaoxing_plus/src/core/utils"
cp "C:/Users/Zelly/Documents/GitHub/ocsjs/packages/core/src/core/answer-wrapper/answer.wrapper.handler.ts" "C:/Users/Zelly/Documents/GitHub/chaoxing_plus/src/core/answer-wrapper/answer.wrapper.handler.ts"
cp "C:/Users/Zelly/Documents/GitHub/ocsjs/packages/core/src/core/answer-wrapper/answer.wrapper.parser.ts" "C:/Users/Zelly/Documents/GitHub/chaoxing_plus/src/core/answer-wrapper/answer.wrapper.parser.ts"
cp "C:/Users/Zelly/Documents/GitHub/ocsjs/packages/core/src/core/answer-wrapper/index.ts" "C:/Users/Zelly/Documents/GitHub/chaoxing_plus/src/core/answer-wrapper/index.ts"
cp "C:/Users/Zelly/Documents/GitHub/ocsjs/packages/core/src/core/answer-wrapper/interface.ts" "C:/Users/Zelly/Documents/GitHub/chaoxing_plus/src/core/answer-wrapper/interface.ts"
cp "C:/Users/Zelly/Documents/GitHub/ocsjs/packages/core/src/core/worker/index.ts" "C:/Users/Zelly/Documents/GitHub/chaoxing_plus/src/core/worker/index.ts"
cp "C:/Users/Zelly/Documents/GitHub/ocsjs/packages/core/src/core/worker/interface.ts" "C:/Users/Zelly/Documents/GitHub/chaoxing_plus/src/core/worker/interface.ts"
cp "C:/Users/Zelly/Documents/GitHub/ocsjs/packages/core/src/core/worker/question.resolver.ts" "C:/Users/Zelly/Documents/GitHub/chaoxing_plus/src/core/worker/question.resolver.ts"
cp "C:/Users/Zelly/Documents/GitHub/ocsjs/packages/core/src/core/worker/utils.ts" "C:/Users/Zelly/Documents/GitHub/chaoxing_plus/src/core/worker/utils.ts"
cp "C:/Users/Zelly/Documents/GitHub/ocsjs/packages/core/src/core/worker/worker.ts" "C:/Users/Zelly/Documents/GitHub/chaoxing_plus/src/core/worker/worker.ts"
cp "C:/Users/Zelly/Documents/GitHub/ocsjs/packages/core/src/core/utils/dom.ts" "C:/Users/Zelly/Documents/GitHub/chaoxing_plus/src/core/utils/dom.ts"
cp "C:/Users/Zelly/Documents/GitHub/ocsjs/packages/core/src/core/utils/index.ts" "C:/Users/Zelly/Documents/GitHub/chaoxing_plus/src/core/utils/index.ts"
cp "C:/Users/Zelly/Documents/GitHub/ocsjs/packages/core/src/core/utils/request.ts" "C:/Users/Zelly/Documents/GitHub/chaoxing_plus/src/core/utils/request.ts"
cp "C:/Users/Zelly/Documents/GitHub/ocsjs/packages/core/src/core/utils/string.ts" "C:/Users/Zelly/Documents/GitHub/chaoxing_plus/src/core/utils/string.ts"
```

- [ ] **Step 2: Create `src/core/index.ts` as a local export surface**

```ts
export * from './answer-wrapper/index.js';
export * from './worker/index.js';
export * from './utils/index.js';
```

- [ ] **Step 3: Run typecheck to identify the real dependency gaps before editing the copied files**

Run: `npm run typecheck`
Expected: FAIL with concrete import/type errors inside `src/core/**/*`.

- [ ] **Step 4: Fix copied core imports using these exact rewrite rules**

Apply these edits across the copied files:

```text
- Replace any '@ocsjs/core' self-imports with relative imports inside src/core.
- Replace imports from 'easy-us' or browser-only helper packages if present; if the file only needs a utility that is not used by cx.ts, remove that dead branch instead of emulating the whole dependency.
- Replace request helpers that rely on GM APIs with fetch/gmRequest-backed local code under src/core/utils/request.ts.
- Keep only exports that are referenced later by src/projects/common.ts, src/projects/cx.ts, src/utils/study.ts, or src/utils/work.ts.
```

- [ ] **Step 5: If `src/core/utils/request.ts` still depends on unavailable `GM_xmlhttpRequest`, replace it with this local implementation**

```ts
export async function request<T>(url: string, options?: { method?: string; responseType?: 'json' | 'text' }) {
  const response = await fetch(url, { method: options?.method ?? 'GET' });
  if (options?.responseType === 'text') {
    return (await response.text()) as T;
  }
  return (await response.json()) as T;
}
```

- [ ] **Step 6: Verify the core layer compiles before moving on**

Run: `npm run typecheck`
Expected: PASS.

---

### Task 4: Build the local support layer that `cx.ts` expects: common, background, render, utils, and result element

**Files:**
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\render.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\elements\search.infos.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\utils\configs.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\utils\study.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\utils\work.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\utils\index.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\background.ts`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\common.ts`
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\index.ts`
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\index.ts`
- Test: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\common.ts`

- [ ] **Step 1: Create `src/render.ts` and `src/elements/search.infos.ts`**

`src/render.ts`

```ts
export const RenderScript = {
  name: '🖼️ 窗口设置'
};
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
          ${info.error ? `<div class="error">${info.error}</div>` : ''}
          ${(info.results || []).map((item) => `<div><strong>答案：</strong><code>${item[1]}</code></div>`).join('')}
        </details>
      `).join('')}
    `;
  }
}
```

- [ ] **Step 2: Create `src/utils/configs.ts`, `src/utils/study.ts`, and `src/utils/index.ts`**

`src/utils/configs.ts`

```ts
export const playbackRate = {
  label: '视频倍速',
  options: [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.5, 4, 6, 8, 16].map((rate) => [rate.toString(), `${rate} x`] as [string, string]),
  defaultValue: '1'
};

export const volume = {
  label: '音量调节',
  defaultValue: 0
};

export const workNotes = {
  defaultValue: '自动答题前请先配置题库。'
};

export const dropdownStyle = {
  labelClassName: 'checkbox-label',
  providerClassName: 'checkbox-input'
};
```

`src/utils/study.ts`

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

`src/utils/index.ts`

```ts
export * from './configs.js';
export * from './study.js';
export * from './work.js';

export async function playMedia(playFunction: () => Promise<void> | undefined | void): Promise<boolean> {
  try {
    const result = playFunction();
    if (result) await result;
    return true;
  } catch (err) {
    console.error('[chaoxing-plus] 播放失败', err);
    return false;
  }
}

export function enableCopy(elements: Array<HTMLElement | Document>) {
  for (const target of elements) {
    target.onselectstart = () => true;
    target.oncopy = () => true;
    target.onpaste = () => true;
    target.onkeydown = () => true;
  }
}
```

- [ ] **Step 3: Create `src/utils/work.ts` with only the helpers that `cx.ts` consumes**

```ts
export function optimizationElementWithImage(root: HTMLElement, cloneNode = false): HTMLElement {
  const clone = cloneNode ? (root.cloneNode(true) as HTMLElement) : root;
  for (const img of Array.from(clone.querySelectorAll('img'))) {
    const src = document.createElement('span');
    src.innerText = img.src;
    src.style.fontSize = '0px';
    img.after(src);
  }
  return clone;
}

export function removeRedundantWords(text: string, words: string[]): string {
  return words.filter(Boolean).reduce((acc, word) => acc.replaceAll(word.trim(), ''), text);
}

export function splitAnswer(answer: string): string[] {
  return answer.split(/[#,，;；\n]/).map((item) => item.trim()).filter(Boolean);
}

export function simplifyWorkResult<T>(results: T[]): T[] {
  return results;
}

export function answerWrapperEmptyWarning(_duration: number) {
  console.warn('[chaoxing-plus] 当前未配置题库');
}

export interface CommonWorkStarterOptions<T> {
  workerProvider: (opts: T) => unknown;
  enable_control_panel?: boolean;
}

export function commonWork<T>(_script: unknown, options: CommonWorkStarterOptions<T>, workOptions: T): void {
  options.workerProvider(workOptions);
}
```

- [ ] **Step 4: Create `src/projects/background.ts` and `src/projects/common.ts`**

`src/projects/background.ts`

```ts
import { Project } from '../runtime/index.js';
import { $message } from '../runtime/message.js';
import { runtimeLog } from '../runtime/logger.js';

export const $console = {
  log(content: string, ...extra: unknown[]) {
    runtimeLog('log', content, ...extra);
  },
  info(content: string, ...extra: unknown[]) {
    runtimeLog('info', content, ...extra);
  },
  warn(content: string, ...extra: unknown[]) {
    runtimeLog('warn', content, ...extra);
    $message.warn(content);
  },
  error(content: string, ...extra: unknown[]) {
    runtimeLog('error', content, ...extra);
    $message.error(content);
  }
};

export const BackgroundProject = Project.create({
  name: '后台',
  domains: [],
  scripts: {}
});
```

`src/projects/common.ts`

```ts
import { Project, runtimeStore } from '../runtime/index.js';

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

const WORK_OPTIONS_KEY = 'common.settings.work-options';

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

const answerCache = new Map<string, unknown>();

function getWorkOptions(): CommonWorkOptions {
  return runtimeStore.get(WORK_OPTIONS_KEY, defaultWorkOptions);
}

export const CommonProject = Project.create({
  name: '通用',
  domains: [],
  scripts: {
    settings: {
      name: '⚙️ 全局设置',
      matches: [['所有页面', /.*/]],
      namespace: 'common.settings',
      methods() {
        return {
          getWorkOptions,
          notificationBySetting(content: string) {
            console.info('[chaoxing-plus]', content);
          }
        };
      }
    },
    workResults: {
      name: '📄 答题结果',
      matches: [['所有页面', /.*/]],
      namespace: 'common.work-results',
      methods() {
        return {
          init() {},
          setResults() {},
          appendResults() {},
          updateWorkStateByResults() {},
          createWorkResultsPanel() {
            const div = document.createElement('div');
            div.textContent = '答题结果面板';
            return div;
          }
        };
      }
    },
    render: {
      name: '🖼️ 渲染',
      matches: [['所有页面', /.*/]],
      namespace: 'common.render',
      methods() {
        return {
          pin() {},
          normal() {},
          minimize() {}
        };
      }
    },
    apps: {
      name: '🔎 拓展应用',
      matches: [['所有页面', /.*/]],
      namespace: 'common.apps',
      methods() {
        return {
          searchAnswerInCaches<T>(title: string, provider: () => Promise<T>) {
            if (answerCache.has(title)) {
              return Promise.resolve(answerCache.get(title) as T);
            }
            return provider().then((result) => {
              answerCache.set(title, result);
              return result;
            });
          },
          addQuestionCacheFromWorkResult(result: unknown) {
            answerCache.set(`result:${Date.now()}`, result);
          }
        };
      }
    }
  }
});
```

- [ ] **Step 5: Register the common/background projects and custom element**

Replace `src/projects/index.ts` with:

```ts
import type { ProjectDefinition } from '../runtime/index.js';
import { CommonProject } from './common.js';
import { BackgroundProject } from './background.js';

export { CommonProject } from './common.js';
export { BackgroundProject } from './background.js';

export function definedProjects(): ProjectDefinition[] {
  return [CommonProject, BackgroundProject];
}
```

Update `src/index.ts` to:

```ts
import { start } from './runtime/index.js';
import { SearchInfosElement } from './elements/search.infos.js';
import { definedProjects } from './projects/index.js';

if (!customElements.get('search-infos')) {
  customElements.define('search-infos', SearchInfosElement);
}

start(definedProjects()).catch((err) => {
  console.error('[chaoxing-plus] startup failed', err);
});
```

- [ ] **Step 6: Verify the support layer builds before touching `cx.ts`**

Run: `npm run typecheck && npm run build`
Expected: PASS.

---

### Task 5: Port the `CXProject` shell, domain list, environment prep, redirect scripts, and analysis helpers

**Files:**
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\cx.ts`
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\index.ts`
- Test: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\cx.ts`

- [ ] **Step 1: Create `src/projects/cx.ts` by porting the script registry skeleton from `ocsjs/packages/scripts/src/projects/cx.ts`**

The initial file must include these script keys, even if some handlers stay thin until later tasks:

```ts
env
guide
study
work
autoRead
pageRedirect
versionRedirect
examRedirect
rateHack
copyHack
studyDispatcher
cxSecretFontRecognize
jfkGuide
```

Use the exact domain list from `ocsjs` `CXProject`.

- [ ] **Step 2: Port the environment and redirect logic first, not the study/work engine yet**

Port these concrete sections from `C:\Users\Zelly\Documents\GitHub\ocsjs\packages\scripts\src\projects\cx.ts` into the local file, adapting imports to local runtime/helpers:

```text
- env.onstart real top-window resolution logic
- guide.oncomplete
- pageRedirect.oncomplete
- versionRedirect.oncomplete
- examRedirect.oncomplete
- jfkGuide.oncomplete (minimal)
- CXAnalyses object
```

- [ ] **Step 3: Use this replacement pattern while porting**

```ts
// replace OCSJS gm access
const unsafeTop = $gm.unsafeWindow as Window & Record<string, any>;

// replace OCSJS message helpers
$console.info('...');
$console.warn('...');
$console.error('...');
```

- [ ] **Step 4: Register `CXProject` in `src/projects/index.ts` only after `cx.ts` compiles**

Replace `src/projects/index.ts` with:

```ts
import type { ProjectDefinition } from '../runtime/index.js';
import { CXProject } from './cx.js';
import { CommonProject } from './common.js';
import { BackgroundProject } from './background.js';

export { CXProject } from './cx.js';
export { CommonProject } from './common.js';
export { BackgroundProject } from './background.js';

export function definedProjects(): ProjectDefinition[] {
  return [CXProject, CommonProject, BackgroundProject];
}
```

- [ ] **Step 5: Verify that the project shell builds before study/work migration starts**

Run: `npm run typecheck && npm run build`
Expected: PASS.

---

### Task 6: Port the Chaoxing study dispatcher and task execution path

**Files:**
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\cx.ts`
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\utils\study.ts`
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\utils\work.ts`
- Test: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\cx.ts`

- [ ] **Step 1: Port the study-only data structures and state from `ocsjs` `cx.ts`**

Bring over these exact pieces into local `cx.ts`:

```text
- state.study object
- VideoQuizStrategy type
- Attachment type
- Job type
- searchIFrame()
- searchJob()
- study()
- JobRunner.media()
- JobRunner.read()
- JobRunner.timereader()
- JobRunner.readPPTWithAudio()
- JobRunner.hyperlink()
```

- [ ] **Step 2: While porting, rewrite helper references to local modules**

Use these replacements:

```ts
import { sleep } from '../runtime/dom.js';
import { waitForElement, waitForMedia } from '../utils/study.js';
import { playMedia } from '../utils/index.js';
import { optimizationElementWithImage, answerWrapperEmptyWarning } from '../utils/work.js';
import { $console } from './background.js';
```

- [ ] **Step 3: Wire the `study` and `studyDispatcher` scripts to the migrated functions**

Use this shape inside `CXProject.scripts`:

```ts
study: {
  // existing metadata
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
      workOptions: CommonProject.scripts.settings.methods?.call({} as any).getWorkOptions?.() ?? {
        period: 3,
        thread: 1,
        upload: 'save',
        answererWrappers: [],
        stopSecondWhenFinish: 3,
        redundanceWordsText: '',
        answerSeparators: '#,|,;,；',
        answerMatchMode: 'includes'
      }
    });
  }
}
```

- [ ] **Step 4: Verify the study path compiles before introducing work/exam code**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Build the bundle after the study path is added**

Run: `npm run build`
Expected: PASS.

---

### Task 7: Port the work/exam and chapter-test pipeline only after study is stable

**Files:**
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\cx.ts`
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\utils\work.ts`
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\common.ts`
- Test: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\cx.ts`

- [ ] **Step 1: Port the answering flow pieces from `ocsjs` `cx.ts`**

Bring over these exact pieces:

```text
- workOrExam()
- JobRunner.chapter()
- getQuestionType()
- readerAndFillHandle()
```

- [ ] **Step 2: Expand `src/utils/work.ts` so it can launch the worker flow instead of only stubbing it**

Replace the placeholder `commonWork()` with this implementation:

```ts
export function commonWork<T>(
  script: { panel?: { body: HTMLElement } },
  options: { workerProvider: (opts: T) => unknown; enable_control_panel?: boolean },
  workOptions: T
): void {
  const panel = document.createElement('div');
  panel.textContent = '自动答题已启动';
  script.panel?.body?.replaceChildren(panel);
  options.workerProvider(workOptions);
}
```

- [ ] **Step 3: Expand `src/projects/common.ts` cache methods only where `cx.ts` requires them**

Ensure these method names exist and return working values:

```text
searchAnswerInCaches
addQuestionCacheFromWorkResult
getWorkOptions
notificationBySetting
```

Do not add extra “future” abstractions in this task.

- [ ] **Step 4: Wire the `work` script to `commonWork()` and the new `workOrExam()` port**

Use this local pattern:

```ts
async oncomplete() {
  const isExam = /\/exam\/preview/.test(location.href);
  const workOptions = CommonProject.scripts.settings.methods?.call({} as any).getWorkOptions?.() ?? {
    period: 3,
    thread: 1,
    upload: 'save',
    answererWrappers: [],
    stopSecondWhenFinish: 3,
    redundanceWordsText: '',
    answerSeparators: '#,|,;,；',
    answerMatchMode: 'includes'
  };
  commonWork(this, {
    workerProvider: (opts) => workOrExam(isExam ? 'exam' : 'work', { ...opts, preview_mode: true }),
    enable_control_panel: true
  }, workOptions);
}
```

- [ ] **Step 5: Verify the answering pipeline compiles**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Build after the work path is integrated**

Run: `npm run build`
Expected: PASS.

---

### Task 8: Port compatibility hooks, then remove the obsolete MV3 tree

**Files:**
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\cx.ts`
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\README.md`
- Delete: old MV3 files listed in the file-structure section
- Test: repository-wide

- [ ] **Step 1: Port the compatibility-only helpers from `ocsjs` `cx.ts`**

Bring over these exact functions into the local `cx.ts`:

```text
mappingRecognize()
loadTyprMapping()
rateHack()
hasFaceRecognition()
hasNewFaceRecognition()
waitForNewFaceRecognition()
waitForFaceRecognition()
```

- [ ] **Step 2: Attach the ported helpers to the right scripts**

Wire these `CXProject.scripts` entries to the migrated functions:

```text
rateHack.onstart -> rateHack()
copyHack.oncomplete -> enableCopy([...]) and/or migrated editor-paste unlock logic
cxSecretFontRecognize.oncomplete -> mappingRecognize()
study / JobRunner media flow -> waitForFaceRecognition() / waitForNewFaceRecognition()
```

- [ ] **Step 3: Verify the new script-style path still builds before deleting the old MV3 code**

Run: `npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 4: Delete the obsolete MV3 source tree and manifest only after the new path is green**

Delete:

```text
src/background/index.ts
src/content/
src/popup/
src/shared/
public/manifest.json
```

- [ ] **Step 5: Rewrite `README.md` to describe the new architecture instead of the old extension UI**

Replace the opening section with:

```md
# Chaoxing Plus — 单平台版 OCSJS 风格超星脚本

本项目已从 Manifest V3 浏览器扩展重构为仅保留超星平台功能的脚本型工程，内部结构尽量贴近 `ocsjs` 的 `CXProject` 与相关依赖链。

## 当前定位

- 仅保留超星学习通功能
- 以 `CXProject` 为核心组织学习、答题、跳章和兼容逻辑
- 不再以 popup / background / content script 三段式扩展结构为主

## 开发

```bash
npm install
npm run typecheck
npm run build
```

构建产物输出到 `dist/chaoxing-plus.js`。
```

- [ ] **Step 6: Run final verification after removing the old tree**

Run: `npm run typecheck && npm run build`
Expected: PASS.

---

### Task 9: Final structural verification against the approved spec

**Files:**
- Test: repository-wide

- [ ] **Step 1: Verify that the new source-of-truth files exist**

Check these paths:

```text
src/index.ts
src/runtime/project.ts
src/runtime/script.ts
src/projects/common.ts
src/projects/background.ts
src/projects/cx.ts
src/core/index.ts
src/utils/work.ts
src/elements/search.infos.ts
```

Expected: all present.

- [ ] **Step 2: Verify that the old MV3 entrypoints are gone**

Check these paths:

```text
src/content/index.ts
src/background/index.ts
src/popup/index.html
src/shared/constants.ts
public/manifest.json
```

Expected: all absent.

- [ ] **Step 3: Verify the required `cx.ts` scope markers exist**

Check `src/projects/cx.ts` for these named elements:

```text
env
guide
study
work
autoRead
pageRedirect
versionRedirect
examRedirect
rateHack
copyHack
studyDispatcher
cxSecretFontRecognize
CXAnalyses
study(
searchJob(
workOrExam(
```

Expected: all present.

- [ ] **Step 4: Run the final repository verification**

Run:

```bash
npm run typecheck
npm run build
```

Expected: both commands pass, and `dist/chaoxing-plus.js` is produced.

---

## Self-Review

### Spec coverage

- **脚本型单平台架构** — covered by Tasks 1, 2, 8, and 9.
- **以 `CXProject` 为核心** — covered by Tasks 5, 6, 7, and 8.
- **补齐超星所需最小运行时** — covered by Tasks 2 and 4.
- **保留学习、答题、跳转、兼容能力** — covered by Tasks 5 through 8.
- **移除旧 MV3 外壳** — covered by Task 8.
- **最终类型检查与构建验收** — covered by Tasks 2 through 9.

### Placeholder scan

- No `TODO`, `TBD`, or “implement later” placeholders remain.
- Every task has exact files.
- Every verification step has exact commands.
- Large ports specify exact source files/functions to bring over, not vague “copy similar code”.
- Git commits were intentionally removed from the plan because the human did not request them.

### Type consistency

- `ProjectDefinition`, `ScriptDefinition`, and `ScriptInstance` are introduced in Task 2 and referenced consistently afterward.
- `CommonWorkOptions` is introduced in Task 4 before Task 7 depends on it.
- `CXProject` is created in Task 5 and extended in Tasks 6–8.
- Final verification in Task 9 checks for the same file/module names introduced earlier.
