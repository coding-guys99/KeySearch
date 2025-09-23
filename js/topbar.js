// topbar.js — 最上面就放
if (document.documentElement.classList.contains('is-web')) {
  // 網頁版不綁 Electron 視窗控制與選單
  console.debug('[KS] topbar.js skipped on web');
  // 可以保留右側搜尋的 DOM 綁定（若你需要），否則直接 return
  // return;
}




// topbar.js — robust dropdowns (fix "all buttons not working")
(function () {
  const ready = (fn) =>
    document.readyState === 'loading'
      ? document.addEventListener('DOMContentLoaded', fn)
      : fn();

  ready(() => {
    const $  = (s, r=document) => r.querySelector(s);
    const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

    const topbar   = $('#ks-topbar');
    if (!topbar) return;

    const mainNav  = $('.ks-mainmenus');
    const pathBtn  = $('#ks-path-chip');
    const pathMenu = $('#ks-path-menu');
    const bellBtn  = $('#ks-bell');
    const bellMenu = $('#ks-bell-menu');

    // ---- helpers ----
    function hideAllMenus() {
      $$('.ks-menu').forEach(m => m.hidden = true);
      $$('.ks-menubtn[aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
    }

    function positionMenu(menu, anchorBtn) {
      // show to measure
      menu.hidden = false;
      menu.style.visibility = 'hidden';

      const r  = anchorBtn.getBoundingClientRect();
      const mw = menu.offsetWidth  || 220;
      const mh = menu.offsetHeight || 200;
      const pad = 8;

      let left = Math.round(r.left);
      let top  = Math.round(r.bottom + 6);

      // clamp to viewport
      if (left + mw + pad > window.innerWidth) left = Math.max(pad, window.innerWidth - mw - pad);
      if (top  + mh + pad > window.innerHeight) top  = Math.max(pad, r.top - mh - 6);

      Object.assign(menu.style, {
        position: 'fixed',
        left: left + 'px',
        top:  top  + 'px',
        zIndex: 1000,
        visibility: 'visible'
      });
    }

    function toggleMenu(menu, btn) {
      const willOpen = menu.hidden;
      hideAllMenus();
      if (willOpen) {
        positionMenu(menu, btn);
        btn.setAttribute('aria-expanded', 'true');
      }
    }

    // ---- MAIN MENUS: File/Edit/View/Data/Help ----
    if (mainNav) {
      mainNav.addEventListener('click', (e) => {
        const btn = e.target.closest('.ks-menubtn');
        if (!btn) return;
        e.stopPropagation();               // ✅ 不讓 document 的 click 先關掉它
        const key  = btn.dataset.menu;     // e.g. "file"
        const menu = document.getElementById('menu-' + key);
        if (!menu) return;
        toggleMenu(menu, btn);
      });
    }

    // ---- PATH CHIP ----
    if (pathBtn && pathMenu) {
      pathBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMenu(pathMenu, pathBtn);
      });

      // 點選單內部不關閉，點項目才關閉
      pathMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        const act = e.target.closest('button')?.dataset.act;
        if (!act) return;
        hideAllMenus();
        // TODO: 接 Electron IPC
        // if (act==='open')  window.electronAPI?.openFolder?.($('#ks-path-text')?.textContent||'');
        // if (act==='change') window.electronAPI?.chooseFolder?.().then(...);
        if (act==='copy') {
          const txt = $('#ks-path-text')?.textContent || '';
          navigator.clipboard?.writeText(txt);
        }
      });
    }

    // ---- BELL ----
    if (bellBtn && bellMenu) {
      bellBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMenu(bellMenu, bellBtn);
      });
      bellMenu.addEventListener('click', (e) => e.stopPropagation());
    }

    // ---- Close on outside click / resize / scroll ----
    document.addEventListener('click', (e) => {
      // 若點擊在任何 .ks-menu 內，就不要關
      if (e.target.closest('.ks-menu') || e.target.closest('.ks-menubtn') || e.target.closest('#ks-path-chip') || e.target.closest('#ks-bell')) {
        return;
      }
      hideAllMenus();
    });
    window.addEventListener('resize', hideAllMenus);
    window.addEventListener('scroll', hideAllMenus, { passive: true });

    // ---- Esc 關閉 ----
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideAllMenus(); });

    // ---- Debug（必要時打開）
    // console.log('[topbar] ready');
  });
  
  // 追加：視窗控制（Electron IPC + 瀏覽器回退）
