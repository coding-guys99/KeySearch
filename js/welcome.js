// welcome.js — expose API + dispatch ready event
(function () {
  const ready = (fn) =>
    document.readyState === 'loading'
      ? document.addEventListener('DOMContentLoaded', fn)
      : fn();

  ready(() => {
    const modal     = document.getElementById('welcome-modal');
    const btnOpen   = document.getElementById('welcome-open');
    const btnChange = document.getElementById('welcome-change');
    const btnStart  = document.getElementById('welcome-start');
    const dontShow  = document.getElementById('welcome-dontshow');
    const pathEl    = document.getElementById('welcome-path');
    if (!modal) return;

    // —— API
    window.Welcome = {
      open(path) {
        if (path) pathEl.textContent = path;
        modal.hidden = false;
      },
      close() { modal.hidden = true; },
      setPath(p) { pathEl.textContent = p || ''; }
    };

    // —— Buttons
    btnOpen?.addEventListener('click', async () => {
      const ok = await window.electronAPI?.openFolder?.(pathEl.textContent);
      if (!ok) alert('Folder not found: ' + pathEl.textContent);
    });
    btnChange?.addEventListener('click', async () => {
      const p = await window.electronAPI?.chooseFolder?.();
      if (p) { pathEl.textContent = p; localStorage.setItem('ks.workspace', p); }
    });
    btnStart?.addEventListener('click', () => {
      if (dontShow?.checked) localStorage.setItem('ks.dontshow', '1');
      localStorage.setItem('ks.onboarded', '1');
      window.Welcome.close();
    });

    // —— announce ready
    window.__KS_WELCOME_READY__ = true;
    window.dispatchEvent(new Event('ks:welcome-ready'));
  });
})();