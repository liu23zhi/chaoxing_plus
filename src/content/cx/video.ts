/**
 * Video automation module.
 *
 * Handles the Chaoxing "ananas" video player:
 *   - Sets playback rate and volume.
 *   - Auto-plays and resumes paused video.
 *   - Handles in-video quiz popups (random answer or dismiss).
 *   - Fires a callback when the video task completes so the study
 *     orchestrator can move to the next task point.
 */

import type { Settings } from '../../shared/types.js';
import { sleep, simulateClick, waitForElement } from '../utils/dom.js';
import { logger } from '../utils/logger.js';

// Capture native HTMLMediaElement descriptors BEFORE any page script can
// override them.  All internal rate and play operations use these directly so
// the Chaoxing player cannot intercept or reset them.
const NATIVE_RATE_DESCRIPTOR = Object.getOwnPropertyDescriptor(
  HTMLMediaElement.prototype,
  'playbackRate',
);
const NATIVE_RATE_GETTER = NATIVE_RATE_DESCRIPTOR?.get;
const NATIVE_PLAY = HTMLMediaElement.prototype.play;
const RATE_EPSILON = 0.01;
const DRAG_STORM_THRESHOLD = 100;
const DRAG_HYSTERESIS_DELTA = 10;
const DRAG_STORM_RESET_POINT = DRAG_STORM_THRESHOLD - DRAG_HYSTERESIS_DELTA;
const DRAG_RESET_WINDOW_MS = 2000;
// Apply high-rate mitigation as soon as speed exceeds normal 2x usage.
const HIGH_RATE_THRESHOLD = 2.01;
const PLAY_FALLBACK_CLICK_COOLDOWN_MS = 4000;
const PLAY_RETRY_DELAY_MS = 1200;
const RATECHANGE_REAPPLY_COOLDOWN_MS = 350;
// Maximum milliseconds between our rate write and the ratechange event
// dispatch for us to consider them causally linked.  The Chaoxing player's
// ratechange→pause call happens <2 ms after we write the rate; 100 ms gives
// ample headroom while staying well clear of any user-initiated pause.
const RATE_CHANGE_SUPPRESS_WINDOW_MS = 100;
// Maximum milliseconds after a likely user interaction during which pause()
// is treated as user-intended and therefore allowed.
const USER_PAUSE_GRACE_WINDOW_MS = 900;
// Data attribute used to signal from the content-script world to the
// page-context injection that we have just written the playback rate.
const RATE_TS_ATTR = 'data-cx-rate-ts';
// Data attribute used to communicate the desired playback rate to the
// page-context rate-enforcer so it can redirect third-party writes.
const RATE_DESIRED_ATTR = 'data-cx-desired-rate';

// Selectors used in the Chaoxing ananas video player.
const SEL = {
  VIDEO: 'video',
  PANEL_ROOT: '#chaoxing-plus-panel',
  // In-video quiz overlay (章节测验 pop-up)
  QUIZ_OVERLAY: '.qc_bind',
  QUIZ_OPTION: '.answerItem',
  QUIZ_SUBMIT: '#submitBtn, .submitBtn, [id*="submit"]',
  // Play buttons – try the big overlay button first, then the control-bar icon.
  PLAY_BTN: '.vjs-big-play-button, .vjs-play-control, .ans-play-btn, [class*="bigPlayBtn"]',
};

export class VideoManager {
  private settings: Settings;
  private video: HTMLVideoElement | null = null;
  private quizCheckInterval: ReturnType<typeof setInterval> | null = null;
  private speedGuardInterval: ReturnType<typeof setInterval> | null = null;
  private playGuardInterval: ReturnType<typeof setInterval> | null = null;
  private onComplete: (() => void) | null = null;
  /** The playback rate we continuously enforce. */
  private desiredRate: number;
  private savedVolumeBeforeMute = 1;
  private highRatePatchInjected = false;
  private rateChangeGuardInjected = false;
  private pauseGuardInjected = false;
  private rateEnforcerInjected = false;
  private videoJsRateBypassInjected = false;
  private pageHookBridgeRequested = false;
  private lastPlayFallbackClickTimestamp = 0;
  private isApplyingRateInternally = false;
  private lastRateApplyTimestamp = 0;

