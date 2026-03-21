/**
 * Content script entry point.
 *
 * Runs on every Chaoxing page (including iframes).
 * Detects the current page type and initialises the appropriate
 * automation modules, then mounts the in-page settings panel.
 */

import { DEFAULT_SETTINGS, STORAGE_KEY, URL_PATTERNS } from '../shared/constants.js';
import type { Message, Settings } from '../shared/types.js';
import { initVideoAutomation, advanceToNextTask } from './cx/video.js';
import { initStudyAutomation } from './cx/study.js';
import { initWorkAutomation } from './cx/work.js';
import { createPanel } from './panel/panel.js';
import { logger } from './utils/logger.js';

// ─── Settings helpers ─────────────────────────────────────────────────────────

function loadSettingsFromBackground(): Promise<Settings> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' } satisfies Message, (resp) => {
      if (chrome.runtime.lastError || !resp) {
        resolve(DEFAULT_SETTINGS);
      } else {
        resolve(resp as Settings);
      }
    });
  });
}

function saveSettingsToBackground(settings: Settings): void {
  chrome.runtime.sendMessage({
    type: 'SAVE_SETTINGS',
    payload: settings,
  } satisfies Message);
}

// ─── Page detection ───────────────────────────────────────────────────────────

function detectPageType(url: string) {
  return {
    isStudyPage:
      URL_PATTERNS.STUDY_PAGE.test(url) || URL_PATTERNS.STUDY_PAGE_V2.test(url),
    isKnowledgeCards: URL_PATTERNS.KNOWLEDGE_CARDS.test(url),
    isReadingTask: URL_PATTERNS.READING_TASK.test(url),
    isWorkPage: URL_PATTERNS.WORK_PAGE.test(url),
    isExamPage: URL_PATTERNS.EXAM_PAGE.test(url),
    isVideoIframe: URL_PATTERNS.VIDEO_IFRAME.test(url),
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  let settings: Settings;
  try {
    settings = await loadSettingsFromBackground();
  } catch {
    settings = DEFAULT_SETTINGS;
  }

  if (!settings.enabled) {
    logger.info('插件已禁用，跳过初始化');
    return;
  }

  const url = window.location.href;
  const page = detectPageType(url);

  logger.info(`超星助手已加载 | ${url.slice(0, 60)}…`);

  // ── Modules ─────────────────────────────────────────────────────────────────

  let videoMgr: ReturnType<typeof initVideoAutomation> | null = null;
  let studyMgr: ReturnType<typeof initStudyAutomation> | null = null;
  let workMgr: ReturnType<typeof initWorkAutomation> | null = null;
  const handleSettingsChange = (updated: Settings) => {
    saveSettingsToBackground(updated);
    videoMgr?.updateSettings(updated);
    studyMgr?.updateSettings(updated);
    workMgr?.updateSettings(updated);
  };

  // Video pages:
  //  - ananas iframe  (VIDEO_IFRAME):  the video <video> element is HERE.
  //  - knowledge-cards iframe (KNOWLEDGE_CARDS): may embed video directly.
  // Note: when running inside the ananas iframe, onComplete uses postMessage
  // to the top frame (handled below) instead of querying the wrong document.
  if (page.isVideoIframe || page.isKnowledgeCards) {
    const onVideoComplete = settings.autoNextTask
      ? () => advanceToNextTask()
      : undefined;
    videoMgr = initVideoAutomation(settings, onVideoComplete);
  }

  // Study tasks (PPT, book, etc.).
  if (page.isKnowledgeCards || page.isReadingTask) {
    studyMgr = initStudyAutomation(settings);
  }

  // Homework / exam.
  if (page.isWorkPage || page.isExamPage) {
    workMgr = initWorkAutomation(settings);
  }

  // ── Panel and cross-frame listeners – only in top-level frame ──────────────
  let panel: ReturnType<typeof createPanel> | null = null;
  if (window.self === window.top) {
    panel = createPanel(settings, handleSettingsChange);

    // Receive task-completion signals from nested video iframes so that we
    // can click the "next task" button from the frame that actually has it.
    // Only accept messages from the expected Chaoxing origins (security guard).
    const TRUSTED_HOSTS = ['chaoxing.com', 'xueyinonline.com'];
    const isTrustedOrigin = (origin: string): boolean => {
      try {
        const host = new URL(origin).hostname;
        return TRUSTED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
      } catch {
        return false;
      }
    };
    window.addEventListener('message', (event) => {
      if (!isTrustedOrigin(event.origin)) return;
      if (event.data?.type === 'CX_PLUS_TASK_DONE' && settings.autoNextTask) {
        advanceToNextTask();
      }
    });
  }

  // Listen for settings changes in ALL frames (including video iframes) so
  // that playback-rate updates take effect immediately without a page reload.
  chrome.runtime.onMessage.addListener((msg: Message) => {
    if (msg.type === 'TOGGLE_PANEL' && window.self === window.top) {
      if (!panel) {
        panel = createPanel(settings, handleSettingsChange);
      } else {
        panel.unmount();
        panel = null;
      }
      return;
    }

    if (msg.type === 'SETTINGS_UPDATED' && msg.payload) {
      const updated = msg.payload as Settings;
      settings = updated;
      videoMgr?.updateSettings(updated);
      studyMgr?.updateSettings(updated);
      workMgr?.updateSettings(updated);
      if (panel) {
        panel.updateSettings(updated);
        panel.setStatus('设置已同步 ✓');
        setTimeout(() => panel?.setStatus('就绪'), 2000);
      }
    }
  });

  // Fallback sync path for cases where runtime messaging does not reach this
  // page/frame (e.g. transient tab/frame lifecycle timing).
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync') return;
    if (!changes[STORAGE_KEY]) return;
    const next = changes[STORAGE_KEY].newValue as Partial<Settings> | undefined;
    if (!next) return;
    const updated = { ...DEFAULT_SETTINGS, ...next };
    settings = updated;
    videoMgr?.updateSettings(updated);
    studyMgr?.updateSettings(updated);
    workMgr?.updateSettings(updated);
    if (panel) {
      panel.updateSettings(updated);
      panel.setStatus('设置已同步 ✓');
      setTimeout(() => panel?.setStatus('就绪'), 2000);
    }
  });
}

main().catch((err) => {
  logger.error('内容脚本初始化失败', err);
});
