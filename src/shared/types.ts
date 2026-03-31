/** Extension-wide TypeScript types. */

export interface Settings {
  /** Master switch – enables or disables the entire extension. */
  enabled: boolean;

  // ── Video settings ──────────────────────────────────────────────────────
  /** Auto-play videos as soon as they load. */
  autoPlay: boolean;
  /** Video playback rate, e.g. 1.0, 1.25, 1.5, 2.0. */
  playbackRate: number;
  /** Mute video while playing (saves bandwidth). */
  muteVideo: boolean;
  /** Automatically advance to the next task point after the current one completes. */
  autoNextTask: boolean;
  /** Strategy for in-video quiz popups: 'random' selects a random option; 'ignore' dismisses. */
  videoQuizStrategy: 'random' | 'ignore';

  // ── Study settings ───────────────────────────────────────────────────────
  /** Auto-complete PPT / Flash / Book task points. */
  autoStudyDoc: boolean;

  // ── Work (homework / exam) settings ─────────────────────────────────────
  /** Attempt to auto-answer homework and exam questions. */
  autoAnswer: boolean;
  /** Delay in milliseconds between filling each answer (avoids bot detection). */
  answerDelayMs: number;
  /** Comma-separated list of question-bank API URLs to query. */
  questionBankUrls: string;
}

export interface Message {
  type: 'GET_SETTINGS' | 'SAVE_SETTINGS' | 'SETTINGS_UPDATED' | 'TOGGLE_PANEL';
  payload?: Partial<Settings>;
}

export interface QuestionBankResponse {
  code: number;
  data: {
    answer: string;
    question: string;
  }[];
}
