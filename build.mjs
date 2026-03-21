import { build } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { copyFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function buildContentScript() {
  await build({
    configFile: false,
    build: {
      lib: {
        entry: resolve(__dirname, 'src/content/index.ts'),
        formats: ['iife'],
        name: 'ChaoxingPlus',
        fileName: () => 'content.js',
      },
      rollupOptions: {
        output: {
          entryFileNames: 'content.js',
          inlineDynamicImports: true,
        },
      },
      outDir: 'dist',
      emptyOutDir: false,
    },
  });
}

async function buildBackground() {
  await build({
    configFile: false,
    build: {
      lib: {
        entry: resolve(__dirname, 'src/background/index.ts'),
        formats: ['es'],
        fileName: () => 'background.js',
      },
      rollupOptions: {
        output: {
          entryFileNames: 'background.js',
          inlineDynamicImports: true,
        },
      },
      outDir: 'dist',
      emptyOutDir: false,
    },
  });
}

async function buildPopup() {
  await build({
    configFile: false,
    base: './',
    root: resolve(__dirname, 'src/popup'),
    build: {
      rollupOptions: {
        input: {
          popup: resolve(__dirname, 'src/popup/index.html'),
        },
        output: {
          entryFileNames: 'popup.js',
          assetFileNames: '[name][extname]',
        },
      },
      outDir: resolve(__dirname, 'dist/popup'),
      emptyOutDir: true,
    },
  });
}

function copyStaticFiles() {
  mkdirSync('dist/icons', { recursive: true });
  copyFileSync('public/manifest.json', 'dist/manifest.json');

  const iconsSrc = 'public/icons';
  if (existsSync(iconsSrc)) {
    const files = readdirSync(iconsSrc);
    files.forEach((file) => {
      const srcPath = `${iconsSrc}/${file}`;
      const destPath = `dist/icons/${file}`;
      if (statSync(srcPath).isFile()) {
        copyFileSync(srcPath, destPath);
      }
    });
  }
}

async function main() {
  console.log('🔨 Building Chaoxing Plus extension...');

  mkdirSync('dist', { recursive: true });

  console.log('  [1/4] Copying static files...');
  copyStaticFiles();

  console.log('  [2/4] Building background service worker...');
  await buildBackground();

  console.log('  [3/4] Building content script...');
  await buildContentScript();

  console.log('  [4/4] Building popup...');
  await buildPopup();

  console.log('✅ Build complete! Extension output: dist/');
  console.log('   Load dist/ as an unpacked extension in Chrome/Edge.');
}

main().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
