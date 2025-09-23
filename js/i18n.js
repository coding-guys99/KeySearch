// js/i18n.js
// Lightweight i18n helper for KeySearch
// - 初始語系：使用者偏好 > 系統語言 > 英文
// - 字典檔位置：./locales/<code>.json  (例如 en.json, zh-TW.json, zh-CN.json)
// - API：window.i18n.t(key), window.setLang(code), window.i18nReady (Promise)

(function () {
  // ---- locale 正規化與候選 ----
  function normalizeLocale(raw) {
    if (!raw) return 'en';
    const s = String(raw).replace('_', '-').trim();
    const [lang, region] = s.split('-');
    if (!region) return lang.toLowerCase();
    return `${lang.toLowerCase()}-${region.toUpperCase()}`;
  }

  // 依實際檔名產生嘗試順序，例如 zh-TW -> ["zh-TW","zh","en"]
  function candidates(locale) {
    const n = normalizeLocale(locale);
    const [lang, region] = n.split('-');
    return region ? [ `${lang}-${region}`, lang, 'en' ] : [ lang, 'en' ];
  }

  // ---- 載入工具 ----
  async function fetchJSON(url) {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
    return r.json();
  }

  // 依候選順序載入字典；全部失敗則回傳英文或空
  async function loadLocaleDict(locale) {
    const order = candidates(locale);
    for (const code of order) {
      try {
        const dict = await fetchJSON(`./locales/${code}.json`);
        return { code, dict };
      } catch (err) {
        // 靜默嘗試下一個；需要時可 console.debug
      }
    }
    // 最後保底 en
    try {
      const dict = await fetchJSON('./locales/en.json');
      return { code: 'en', dict };
    } catch {
      return { code: 'en', dict: {} };
    }
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
      window.dispatchEvent(new CustomEvent('ks:i18n-changed', { detail: { locale: code } }));
    },
    t(key) {
      if (!key) return '';
      return (this.dict && Object.prototype.hasOwnProperty.call(this.dict, key))
        ? this.dict[key]
        : key; // 沒翻譯就顯示 key，方便找漏字
    },
    apply(root = document) {
      // data-i18n（可搭配 data-i18n-attr 或 data-i18n-html）
      root.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const attr = el.getAttribute('data-i18n-attr');   // e.g. placeholder/title
        const asHTML = el.hasAttribute('data-i18n-html'); // 可信任來源才用 innerHTML
        const txt = this.t(key);
        if (attr) el.setAttribute(attr, txt);
        else if (asHTML) el.innerHTML = txt;
        else el.textContent = txt;
      });

      // 快捷：data-i18n-placeholder
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
    const sys = normalizeLocale(navigator.language || 'en');
    const initial = prefs.lang ? normalizeLocale(prefs.lang) : sys;
    await I18N.load(initial);
    return I18N.locale;
  })();

  // ---- 對外 API ----
  window.i18n = I18N;
  window.i18nReady = ready;

  // 切換語言 + 持久化 + 觸發你的 UI 重繪
  window.setLang = async function (next) {
    const code = normalizeLocale(next);
    await I18N.load(code);
    try {
      const prefs = JSON.parse(localStorage.getItem('ks.prefs') || '{}');
      prefs.lang = I18N.locale;
      localStorage.setItem('ks.prefs', JSON.stringify(prefs));
    } catch {}
    // 讓卡片/清單立即反映（若你在 app.js 暴露了 KS.rerender）
    window.KS?.rerender?.();
  };
})();
