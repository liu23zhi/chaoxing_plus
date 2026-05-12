# Chaoxing 官方域名收敛 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将扩展的官方支持边界统一收紧为仅支持 `*.chaoxing.com`，同时保证 manifest、项目域名白名单、测试与当前说明表达保持一致。

**Architecture:** 这次改动只收缩域名边界，不调整学习、答题、面板、日志或题库流程。`build.mjs` 继续作为 manifest 生成入口，`src/projects/cx.ts` 继续作为超星项目定义入口，测试通过字符串断言和构建产物断言锁定“仅保留 chaoxing.com”的边界。

**Tech Stack:** Node.js, Vite build script (`build.mjs`), TypeScript, plain JavaScript, Node `node:test`, existing dist manifest generation flow.

---

## File Structure

- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\build.mjs`
  - 收紧 `chaoxingHosts`，仅保留 `*://*.chaoxing.com/*`
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\cx.ts`
  - 收紧 `CXProject.domains`，仅保留 `chaoxing.com`
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\manifest-permissions.test.mjs`
  - 将 manifest 权限与注入范围测试改为只断言 `chaoxing.com`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\cx-domain-scope.test.mjs`
  - 为 `CXProject.domains` 增加回归测试，锁定只保留 `chaoxing.com`
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\popup.html`
  - 将当前用户可见文案收紧为“超星官网/chaoxing.com”语义（如果现有文案仍然泛指“超星网站”，则明确为官方站点）
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\popup.js`
  - 保持首页跳转到 `https://www.chaoxing.com/`，仅在测试配套需要时调整
- Test/Build: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\dist\manifest.json`
  - 通过 `npm run build` 后由测试读取验证

## Task 1: 锁定 manifest 只允许 `*.chaoxing.com`

**Files:**
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\manifest-permissions.test.mjs`
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\build.mjs:17-36`
- Test: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\manifest-permissions.test.mjs`

- [ ] **Step 1: Write the failing test**

Modify `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\manifest-permissions.test.mjs`.

Replace the host list:

```js
const expectedChaoxingHosts = [
  '*://*.chaoxing.com/*'
];
```

Then add a new regression test below `manifest uses zh_CN locale, chaoxing helper name, and chaoxing host permissions`:

```js
test('manifest content script matches exactly the official chaoxing domain scope', async () => {
  const source = await readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(source);

  assert.deepEqual(manifest.content_scripts[0].matches, expectedChaoxingHosts);
  assert.equal(manifest.content_scripts[0].matches.includes('*://*.xueyinonline.com/*'), false);
  assert.equal(manifest.content_scripts[0].matches.includes('*://*.sslibrary.com/*'), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run build && node --test "C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\manifest-permissions.test.mjs"
```

Expected: FAIL because `build.mjs` still generates host permissions and content script matches for mirror domains such as `xueyinonline.com` and `sslibrary.com`.

- [ ] **Step 3: Write minimal implementation**

Modify `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\build.mjs`.

Replace:

```js
const chaoxingHosts = [
  '*://*.chaoxing.com/*',
  '*://*.xueyinonline.com/*',
  '*://*.hnsyu.net/*',
  '*://*.qutjxjy.cn/*',
  '*://*.ynny.cn/*',
  '*://*.hnvist.cn/*',
  '*://*.fjlecb.cn/*',
  '*://*.gdhkmooc.com/*',
  '*://*.cugbonline.cn/*',
  '*://*.zjelib.cn/*',
  '*://*.cqrspx.cn/*',
  '*://*.neauce.com/*',
  '*://*.zhihui-yun.com/*',
  '*://*.cqie.cn/*',
  '*://*.ccqmxx.com/*',
  '*://*.jxgmxy.com/*',
  '*://*.jnzyjsxy.cn/*',
  '*://*.sslibrary.com/*'
];
```

with:

```js
const chaoxingHosts = [
  '*://*.chaoxing.com/*'
];
```

Do not change any other manifest fields.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm run build && node --test "C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\manifest-permissions.test.mjs"
```

Expected: PASS, and both `host_permissions` and `content_scripts[0].matches` should equal `['*://*.chaoxing.com/*']`.

- [ ] **Step 5: Commit**

Run:

```bash
git add "C:\Users\Zelly\Documents\GitHub\chaoxing_plus\build.mjs" "C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\manifest-permissions.test.mjs"
git commit -m "$(cat <<'EOF'
收紧：仅保留 chaoxing.com 扩展注入范围

移除镜像域名的 manifest 权限与内容脚本匹配范围，只保留 chaoxing.com 官方域名，并补充对应回归测试。
EOF
)"
```

### Task 2: 锁定 `CXProject.domains` 仅保留 `chaoxing.com`

**Files:**
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\cx-domain-scope.test.mjs`
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\cx.ts:632-655`
- Test: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\cx-domain-scope.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\cx-domain-scope.test.mjs` with this content:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const cxPath = resolve(process.cwd(), 'src', 'projects', 'cx.ts');

