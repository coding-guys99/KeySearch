import { filterAndSearch, sortItems } from './search.js';

// ===== Welcome 彈窗（僅啟動時） =====
let KS_SESSION_WELCOME_SHOWN = false;

function shouldShowWelcome() {
  // 你的需求：開啟程式就要顯示（除非勾了「Don’t show」）
  return !localStorage.getItem('ks.dontshow');
}

function tryOpenWelcomeOnce() {
  if (KS_SESSION_WELCOME_SHOWN) return true;
  if (window.Welcome && typeof window.Welcome.open === 'function') {
    const path = localStorage.getItem('ks.workspace') || 'C:\\KeySearch\\KeySearchData';
    window.Welcome.open(path);
    KS_SESSION_WELCOME_SHOWN = true;
    return true;
  }
  return false;
}

function maybeShowWelcomeAtStartup() {
  if (!shouldShowWelcome()) return;

  // 先嘗試立即打開
  if (tryOpenWelcomeOnce()) return;

  // 等 welcome.js 就緒事件
  const onReady = () => {
    window.removeEventListener('ks:welcome-ready', onReady);
    tryOpenWelcomeOnce();
  };
  window.addEventListener('ks:welcome-ready', onReady);

  // 再加幾次時間差重試（避免載入競速）
  [0, 200, 600, 1200].forEach(ms => {
    setTimeout(() => tryOpenWelcomeOnce(), ms);
  });
}

// ===== DOM 快捷 =====
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const els = {
  // 支援 #q 與 #ks-search（網頁版）
  q: $('#q') || $('#ks-search'),
  fIdentity: $('#f-identity'),
  fType: $('#f-type'),
  fTag: $('#f-tag'),
  fSort: $('#f-sort'),
  btnClear: $('#btn-clear'),
  stats: $('#stats'),
  cards: $('#cards'),
  // form
  form: $('#item-form'),
  id: $('#id'),
  title: $('#title'),
  identity: $('#identity'),
  type: $('#type'),
  tags: $('#tags'),
  links: $('#links'),
  content: $('#content'),
  btnSave: $('#btn-save'),
  btnReset: $('#btn-reset'),
  btnDelete: $('#btn-delete'),
  // io
  btnExport: $('#btn-export'),
  btnExportCsv: $('#btn-export-csv'),
  importFile: $('#import-file')
};

let cache = [];
let currentSort = 'updatedAt_desc';

// ===== 初始化 =====
async function init() {
  await ensureSeed();
  cache = await dbAll();
  bindEvents();
  render();
  maybeShowWelcomeAtStartup();
}

function bindEvents() {
  // Filters
  [els.q, els.fIdentity, els.fType, els.fTag, els.fSort].forEach(el => {
    if (!el) return;
    el.addEventListener('input', render);
    el.addEventListener('change', render);
  });

  if (els.btnClear) {
    els.btnClear.addEventListener('click', () => {
      if (els.q)         els.q.value = '';
      if (els.fIdentity) els.fIdentity.value = '';
      if (els.fType)     els.fType.value = '';
      if (els.fTag)      els.fTag.value = '';
      if (els.fSort)     els.fSort.value = 'updatedAt_desc';
      render();
    });
  }

  // 表單提交
  if (els.form) els.form.addEventListener('submit', onSave);
  if (els.btnSave) els.btnSave.addEventListener('click', (e) => {
    e.preventDefault();
    onSave(e);
  });

  if (els.btnReset)  els.btnReset.addEventListener('click', () => loadForm(null));
  if (els.btnDelete) els.btnDelete.addEventListener('click', onDelete);

  // Export / Import
  if (els.btnExport)    els.btnExport.addEventListener('click', onExport);
  if (els.btnExportCsv) els.btnExportCsv.addEventListener('click', onExportCSV);
  if (els.importFile)   els.importFile.addEventListener('change', onImport);

  console.debug('[KS] bindEvents:',
    !!els.form, !!els.btnSave, !!els.title, !!els.identity, !!els.type);
}

// ---- helpers: safe getters (avoid null.value errors)
function val(el, def){ return el && typeof el.value !== 'undefined' ? el.value : (def===undefined ? '' : def); }
function valTrim(el, def){ var v = val(el, def); return typeof v === 'string' ? v.trim() : v; }
function checked(el, def){ return el ? !!el.checked : !!def; }

// ---- safe readFilters
function readFilters(){
  return {
    q:        valTrim(els.q, ''),
    identity: valTrim(els.fIdentity, ''),
    type:     valTrim(els.fType, ''),
    tag:      valTrim(els.fTag, ''),
    sort:     valTrim(els.fSort, 'updatedAt_desc')
  };
}

