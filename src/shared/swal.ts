let pageSwalReadyPromise: Promise<void> | null = null;

function ensurePageSwalReady(): Promise<void> {
  if (pageSwalReadyPromise) return pageSwalReadyPromise;

  pageSwalReadyPromise = new Promise((resolve) => {
    const root = document.head || document.documentElement;
    const cssHref = chrome.runtime.getURL('vendor/sweetalert2.min.css');
    const jsSrc = chrome.runtime.getURL('vendor/sweetalert2.all.min.js');
    const bridgeSrc = chrome.runtime.getURL('vendor/swal-bridge.js');
    const existingCss = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .some((link) => (link as HTMLLinkElement).href === cssHref);
    if (!existingCss) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = cssHref;
      root.appendChild(css);
    }

    const existingBridge = Array.from(document.querySelectorAll('script[src]'))
      .some((script) => (script as HTMLScriptElement).src === bridgeSrc);
    if (!existingBridge) {
      const bridge = document.createElement('script');
      bridge.src = bridgeSrc;
      bridge.async = false;
      root.appendChild(bridge);
    }

    const existingJs = Array.from(document.querySelectorAll('script[src]'))
      .some((script) => (script as HTMLScriptElement).src === jsSrc);
    if (!existingJs) {
      const js = document.createElement('script');
      js.src = jsSrc;
      js.async = false;
      js.addEventListener('load', () => resolve(), { once: true });
      js.addEventListener('error', () => resolve(), { once: true });
      root.appendChild(js);
      return;
    }

    resolve();
  });

  return pageSwalReadyPromise;
}

export async function showSpeedWarningSwal(): Promise<void> {
  await ensurePageSwalReady();
  document.dispatchEvent(new CustomEvent('cx-plus:swal-fire', {
    detail: {
      icon: 'warning',
      title: '高倍速风险提示',
      html: '⚠️高倍速可能导致学习记录清空/回退<br/>⚠️超星后台可以看到学习时长，请谨慎设置<br/>⚠️如已清空/回退，请降低倍速至1-2倍',
      confirmButtonText: '我知道了',
    },
  }));
}
