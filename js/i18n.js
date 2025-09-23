// i18n.js — CN/TW 不打架版
(function () {
  const cache = new Map();
  let fallback = null;
  let readyFired = false;

  // 明確映射（alias → 實檔名）
  const ALIAS = {
    en: 'en',
    // 中文：只有 zh 或未帶區域 → 視為 zh-CN
    zh: 'zh-CN',
    'zh-cn': 'zh-CN', 'zh_cn': 'zh-CN', cn: 'zh-CN',
    'zh-tw': 'zh-TW', 'zh_tw': 'zh-TW', tw: 'zh-TW',
    // 其他
    'pt-br': 'pt-BR', br: 'pt-BR',
    vi: 'vi', viet: 'vi',
    ms: 'ms', bm: 'ms',
    th: 'th', thai: 'th',
    hi: 'hi', in: 'hi',
    de: 'de', fr: 'fr', ja: 'ja', es: 'es', ru: 'ru', ar: 'ar',
    ko: 'ko', id: 'id', mn: 'mn'
  };

  function aliasToReal(input) {
    if (!input) return 'en';
    const k = String(input).trim().replace(/_/g, '-').toLowerCase();
    if (ALIAS[k]) return ALIAS[k];
    // 通用 bcp47：xx 或 xx-YY
    const m = /^([a-z]{2})(?:-([a-z]{2}))?$/.exec(k);
    if (m) {
      const lang = m[1], region = m[2];
      return region ? `${lang}-${region.toUpperCase()}` : lang;
    }
    return 'en';
  }

  async function loadJSON(path) {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${path}`);
    return res.json();
  }

  const I18N = {
    locale: 'en',
    dict: {},
    async load(nextLocaleOrAlias) {
      const real = aliasToReal(nextLocaleOrAlias);
      this.locale = real;

      // 只用英文作 fallback，避免 CN/TW 互相覆蓋
      if (!fallback) {
        try { fallback = await loadJSON('./locales/en.json'); }
        catch (e) { console.error('[i18n] load en.json failed', e); fallback = {}; }
      }

      if (!cache.has(real)) {
        try {
          const dict = await loadJSON(`./locales/${real}.json`);
          cache.set(real, dict);
        } catch (e) {
          console.error(`[i18n] load ${real}.json failed`, e);
          this.locale = 'en';
          cache.set('en', fallback);
        }
      }

      // 僅套用當前語言；查 key 時若沒有再回退到 en
      this.dict = cache.get(this.locale) || fallback;

      this.apply();
      document.documentElement.setAttribute('lang', this.locale);

      // 對外事件
      if (!readyFired) {
        readyFired = true;
        window.dispatchEvent(new Event('i18n:ready'));
      }
      window.dispatchEvent(new CustomEvent('ks:i18n-changed', { detail: { locale: this.locale } }));

      // 記住偏好
      try {
        const prefs = JSON.parse(localStorage.getItem('ks.prefs') || '{}');
        prefs.lang = this.locale;
        localStorage.setItem('ks.prefs', JSON.stringify(prefs));
      } catch {}
    },

    t(key) {
      if (!key) return '';
      if (Object.prototype.hasOwnProperty.call(this.dict, key)) return this.dict[key];
      if (fallback && Object.prototype.hasOwnProperty.call(fallback, key)) return fallback[key];
      return key;
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

  // 全域 API
  window.i18n = I18N;
  window.setLang = (lang) => I18N.load(lang);
  window.i18nReady = (async () => {
    // 初始化：先用偏好，沒有就用瀏覽器語言（但 zh → zh-CN）
    const prefs = JSON.parse(localStorage.getItem('ks.prefs') || '{}');
    const initial = prefs.lang || navigator.language || 'en';
    await I18N.load(initial);
    return I18N.locale;
  })();
})();
