// app.js — KeySearch (web) integrated
import { filterAndSearch, sortItems } from './search.js';

/* ======================= Welcome（啟動一次） ======================= */
let KS_SESSION_WELCOME_SHOWN = false;

function shouldShowWelcome() {
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
  if (tryOpenWelcomeOnce()) return;
  const onReady = () => {
    window.removeEventListener('ks:welcome-ready', onReady);
    tryOpenWelcomeOnce();
  };
  window.addEventListener('ks:welcome-ready', onReady);
  [0, 200, 600, 1200].forEach(ms => setTimeout(() => tryOpenWelcomeOnce(), ms));
}

/* ======================= DOM 簡化 ======================= */
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const els = {
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

/* ======================= 初始化 ======================= */
async function init() {
  cache = await dbAll();
  bindEvents();
  render();
  maybeShowWelcomeAtStartup();
}

function bindEvents() {
  [els.q, els.fIdentity, els.fType, els.fTag, els.fSort].forEach(el => {
    if (!el) return;
    el.addEventListener('input', render);
    el.addEventListener('change', render);
  });

  els.btnClear?.addEventListener('click', () => {
    if (els.q)         els.q.value = '';
    if (els.fIdentity) els.fIdentity.value = '';
    if (els.fType)     els.fType.value = '';
    if (els.fTag)      els.fTag.value = '';
    if (els.fSort)     els.fSort.value = 'updatedAt_desc';
    render();
  });

  // 表單提交
  els.form?.addEventListener('submit', onSave);
  els.btnSave?.addEventListener('click', (e) => { e.preventDefault(); onSave(e); });
  els.btnReset?.addEventListener('click', () => loadForm(null));
  els.btnDelete?.addEventListener('click', onDelete);

  // 匯出 / 匯入
  els.btnExport?.addEventListener('click', onExportJSON);
  els.btnExportCsv?.addEventListener('click', onExportCSV);
  els.importFile?.addEventListener('change', onImport);

  console.debug('[KS] bindEvents:',
    !!els.form, !!els.btnSave, !!els.title, !!els.identity, !!els.type);
}

/* ======================= 渲染 ======================= */
function readFilters(){
  return {
    q:        valTrim(els.q, ''),
    identity: valTrim(els.fIdentity, ''),
    type:     valTrim(els.fType, ''),
    tag:      valTrim(els.fTag, ''),
    sort:     valTrim(els.fSort, 'updatedAt_desc')
  };
}

// === Demo cards (render-only; not stored in DB) ===
function getDemoCards(){
  // 只要在這裡維護 i18n key；實際字在 /locales/*.json
  const t = (k) => (window.i18n?.t(k) || k);
  const now = new Date().toISOString();
  return [
    {
      id: 'demo-quickstart',
      _demo: true,
      title: t('demo.quickstart.title'),
      identity: 'Company',
      type: 'Knowledge',
      tags: ['demo','getting-started'],
      links: ['https://example.com/keysearch/docs'],
      content: t('demo.quickstart.content'),
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'demo-project',
      _demo: true,
      title: t('demo.project.title'),
      identity: 'Company',
      type: 'Project',
      tags: ['demo','web','design'],
      links: ['https://www.figma.com/','https://trello.com/'],
      content: t('demo.project.content'),
      createdAt: now,
      updatedAt: now
    }
  ];
}


function render() {
  const { q, identity, type, tag, sort } = readFilters();
  let items = filterAndSearch(cache, { q, identity, type, tag });
  items = sortItems(items, sort || 'updatedAt_desc');
  currentSort = sort || 'updatedAt_desc';

  // 👉 只有在「資料庫真的為空」時，顯示示例卡
  const useDemo = (cache.length === 0);
  if (useDemo) {
    items = getDemoCards();
  }

  if (els.stats) {
    // 小提示：讓使用者知道目前看到的是示例
    const label = useDemo ? `${items.length} examples` : `${items.length} result${items.length===1?'':'s'}`;
    els.stats.textContent = label;
  }

  if (els.cards) {
    els.cards.innerHTML = items.map(renderCard).join('');

    // 若是示例卡，不綁定「Edit」；避免誤以為能改
    $$('.card').forEach(card => {
      const isDemo = card.hasAttribute('data-demo');
      const btn = card.querySelector('.edit-btn');
      if (!btn) return;
      if (isDemo) {
        btn.disabled = true;
        btn.title = 'This is an example card';
        btn.classList.add('is-disabled');
        return;
      }
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
  // 若未來某些卡沒直接寫 title/content，而是給 key，也能 fallback
  const tt = (k) => window.i18n?.t(k) || k;

  const isDemo = !!it._demo;
  const title = it.titleKey ? tt(it.titleKey) : (it.title || '');
  const content = it.contentKey ? tt(it.contentKey) : (it.content || '');

  const tags = (it.tags||[]).map(t=>`<span class="badge">${escapeHtml(t)}</span>`).join('');
  const links = (it.links||[]).map(u=>{
    const label = u.startsWith('file:///') ? 'Open File' : 'Open Link';
    return `<a href="${escapeAttr(u)}" target="_blank" rel="noopener">${label}</a>`;
  }).join('');
  const snippet = (content||'').slice(0,220);
  const updated = it.updatedAt ? new Date(it.updatedAt).toLocaleString() : '';
  const identityPill = it.identity==='Company' ? 'blue' : 'lime';

  return `
    <article class="card" data-id="${escapeAttr(it.id)}" ${isDemo?'data-demo="1"':''}>
      <div class="row">
        <div class="title">${escapeHtml(title)}${isDemo?` <span class="badge" style="margin-left:6px;opacity:.7">DEMO</span>`:''}</div>
        <button class="edit-btn"${isDemo?' disabled':''}>Edit</button>
      </div>
      <div class="badges">
        <span class="badge ${it.identity==='Company'?'green':''}">${escapeHtml(it.identity)}</span>
        <span class="badge">${escapeHtml(it.type)}</span>
        ${tags}
      </div>
      <div class="snippet">${escapeHtml(snippet)}${(content||'').length>220?'…':''}</div>
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
    els.id       && (els.id.value = '');
    els.title    && (els.title.value = '');
    els.identity && (els.identity.value = 'Company');
    els.type     && (els.type.value = 'Project');
    els.tags     && (els.tags.value = '');
    els.links    && (els.links.value = '');
    els.content  && (els.content.value = '');
    els.btnDelete && (els.btnDelete.disabled = true);
    return;
  }
  els.id       && (els.id.value = it.id);
  els.title    && (els.title.value = it.title || '');
  els.identity && (els.identity.value = it.identity || 'Company');
  els.type     && (els.type.value = it.type || 'Project');
  els.tags     && (els.tags.value = (it.tags||[]).join(', '));
  els.links    && (els.links.value = (it.links||[]).join(', '));
  els.content  && (els.content.value = it.content || '');
  els.btnDelete && (els.btnDelete.disabled = false);
}

/* ======================= 事件處理 ======================= */
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

  let dbOK = false;
  try {
    if (typeof dbAddOrUpdate === 'function') {
      await dbAddOrUpdate(item);
      dbOK = true;
    }
  } catch (err) {
    console.error('[KS] dbAddOrUpdate failed:', err);
  }

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

  // 可選：避免新卡片被當前篩選藏起來
  els.q         && (els.q.value = '');
  els.fIdentity && (els.fIdentity.value = '');
  els.fType     && (els.fType.value = '');
  els.fTag      && (els.fTag.value = '');
  els.fSort     && (els.fSort.value = 'updatedAt_desc');

  loadForm(null);
  render();
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

/* ======================= 匯出 / 匯入 ======================= */
async function onExportJSON() {
  const data = await dbExport();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  await saveBlobWithPicker(blob, 'keysearch-export.json', {
    description: 'JSON File',
    accept: { 'application/json': ['.json'] }
  });
}

function itemsToCSV(items) {
  const cols = ['id','title','identity','type','tags','links','content','createdAt','updatedAt'];
  const rows = items.map(it => {
    const obj = {
      id: it.id || '',
      title: it.title || '',
      identity: it.identity || '',
      type: it.type || '',
      tags: (it.tags || []).join('|'),
      links: (it.links || []).join('|'),
      content: it.content || '',
      createdAt: it.createdAt || '',
      updatedAt: it.updatedAt || ''
    };
    return cols.map(c => csvEscape(obj[c]));
  });
  const header = cols.join(',');
  const body = rows.map(r => r.join(',')).join('\r\n');
  return header + '\r\n' + body;
}

function csvEscape(value) {
  let s = (value == null ? '' : String(value));
  if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

// 通用：原生 Save 對話框；不支援時 fallback 到 prompt + a[download]
async function saveBlobWithPicker(blob, suggestedName, typeSpec = { description: 'File', accept: { 'application/octet-stream': ['.*'] } }) {
  if (window.showSaveFilePicker) {
    const handle = await window.showSaveFilePicker({
      suggestedName,
      types: [typeSpec]
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
  } else {
    let name = prompt('Enter a file name', suggestedName) || suggestedName;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
}

async function onExportCSV() {
  const { q, identity, type, tag, sort } = readFilters();
  let items = filterAndSearch(cache, { q, identity, type, tag });
  items = sortItems(items, sort);

  const csv = itemsToCSV(items);
  const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8' });

  const parts = ['keysearch'];
  if (identity) parts.push(identity.toLowerCase());
  if (type)     parts.push(type.toLowerCase());
  if (q?.trim()) parts.push(q.trim().slice(0,24));
  const suggested = parts.join('-') + '.csv';

  try {
    await saveBlobWithPicker(blob, suggested, {
      description: 'CSV File',
      accept: { 'text/csv': ['.csv'] }
    });
  } catch (err) {
    console.error('[KS] save CSV failed:', err);
    alert('Save failed: ' + (err?.message || err));
  }
}

async function onImport(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  try {
    const arr = JSON.parse(text);
    if (!Array.isArray(arr)) throw new Error('Invalid JSON: expected array');
    const now = new Date().toISOString();
    const normalized = arr.map(x => ({
      id: x.id || (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now())),
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

/* ======================= Utils ======================= */
function val(el, def){ return el && typeof el.value !== 'undefined' ? el.value : (def===undefined ? '' : def); }
function valTrim(el, def){ const v = val(el, def); return typeof v === 'string' ? v.trim() : v; }
function splitComma(s) { return (s||'').split(',').map(x=>x.trim()).filter(Boolean); }
function escapeHtml(s=''){ return s.replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
function escapeAttr(s=''){ return escapeHtml(s).replace(/"/g,'&quot;'); }

function normalizeLink(raw = '') {
  let s = String(raw).trim();
  if (!s) return '';
  if (/^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//.test(s)) return s;
  s = s.replace(/^["']|["']$/g, '');
  if (/^\\\\[^\\\/]+[\\\/]+/.test(s)) {
    const withoutLeading = s.replace(/^\\\\/, '');
    const parts = withoutLeading.split(/[\\\/]+/);
    const host = parts.shift();
    const path = parts.join('/');
    return `file://${host}/${encodeURI(path)}`;
  }
  if (/^[a-zA-Z]:[\\/]/.test(s)) {
    const uni = s.replace(/\\/g, '/');
    const drive = uni.slice(0, 2);
    const rest = uni.slice(2);
    return `file:///${drive}${encodeURI(rest)}`;
  }
  return s;
}
function normalizeLinksFromInput(input = '') {
  return splitComma(input).map(normalizeLink);
}

/* ======================= 對外 API ======================= */
window.KS = {
  newItem: () => loadForm(null),
  exportJSON: () => onExportJSON(),
  exportCSV:  () => onExportCSV(),
  importData: () => { document.getElementById('import-file')?.click(); },
  rerender: () => render(),
  reindex: () => {
    if (typeof rebuildIndex === 'function') return rebuildIndex();
    console.warn('[KS] rebuildIndex() not found, fallback render()');
    render();
  },
  openPrefs: () => document.getElementById('ks-gear')?.click(),
  toggleTheme: () => {
    const prefs = JSON.parse(localStorage.getItem('ks.prefs') || '{}');
    const cur  = prefs.theme || 'dark';
    const next = cur === 'light' ? 'dark' : 'light';
    if (typeof window.applyTheme === 'function') window.applyTheme(next);
    else {
      document.body.classList.toggle('ks-theme-light', next === 'light');
      document.body.classList.toggle('ks-theme-dark',  next !== 'light');
    }
    prefs.theme = next;
    localStorage.setItem('ks.prefs', JSON.stringify(prefs));
  }
};

/* ======================= DEV Welcome（上線改 false） ======================= */
(function () {
  const DEV_FORCE_SHOW = true; // ← 上線請改成 false
  let tries = 0;
  function canShow() { return DEV_FORCE_SHOW || shouldShowWelcome(); }
  function tryOpenDev() { return canShow() ? tryOpenWelcomeOnce() : false; }
  tryOpenDev();
  const onReady = () => { window.removeEventListener('ks:welcome-ready', onReady); tryOpenDev(); };
  window.addEventListener('ks:welcome-ready', onReady);
  const t = setInterval(() => { if (tryOpenDev() || ++tries > 25) clearInterval(t); }, 200);
})();

/* ======================= 啟動 ======================= */
init();
// 偏好套用：若 prefs.js 還沒載完，onload 再補一次
if (typeof readPrefs === 'function' && typeof applyPrefs === 'function') {
  applyPrefs(readPrefs());
} else {
  window.addEventListener('load', () => {
    if (typeof readPrefs === 'function' && typeof applyPrefs === 'function') {
      applyPrefs(readPrefs());
    }
  });
}