  constructor(settings: Settings) {
    this.settings = settings;
    this.desiredRate = settings.playbackRate;
  }

  /** Update settings at runtime (called when popup saves new config). */
  updateSettings(settings: Settings): void {
    this.settings = settings;
    this.desiredRate = settings.playbackRate;
    if (this.video) {
      this.applyVideoSettings(this.video);
    }
  }

  /**
   * Begin watching the page for a video element.
   * @param onComplete - called once when the video task is marked complete.
   */
  start(onComplete?: () => void): void {
    if (onComplete) this.onComplete = onComplete;
    // Inject page-world interceptors as early as possible — before the first
    // Chaoxing timer fires (~1200 ms after player init).  Both calls are
    // idempotent so the MutationObserver below cannot double-inject.
    this.injectRateChangeGuard();
    this.injectPauseGuard();
    this.injectRateEnforcer();
    this.injectVideoJsRateBypass();
    this.findAndSetupVideo();

    // Also watch for dynamically inserted videos (SPAs swap content).
    const observer = new MutationObserver(() => {
      if (this.video && document.contains(this.video)) return;
      this.findAndSetupVideo();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  stop(): void {
    if (this.quizCheckInterval) clearInterval(this.quizCheckInterval);
    this.stopPlaybackGuards();
    this.quizCheckInterval = null;
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private findAndSetupVideo(): void {
    const video = document.querySelector<HTMLVideoElement>(SEL.VIDEO);
    if (!video || video === this.video) return;
    this.stopPlaybackGuards();
    this.video = video;
    logger.info('检测到视频元素，初始化视频控制…');
    this.applyVideoSettings(video);
    this.attachVideoListeners(video);
    this.startQuizGuard();
    this.startSpeedGuard(video);
    this.startPlayGuard(video);
  }

  private applyVideoSettings(video: HTMLVideoElement): void {
    if (this.settings.muteVideo) {
      if (!video.muted && video.volume > 0) {
        this.savedVolumeBeforeMute = video.volume;
      }
      video.muted = true;
    } else {
      video.muted = false;
      if (video.volume === 0) {
        video.volume = this.savedVolumeBeforeMute > 0 ? this.savedVolumeBeforeMute : 1;
      }
    }
    this.applyPlaybackRate(video, this.settings.playbackRate);
    if (this.settings.autoPlay) {
      this.tryPlay(video);
    }
  }

  private applyPlaybackRate(video: HTMLVideoElement, rate: number): void {
    this.desiredRate = rate;
    this.applyNativeRate(video, rate);
  }

  private ensurePageHookBridge(): void {
    if (this.pageHookBridgeRequested) return;
    this.pageHookBridgeRequested = true;
    const id = 'cx-plus-page-hooks-bridge';
    if (document.getElementById(id)) return;
    const script = document.createElement('script');
    script.id = id;
    script.src = chrome.runtime.getURL('page-hooks.js');
    script.async = false;
    (document.head || document.documentElement).appendChild(script);
  }

  private dispatchPageHook(type: string, payload?: Record<string, unknown>): void {
    this.ensurePageHookBridge();
    const emit = () => {
      document.dispatchEvent(new CustomEvent('cx-plus:page-hook', {
        detail: { type, payload: payload ?? {} },
      }));
    };
    // Bridge script may not be ready immediately after <script src> append.
    emit();
    setTimeout(emit, 50);
    setTimeout(emit, 300);
  }

  /**
   * Inject a small page-context patch inspired by OCSJS:
   * patch seekBarControl so drag-log storms are rate-limited.
   * This mirrors OCSJS' strategy for the "一直转圈/看似加载中" stuck state
   * that can occur at higher playback rates.
   */
  private injectHighRatePatch(): void {
    if (this.highRatePatchInjected) return;
    this.highRatePatchInjected = true;
    this.dispatchPageHook('injectHighRatePatch', {
      dragResetWindowMs: DRAG_RESET_WINDOW_MS,
      dragStormThreshold: DRAG_STORM_THRESHOLD,
      dragStormResetPoint: DRAG_STORM_RESET_POINT,
    });
  }

  /**
   * Inject a page-context script that intercepts `ratechange` events at the
   * capture phase and stops them from reaching the Chaoxing player when they
   * originate from our own rate writes.
   *
   * Root cause (Trace-20260321T231710): our speedGuard writes `playbackRate`
   * every 1200 ms via the native setter → `ratechange` fires → the Chaoxing
   * player's bubble-phase ratechange handler calls `video.pause()` → our pause
   * listener resumes the video → 1200 ms later the loop repeats.
   *
   * Fix: just before each native setter call we stamp a timestamp on the video
   * element (`data-cx-rate-ts`).  The capture-phase listener reads that stamp;
   * if the ratechange arrived within RATE_CHANGE_SUPPRESS_WINDOW_MS it calls
   * `stopImmediatePropagation()` so the player's handler never runs.
   */
  private injectRateChangeGuard(): void {
    if (this.rateChangeGuardInjected) return;
    this.rateChangeGuardInjected = true;
    this.dispatchPageHook('injectRateChangeGuard', {
      rateTsAttr: RATE_TS_ATTR,
      suppressWindowMs: RATE_CHANGE_SUPPRESS_WINDOW_MS,
    });
  }

  /**
   * Inject a page-context pause blocker.
   *
   * Strategy (close to "只能播放不能暂停"):
   * - when desiredRate > 1, block ALL programmatic pause() calls;
   * - only allow pause() during a short grace window after likely user actions
   *   (click / touch / keyboard), or when media already ended.
   *
   * This avoids play/pause tug-of-war loops and targets the real source:
   * repeated internal `video.pause()` calls from Chaoxing scripts.
   */
  private injectPauseGuard(): void {
    if (this.pauseGuardInjected) return;
    this.pauseGuardInjected = true;
    this.dispatchPageHook('injectPauseGuard', {
      rateDesiredAttr: RATE_DESIRED_ATTR,
      userPauseGraceWindowMs: USER_PAUSE_GRACE_WINDOW_MS,
    });
  }

  /**
   * Inject a page-context script that overrides `HTMLMediaElement.prototype.playbackRate`
   * setter so ALL rate writes — including those from the Chaoxing player's own
   * internal timers — are intercepted.
   *
   * Root cause (Trace-20260321T231710): the Chaoxing player has three repeating
   * timers (IDs 21, 22, 23 in its obfuscated script) that fire every ~1200 ms
   * and write `playbackRate = 1.0`, resetting the rate back to normal speed.
   * Each such write triggers a `ratechange` event.  The existing
   * `injectRateChangeGuard()` only suppresses events stamped by OUR content
   * script, so Chaoxing's own timer-triggered ratechanges slip through →
   * Chaoxing's handler calls `pause()` → ~800 ms pause/resume loop.
   *
   * Fix: override the `playbackRate` setter in the page-context world so that:
   *   1. Any write that would move the rate away from our desired value is silently
   *      redirected to the desired rate.
   *   2. Every write (redirected or not) stamps `data-cx-rate-ts` so the
   *      ratechange guard can suppress the resulting event.
   *   3. In steady state the rate never actually changes → no `ratechange` fires
   *      at all → the Chaoxing handler never sees it → no spurious `pause()`.
   *
   * Three previous failure modes that this revision addresses:
   *   A. The earlier version captured `nativeSetter` from the CURRENT prototype,
   *      which may already be Chaoxing's own override (Chaoxing loads before our
   *      content script at `document_idle`).  Using a fresh about:blank iframe
   *      guarantees we get the TRUE browser-native setter regardless of what the
   *      Chaoxing player has done to `HTMLMediaElement.prototype`.
   *   B. `configurable: true` let Chaoxing re-override the property descriptor
   *      after our enforcer ran.  We now use `configurable: false`.
   *   C. The enforcer was only injected after the video element was found.  It
   *      is now injected at `start()` time so it is in place before the first
   *      Chaoxing timer fires (~1200 ms after player init).
   *
   * Additionally we install an own-property descriptor on each <video> element
   * (via `applyToVideoElement`) so that even a prototype-level reset by Chaoxing
   * cannot bypass our intercept — own properties always shadow prototype ones.
   *
   * The content script's own `NATIVE_RATE_DESCRIPTOR?.set` (captured before this
   * injection in Chrome's isolated-world heap) is the true native setter and
   * bypasses this override entirely.
   */
  private injectRateEnforcer(): void {
    if (this.rateEnforcerInjected) return;
    this.rateEnforcerInjected = true;
    this.dispatchPageHook('injectRateEnforcer', {
      rateTsAttr: RATE_TS_ATTR,
      rateDesiredAttr: RATE_DESIRED_ATTR,
      epsilon: RATE_EPSILON,
    });
  }

  /**
   * Inject an OCSJS-style `ans.VideoJs` override that skips Chaoxing's internal
   * playback-rate restriction bootstrap path ("下面连着一个倍速限制方法").
   *
   * Why needed even with our rate enforcer:
   * - Some Chaoxing variants still install extra rate-limit hooks in the
   *   `ans.VideoJs` constructor. Those hooks can cause unstable rate resets or
   *   repeated pause/resume behavior under high playback speeds.
   * - OCSJS addresses this by overriding `ans.VideoJs` and reusing the original
   *   constructor body minus the speed-limit section. We mirror that strategy.
   */
  private injectVideoJsRateBypass(): void {
    if (this.videoJsRateBypassInjected) return;
    this.videoJsRateBypassInjected = true;
    this.dispatchPageHook('injectVideoJsRateBypass');
  }

  /**
   * Attempt to play the video using the native `play()` to bypass any
   * overriding by the Chaoxing player.  Falls back to clicking the player's
   * play button when the promise rejects (browser autoplay policy or player
   * not yet ready).  Retries a few times to handle cases where the player
   * pauses the video during its own initialisation.
   */
  private tryPlay(video: HTMLVideoElement, retries = 4): void {
    if (!video.paused) return;

    NATIVE_PLAY.call(video).catch(() => {
      const panelEditing = this.isPanelEditingActive();
      // Throttle fallback synthetic clicks to prevent click/event storms when
      // player/runtime repeatedly rejects play() at >2x.
      const now = Date.now();
      const elapsedSinceFallbackClick = now - this.lastPlayFallbackClickTimestamp;
      if (!panelEditing && elapsedSinceFallbackClick >= PLAY_FALLBACK_CLICK_COOLDOWN_MS) {
        this.lastPlayFallbackClickTimestamp = now;
        // Use native click() for fallback to avoid dispatching our synthetic
        // mousedown/mouseup/click triplet, which can amplify Event churn under
        // repeated play() rejections.
        const playBtn = document.querySelector<HTMLElement>(SEL.PLAY_BTN);
        if (playBtn) {
          playBtn.click();
        } else {
          // If no explicit play button is visible, click the video surface
          // itself (some Chaoxing themes bind click-to-play on media area).
          video.click();
        }
      }
      if (retries <= 1) return;
      const nextRetryDelay = panelEditing
        ? PLAY_RETRY_DELAY_MS
        : elapsedSinceFallbackClick >= PLAY_FALLBACK_CLICK_COOLDOWN_MS
        ? PLAY_RETRY_DELAY_MS
        : PLAY_FALLBACK_CLICK_COOLDOWN_MS - elapsedSinceFallbackClick;
      setTimeout(() => this.tryPlay(video, retries - 1), nextRetryDelay);
    });
  }

  private isPanelEditingActive(): boolean {
    const isEditableInPanel = (doc: Document): boolean => {
      const active = doc.activeElement as HTMLElement | null;
      if (!active) return false;
      const insidePanel = active.closest(SEL.PANEL_ROOT);
      if (!insidePanel) return false;
      const tag = active.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
      return active.isContentEditable;
    };

    if (isEditableInPanel(document)) return true;
    // Video logic may run in nested iframe while panel focus is in top document.
    try {
      if (window.top && window.top !== window && window.top.document) {
        return isEditableInPanel(window.top.document);
      }
    } catch {
      // Cross-origin access denied; ignore and fall back to current document only.
    }
    return false;
  }

  private attachVideoListeners(video: HTMLVideoElement): void {
    // Guards were already injected in start(); calls here are idempotent no-ops.
    this.injectRateChangeGuard();
    this.injectRateEnforcer();
    // Keep desired rate stable across source reloads / player resets.
    video.addEventListener('ratechange', () => {
      if (this.isApplyingRateInternally) return;
      if (Date.now() - this.lastRateApplyTimestamp < RATECHANGE_REAPPLY_COOLDOWN_MS) return;
      const current = NATIVE_RATE_GETTER?.call(video);
      if (typeof current === 'number' && Math.abs(current - this.desiredRate) > RATE_EPSILON) {
        this.applyNativeRate(video, this.desiredRate);
      }
    });

    // Auto-resume when paused unexpectedly (e.g. after an ad or quiz popup).
    video.addEventListener('pause', () => {
      if (this.settings.autoPlay) {
        setTimeout(() => {
          if (video.paused && !video.ended && !this.isQuizVisible()) {
            this.tryPlay(video);
          }
        }, 800);
      }
    });

    // Fire the completion callback when the video ends.
    video.addEventListener('ended', () => {
      logger.info('视频播放完毕');
      // Give the page a moment to update task-point state before advancing.
      setTimeout(() => {
        // If we are inside a nested iframe (ananas player), we cannot click the
        // task-navigation buttons that live in the parent / study page. Signal
        // the top-level frame to handle advancement instead.
        if (window.self !== window.top) {
          window.top?.postMessage({ type: 'CX_PLUS_TASK_DONE' }, window.location.origin);
        } else {
          this.onComplete?.();
        }
      }, 1500);
    });
  }

  /** Poll for in-video quiz overlays and handle them. */
  private startQuizGuard(): void {
    if (this.quizCheckInterval) return;
    this.quizCheckInterval = setInterval(() => {
      this.handleQuizIfPresent();
    }, 2000);
  }

  /**
   * Periodically re-apply the desired rate via the native setter as a failsafe
   * against any drift (e.g. after a seek or source reload).
   */
  private startSpeedGuard(video: HTMLVideoElement): void {
    if (this.speedGuardInterval) return;
    this.speedGuardInterval = setInterval(() => {
      const current = NATIVE_RATE_GETTER?.call(video);
      if (typeof current !== 'number' || Math.abs(current - this.desiredRate) > RATE_EPSILON) {
        this.applyNativeRate(video, this.desiredRate);
      }
    }, 1200);
  }

  /**
   * Keep auto-play stable when Chaoxing player pauses during initialisation,
   * source switching, or unsupported-rate enforcement.
   */
  private startPlayGuard(video: HTMLVideoElement): void {
    if (this.playGuardInterval) return;
    this.playGuardInterval = setInterval(() => {
      if (!this.settings.autoPlay) return;
      if (!video.paused) return;
      if (video.ended) return;
      if (this.isQuizVisible()) return;
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      this.tryPlay(video, 2);
    }, 1200);
  }

  private stopPlaybackGuards(): void {
    if (this.speedGuardInterval) clearInterval(this.speedGuardInterval);
    if (this.playGuardInterval) clearInterval(this.playGuardInterval);
    this.speedGuardInterval = null;
    this.playGuardInterval = null;
  }

  private applyNativeRate(video: HTMLVideoElement, rate: number): void {
    try {
      if (rate >= HIGH_RATE_THRESHOLD) {
        this.injectHighRatePatch();
      }
      this.isApplyingRateInternally = true;
      // Start cooldown window before writing playbackRate because the write can
      // synchronously trigger a ratechange event in some runtimes.
      this.lastRateApplyTimestamp = Date.now();
      // Stamp the video element so the page-context ratechange guard can
      // identify ratechange events caused by our writes and stop them from
      // reaching the Chaoxing player's handler (which calls pause() in
      // response to every ratechange, causing the ~1200 ms auto-pause loop).
      // Also publish the desired rate so the rate-enforcer can redirect any
      // third-party writes (e.g. Chaoxing's own timer callbacks) back to it.
      video.setAttribute(RATE_DESIRED_ATTR, String(rate));
      video.setAttribute(RATE_TS_ATTR, String(this.lastRateApplyTimestamp));
      NATIVE_RATE_DESCRIPTOR?.set?.call(video, rate);
    } catch (err) {
      // Player transitions can briefly reject writes; guard intervals retry.
      logger.debug('倍速写入被播放器短暂拒绝，稍后重试', err);
    } finally {
      this.isApplyingRateInternally = false;
    }
  }

  private isQuizVisible(): boolean {
    const overlay = document.querySelector(SEL.QUIZ_OVERLAY);
    if (!overlay) return false;
    const style = window.getComputedStyle(overlay);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  private handleQuizIfPresent(): void {
    if (!this.isQuizVisible()) return;

    const strategy = this.settings.videoQuizStrategy;
    logger.info(`检测到视频内弹题，策略: ${strategy}`);

    if (strategy === 'random') {
      this.answerQuizRandomly();
    } else {
      // 'ignore' – just close/dismiss if possible.
      this.dismissQuiz();
    }
  }

  private answerQuizRandomly(): void {
    const options = Array.from(
      document.querySelectorAll<HTMLElement>(SEL.QUIZ_OPTION),
    );
    if (options.length === 0) return;

    const randomOption = options[Math.floor(Math.random() * options.length)];
    simulateClick(randomOption);

    // Submit after a short delay.
    setTimeout(() => {
      const submitBtn = document.querySelector<HTMLElement>(SEL.QUIZ_SUBMIT);
      if (submitBtn) {
        simulateClick(submitBtn);
        logger.info('已随机选择答案并提交弹题');
      }
    }, 600);
  }

  private dismissQuiz(): void {
    // Try clicking a close/dismiss button.
    const closeBtn = document.querySelector<HTMLElement>(
      '.close, .closeBtn, [data-dismiss="modal"], .qc_bind .close',
    );
    if (closeBtn) {
      simulateClick(closeBtn);
      logger.info('已关闭视频弹题');
    }
  }
}

/**
 * Convenience factory.  Instantiates and starts VideoManager for the current page.
 */
export function initVideoAutomation(
  settings: Settings,
  onComplete?: () => void,
): VideoManager {
  const mgr = new VideoManager(settings);
  if (settings.enabled) {
    // Always start so speed/mute settings apply even when autoPlay is off.
    mgr.start(onComplete);
    logger.info(`视频自动化已启动 (倍速: ${settings.playbackRate}x)`);
  }
  return mgr;
}

/**
 * Try to click the "下一个任务" / "Next task" button after a task completes.
 */
export async function advanceToNextTask(): Promise<void> {
  // Different Chaoxing versions use different selectors.
  const candidates = [
    '.ans-next-btn',
    '.nextBtn',
    '.next-task-btn',
    '[data-action="next"]',
    '.job-next',
  ];

  for (const sel of candidates) {
    const btn = document.querySelector<HTMLElement>(sel);
    if (btn && btn.offsetParent !== null) {
      await sleep(800);
      simulateClick(btn);
      logger.info('已点击下一任务按钮');
      return;
    }
  }

  // If no explicit button, try clicking the next uncompleted item in the task list.
  const incompleteItem = document.querySelector<HTMLElement>(
    '.ans-job-icon:not(.icon-finish), .chapter_item:not(.finish)',
  );
  if (incompleteItem) {
    await sleep(800);
    simulateClick(incompleteItem);
    logger.info('已切换到下一未完成任务');
  }
}

/**
 * Wait until the current video task point is marked finished by the page.
 */
export async function waitForVideoTaskComplete(timeoutMs = 120_000): Promise<void> {
  await waitForElement('.ans-job-icon.icon-finish, .job-icon-finish', timeoutMs);
}
