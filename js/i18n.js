// i18n.js — robust + attr/html support + locale normalize
(function(){
  const cache = new Map(); // { 'en': {...}, 'zh-TW': {...} , 'bm': {...} }
  let fallback = null;

  // --- locale 正規化：zh_TW/zh-tw -> zh-TW，其它一律 en/原樣 ---
  function normalizeLocale(raw) {
  if (!raw) return 'en';
  let s = String(raw).replace('_','-').toLowerCase();
  if (s.startsWith('zh')) return 'zh-TW';
  const [lang, region] = s.split('-');
  return region ? `${lang}-${region.toUpperCase()}` : lang;
}


  function safeFetchJSON(url){
    return fetch(url, { cache: 'no-store' })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
        return r.json();
      });
  }

  const I18N = {
    locale: 'en',
    dict: {},
    async load(localeRaw){
      const locale = normalizeLocale(localeRaw);
      this.locale = locale;

      // 先載 fallback（en）
      if (!fallback){
        try {
          fallback = await safeFetchJSON('./locales/en.json');
        } catch (err){
          console.error('[i18n] Failed to load fallback en.json:', err);
          fallback = {};
        }
      }

      // 載目標語系
      if (!cache.has(locale)){
        try {
          const d = await safeFetchJSON(`./locales/${locale}.json`);
          cache.set(locale, d);
        } catch (err){
          console.error(`[i18n] Failed to load ${locale}.json:`, err);
          this.locale = 'en';
          cache.set('en', fallback);
        }
      }

      this.dict = cache.get(this.locale) || fallback || {};
      this.apply();
      window.dispatchEvent(new CustomEvent('ks:i18n-changed', { detail:{ locale: this.locale }}));
    },
    t(key){
      if (!key) return '';
      if (this.dict && key in this.dict) return this.dict[key];
      if (fallback && key in fallback) return fallback[key];
      return key; // 沒翻就顯示 key（便於找漏字）
    },
    apply(root=document){
      // 1) data-i18n + 可選 data-i18n-attr 或 data-i18n-html
      root.querySelectorAll('[data-i18n]').forEach(el=>{
        const key  = el.getAttribute('data-i18n');
        const attr = el.getAttribute('data-i18n-attr'); // e.g. placeholder/title
        const asHTML = el.hasAttribute('data-i18n-html'); // 需要保留 <b> 等標籤
        const txt  = this.t(key);

        if (attr) {
          el.setAttribute(attr, txt);
        } else if (asHTML) {
          el.innerHTML = txt; // 你信任自己的字典來源
        } else {
          el.textContent = txt;
        }
      });

      // 2) 快捷：data-i18n-placeholder（等同 data-i18n + data-i18n-attr="placeholder"）
      root.querySelectorAll('[data-i18n-placeholder]').forEach(el=>{
        const key = el.getAttribute('data-i18n-placeholder');
        el.setAttribute('placeholder', this.t(key));
      });
    }
  };

  // 全域暴露 & ready promise
  const ready = (async () => {
    const prefs = JSON.parse(localStorage.getItem('ks.prefs') || '{}');
    let lang = normalizeLocale(prefs.lang || (navigator.language || 'en'));
    await I18N.load(lang);
    return I18N.locale;
  })();

  window.i18n = I18N;
  window.i18nReady = ready;
})();
