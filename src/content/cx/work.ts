/**
 * Homework / exam auto-answer module.
 *
 * Workflow:
 *   1. Scan the page for question elements.
 *   2. For each question, query the configured question-bank API(s).
 *   3. Fill in the best-matched answer.
 *   4. Optionally submit the work (guarded by a timeout so the user can review).
 *
 * Supported question types:
 *   - Single-choice  (单选题)
 *   - Multiple-choice (多选题)
 *   - True/False      (判断题)
 *   - Fill-in-the-blank (填空题)
 *   - Short answer    (简答题)
 */

import type { Settings, QuestionBankResponse } from '../../shared/types.js';
import { sleep, cleanText, normaliseQuestion, simulateClick } from '../utils/dom.js';
import { logger } from '../utils/logger.js';

// ─── Selectors ────────────────────────────────────────────────────────────────

const SEL = {
  /** Container for each question block. */
  QUESTION: '.questionLi, .quesId, .TiMu, .singleQuesId',
  /** Question stem text. */
  QUESTION_STEM: '.stem_font, .qTitle, .TiMu .ti_k, .fontLabel, .tiMu',
  /** Option labels for choice questions. */
  OPTION: '.answerBg, .answer_p, li[id^="answer"], .optionList li, .choiceItem',
  /** Option text within a label. */
  OPTION_TEXT: '.answer_p, span.answer_font, .stem_font, .fontLabel',
  /** Input for fill-in-the-blank answers. */
  BLANK_INPUT: '.blank input, input[type="text"][id*="blank"], input[type="text"].fillPInput',
  /** Textarea for short-answer questions. */
  SHORT_ANSWER: 'textarea.shortanswerEditor, .shortAnswerTextarea, textarea[id*="Answer"]',
  /** Submit button. */
  SUBMIT_BTN: '#submitBtn, .submitBtn, [id*="submit"]:not([disabled])',
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface Question {
  el: Element;
  stem: string;
  type: 'single' | 'multi' | 'judge' | 'blank' | 'short' | 'unknown';
  options: Array<{ el: HTMLElement; text: string }>;
  blanks: HTMLInputElement[];
  shortAnswer: HTMLTextAreaElement | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function detectQuestionType(el: Element): Question['type'] {
  // Chaoxing stores question types as numeric data-type attributes:
  // 0=single, 1=multi, 2=judge, 3=blank, 4=short
  const numType = el.getAttribute('data-type');
  if (numType === '0') return 'single';
  if (numType === '1') return 'multi';
  if (numType === '2') return 'judge';
  if (numType === '3') return 'blank';
  if (numType === '4') return 'short';

  // Fall back to class/attribute text matching.
  const cls = el.className + ' ' + (el.getAttribute('type') ?? '');
  if (/single|单选/i.test(cls)) return 'single';
  if (/multi|多选/i.test(cls)) return 'multi';
  if (/judge|判断/i.test(cls)) return 'judge';
  const blanks = el.querySelectorAll(SEL.BLANK_INPUT);
  if (blanks.length > 0) return 'blank';
  const sa = el.querySelector(SEL.SHORT_ANSWER);
  if (sa) return 'short';
  return 'unknown';
}

function parseQuestion(el: Element): Question {
  const stemEl = el.querySelector(SEL.QUESTION_STEM);
  const stem = cleanText(stemEl ?? el);

  const optionEls = Array.from(el.querySelectorAll<HTMLElement>(SEL.OPTION));
  const options = optionEls.map((optEl) => ({
    el: optEl,
    text: cleanText(optEl.querySelector(SEL.OPTION_TEXT) ?? optEl),
  }));

  const blanks = Array.from(el.querySelectorAll<HTMLInputElement>(SEL.BLANK_INPUT));
  const shortAnswer = el.querySelector<HTMLTextAreaElement>(SEL.SHORT_ANSWER);

  return {
    el,
    stem,
    type: detectQuestionType(el),
    options,
    blanks,
    shortAnswer,
  };
}

// ─── Question bank query ──────────────────────────────────────────────────────

async function queryQuestionBank(
  question: string,
  bankUrls: string[],
): Promise<string | null> {
  for (const baseUrl of bankUrls) {
    if (!baseUrl.trim()) continue;
    try {
      const controller = new AbortController();
      const timerId = setTimeout(() => controller.abort(), 5_000);
      const url = `${baseUrl.replace(/\/$/, '')}?question=${encodeURIComponent(question)}`;
      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timerId);
      if (!resp.ok) continue;
      const json = (await resp.json()) as QuestionBankResponse;
      if (json.code === 1 && json.data?.length > 0) {
        const answer = json.data[0].answer;
        if (answer) return answer;
      }
    } catch {
      // Network error or timeout – try next URL.
    }
  }
  return null;
}

// ─── Answer filling ───────────────────────────────────────────────────────────

/**
 * Compare a bank answer string with an option's text, returning true when
 * the option should be selected.
 */
function optionMatches(optionText: string, answer: string): boolean {
  const norm = (s: string) => normaliseQuestion(s.toLowerCase());
  const aText = norm(optionText);
  const aAnswer = norm(answer);

  // Direct inclusion.
  if (aAnswer.includes(aText) || aText.includes(aAnswer)) return true;

  // Single-letter match (A / B / C / D).
  if (/^[a-d]$/.test(aAnswer) && aText.startsWith(aAnswer)) return true;

  return false;
}

async function fillSingleChoice(q: Question, answer: string): Promise<void> {
  const matched = q.options.find((o) => optionMatches(o.text, answer));
  if (matched) {
    simulateClick(matched.el);
  } else if (q.options.length > 0) {
    // Fall back to first option to avoid leaving blank.
    simulateClick(q.options[0].el);
    logger.warn(`未匹配选项，已选第一项 (题干: ${q.stem.slice(0, 30)})`);
  }
}

async function fillMultiChoice(q: Question, answer: string): Promise<void> {
  // answer may be like "AB", "A,B,C" or "选项A;选项B".
  const letters = answer.match(/[A-D]/gi)?.map((l) => l.toUpperCase()) ?? [];
  const parts = answer.split(/[,，；;]+/);

  for (const option of q.options) {
    const optText = option.text.toUpperCase();
    const shouldSelect =
      letters.some((l) => optText.startsWith(l)) ||
      parts.some((p) => optionMatches(option.text, p.trim()));

    if (shouldSelect) {
      simulateClick(option.el);
      await sleep(150);
    }
  }
}

async function fillJudge(q: Question, answer: string): Promise<void> {
  const isTrue = /true|正确|对|是|√/i.test(answer);
  const target = isTrue ? q.options[0] : q.options[1];
  if (target) simulateClick(target.el);
}

function setNativeInputValue(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  // React / Vue controlled inputs need the native setter to fire events.
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(input),
    'value',
  )?.set;
  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    input.value = value;
  }
}