const removedDomains = [
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
];

test('cx project domains only keep the official chaoxing domain', async () => {
  const source = await readFile(cxPath, 'utf8');

  assert.equal(source.includes("domains: [\n    'chaoxing.com'\n  ]"), true);
  removedDomains.forEach((domain) => {
    assert.equal(source.includes(`'${domain}'`), false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test "C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\cx-domain-scope.test.mjs"
```

Expected: FAIL because `src/projects/cx.ts` still contains `edu.cn`, `org.cn`, and multiple mirror domains.

- [ ] **Step 3: Write minimal implementation**

Modify `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\cx.ts`.

Replace:

```ts
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
```

with:

```ts
domains: [
  'chaoxing.com'
],
```

Do not modify any `matches` arrays in `guide`, `study`, `work`, `autoRead`, or other scripts during this task.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test "C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\cx-domain-scope.test.mjs"
```

Expected: PASS, and the regression test should confirm every removed mirror domain is absent from `CXProject.domains`.

- [ ] **Step 5: Commit**

Run:

```bash
git add "C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\cx.ts" "C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\cx-domain-scope.test.mjs"
git commit -m "$(cat <<'EOF'
收紧：仅保留 chaoxing.com 项目域名白名单

将 CXProject 的站点识别边界收敛为 chaoxing.com 官方域名，移除镜像域名白名单，并新增字符串回归测试。
EOF
)"
```

### Task 3: 同步当前说明表达并完成回归验证

**Files:**
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\popup.html`
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\extension-shell.test.mjs`
- Test: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\extension-shell.test.mjs`
- Test: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\manifest-permissions.test.mjs`
- Test: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\cx-domain-scope.test.mjs`

- [ ] **Step 1: Write the failing test**

Modify `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\extension-shell.test.mjs`.

Replace:

```js
assert.equal(source.includes('给超星网站使用的自动学习 / 自动搜题扩展'), true);
assert.equal(source.includes('打开超星官网'), true);
```

with:

```js
assert.equal(source.includes('给 chaoxing.com 官方站点使用的自动学习 / 自动搜题扩展'), true);
assert.equal(source.includes('打开 chaoxing.com 官网'), true);
```

Keep the existing homepage assertion in the popup script test unchanged.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test "C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\extension-shell.test.mjs"
```

Expected: FAIL because `src/popup.html` still says `给超星网站使用的自动学习 / 自动搜题扩展` and `打开超星官网`.

- [ ] **Step 3: Write minimal implementation**

Modify `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\popup.html`.

Replace:

```html
<div class="desc">这是一个给超星网站使用的自动学习 / 自动搜题扩展。</div>
<button id="open-chaoxing" class="button" type="button">打开超星官网</button>
```

with:

```html
<div class="desc">这是一个给 chaoxing.com 官方站点使用的自动学习 / 自动搜题扩展。</div>
<button id="open-chaoxing" class="button" type="button">打开 chaoxing.com 官网</button>
```

Do not change the popup script URL.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npm run build && node --test "C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\manifest-permissions.test.mjs" "C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\cx-domain-scope.test.mjs" "C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\extension-shell.test.mjs"
```

Expected: PASS for all three test files. The built manifest should remain restricted to `*.chaoxing.com`, the project domain list should remain restricted to `chaoxing.com`, and the popup should present the official-domain wording.

- [ ] **Step 5: Run typecheck to verify no unrelated regression**

Run:

```bash
npm run typecheck
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 6: Commit**

Run:

```bash
git add "C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\popup.html" "C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\extension-shell.test.mjs" "C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\manifest-permissions.test.mjs" "C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\cx-domain-scope.test.mjs" "C:\Users\Zelly\Documents\GitHub\chaoxing_plus\build.mjs" "C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\projects\cx.ts"
git commit -m "$(cat <<'EOF'
调整：统一为 chaoxing.com 官方域名支持范围

同步收紧 manifest、项目域名白名单与当前说明表达，明确扩展仅支持 chaoxing.com 官方域名，并补全回归测试。
EOF
)"
```

## Self-Review

- **Spec coverage:**
  - Manifest 权限与注入范围：Task 1 覆盖
  - 项目运行边界：Task 2 覆盖
  - 测试与当前说明表达：Task 3 覆盖
- **Placeholder scan:**
  - 无 TBD / TODO / “类似处理”占位语句
  - 每个任务都包含具体文件、测试代码、命令和预期结果
- **Type consistency:**
  - 统一使用 `chaoxingHosts`、`CXProject.domains`、`expectedChaoxingHosts`、`removedDomains` 这些已在现有代码和测试中存在或在任务里明确定义的名称
