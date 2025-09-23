// i18n.js — robust + alias support + data-i18n / attr / html
(function () {
  const cache = new Map();      // e.g. { 'en': {...}, 'zh-TW': {...} }
  let fallback = null;          // en.json
  let hasDispatchedReady = false;

  // alias → real locale filename base (must match /locales/*.json)
  const ALIAS = {
    // you can extend freely
    en: 'en',
    cn: 'zh-CN',
    tw: 'zh-TW',
    br: 'pt-BR',
    viet: 'vi',
    bm: 'ms',
    thai: 'th',
    in: 'hi',
    // pass-through short codes
    de: 'de', fr:'fr', ja:'ja', es:'es', ru:'ru', ar:'ar', hi:'hi',
    ko:'ko', id:'id', mn:'mn', ms:'ms', vi:'vi', th:'th', pt:'pt'
  };

  function aliasToReal(raw) {
    if (!raw) return 'en';
    const s = String(raw).trim();
    const key = s.replace(/_/g, '-').toLowerCase();
    // exact alias first
    for (const [a, real] of Object.entries(ALIAS)) {
      if (a === key) return real;
    }
    // standard BCP-47 like zh-tw → zh-TW
    if (/^[a-z]{2}(-[a-z]{2})?$/i.test(key)) {
      const [lang, region] = key.split('-');
      return region ? `${lang.toLowerCase()}-${region.toUpperCase()}` : lang.toLowerCase();
    }
    return 'en';
  }

  async function safeFetchJSON(url) {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
    return r.json();
  }

  const I18N = {
    locale: 'en',
    dict: {},
    async load(localeOrAlias) {
      const real = aliasToReal(localeOrAlias);
      this.locale = real;

      // ensure fallback en.json
      if (!fallback) {
        try {
          fallback = await safeFetchJSON('./locales/en.json');
        } catch (err) {
          console.error('[i18n] Failed to load fallback en.json:', err);
          fallback = {};
        }
      }

      if (!cache.has(real)) {
        try {
          const d = await safeFetchJSON(`./locales/${real}.json`);
          cache.set(real, d);
        } catch (err) {
          console.error(`[i18n] Failed to load ${real}.json:`, err);
          this.locale = 'en';
          cache.set('en', fallback);
        }
      }

      this.dict = cache.get(this.locale) || fallback || {};
      this.apply();
      document.documentElement.setAttribute('lang', this.locale);

      if (!hasDispatchedReady) {
        hasDispatchedReady = true;
        window.dispatchEvent(new Event('i18n:ready'));
      }
      window.dispatchEvent(new CustomEvent('ks:i18n-changed', { detail: { locale: this.locale } }));

      // persist preference
      try {
        const prefs = JSON.parse(localStorage.getItem('ks.prefs') || '{}');
        prefs.lang = this.locale;
        localStorage.setItem('ks.prefs', JSON.stringify(prefs));
      } catch {}
    },
    t(key) {
      if (!key) return '';
      if (this.dict && key in this.dict) return this.dict[key];
      if (fallback && key in fallback) return fallback[key];
      return key; // show key when missing
    },
    apply(root = document) {
      // [data-i18n] + optional [data-i18n-attr] or [data-i18n-html]
      root.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const attr = el.getAttribute('data-i18n-attr'); // e.g., placeholder/title
        const asHTML = el.hasAttribute('data-i18n-html');
        const txt = this.t(key);

        if (attr) {
          el.setAttribute(attr, txt);
        } else if (asHTML) {
          el.innerHTML = txt;
        } else {
          el.textContent = txt;
        }
      });

      // shortcut: data-i18n-placeholder
      root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.setAttribute('placeholder', this.t(key));
      });
    }
  };

  // expose to window
  window.i18n = I18N;

  // public API: setLang(aliasOrLocale) → Promise
  window.setLang = async function setLangNext(next) {
    return I18N.load(next);
  };

  // ready promise (initial load)
  window.i18nReady = (async () => {
    const prefs = JSON.parse(localStorage.getItem('ks.prefs') || '{}');
    const initial = prefs.lang || navigator.language || 'en';
    await I18N.load(initial);
    return I18N.locale;
  })();
})();
