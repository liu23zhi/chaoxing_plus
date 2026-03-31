(() => {
  if (window.__CX_PLUS_SWAL_BRIDGE__) return;
  window.__CX_PLUS_SWAL_BRIDGE__ = true;

  const waitForSwalFire = (timeoutMs = 5000) => new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      const Swal = window.Swal;
      if (Swal && typeof Swal.fire === 'function') {
        resolve(Swal);
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        resolve(null);
        return;
      }
      window.setTimeout(check, 50);
    };
    check();
  });

  document.addEventListener('cx-plus:swal-fire', (event) => {
    const detail = event && event.detail ? event.detail : {};
    waitForSwalFire().then((Swal) => {
      if (!Swal) return;
      Swal.fire(detail);
    });
  });
})();
