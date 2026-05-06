# Extension Logo and Popup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Chaoxing Plus extension logo, a minimal toolbar popup that introduces the extension and opens Chaoxing, and a user-facing manifest description.

**Architecture:** Keep the change entirely inside the extension shell. `build.mjs` remains the single place that generates the MV3 manifest and copies static files into `dist`, while a tiny popup page is added as a standalone static asset with no dependency on the content-script runtime.

**Tech Stack:** Node.js, Manifest V3 static assets, plain HTML/CSS/JavaScript, existing `build.mjs` build flow, Node `node:test` source assertions.

---

## File Structure

- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\build.mjs`
  - Add manifest `icons`
  - Add manifest `action.default_popup`
  - Update manifest `description`
  - Copy the icon asset and popup assets into `dist`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\popup.html`
  - Minimal popup UI structure and styles
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\popup.js`
  - Open `https://www.chaoxing.com/` from the popup button
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\extension-shell.test.mjs`
  - Regression tests that assert the manifest/build source includes icon wiring, popup wiring, and the updated description
- Use existing asset: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\icon\icon_512X512.png`

### Task 1: Add failing regression tests for manifest and popup shell wiring

**Files:**
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\extension-shell.test.mjs`
- Test: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\extension-shell.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\extension-shell.test.mjs` with this content:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const buildScriptPath = resolve(process.cwd(), 'build.mjs');
const popupHtmlPath = resolve(process.cwd(), 'src', 'popup.html');
const popupJsPath = resolve(process.cwd(), 'src', 'popup.js');

const expectedDescription = '给超星网站使用的自动学习与自动搜题扩展。';
const expectedHomepage = 'https://www.chaoxing.com/';

test('build script declares extension icons, popup, and updated description', async () => {
  const source = await readFile(buildScriptPath, 'utf8');

  assert.equal(source.includes("description: '给超星网站使用的自动学习与自动搜题扩展。'"), true);
  assert.equal(source.includes("default_popup: 'popup.html'"), true);
  assert.equal(source.includes("'512': 'icon_512X512.png'"), true);
});

test('popup page introduces the extension for Chaoxing users', async () => {
  const source = await readFile(popupHtmlPath, 'utf8');

  assert.equal(source.includes('给超星网站使用的自动学习 / 自动搜题扩展'), true);
  assert.equal(source.includes('打开超星官网'), true);
});