(function () {
  const ready = (fn) =>
    document.readyState === 'loading'
      ? document.addEventListener('DOMContentLoaded', fn)
      : fn();

  ready(() => {
    const $ = (s, r=document) => r.querySelector(s);

    const btnMin   = $('#ks-min');
    const btnMax   = $('#ks-max');
    const btnClose = $('#ks-close');
    const topbar   = $('#ks-topbar');

    // 按鈕點擊
    btnMin?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.electronAPI?.winMinimize) window.electronAPI.winMinimize();
      else alert('Minimize (browser demo)');
    });

    btnMax?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.electronAPI?.winToggleMax) window.electronAPI.winToggleMax();
      else alert('Maximize/Restore (browser demo)');
    });

    btnClose?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.electronAPI?.winClose) window.electronAPI.winClose();
      else alert('Close (browser demo)');
    });

    // 雙擊頂欄 → 最大化/還原（排除點到可互動元素）
    topbar?.addEventListener('dblclick', (e) => {
      const interactive = e.target.closest('.ks-iconbtn, .ks-searchwrap, .ks-chip, .ks-menubtn, .ks-winbtns button');
      if (interactive) return; // 使用者是雙擊到可互動的區域，忽略
      if (window.electronAPI?.winToggleMax) window.electronAPI.winToggleMax();
    });
  });
})();

// 在你的 topbar.js 的 DOMReady 裡，補這段「選單動作對應」
(function(){
  const ready = (fn)=>document.readyState==='loading' ? 
    document.addEventListener('DOMContentLoaded', fn) : fn();
	document.addEventListener('DOMContentLoaded', () => {
  applyTheme(readThemePref());
});

  ready(() => {
    const $  = (s,r=document)=>r.querySelector(s);
    const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));

    // 你原本的 hideAllMenus/toggleMenu 已有就用原本的
    const hideAllMenus = () => {
      $$('.ks-menu').forEach(m => m.hidden = true);
      $$('.ks-menubtn[aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded','false'));
    };

    // 統一處理：根據 data-act 執行對應動作
    function runAction(act){
      switch (act) {
		  case 'welcome': {
  // 手動叫出（方便你測試）
  const path = localStorage.getItem('ks.workspace') || 'C:\\KeySearch\\KeySearchData';
  if (window.Welcome?.open) window.Welcome.open(path);
  else alert('Welcome API not ready');
  return;
}
		  
		  
        // ===== File =====
        case 'new':        return window.KS?.newItem();
        case 'open': {     // 這裡示範「切換工作資料夾」
          return window.electronAPI?.chooseFolder?.().then(p=>{
            if (p) {
              localStorage.setItem('ks.workspace', p);
              // 畫面上 chip 同步
              const t=$('#ks-path-text'); if (t) t.textContent=p;
            }
          });
        }
        case 'export':     return window.KS?.exportCSV?.();  // 你也可改成 exportJSON
        case 'quit':       return window.electronAPI?.winClose?.();

        // ===== Edit =====
        case 'prefs':      return window.KS?.openPrefs?.();

        // ===== View =====
       case 'toggle-theme': {
  // 優先用 app.js 提供的 KS 方法（若存在）
  if (window.KS?.toggleTheme) {
    window.KS.toggleTheme();
  } else {
    // 保險：自己切 class 並存偏好
    const current = readThemePref();
    applyTheme(current === 'light' ? 'dark' : 'light');
  }
  return;
}
        case 'zoom-in':    return window.electronAPI?.zoom?.('in');
        case 'zoom-out':   return window.electronAPI?.zoom?.('out');

        // ===== Data =====
        case 'import':     return window.KS?.importData?.();
        case 'reindex':    return window.KS?.reindex?.();

        // ===== Help =====
        case 'docs':       return window.electronAPI?.openExternal?.('https://example.com/keysearch/docs');
        case 'about':      return window.electronAPI?.showAbout?.();

        default:
          console.warn('[KS][menu] unknown action:', act);
      }
    }

    // 在所有 .ks-menu 上用事件委派
    $$('.ks-menu').forEach(menu=>{
      menu.addEventListener('click', (e)=>{
        const btn = e.target.closest('button'); if (!btn) return;
        const act = btn.dataset.act; if (!act) return;
        e.stopPropagation();
        hideAllMenus();
        runAction(act);
      });
    });
  });
})();


