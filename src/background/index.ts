/**
 * Background service worker.
 *
 * Responsibilities:
 * - Persist and serve extension settings via chrome.storage.sync.
 * - Relay SETTINGS_UPDATED messages to all open Chaoxing tabs so that
 *   content scripts pick up configuration changes without a page reload.
 */

import { STORAGE_KEY, DEFAULT_SETTINGS } from '../shared/constants.js';
import type { Message, Settings } from '../shared/types.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

async function loadSettings(): Promise<Settings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(STORAGE_KEY, (result) => {
      const stored = result[STORAGE_KEY] as Partial<Settings> | undefined;
      resolve({ ...DEFAULT_SETTINGS, ...(stored ?? {}) });
    });
  });
}

async function saveSettings(settings: Settings): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ [STORAGE_KEY]: settings }, resolve);
  });
}

// ─── Message handler ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (
    message: Message,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ) => {
    if (message.type === 'GET_SETTINGS') {
      loadSettings().then(sendResponse);
      return true; // keep channel open for async response
    }

    if (message.type === 'SAVE_SETTINGS' && message.payload) {
      loadSettings().then(async (current) => {
        const updated: Settings = { ...current, ...message.payload };
        await saveSettings(updated);

        // Broadcast the update to all Chaoxing tabs.
        const tabs = await chrome.tabs.query({
          url: ['*://*.chaoxing.com/*', '*://*.xueyinonline.com/*'],
        });
        tabs.forEach((tab) => {
          if (tab.id != null) {
            chrome.tabs
              .sendMessage(tab.id, {
                type: 'SETTINGS_UPDATED',
                payload: updated,
              } satisfies Message)
              .catch(() => {
                // Tab may not have the content script; silently ignore.
              });
          }
        });

        sendResponse({ ok: true, settings: updated });
      });
      return true;
    }

    return false;
  },
);

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id == null) return;
  chrome.tabs
    .sendMessage(tab.id, { type: 'TOGGLE_PANEL' } satisfies Message)
    .catch(() => {
      // Tab may not match content_scripts; ignore.
    });
});

// ─── Installation hook ───────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') {
    await saveSettings(DEFAULT_SETTINGS);
    console.log('[超星助手] Extension installed with default settings.');
  }
});
