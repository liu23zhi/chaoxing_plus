/**
 * In-page floating panel.
 *
 * Injects a draggable, collapsible panel into Chaoxing pages so the
 * user can adjust extension settings without opening the popup.
 */

import type { Settings } from '../../shared/types.js';
import { showSpeedWarningSwal } from '../../shared/swal.js';
import { logger } from '../utils/logger.js';

// ─── Panel HTML / CSS ─────────────────────────────────────────────────────────

const PANEL_ID = 'chaoxing-plus-panel';
const PANEL_STYLE_ID = 'chaoxing-plus-panel-style';
const SPEED_OPTIONS = ['1', '1.25', '1.5', '1.75', '2', '2.5', '3', '4', '6', '8', '12', '16', '20'] as const;

const PANEL_CSS = `
#${PANEL_ID} {
  position: fixed;
  top: 80px;
  right: 20px;
  z-index: 2147483647;
  width: 280px;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 4px 24px rgba(0,0,0,.18);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 13px;
  color: #333;
  user-select: none;
  overflow: hidden;
  transition: height 0.2s ease;
}
#${PANEL_ID}.collapsed .cx-panel-body {
  display: none;
}
.cx-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%);
  color: #fff;
  cursor: move;
  border-radius: 10px 10px 0 0;
}
.cx-panel-header .cx-panel-title {
  font-weight: 600;
  font-size: 13px;
  letter-spacing: .5px;
}
.cx-panel-header .cx-panel-toggle {
  background: none;
  border: none;
  color: #fff;
  font-size: 16px;
  cursor: pointer;
  line-height: 1;
  padding: 0 2px;
  opacity: .85;
}
.cx-panel-header .cx-panel-toggle:hover { opacity: 1; }
.cx-panel-body {
  padding: 10px 14px 14px;
}
.cx-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid #f0f0f0;
}
.cx-row:last-child { border-bottom: none; }
.cx-row label {
  flex: 1;
  cursor: pointer;
  color: #444;
}
.cx-row input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #1a73e8;
  cursor: pointer;
}
.cx-row input[type="number"] {
  width: 96px;
  padding: 4px 6px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  text-align: right;
}
.cx-row select {
  width: 96px;
  font-size: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 2px 4px;
  background: #fafafa;
}
.cx-row input.cx-speed-input {
  width: 96px;
  font-size: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 2px 4px;
  background: #fafafa;
  text-align: right;
}
.cx-speed-controls {
  display: flex;
  gap: 6px;
}
.cx-row.column {
  flex-direction: column;
  align-items: flex-start;
}
.cx-row.column label {
  margin-bottom: 4px;
}
.cx-speed-warning {
  margin: 6px 0;
  padding: 6px 8px;
  background: #fff8e1;
  border: 1px solid #ffe082;
  border-radius: 6px;
  font-size: 11px;
  color: #7a5000;
  line-height: 1.7;
}
.cx-row textarea {
  width: 100%;
  min-height: 56px;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  resize: vertical;
  font-family: monospace;
}
.cx-status {
  margin-top: 8px;
  padding: 6px 10px;
  background: #e8f0fe;
  border-radius: 6px;
  font-size: 12px;
  color: #1a73e8;
  min-height: 24px;
}
.cx-btn {
  margin-top: 10px;
  width: 100%;
  padding: 7px;
  background: #1a73e8;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  font-weight: 500;
}
.cx-btn:hover { background: #1558b0; }
.cx-btn.secondary {
  background: #f1f3f4;
  color: #333;
  margin-top: 6px;
}
.cx-btn.secondary:hover { background: #e2e5ea; }
`;

// ─── Panel class ──────────────────────────────────────────────────────────────

export class Panel {
  private el: HTMLDivElement | null = null;
  private settings: Settings;
  private onSettingsChange: (s: Settings) => void;
  private statusEl: HTMLDivElement | null = null;
  private isDragging = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;