function readThemePref() {
  try {
    const p = JSON.parse(localStorage.getItem('ks.prefs') || '{}');
    return p.theme || 'dark';
  } catch { return 'dark'; }
}

function applyTheme(theme) {
  const body = document.body;
  const topbar = document.getElementById('ks-topbar');

  body.classList.toggle('ks-theme-light', theme === 'light');
  body.classList.toggle('ks-theme-dark',  theme !== 'light');
  topbar?.classList.toggle('ks-theme-light', theme === 'light');
  topbar?.classList.toggle('ks-theme-dark',  theme !== 'light');

  // 存偏好
  const p = JSON.parse(localStorage.getItem('ks.prefs') || '{}');
  p.theme = theme;
  localStorage.setItem('ks.prefs', JSON.stringify(p));
}

// 啟動時套用
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(readThemePref());
});

})();

(function(){
  const ready = (fn)=>document.readyState==='loading'
    ? document.addEventListener('DOMContentLoaded', fn)
    : fn();

  ready(()=>{
    const $  = (s,r=document)=>r.querySelector(s);
    const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));

    // --- About modal helpers ---
    const aboutModal = $('#about-modal');
    function openAbout(){
      if (!aboutModal) return console.warn('[KS] #about-modal not found');
      aboutModal.hidden = false;
      document.body.classList.add('ks-modal-open');
      // 版本號若需動態：讀 package.json 或 localStorage
      const verEl = $('#about-version');
      try {
        const v = localStorage.getItem('ks.version');
        if (verEl && v) verEl.textContent = v;
      } catch {}
    }
    function closeAbout(){
      if (!aboutModal) return;
      aboutModal.hidden = true;
      document.body.classList.remove('ks-modal-open');
    }

    // 關閉鈕、遮罩、Esc
    $('#about-x')    ?.addEventListener('click', (e)=>{ e.stopPropagation(); closeAbout(); });
    $('#about-close')?.addEventListener('click', (e)=>{ e.stopPropagation(); closeAbout(); });
    aboutModal?.addEventListener('click', (e)=>{
      if (e.target === aboutModal) closeAbout();
    });
    document.addEventListener('keydown', (e)=>{
      if (!aboutModal?.hidden && e.key === 'Escape') closeAbout();
    });

    // --- 菜單動作路由（若你已有 runAction，就把 case 'about' 合併進去） ---
    function hideAllMenus(){
      $$('.ks-menu').forEach(m=>m.hidden=true);
      $$('.ks-menubtn[aria-expanded="true"]').forEach(b=>b.setAttribute('aria-expanded','false'));
    }

    function runAction(act){
      switch(act){
        // ... 你其它動作 ...
        case 'about':
          hideAllMenus();
          openAbout();
          return;
      }
    }

    // 把所有下拉選單的 click 交給 runAction
    $$('.ks-menu').forEach(menu=>{
      menu.addEventListener('click', (e)=>{
        const btn = e.target.closest('button');
        if (!btn) return;
        const act = btn.dataset.act;
        if (!act) return;
        e.stopPropagation();
        runAction(act);
      });
    });

    // （可選）直接在 Help > About 的按鈕再加一道保險
    $('#menu-help button[data-act="about"]')?.addEventListener('click', (e)=>{
      e.stopPropagation();
      runAction('about');
    });

    // Debug：點擊時若仍無反應，Console 會看到
    console.debug('[KS] About wiring ready:',
      !!aboutModal,
      !!document.querySelector('#menu-help button[data-act="about"]'));
  });
})();

if (act === 'welcome') {
  const modal = document.getElementById('welcome-modal');
  if (modal) modal.hidden = false;
}