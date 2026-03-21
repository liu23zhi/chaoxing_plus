/**
 * Popup script.
 *
 * Loads settings from the background service worker, renders them into the form,
 * and saves back when the user clicks "保存设置".
 */

import { DEFAULT_SETTINGS } from '../shared/constants.js';
import type { Message, Settings } from '../shared/types.js';

// ─── DOM helpers ──────────────────────────────────────────────────────────────

function getElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id) as T | null;
  if (!el) throw new Error(`Element #${id} not found`);
  return el;
}
function $(id: string): HTMLElement { return getElement<HTMLElement>(id); }
function cb(id: string): HTMLInputElement { return getElement<HTMLInputElement>(id); }
function sel(id: string): HTMLSelectElement { return getElement<HTMLSelectElement>(id); }
function num(id: string): HTMLInputElement { return getElement<HTMLInputElement>(id); }
function ta(id: string): HTMLTextAreaElement { return getElement<HTMLTextAreaElement>(id); }

// ─── Load / save ─────────────────────────────────────────────────────────────

function loadSettings(): Promise<Settings> {
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

function saveSettings(settings: Settings): Promise<void> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'SAVE_SETTINGS', payload: settings } satisfies Message,
      () => resolve(),
    );
  });
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderSettings(s: Settings): void {
  cb('enabled').checked = s.enabled;
  cb('autoPlay').checked = s.autoPlay;
  cb('muteVideo').checked = s.muteVideo;
  cb('autoNextTask').checked = s.autoNextTask;
  cb('autoStudyDoc').checked = s.autoStudyDoc;
  cb('autoAnswer').checked = s.autoAnswer;

  sel('playbackRate').value = String(s.playbackRate);

  sel('videoQuizStrategy').value = s.videoQuizStrategy;
  num('answerDelayMs').value = String(s.answerDelayMs);
  ta('questionBankUrls').value = s.questionBankUrls;

  // Disable sub-settings when master switch is off.
  toggleSubSettings(s.enabled);
}

function collectSettings(): Settings {
  return {
    enabled: cb('enabled').checked,
    autoPlay: cb('autoPlay').checked,
    playbackRate: parseFloat(sel('playbackRate').value),
    muteVideo: cb('muteVideo').checked,
    autoNextTask: cb('autoNextTask').checked,
    videoQuizStrategy: (sel('videoQuizStrategy').value as Settings['videoQuizStrategy']),
    autoStudyDoc: cb('autoStudyDoc').checked,
    autoAnswer: cb('autoAnswer').checked,
    answerDelayMs: parseInt(num('answerDelayMs').value, 10),
    questionBankUrls: ta('questionBankUrls').value,
  };
}

function toggleSubSettings(enabled: boolean): void {
  const main = $('main-settings');
  main.style.opacity = enabled ? '1' : '0.4';
  main.style.pointerEvents = enabled ? 'auto' : 'none';
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  const settings = await loadSettings();
  renderSettings(settings);

  // Toggle sub-settings opacity.
  cb('enabled').addEventListener('change', (e) => {
    toggleSubSettings((e.target as HTMLInputElement).checked);
  });

  // Save button.
  $('saveBtn').addEventListener('click', async () => {
    const updated = collectSettings();
    await saveSettings(updated);
    const statusEl = $('status');
    statusEl.textContent = '✓ 已保存';
    setTimeout(() => { statusEl.textContent = ''; }, 2000);
  });
}

init();