test('popup script opens the Chaoxing homepage', async () => {
  const source = await readFile(popupJsPath, 'utf8');

  assert.equal(source.includes(expectedHomepage), true);
  assert.equal(source.includes('chrome.tabs.create'), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test "C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\extension-shell.test.mjs"
```

Expected: FAIL because `src/popup.html` and `src/popup.js` do not exist yet, and `build.mjs` does not yet declare the new description, popup, or icon.

### Task 2: Implement the popup assets and build wiring

**Files:**
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\build.mjs`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\popup.html`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\popup.js`
- Test: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\extension-shell.test.mjs`

- [ ] **Step 1: Create the popup page**

Create `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\popup.html` with this content:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Chaoxing Plus</title>
    <style>
      :root {
        color-scheme: light;
        font-family: "Microsoft YaHei", "PingFang SC", system-ui, sans-serif;
      }

      body {
        margin: 0;
        width: 320px;
        padding: 20px;
        background: linear-gradient(180deg, #f8fbff 0%, #eef6ff 100%);
        color: #0f172a;
      }

      .card {
        display: grid;
        gap: 12px;
        padding: 16px;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.96);
        border: 1px solid rgba(148, 163, 184, 0.18);
        box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
      }

      .title {
        font-size: 18px;
        font-weight: 800;
      }

      .desc {
        font-size: 13px;
        line-height: 1.65;
        color: #334155;
      }

      .button {
        appearance: none;
        border: 0;
        border-radius: 12px;
        padding: 10px 14px;
        font-size: 14px;
        font-weight: 700;
        color: #ffffff;
        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
        cursor: pointer;
      }

      .button:hover {
        filter: brightness(1.03);
      }
    </style>
  </head>
  <body>
    <section class="card">
      <div class="title">Chaoxing Plus</div>
      <div class="desc">这是一个给超星网站使用的自动学习 / 自动搜题扩展。</div>
      <button id="open-chaoxing" class="button" type="button">打开超星官网</button>
    </section>
    <script type="module" src="./popup.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Create the popup script**

Create `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\popup.js` with this content:

```js
const homepage = 'https://www.chaoxing.com/';
const openButton = document.getElementById('open-chaoxing');

if (openButton) {
  openButton.addEventListener('click', () => {
    chrome.tabs.create({ url: homepage });
  });
}
```

- [ ] **Step 3: Update the build script manifest and static file copying**

Modify `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\build.mjs`.

In the imports, change:

```js
import { copyFileSync, mkdirSync, existsSync, writeFileSync } from 'fs';
```

to:

```js
import { copyFileSync, mkdirSync, existsSync, writeFileSync } from 'fs';
```

(Keep the import as-is; no new fs helper is required.)

Inside the `manifest` object, replace:

```js
description: '仅保留超星学习通功能的脚本型扩展包装层',
```

with:

```js
description: '给超星网站使用的自动学习与自动搜题扩展。',
icons: {
  '512': 'icon_512X512.png'
},
action: {
  default_popup: 'popup.html'
},
```

After the existing `extension-entry.js` copy block:

```js
if (existsSync('src/extension-entry.js')) {
  copyFileSync('src/extension-entry.js', 'dist/extension-entry.js');
}
```

add these blocks:

```js
if (existsSync('icon/icon_512X512.png')) {
  copyFileSync('icon/icon_512X512.png', 'dist/icon_512X512.png');
}

if (existsSync('src/popup.html')) {
  copyFileSync('src/popup.html', 'dist/popup.html');
}

if (existsSync('src/popup.js')) {
  copyFileSync('src/popup.js', 'dist/popup.js');
}
```

- [ ] **Step 4: Run the test to verify it now passes**

Run:

```bash
node --test "C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\extension-shell.test.mjs"
```

Expected: PASS for all three assertions.

### Task 3: Verify build output matches the new extension shell behavior

**Files:**
- Test: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\scripts\extension-shell.test.mjs`
- Modify: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\build.mjs`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\popup.html`
- Create: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\src\popup.js`
- Use existing: `C:\Users\Zelly\Documents\GitHub\chaoxing_plus\icon\icon_512X512.png`

- [ ] **Step 1: Run full project typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 2: Run production build**

Run:

```bash
npm run build
```

Expected: PASS and produce `dist/manifest.json`, `dist/icon_512X512.png`, `dist/popup.html`, and `dist/popup.js`.

- [ ] **Step 3: Inspect the built manifest**

Run:

```bash
node -e "const fs=require('fs'); const manifest=JSON.parse(fs.readFileSync('dist/manifest.json','utf8')); console.log(JSON.stringify({description: manifest.description, icons: manifest.icons, popup: manifest.action?.default_popup}, null, 2));"
```

Expected output:

```json
{
  "description": "给超星网站使用的自动学习与自动搜题扩展。",
  "icons": {
    "512": "icon_512X512.png"
  },
  "popup": "popup.html"
}
```

- [ ] **Step 4: Inspect that popup and icon assets were emitted**

Run:

```bash
node -e "const fs=require('fs'); ['dist/icon_512X512.png','dist/popup.html','dist/popup.js'].forEach((file) => console.log(file, fs.existsSync(file)));"
```

Expected output:

```text
dist/icon_512X512.png true
dist/popup.html true
dist/popup.js true
```

- [ ] **Step 5: Commit**

Run:

```bash
git add "build.mjs" "src/popup.html" "src/popup.js" "scripts/extension-shell.test.mjs"
git commit -m "$(cat <<'EOF'
feat: add extension logo and homepage popup

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```
