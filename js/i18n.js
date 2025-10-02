// js/i18n.js
// Lightweight i18n helper for KeySearch
(function () {
  // ---- alias（可選）：如果你的 <option value="cn"> 想對應 zh-CN，就在這裡對應 ----
  const ALIASES = { cn: 'zh-CN', tw: 'zh-TW', br: 'pt-BR' };
  const resolveAlias = (code) => (ALIASES[code] || code);

  // ---- locale 正規化與候選 ----
  function normalizeLocale(raw) {
    if (!raw) return 'en';
    const s = String(raw).replace('_', '-').trim();
    const [lang, region] = s.split('-');
    if (!region) return lang.toLowerCase();
    return `${lang.toLowerCase()}-${region.toUpperCase()}`;
  }
  function candidates(locale) {
    const n = normalizeLocale(locale);
    const [lang, region] = n.split('-');
    return region ? [`${lang}-${region}`, lang, 'en'] : [lang, 'en'];
  }

  // ---- 載入工具 ----
  async function fetchJSON(url) {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
    return r.json();
  }
  async function loadLocaleDict(locale) {
    const order = candidates(locale);
    for (const code of order) {
      try {
        const dict = await fetchJSON(`./locales/${code}.json`);
        return { code, dict };
      } catch {}
    }
    try {
      const dict = await fetchJSON('./locales/en.json');
      return { code: 'en', dict };
    } catch {
      return { code: 'en', dict: {} };
    }
  }

  // ---- 同步語言下拉選單（讓顯示值與目前語系一致） ----
  function syncLangSelectors(currentCode) {
    const wanted = normalizeLocale(resolveAlias(currentCode));
    // 這三個選擇器都支援：#lang-select、#pref-lang、以及 data-lang-switcher
    document.querySelectorAll('#lang-select, #pref-lang, select[data-lang-switcher]')
      .forEach(sel => {
        if (!(sel && sel.options && sel.options.length)) return;

        // 先嘗試完全匹配 value
        let match = Array.from(sel.options).find(o => normalizeLocale(resolveAlias(o.value)) === wanted);

        // 次選：同語系（例如 zh 與 zh-TW）
        if (!match) {
          const wantedLang = wanted.split('-')[0];
          match = Array.from(sel.options).find(o => normalizeLocale(resolveAlias(o.value)).split('-')[0] === wantedLang);
        }

        if (match) sel.value = match.value;
      });
  }

  // （可選）幫語言選單綁 change 事件
  function wireLangSelectors() {
    document.querySelectorAll('#lang-select, #pref-lang, select[data-lang-switcher]')
      .forEach(sel => {
        if (sel.__i18n_wired) return;
        sel.__i18n_wired = true;
        sel.addEventListener('change', () => {
          const val = sel.value;
          window.setLang?.(val);
        });
      });
  }

  // ---- i18n 物件 ----
  const I18N = {
    locale: 'en',
    dict: {},
    async load(locale) {
      const { code, dict } = await loadLocaleDict(locale);
      this.locale = code;
      this.dict = dict || {};
      this.apply();
      document.documentElement.setAttribute('lang', code);
      // 選單值跟著目前語言
      syncLangSelectors(code);
      // 確保有綁到 change
      wireLangSelectors();
      window.dispatchEvent(new CustomEvent('ks:i18n-changed', { detail: { locale: code } }));
    },
    t(key) {
      if (!key) return '';
      return (this.dict && Object.prototype.hasOwnProperty.call(this.dict, key))
        ? this.dict[key]
        : key;
    },
    apply(root = document) {
      root.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const attr = el.getAttribute('data-i18n-attr');
        const asHTML = el.hasAttribute('data-i18n-html');
        const txt = this.t(key);
        if (attr) el.setAttribute(attr, txt);
        else if (asHTML) el.innerHTML = txt;
        else el.textContent = txt;
      });
      root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.setAttribute('placeholder', this.t(key));
      });
    }
  };

  // ---- 初次載入：使用者偏好 > 系統語言 > 英文 ----
  const ready = (async () => {
    let prefs = {};
    try { prefs = JSON.parse(localStorage.getItem('ks.prefs') || '{}'); } catch {}
    const sys = normalizeLocale(resolveAlias(navigator.language || 'en'));
    const initial = prefs.lang ? normalizeLocale(resolveAlias(prefs.lang)) : sys;
    await I18N.load(initial);
    return I18N.locale;
  })();

  // ---- 對外 API ----
  window.i18n = I18N;
  window.i18nReady = ready;

  window.setLang = async function (next) {
    const code = normalizeLocale(resolveAlias(next));
    await I18N.load(code);
    try {
      const prefs = JSON.parse(localStorage.getItem('ks.prefs') || '{}');
      prefs.lang = I18N.locale;
      localStorage.setItem('ks.prefs', JSON.stringify(prefs));
    } catch {}
    window.KS?.rerender?.();
  };
})();
