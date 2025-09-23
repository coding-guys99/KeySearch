// i18n.js — 容錯載入：zh-CN ⇄ cn, zh-TW ⇄ tw 自動回退
(function () {
  const cache = new Map();
  let fallback = null;
  let readyFired = false;

  // 你可按需擴充；右邊字串是「首選檔名」
  const ALIAS = {
    en: 'en',
    // 中文：若只有 zh，預設簡中
    zh: 'zh-CN',
    'zh-cn': 'zh-CN', 'zh_cn': 'zh-CN', cn: 'zh-CN',
    'zh-tw': 'zh-TW', 'zh_tw': 'zh-TW', tw: 'zh-TW',
    // 其他常見
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
    const m = /^([a-z]{2})(?:-([a-z]{2}))?$/.exec(k);
    if (m) {
      const lang = m[1], region = m[2];
      return region ? `${lang}-${region.toUpperCase()}` : lang;
    }
    return 'en';
  }

  async function fetchJSON(path) {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${path}`);
    return res.json();
  }

  // 嘗試多種檔名：real → 去 dash（zh-CN→zhCN）→ 特例 cn/tw
  async function tryLoadLocaleFile(real) {
    const tried = new Set();

    const candidates = [];
    // 1) 首選（如 zh-CN）
    candidates.push(real);
    // 2) 去掉 dash（zh-CN → zhCN）——有些人會這樣命名
    const noDash = real.replace(/-/g, '');
    if (noDash !== real) candidates.push(noDash);
    // 3) 特例：中文常見短碼
    if (/^zh/i.test(real)) {
      if (/cn/i.test(real)) candidates.push('cn');
      if (/tw/i.test(real)) candidates.push('tw');
    }

    for (const name of candidates) {
      const key = name.toLowerCase();
      if (tried.has(key)) continue;
      tried.add(key);
      try {
        return await fetchJSON(`./locales/${name}.json`);
      } catch (e) {
        // console.warn(`[i18n] try ${name}.json failed`, e);
      }
    }
    throw new Error(`No locale file found for ${real}`);
  }

  const I18N = {
    locale: 'en',
    dict: {},
    async load(nextLocaleOrAlias) {
      const real = aliasToReal(nextLocaleOrAlias);
      this.locale = real;

      if (!fallback) {
        try { fallback = await fetchJSON('./locales/en.json'); }
        catch (e) { console.error('[i18n] load en.json failed', e); fallback = {}; }
      }

      if (!cache.has(real)) {
        try {
          const dict = await tryLoadLocaleFile(real);
          cache.set(real, dict);
        } catch (e) {
          console.error(`[i18n] Failed to load ${real} (tried variants)`, e);
          this.locale = 'en';
          cache.set('en', fallback);
        }
      }

      this.dict = cache.get(this.locale) || fallback;
      this.apply();
      document.documentElement.setAttribute('lang', this.locale);

      if (!readyFired) {
        readyFired = true;
        window.dispatchEvent(new Event('i18n:ready'));
      }
      window.dispatchEvent(new CustomEvent('ks:i18n-changed', { detail: { locale: this.locale } }));

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

  window.i18n = I18N;
  window.setLang = (lang) => I18N.load(lang);
  window.i18nReady = (async () => {
    const prefs = JSON.parse(localStorage.getItem('ks.prefs') || '{}');
    const initial = prefs.lang || navigator.language || 'en';
    await I18N.load(initial);
    return I18N.locale;
  })();
})();
