/** DOM utility helpers used by content scripts. */

/**
 * Wait for a CSS selector to appear in the DOM.
 * Resolves with the matching element or rejects after `timeoutMs`.
 */
export function waitForElement<T extends Element>(
  selector: string,
  timeoutMs = 10_000,
  root: Document | Element = document,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const el = root.querySelector<T>(selector);
    if (el) {
      resolve(el);
      return;
    }

    const observer = new MutationObserver(() => {
      const found = root.querySelector<T>(selector);
      if (found) {
        observer.disconnect();
        resolve(found);
      }
    });

    observer.observe(
      root instanceof Document ? root.documentElement : root,
      { childList: true, subtree: true },
    );

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`waitForElement timed out: ${selector}`));
    }, timeoutMs);
  });
}

/**
 * Simulate a real mouse click on an element, dispatching MouseEvents so that
 * JavaScript event listeners on the page react as if the user clicked.
 */
export function simulateClick(el: Element): void {
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

/**
 * Sleep for `ms` milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Observe DOM mutations inside `root` and invoke `callback` whenever
 * child nodes change.  Returns a cleanup function that disconnects the
 * observer.
 */
export function observeDOM(
  root: Element | Document,
  callback: MutationCallback,
): () => void {
  const observer = new MutationObserver(callback);
  observer.observe(root instanceof Document ? root.documentElement : root, {
    childList: true,
    subtree: true,
  });
  return () => observer.disconnect();
}

/**
 * Return the text content of an element, trimmed and with redundant
 * whitespace collapsed.
 */
export function cleanText(el: Element | null | undefined): string {
  return (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Normalise a question string for comparison: remove punctuation variants,
 * collapse whitespace, and convert full-width digits to ASCII.
 */
export function normaliseQuestion(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[，。！？；：【】]/g, (c) => {
      const map: Record<string, string> = {
        '，': ',', '。': '.', '！': '!', '？': '?',
        '；': ';', '：': ':', '【': '[', '】': ']',
      };
      return map[c] ?? c;
    })
    .trim();
}
