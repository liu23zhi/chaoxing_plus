import type { Settings } from './types.js';

/** Chrome storage key for persisted settings. */
export const STORAGE_KEY = 'chaoxing_plus_settings';

/** Default extension settings. */
export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  autoPlay: true,
  playbackRate: 1.25,
  muteVideo: false,
  autoNextTask: true,
  videoQuizStrategy: 'random',
  autoStudyDoc: true,
  autoAnswer: false,
  answerDelayMs: 1500,
  questionBankUrls: '',
};

/** Chaoxing URL patterns used to identify page types. */
export const URL_PATTERNS = {
  /** Course study page (contains task list + content iframe). */
  STUDY_PAGE: /chaoxing\.com\/mycourse\/studentstudy/,
  /** New-version study page. */
  STUDY_PAGE_V2: /chaoxing\.com\/mooc2-ans\/mycourse/,
  /** Knowledge-cards page rendered inside the study iframe. */
  KNOWLEDGE_CARDS: /\/knowledge\/cards/,
  /** In-page reading (book) task point. */
  READING_TASK: /\/readsvr\/book\/mooc/,
  /** Homework submit page (all known URL variants). */
  WORK_PAGE: /(\/work\/(dowork|savetk|dohomeworknew|paper|index)|\/mooc2-ans\/work\/)/i,
  /** Exam pages (all known URL variants). */
  EXAM_PAGE: /(\/exam\/|\/mooc2\/exam\/|\/mooc2-ans\/exam\/|\/exam\/(test|doExam))/i,
  /** Video module iframe (ananas player – matches any ananas path). */
  VIDEO_IFRAME: /\/ananas\/(modules\/(video|audio)|media\/p\/)/,
} as const;

/** Log prefix for all console output from this extension. */
export const LOG_PREFIX = '[超星助手]';