async function fillBlanks(q: Question, answer: string): Promise<void> {
  // Multiple blanks may be separated by "#" in some bank responses.
  const parts = answer.split(/#|【|】/).filter(Boolean);
  q.blanks.forEach((blank, i) => {
    setNativeInputValue(blank, parts[i] ?? parts[0] ?? answer);
  });
}

async function fillShortAnswer(q: Question, answer: string): Promise<void> {
  if (q.shortAnswer) {
    setNativeInputValue(q.shortAnswer, answer);
  }
}

// ─── Main class ───────────────────────────────────────────────────────────────

export class WorkManager {
  private settings: Settings;

  constructor(settings: Settings) {
    this.settings = settings;
  }

  updateSettings(settings: Settings): void {
    this.settings = settings;
  }

  async run(): Promise<void> {
    if (!this.settings.autoAnswer) return;

    const bankUrls = this.settings.questionBankUrls
      .split(/\n|,/)
      .map((u) => u.trim())
      .filter(Boolean);

    const questionEls = Array.from(document.querySelectorAll(SEL.QUESTION));
    if (questionEls.length === 0) {
      logger.warn('未检测到题目，请确认当前页面是作业/考试页面');
      return;
    }

    logger.info(`检测到 ${questionEls.length} 道题目，开始自动答题…`);

    for (const el of questionEls) {
      const q = parseQuestion(el);
      if (!q.stem) continue;

      const answer = bankUrls.length > 0
        ? await queryQuestionBank(q.stem, bankUrls)
        : null;

      if (answer) {
        logger.info(`答案命中: ${q.stem.slice(0, 25)}… → ${answer.slice(0, 30)}`);
        switch (q.type) {
          case 'single': await fillSingleChoice(q, answer); break;
          case 'multi':  await fillMultiChoice(q, answer);  break;
          case 'judge':  await fillJudge(q, answer);        break;
          case 'blank':  await fillBlanks(q, answer);       break;
          case 'short':  await fillShortAnswer(q, answer);  break;
          default:       break;
        }
      } else {
        logger.warn(`未找到答案: ${q.stem.slice(0, 40)}…`);
      }

      await sleep(this.settings.answerDelayMs);
    }

    logger.info('自动答题完成，请检查答案后手动提交');
  }
}

/**
 * Convenience factory.
 */
export function initWorkAutomation(settings: Settings): WorkManager {
  const mgr = new WorkManager(settings);
  if (settings.enabled && settings.autoAnswer) {
    // Run after a short delay to ensure the page has fully loaded.
    sleep(2_000).then(() => mgr.run());
    logger.info('作业/考试自动答题已启动');
  }
  return mgr;
}
