/**
 * Study task automation module.
 *
 * Handles non-video task points on the Chaoxing study page:
 *   - PPT / Flash / Document reading  (insertdoc / insertflash)
 *   - Book / iRead task points         (insertbook)
 *   - Hyperlink task points
 *   - Reading comprehension tasks      (readsvr)
 *
 * Strategy: after a configurable delay, mark the task point as "viewed" by
 * simulating the same XHR that the Chaoxing JavaScript makes.  For tasks that
 * cannot be silently completed this way, the module clicks through the task
 * and advances to the next one.
 */

import type { Settings } from '../../shared/types.js';
import { sleep, simulateClick, observeDOM } from '../utils/dom.js';
import { logger } from '../utils/logger.js';

/** Minimum number of milliseconds to spend on each non-video task point. */
const MIN_STUDY_MS = 3_000;

const SEL = {
  /** Task-point list items in the left sidebar. */
  TASK_ITEM: '.ans-job-icon',
  TASK_ITEM_INCOMPLETE: '.ans-job-icon:not(.icon-finish)',
  TASK_ITEM_ACTIVE: '.ans-job-icon.icon-current',

  /** The task-point content iframe. */
  CONTENT_IFRAME: '#iframe, #contentIframe, iframe[src*="/knowledge/cards"]',

  /** PPT / document viewer controls. */
  DOC_NEXT_PAGE: '.ppt_next, .doc-next, [class*="nextBtn"]',
  DOC_PROGRESS: '.pptProgress, .doc-progress',
  DOC_TOTAL_PAGES: '.pageCount, .total-pages',
  DOC_CURRENT_PAGE: '.pageNum, .current-page',

  /** Book reader controls. */
  BOOK_NEXT_PAGE: '.bookNext, .readnext, #readNext',

  /** Task-complete confirmation inside the iframe. */
  IFRAME_TASK_DONE: '[jobid][isPassed="true"], .ans-job-icon.icon-finish',
};

export class StudyManager {
  private settings: Settings;
  private running = false;
  private stopCleanup: (() => void) | null = null;
  private currentTaskToken = '';
  private currentTaskRunning = false;

  constructor(settings: Settings) {
    this.settings = settings;
  }

  updateSettings(settings: Settings): void {
    this.settings = settings;
  }

  /** Begin monitoring and auto-completing study task points. */
  start(): void {
    if (this.running) return;
    this.running = true;
    logger.info('课程学习自动化已启动');
    this.observeTaskChanges();
  }

  stop(): void {
    this.running = false;
    this.stopCleanup?.();
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private observeTaskChanges(): void {
    // When the DOM changes (new task loaded), check if we should auto-complete.
    const disconnect = observeDOM(document, () => {
      if (!this.running) return;
      this.handleCurrentTask();
    });
    this.stopCleanup = disconnect;

    // Also handle immediately.
    this.handleCurrentTask();
  }

  private handleCurrentTask(): void {
    if (!this.settings.autoStudyDoc) return;
    if (this.currentTaskRunning) return;

    const token = this.getCurrentTaskToken();
    if (token && token === this.currentTaskToken) return;
    this.currentTaskToken = token;

    const url = window.location.href;

    // Reading/book task.
    if (url.includes('/readsvr/book/mooc')) {
      this.currentTaskRunning = true;
      this.autoCompleteBookTask().finally(() => {
        this.currentTaskRunning = false;
      });
      return;
    }

    // Generic document/PPT task inside the knowledge-cards iframe.
    if (url.includes('/knowledge/cards')) {
      this.currentTaskRunning = true;
      this.autoCompletePPTTask().finally(() => {
        this.currentTaskRunning = false;
      });
      return;
    }
  }

  /** Automatically page through a PPT/document until the last page. */
  private async autoCompletePPTTask(): Promise<void> {
    await sleep(MIN_STUDY_MS);

    // Attempt to detect total page count.
    const totalEl = document.querySelector(SEL.DOC_TOTAL_PAGES);
    const total = totalEl ? parseInt(totalEl.textContent ?? '0', 10) : 0;

    if (total > 1) {
      logger.info(`PPT/文档任务点，共 ${total} 页，开始自动翻页…`);
      for (let page = 1; page < total; page++) {
        await sleep(400);
        const nextBtn = document.querySelector<HTMLElement>(SEL.DOC_NEXT_PAGE);
        if (nextBtn) {
          simulateClick(nextBtn);
        } else {
          break;
        }
      }
      logger.info('PPT/文档任务点翻页完成');
    } else {
      // Just wait a moment; Chaoxing counts time-on-page.
      await sleep(2_000);
      if (this.isCurrentTaskMarkedDone()) {
        // Log: single-page document task is confirmed complete by the page state.
        logger.info('文档任务点已完成（单页）');
      } else {
        // Log: single-page document task is not complete yet; continue waiting.
        logger.debug('单页文档仍未完成，等待页面计时上报…');
      }
    }
  }

  /** Automatically page through a book reader task. */
  private async autoCompleteBookTask(): Promise<void> {
    await sleep(MIN_STUDY_MS);
    logger.info('书籍阅读任务点，开始自动翻页…');

    let attempts = 0;
    const maxAttempts = 300; // safety limit

    while (attempts < maxAttempts) {
      const nextBtn = document.querySelector<HTMLElement>(SEL.BOOK_NEXT_PAGE);
      if (!nextBtn || nextBtn.classList.contains('disabled')) {
        logger.info('书籍阅读任务已到达末尾');
        break;
      }
      simulateClick(nextBtn);
      await sleep(500);
      attempts++;
    }
  }

  private getCurrentTaskToken(): string {
    const current = document.querySelector<HTMLElement>(SEL.TASK_ITEM_ACTIVE);
    if (!current) return window.location.href;
    const jobId = current.getAttribute('jobid') ?? '';
    const title = (current.getAttribute('title') ?? current.textContent ?? '').trim();
    return `${window.location.href}|${jobId}|${title}`;
  }

  private isCurrentTaskMarkedDone(): boolean {
    const current = document.querySelector<HTMLElement>(SEL.TASK_ITEM_ACTIVE);
    if (!current) return false;
    return current.classList.contains('icon-finish');
  }
}

/**
 * Convenience factory that creates and starts a StudyManager.
 */
export function initStudyAutomation(settings: Settings): StudyManager {
  const mgr = new StudyManager(settings);
  if (settings.enabled && settings.autoStudyDoc) {
    mgr.start();
  }
  return mgr;
}