  constructor(settings: Settings, onSettingsChange: (s: Settings) => void) {
    this.settings = settings;
    this.onSettingsChange = onSettingsChange;
  }

  /** Inject the panel into the page. */
  mount(): void {
    if (document.getElementById(PANEL_ID)) return;

    // Inject styles.
    if (!document.getElementById(PANEL_STYLE_ID)) {
      const style = document.createElement('style');
      style.id = PANEL_STYLE_ID;
      style.textContent = PANEL_CSS;
      document.head.appendChild(style);
    }

    this.el = document.createElement('div');
    this.el.id = PANEL_ID;
    this.el.innerHTML = this.buildHTML();
    document.body.appendChild(this.el);
    this.syncSpeedControls(
      this.el.querySelector<HTMLSelectElement>('#cx-speed-preset'),
      this.el.querySelector<HTMLInputElement>('#cx-speed-custom'),
      this.settings.playbackRate,
    );

    this.statusEl = this.el.querySelector('.cx-status');
    this.bindEvents();
    logger.info('超星助手面板已加载');
  }

  /** Remove the panel from the page. */
  unmount(): void {
    this.el?.remove();
    this.el = null;
  }

  /** Update the status message displayed in the panel. */
  setStatus(msg: string): void {
    if (this.statusEl) {
      this.statusEl.textContent = msg;
    }
  }

