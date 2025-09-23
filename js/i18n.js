// i18n.js — 補：zh-CN ⇄ cn、zh-TW ⇄ tw 自動回退
(function () {
  const cache = new Map();
  let fallback = null;
  let readyFired = false;

  const ALIAS = {
    en:'en',
    zh:'zh-CN', 'zh-cn':'zh-CN', 'zh_cn':'zh-CN', cn:'zh-CN',
    'zh-tw':'zh-TW','zh_tw':'zh-TW', tw:'zh-TW',
    'pt-br':'pt-BR', br:'pt-BR',
    vi:'vi', viet:'vi', ms:'ms', bm:'ms', th:'th', thai:'th',
    hi:'hi', in:'hi', de:'de', fr:'fr', ja:'ja', es:'es', ru:'ru',
    ar:'ar', ko:'ko', id:'id', mn:'mn'
  };

  function aliasToReal(input) {
    if (!input) return 'en';
    const k = String(input).trim().replace(/_/g,'-').toLowerCase();
    if (ALIAS[k]) return ALIAS[k];
    const m = /^([a-z]{2})(?:-([a-z]{2}))?$/.exec(k);
    if (m) return m[2] ? `${m[1]}-${m[2].toUpperCase()}` : m[1];
    return 'en';
  }

  async function fetchJSON(path) {
    const r = await fetch(path, { cache:'no-store' });
    if (!r.ok) throw new Error(`HTTP 404 ${path}`);
    return r.json();
  }

  // ⭐ 這段是關鍵：依序嘗試多種檔名
  async function loadLocaleDict(real) {
    const candidates = [real];
    const noDash = real.replace(/-/g,'');
    if (noDash !== real) candidates.push(noDash);
    if (/^zh/i.test(real)) {
      if (/cn/i.test(real)) candidates.push('cn');
      if (/tw/i.test(real)) candidates.push('tw');
    }
    for (const name of candidates) {
      try { return await fetchJSON(`./locales/${name}.json`); }
      catch {}
    }
    throw new Error(`No locale file for ${real}`);
  }

  const I18N = {
    locale:'en', dict:{},
    async load(next) {
      const real = aliasToReal(next);
      this.locale = real;

      if (!fallback) {
        try { fallback = await fetchJSON('./locales/en.json'); }
        catch { fallback = {}; }
      }

      if (!cache.has(real)) {
        try { cache.set(real, await loadLocaleDict(real)); }
        catch (e) {
          console.error('[i18n] load failed for', real, e);
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
      window.dispatchEvent(new CustomEvent('ks:i18n-changed',{ detail:{ locale:this.locale }}));

      try {
        const prefs = JSON.parse(localStorage.getItem('ks.prefs')||'{}');
        prefs.lang = this.locale;
        localStorage.setItem('ks.prefs', JSON.stringify(prefs));
      } catch {}
    },
    t(k){ if (!k) return ''; return (this.dict[k] ?? (fallback?.[k] ?? k)); },
    apply(root=document){
      root.querySelectorAll('[data-i18n]').forEach(el=>{
        const key=el.getAttribute('data-i18n');
        const attr=el.getAttribute('data-i18n-attr');
        const asHTML=el.hasAttribute('data-i18n-html');
        const txt=this.t(key);
        if (attr) el.setAttribute(attr, txt);
        else if (asHTML) el.innerHTML = txt;
        else el.textContent = txt;
      });
      root.querySelectorAll('[data-i18n-placeholder]').forEach(el=>{
        el.setAttribute('placeholder', this.t(el.getAttribute('data-i18n-placeholder')));
      });
    }
  };

  window.i18n = I18N;
  window.setLang = (lang)=>I18N.load(lang);
  window.i18nReady = (async ()=>{
    const prefs = JSON.parse(localStorage.getItem('ks.prefs')||'{}');
    await I18N.load(prefs.lang || navigator.language || 'en');
    return I18N.locale;
  })();
})();
