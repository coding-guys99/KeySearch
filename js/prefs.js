// prefs.js — Preferences modal: load/save/apply + i18n switching
(function () {
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // ====== 語言代碼正規化 ======
  function normalizeLang(l) {
  if (!l) return 'en';
  let s = String(l).replace('_','-').toLowerCase(); // zh_TW -> zh-tw
  if (s.startsWith('zh')) return 'zh-TW';           // 你的策略：所有中文都用 zh-TW
  const [lang, region] = s.split('-');              // 支援 like "bm-MY"
  return region ? `${lang}-${region.toUpperCase()}` : lang; // bm -> bm, bm-my -> bm-MY
}


  // ====== Defaults / Storage ======
  function getDefaultPrefs() {
    return {
      autoBackup: false,
      workspace: 'C:\\KeySearch\\KeySearchData',
      backupInterval: 'manual',

      theme: 'dark',        // dark | light | system
      fontsize: 14,         // 12..22
      layout: 'cards',      // cards | list
      lang: normalizeLang(navigator.language || 'en'),

      sort: 'updatedAt_desc',
      fuzzy: false,
      max: 500,

      dbPath: '',
      beta: false,
      devtools: false
    };
  }

  function readPrefs() {
    try {
      const raw = localStorage.getItem('ks.prefs');
      if (!raw) return getDefaultPrefs();
      return Object.assign(getDefaultPrefs(), JSON.parse(raw));
    } catch {
      return getDefaultPrefs();
    }
  }

  function writePrefs(prefs) {
    localStorage.setItem('ks.prefs', JSON.stringify(prefs));
  }

  // ====== Modal open/close ======
  const modal = $('#prefs-modal');
  const tabs  = $$('.ks-tab', modal);
  const panels= $$('.ks-panel', modal);

  function openPrefs() {
    loadPrefsIntoForm();
    modal.hidden = false;
    activateTab('general');
  }
  function closePrefs() {
    modal.hidden = true;
  }

  // 綁齒輪 / 選單（Edit→Preferences…）
  $('#ks-gear')?.addEventListener('click', openPrefs);
  $$('#menu-edit button[data-act="prefs"]').forEach(b => b.addEventListener('click', (e) => {
    e.stopPropagation();
    openPrefs();
  }));
  $('#prefs-x')?.addEventListener('click', closePrefs);
  $('#prefs-close')?.addEventListener('click', closePrefs);

  // ====== Tabs ======
  tabs.forEach(t => t.addEventListener('click', () => activateTab(t.dataset.tab)));
  function activateTab(name) {
    tabs.forEach(t => {
      const isActive = t.dataset.tab === name;
      t.classList.toggle('is-active', isActive);
      t.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    panels.forEach(p => p.hidden = (p.dataset.panel !== name));
  }

  // ====== Load → Form ======
  function loadPrefsIntoForm() {
    const p = readPrefs();
    // General
    $('#pref-auto-backup').checked = !!p.autoBackup;
    $('#pref-workspace').value = p.workspace || '';
    $('#pref-backup-interval').value = p.backupInterval || 'manual';

    // Interface
    $('#pref-theme').value = p.theme || 'dark';
    $('#pref-fontsize').value = p.fontsize || 14;
    $('#pref-layout').value = p.layout || 'cards';
    $('#pref-lang').value = normalizeLang(p.lang || (window.i18n?.locale || 'en'));

    // Search
    $('#pref-sort').value = p.sort || 'updatedAt_desc';
    $('#pref-fuzzy').checked = !!p.fuzzy;
    $('#pref-max').value = p.max || 500;

    // Advanced
    $('#pref-db-path').value = p.dbPath || '';
    $('#pref-beta').checked = !!p.beta;
    $('#pref-devtools').checked = !!p.devtools;
  }

  // ====== Save ← Form (apply immediately) ======
  $('#prefs-save')?.addEventListener('click', async () => {
    await savePrefsFromForm();
    closePrefs();
  });

  // Reset all
  $('#prefs-reset')?.addEventListener('click', () => {
    writePrefs(getDefaultPrefs());
    loadPrefsIntoForm();
    applyPrefs(readPrefs());
  });

  // Reset Welcome flag
  $('#prefs-reset-welcome')?.addEventListener('click', () => {
    localStorage.removeItem('ks.onboarded');
    alert('Welcome will show next time you open KeySearch.');
  });

  async function savePrefsFromForm() {
    const p = readPrefs();

    // General
    p.autoBackup     = $('#pref-auto-backup').checked;
    p.workspace      = $('#pref-workspace').value.trim();
    p.backupInterval = $('#pref-backup-interval').value;

    // Interface
    p.theme    = $('#pref-theme').value;
    p.fontsize = parseInt($('#pref-fontsize').value, 10) || 14;
    p.layout   = $('#pref-layout').value;
    p.lang     = normalizeLang($('#pref-lang').value || 'en');

    // Search
    p.sort   = $('#pref-sort').value;
    p.fuzzy  = $('#pref-fuzzy').checked;
    p.max    = parseInt($('#pref-max').value, 10) || 500;

    // Advanced
    p.dbPath   = $('#pref-db-path').value.trim();
    p.beta     = $('#pref-beta').checked;
    p.devtools = $('#pref-devtools').checked;

    writePrefs(p);
    applyPrefs(p);

    // 🔥 語言即時切換
    if (window.i18n && typeof window.i18n.load === 'function') {
      await window.i18n.load(p.lang);  // 等載入完成
    }
    if (typeof window.render === 'function') {
      window.render(); // 讓動態內容（卡片等）也更新
    }
  }

  // ====== Apply prefs to UI ======
  function applyPrefs(p) {
    const topbar = document.getElementById('ks-topbar');

    // Theme
    if (p.theme === 'light') {
      topbar?.classList.add('ks-theme-light'); topbar?.classList.remove('ks-theme-dark');
      document.body.classList.add('ks-theme-light'); document.body.classList.remove('ks-theme-dark');
    } else if (p.theme === 'dark') {
      topbar?.classList.add('ks-theme-dark'); topbar?.classList.remove('ks-theme-light');
      document.body.classList.add('ks-theme-dark'); document.body.classList.remove('ks-theme-light');
    } else {
      const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const dark = isDark ? 'add' : 'remove';
      topbar?.classList[dark]('ks-theme-dark');
      topbar?.classList[isDark ? 'remove' : 'add']('ks-theme-light');
      document.body.classList[dark]('ks-theme-dark');
      document.body.classList[isDark ? 'remove' : 'add']('ks-theme-light');
    }

    // Font size
    document.documentElement.style.setProperty('--app-font-size', (p.fontsize || 14) + 'px');

    // Layout
    const viewSelect = document.getElementById('f-view');
    if (viewSelect) {
      viewSelect.value = p.layout;
      viewSelect.dispatchEvent(new Event('change'));
    } else {
      window.dispatchEvent(new CustomEvent('ks:layout-changed', { detail: { layout: p.layout } }));
    }

    // Default sort
    const sortSelect = document.getElementById('f-sort');
    if (sortSelect) {
      sortSelect.value = p.sort;
      sortSelect.dispatchEvent(new Event('change'));
    } else {
      window.dispatchEvent(new CustomEvent('ks:sort-changed', { detail: { sort: p.sort } }));
    }
  }

  // 初次載入套用偏好
  applyPrefs(readPrefs());

  // ====== 語言切換後需要重新繪製的地方 ======
  window.addEventListener('ks:i18n-changed', () => {
    if (typeof window.render === 'function') window.render();
  });

})();