  /** Refresh displayed values after settings change from outside (popup). */
  updateSettings(settings: Settings): void {
    this.settings = settings;
    if (!this.el) return;
    const speedPreset = this.el.querySelector<HTMLSelectElement>('#cx-speed-preset');
    const speedCustom = this.el.querySelector<HTMLInputElement>('#cx-speed-custom');
    this.syncSpeedControls(speedPreset, speedCustom, settings.playbackRate);
    this.syncCheckboxes();
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private buildHTML(): string {
    const s = this.settings;
    return `
      <div class="cx-panel-header" id="cx-panel-header">
        <span class="cx-panel-title">📚 超星学习通助手</span>
        <button class="cx-panel-toggle" id="cx-toggle" title="折叠/展开">▾</button>
      </div>
      <div class="cx-panel-body">
        <div class="cx-row">
          <label for="cx-enabled">启用插件</label>
          <input type="checkbox" id="cx-enabled" ${s.enabled ? 'checked' : ''}>
        </div>
        <div class="cx-row">
          <label for="cx-autoplay">自动播放视频</label>
          <input type="checkbox" id="cx-autoplay" ${s.autoPlay ? 'checked' : ''}>
        </div>
        <div class="cx-row">
          <label for="cx-speed">播放倍速</label>
          <div class="cx-speed-controls">
            <select id="cx-speed-preset">
              <option value="">自定义</option>
              ${this.buildSpeedOptions()}
            </select>
            <input id="cx-speed-custom" class="cx-speed-input" type="text" value="${s.playbackRate}" placeholder="自定义">
          </div>
        </div>
        <div class="cx-speed-warning">
          <div>⚠️ 超星后台可以看到学习时长，请谨慎设置</div>
        </div>
        <div class="cx-row">
          <label for="cx-mute">静音播放</label>
          <input type="checkbox" id="cx-mute" ${s.muteVideo ? 'checked' : ''}>
        </div>
        <div class="cx-row">
          <label for="cx-nexttask">完成后自动下一任务</label>
          <input type="checkbox" id="cx-nexttask" ${s.autoNextTask ? 'checked' : ''}>
        </div>
        <div class="cx-row">
          <label for="cx-quiz">视频内弹题策略</label>
          <select id="cx-quiz">
            <option value="random" ${s.videoQuizStrategy === 'random' ? 'selected' : ''}>随机答题</option>
            <option value="ignore" ${s.videoQuizStrategy === 'ignore' ? 'selected' : ''}>忽略</option>
          </select>
        </div>
        <div class="cx-row">
          <label for="cx-autodoc">自动翻PPT/文档</label>
          <input type="checkbox" id="cx-autodoc" ${s.autoStudyDoc ? 'checked' : ''}>
        </div>
        <div class="cx-row">
          <label for="cx-autoanswer">自动答题</label>
          <input type="checkbox" id="cx-autoanswer" ${s.autoAnswer ? 'checked' : ''}>
        </div>
        <div class="cx-row column">
          <label for="cx-answer-delay">答题延迟 (ms)</label>
          <input type="number" id="cx-answer-delay" min="500" max="10000" step="100" value="${s.answerDelayMs}">
        </div>
        <div class="cx-row column">
          <label for="cx-qb-urls">题库 API 地址（每行一个）</label>
          <textarea id="cx-qb-urls" rows="3" placeholder="https://your-api.example.com/query">${s.questionBankUrls}</textarea>
        </div>
        <div class="cx-status">就绪</div>
        <button class="cx-btn" id="cx-save">保存设置</button>
      </div>
    `;
  }

  private syncCheckboxes(): void {
    if (!this.el) return;
    const s = this.settings;
    const set = (id: string, val: boolean) => {
      const cb = this.el!.querySelector<HTMLInputElement>(`#${id}`);
      if (cb) cb.checked = val;
    };
    set('cx-enabled', s.enabled);
    set('cx-autoplay', s.autoPlay);
    set('cx-mute', s.muteVideo);
    set('cx-nexttask', s.autoNextTask);
    set('cx-autodoc', s.autoStudyDoc);
    set('cx-autoanswer', s.autoAnswer);
    const answerDelay = this.el.querySelector<HTMLInputElement>('#cx-answer-delay');
    if (answerDelay) answerDelay.value = String(s.answerDelayMs);
    const qbUrls = this.el.querySelector<HTMLTextAreaElement>('#cx-qb-urls');
    if (qbUrls) qbUrls.value = s.questionBankUrls;
    const quiz = this.el.querySelector<HTMLSelectElement>('#cx-quiz');
    if (quiz) quiz.value = s.videoQuizStrategy;
  }

  private buildSpeedOptions(): string {
    return SPEED_OPTIONS
      .map((rate) => `<option value="${rate}">${rate}x</option>`)
      .join('');
  }

  private syncSpeedControls(
    presetEl: HTMLSelectElement | null,
    customEl: HTMLInputElement | null,
    rate: number,
  ): void {
    if (!presetEl || !customEl) return;
    const asText = String(rate);
    const hasPreset = SPEED_OPTIONS.some((opt) => opt === asText);
    presetEl.value = hasPreset ? asText : '';
    customEl.value = asText;
  }

  private parsePlaybackRate(value: string): number {
    const parsed = parseFloat(value.trim());
    if (!Number.isFinite(parsed)) return this.settings.playbackRate;
    return Math.min(20, Math.max(0.25, parsed));
  }

  private warnHighSpeed(rate: number): void {
    if (rate <= 2) return;
    void showSpeedWarningSwal();
  }

  private bindEvents(): void {
    if (!this.el) return;

    // Collapse / expand.
    this.el.querySelector('#cx-toggle')?.addEventListener('click', () => {
      this.el?.classList.toggle('collapsed');
      const btn = this.el?.querySelector<HTMLButtonElement>('#cx-toggle');
      if (btn) btn.textContent = this.el?.classList.contains('collapsed') ? '▸' : '▾';
    });

    // Save button.
    this.el.querySelector('#cx-save')?.addEventListener('click', () => {
      this.collectAndSave();
    });

    this.el.querySelector<HTMLSelectElement>('#cx-speed-preset')?.addEventListener('change', (e) => {
      const value = (e.target as HTMLSelectElement).value;
      if (!value) return;
      const custom = this.el?.querySelector<HTMLInputElement>('#cx-speed-custom');
      if (custom) custom.value = value;
    });
    this.el.querySelector<HTMLInputElement>('#cx-speed-custom')?.addEventListener('input', (e) => {
      const customValue = (e.target as HTMLInputElement).value.trim();
      const preset = this.el?.querySelector<HTMLSelectElement>('#cx-speed-preset');
      if (!preset) return;
      preset.value = SPEED_OPTIONS.some((opt) => opt === customValue) ? customValue : '';
    });

    // Draggable header.
    const header = this.el.querySelector<HTMLElement>('#cx-panel-header');
    if (header) {
      header.addEventListener('mousedown', (e) => this.onDragStart(e as MouseEvent));
    }
    document.addEventListener('mousemove', (e) => this.onDragMove(e));
    document.addEventListener('mouseup', () => { this.isDragging = false; });
  }

  private collectAndSave(): void {
    if (!this.el) return;
    const get = <T extends HTMLInputElement | HTMLSelectElement>(id: string): T | null =>
      this.el!.querySelector<T>(`#${id}`);
    const getArea = (id: string): HTMLTextAreaElement | null =>
      this.el!.querySelector<HTMLTextAreaElement>(`#${id}`);

    const cb = (id: string) => (get<HTMLInputElement>(id)?.checked ?? false);
    const sel = (id: string) => get<HTMLSelectElement>(id)?.value ?? '';
    const int = (id: string, fallback: number) => {
      const parsed = parseInt((get<HTMLInputElement>(id)?.value) ?? '', 10);
      return Number.isFinite(parsed) ? parsed : fallback;
    };
    const text = (id: string) => getArea(id)?.value ?? '';

    const updated: Settings = {
      ...this.settings,
      enabled: cb('cx-enabled'),
      autoPlay: cb('cx-autoplay'),
      playbackRate: this.parsePlaybackRate((get<HTMLInputElement>('cx-speed-custom')?.value) ?? String(this.settings.playbackRate)),
      muteVideo: cb('cx-mute'),
      autoNextTask: cb('cx-nexttask'),
      videoQuizStrategy: (sel('cx-quiz') as Settings['videoQuizStrategy']) || 'random',
      autoStudyDoc: cb('cx-autodoc'),
      autoAnswer: cb('cx-autoanswer'),
      answerDelayMs: int('cx-answer-delay', this.settings.answerDelayMs),
      questionBankUrls: text('cx-qb-urls'),
    };

    this.settings = updated;
    this.syncSpeedControls(
      this.el.querySelector<HTMLSelectElement>('#cx-speed-preset'),
      this.el.querySelector<HTMLInputElement>('#cx-speed-custom'),
      updated.playbackRate,
    );
    this.warnHighSpeed(updated.playbackRate);
    this.onSettingsChange(updated);
    this.setStatus('设置已保存 ✓');
    setTimeout(() => this.setStatus('就绪'), 2000);
  }

  private onDragStart(e: MouseEvent): void {
    if (!this.el) return;
    // Ignore clicks on the toggle button.
    if ((e.target as Element).id === 'cx-toggle') return;
    this.isDragging = true;
    const rect = this.el.getBoundingClientRect();
    this.dragOffsetX = e.clientX - rect.left;
    this.dragOffsetY = e.clientY - rect.top;
  }

  private onDragMove(e: MouseEvent): void {
    if (!this.isDragging || !this.el) return;
    const x = e.clientX - this.dragOffsetX;
    const y = e.clientY - this.dragOffsetY;
    this.el.style.left = `${Math.max(0, x)}px`;
    this.el.style.top = `${Math.max(0, y)}px`;
    this.el.style.right = 'auto';
  }
}

/**
 * Create and mount the in-page panel.
 */
export function createPanel(
  settings: Settings,
  onSettingsChange: (s: Settings) => void,
): Panel {
  const panel = new Panel(settings, onSettingsChange);
  panel.mount();
  return panel;
}