function valNumber(el, def){
  var v = parseFloat(val(el, def));
  return isNaN(v) ? (def || 0) : v;
}
function selectedValues(selectEl){
  if (!selectEl || !selectEl.options) return [];
  var out = [];
  for (var i=0;i<selectEl.options.length;i++){
    var opt = selectEl.options[i];
    if (opt.selected) out.push(opt.value);
  }
  return out;
}

// ===== 渲染 =====
function render() {
  const { q, identity, type, tag, sort } = readFilters();
  let items = filterAndSearch(cache, { q, identity, type, tag });
  items = sortItems(items, sort || 'updatedAt_desc');
  currentSort = sort || 'updatedAt_desc';

  if (els.stats) {
    els.stats.textContent = `${items.length} result${items.length===1?'':'s'}`;
  }
  if (els.cards) {
    els.cards.innerHTML = items.map(renderCard).join('');
    // bind card clicks（防呆）
    $$('.card').forEach(card => {
      const btn = card.querySelector('.edit-btn');
      if (!btn) return;
      btn.addEventListener('click', () => {
        const id = card.getAttribute('data-id');
        const it = cache.find(x => x.id === id);
        loadForm(it || null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }
}

function renderCard(it) {
  const tags = (it.tags||[]).map(t=>`<span class="badge">${escapeHtml(t)}</span>`).join('');
  const links = (it.links||[]).map(u=>{
    const label = u.startsWith('file:///') ? 'Open File' : 'Open Link';
    return `<a href="${escapeAttr(u)}" target="_blank" rel="noopener">${label}</a>`;
  }).join('');
  const snippet = (it.content||'').slice(0,220);
  const updated = it.updatedAt ? new Date(it.updatedAt).toLocaleString() : '';
  const identityPill = it.identity==='Company' ? 'blue' : 'lime';

  return `
    <article class="card" data-id="${escapeAttr(it.id)}">
      <div class="row">
        <div class="title">${escapeHtml(it.title)}</div>
        <button class="edit-btn">Edit</button>
      </div>
      <div class="badges">
        <span class="badge ${it.identity==='Company'?'green':''}">${escapeHtml(it.identity)}</span>
        <span class="badge">${escapeHtml(it.type)}</span>
        ${tags}
      </div>
      <div class="snippet">${escapeHtml(snippet)}${(it.content||'').length>220?'…':''}</div>
      <div class="links">${links}</div>
      <div class="meta">
        <span class="pill ${identityPill}">${escapeHtml(it.identity)}</span>
        <span class="pill">${escapeHtml(it.type)}</span>
        <span style="margin-left:8px">Updated: ${escapeHtml(updated)}</span>
        ${typeof it._score==='number' ? `<span style="margin-left:auto">Score: ${it._score}</span>` : ''}
      </div>
    </article>
  `;
}

function loadForm(it) {
  if (!it) {
    if (els.id)       els.id.value = '';
    if (els.title)    els.title.value = '';
    if (els.identity) els.identity.value = 'Company';
    if (els.type)     els.type.value = 'Project';
    if (els.tags)     els.tags.value = '';
    if (els.links)    els.links.value = '';
    if (els.content)  els.content.value = '';
    if (els.btnDelete) els.btnDelete.disabled = true;
    return;
  }
  if (els.id)       els.id.value = it.id;
  if (els.title)    els.title.value = it.title || '';
  if (els.identity) els.identity.value = it.identity || 'Company';
  if (els.type)     els.type.value = it.type || 'Project';
  if (els.tags)     els.tags.value = (it.tags||[]).join(', ');
  if (els.links)    els.links.value = (it.links||[]).join(', ');
  if (els.content)  els.content.value = it.content || '';
  if (els.btnDelete) els.btnDelete.disabled = false;
}

// ===== 事件：新增/更新/刪除/匯入匯出 =====
async function onSave(e) {
  e?.preventDefault?.();

  const title = (els.title?.value || '').trim();
  if (!title) { alert('Title is required.'); return; }

  const now = new Date().toISOString();
  const id  = els.id?.value || (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()));

  const item = {
    id,
    title,
    identity: els.identity?.value || 'Company',
    type: els.type?.value || 'Project',
    tags: splitComma(els.tags?.value),
    links: normalizeLinksFromInput(els.links?.value),
    content: els.content?.value || '',
    createdAt: els.id?.value ? (cache.find(x => x.id === id)?.createdAt || now) : now,
    updatedAt: now,
    _v: (cache.find(x => x.id === id)?._v || 0) + 1
  };

  console.debug('[KS] onSave payload:', item);

  // 嘗試寫 DB
  let dbOK = false;
  try {
    if (typeof dbAddOrUpdate === 'function') {
      await dbAddOrUpdate(item);
      dbOK = true;
    }
  } catch (err) {
    console.error('[KS] dbAddOrUpdate failed:', err);
  }

  // 更新 cache：如果 db 成功就讀 db，不成功就直接塞 cache
  try {
    if (dbOK && typeof dbAll === 'function') {
      cache = await dbAll();
    } else {
      const idx = cache.findIndex(x => x.id === id);
      if (idx >= 0) cache[idx] = item;
      else cache.push(item);
    }
  } catch (err) {
    console.error('[KS] dbAll failed:', err);
    const idx = cache.findIndex(x => x.id === id);
    if (idx >= 0) cache[idx] = item;
    else cache.push(item);
  }

  // （可選）存檔後重置篩選，避免新卡片被當前條件藏起來
  if (els.q)         els.q.value = '';
  if (els.fIdentity) els.fIdentity.value = '';
  if (els.fType)     els.fType.value = '';
  if (els.fTag)      els.fTag.value = '';
  if (els.fSort)     els.fSort.value = 'updatedAt_desc';

  // 表單清空 + 畫面刷新
  loadForm(null);
  render();

  console.debug('[KS] cache after save:', cache);
}

async function onDelete() {
  const id = els.id?.value;
  if (!id) return;
  if (!confirm('Delete this item?')) return;
  await dbDelete(id);
  cache = await dbAll();
  loadForm(null);
  render();
}

async function onExport() {
  const data = await dbExport();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `kmdb-export-${Date.now()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function itemsToCSV(items) {
  // 欄位順序
  const cols = ['id','title','identity','type','tags','links','content','createdAt','updatedAt'];

  // 轉 CSV 時的欄位轉換
  const rows = items.map(it => {
    const obj = {
      id: it.id || '',
      title: it.title || '',
      identity: it.identity || '',
      type: it.type || '',
      tags: (it.tags || []).join('|'),     // 多值用 | 串接，避免跟逗號衝突
      links: (it.links || []).join('|'),
      content: it.content || '',
      createdAt: it.createdAt || '',
      updatedAt: it.updatedAt || ''
    };
    return cols.map(c => csvEscape(obj[c]));
  });

  // CSV 標頭 + 內容
  const header = cols.join(',');
  const body = rows.map(r => r.join(',')).join('\r\n');
  return header + '\r\n' + body;
}

function csvEscape(value) {
  // 轉字串
  let s = (value == null ? '' : String(value));
  // 若包含逗號、雙引號或換行，就用雙引號包起來，並把內部的 " 轉成 ""
  if (/[",\r\n]/.test(s)) {
    s = '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

async function onExportCSV() {
  // 匯出「當前篩選/搜尋結果」→ 與畫面一致
  const { q, identity, type, tag, sort } = readFilters();
  let items = filterAndSearch(cache, { q, identity, type, tag });
  items = sortItems(items, sort);

  // 產 CSV 字串；前置 BOM 讓 Excel 在 Windows 上顯示 UTF-8
  const csv = itemsToCSV(items);
  const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kmdb-export-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function onImport(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  try {
    const arr = JSON.parse(text);
    if (!Array.isArray(arr)) throw new Error('Invalid JSON: expected array');
    // normalize minimal fields
    const now = new Date().toISOString();
    const normalized = arr.map(x => ({
      id: x.id || (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()) ),
      title: String(x.title || '').trim(),
      identity: ['Company','Personal'].includes(x.identity) ? x.identity : 'Company',
      type: ['Project','Knowledge','Admin','Resource'].includes(x.type) ? x.type : 'Project',
      tags: Array.isArray(x.tags) ? x.tags.map(String) : [],
      links: Array.isArray(x.links) ? x.links.map(normalizeLink) : normalizeLinksFromInput(x.links || ''),
      content: String(x.content || ''),
      createdAt: x.createdAt || now,
      updatedAt: x.updatedAt || now,
      _v: x._v ? Number(x._v) : 1
    }));
    await dbImport(normalized);
    cache = await dbAll();
    render();
    e.target.value = '';
    alert('Import done.');
  } catch (err) {
    console.error(err);
    alert('Import failed: ' + err.message);
  }
}

// ===== utils =====
function splitComma(s) {
  return (s||'')
    .split(',')
    .map(x=>x.trim())
    .filter(Boolean);
}
function escapeHtml(s=''){
  return s.replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[ch]));
}
function escapeAttr(s=''){
  return escapeHtml(s).replace(/"/g,'&quot;');
}

// 初始化後（安全呼叫：prefs.js 尚未載入時不報錯）
init();
if (typeof readPrefs === 'function' && typeof applyPrefs === 'function') {
  applyPrefs(readPrefs());
} else {
  // 等頁面載完再補一次，避免載入順序導致 ReferenceError
  window.addEventListener('load', () => {
    if (typeof readPrefs === 'function' && typeof applyPrefs === 'function') {
      applyPrefs(readPrefs());
    }
  });
}

// --- Windows path -> file:// URL normalizer ---
function normalizeLink(raw = '') {
  let s = String(raw).trim();
  if (!s) return '';

  // Already a URL? keep as-is
  if (/^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//.test(s)) return s;

  // Remove surrounding quotes
  s = s.replace(/^["']|["']$/g, '');

  // UNC path: \\Server\Share\Path\to\file.ext
  if (/^\\\\[^\\\/]+[\\\/]+/.test(s)) {
    const withoutLeading = s.replace(/^\\\\/, '');
    const parts = withoutLeading.split(/[\\\/]+/);
    const host = parts.shift();                     // Server
    const path = parts.join('/');                   // Share/Path/to/file.ext
    // file://server/share/Path/to/file.ext
    return `file://${host}/${encodeURI(path)}`;
  }

  // Drive path: C:\Dir\Sub\file.ext  or  C:/Dir/Sub/file.ext
  if (/^[a-zA-Z]:[\\/]/.test(s)) {
    const uni = s.replace(/\\/g, '/');             // C:/Dir/Sub/file.ext
    const drive = uni.slice(0, 2);                 // C:
    const rest = uni.slice(2);                     // /Dir/Sub/file.ext
    // file:///C:/Dir/Sub/file.ext
    return `file:///${drive}${encodeURI(rest)}`;
  }

  // Relative path or other text → keep as-is (still clickable if it's http/https)
  return s;
}

function normalizeLinksFromInput(input = '') {
  return splitComma(input).map(normalizeLink);
}

// ===== 對外 API =====
window.KS = {
  // 新增條目（清空表單）
  newItem: () => loadForm(null),

  // 匯出
  exportJSON: () => onExport(),
  exportCSV:  () => onExportCSV(),

  // 匯入（觸發隱藏 input#import-file）
  importData: () => {
    const f = document.getElementById('import-file');
    if (f) f.click();
  },

  // 重新整理畫面
  rerender: () => render(),

  // 重新建立索引（如果存在）
  reindex: () => {
    if (typeof rebuildIndex === 'function') return rebuildIndex();
    console.warn('[KS] rebuildIndex() not found, fallback render()');
    render();
  },

  // 偏好視窗（讓選單也能打開）
  openPrefs: () => document.getElementById('ks-gear')?.click(),

  // 佈景主題切換（修正語法＆持久化）
  toggleTheme: () => {
    const prefs = JSON.parse(localStorage.getItem('ks.prefs') || '{}');
    const cur  = prefs.theme || 'dark';
    const next = cur === 'light' ? 'dark' : 'light';

    // 若有 topbar 的 applyTheme，就用同一套；沒有就自己切 class
    if (typeof window.applyTheme === 'function') {
      window.applyTheme(next);
    } else {
      document.body.classList.toggle('ks-theme-light', next === 'light');
      document.body.classList.toggle('ks-theme-dark',  next !== 'light');
    }

    prefs.theme = next;
    localStorage.setItem('ks.prefs', JSON.stringify(prefs));
  }
};

// ===== Welcome 強化：在 dev 環境一定會彈（上線改為 false） =====
(function () {
  const DEV_FORCE_SHOW = true; // ← 上線請改成 false

  let shown = false;
  const getPath = () => localStorage.getItem('ks.workspace') || 'C:\\KeySearch\\KeySearchData';
  const allowShow = () => DEV_FORCE_SHOW || !localStorage.getItem('ks.dontshow');

 

  // 1) 立刻嘗試
  tryOpen();

  // 2) 等 welcome.js 就緒事件
  const onReady = () => { window.removeEventListener('ks:welcome-ready', onReady); tryOpen(); };
  window.addEventListener('ks:welcome-ready', onReady);

  // 3) 輪詢 5 秒（每 200ms）
  let tries = 0;
  const t = setInterval(() => {
    if (tryOpen() || ++tries > 25) clearInterval(t);
  }, 200);
})();


(function(){
  // Export JSON
  document.getElementById('btn-export-json')?.addEventListener('click', () => {
    if (window.KS?.exportJSON) return window.KS.exportJSON();
    // 後備：直接叫 dbExport 並下載
    if (typeof dbExport === 'function') {
      dbExport().then(data => {
        const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `kmdb-export-${Date.now()}.json`;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
      });
    } else {
      alert('Export function not found.');
    }
  });

  // 語言切換（需要你的 lang.js 內有 setLang(langCode)）
  document.querySelectorAll('.web-actions [data-lang]')?.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const lang = btn.getAttribute('data-lang');
      if (typeof window.setLang === 'function') {
        window.setLang(lang);
        // 若你有偏好存取
        try {
          const prefs = JSON.parse(localStorage.getItem('ks.prefs')||'{}');
          prefs.lang = lang;
          localStorage.setItem('ks.prefs', JSON.stringify(prefs));
        } catch {}
      } else {
        alert('Language module not loaded.');
      }
    });
  });
})();

