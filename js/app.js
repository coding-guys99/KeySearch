// app.js — KeySearch (web) integrated
import { filterAndSearch, sortItems } from './search.js';

/* ======================= Welcome（啟動一次） ======================= */
let KS_SESSION_WELCOME_SHOWN = false;
function shouldShowWelcome() { return !localStorage.getItem('ks.dontshow'); }
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
  const onReady = () => { window.removeEventListener('ks:welcome-ready', onReady); tryOpenWelcomeOnce(); };
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

// 連續序號（從 1 開始；init 時會自動更新成最大值+1）
let KS_SEQ = 1;

// 建立時間格式：2025-10-02 Time:11:45am
function formatCreatedAt(d = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  let h = d.getHours();
  const m = pad(d.getMinutes());
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12; // 0=>12
  return `${yyyy}-${mm}-${dd} Time:${h}:${m}${ampm}`;
}


/* ======================= 初始化（先等 i18nReady） ======================= */
async function init() {
  if (window.i18nReady) { try { await window.i18nReady; } catch {} }
  cache = await dbAll();

  // 🔽 初始化序號：把現有資料的 id（可解析成整數者）找最大 + 1
  if (cache.length > 0) {
    const nums = cache
      .map(x => parseInt(x.id, 10))
      .filter(n => Number.isFinite(n) && n > 0);
    if (nums.length > 0) KS_SEQ = Math.max(...nums) + 1;
  }

  bindEvents();
  render();
  maybeShowWelcomeAtStartup();
}

// 語言切換完成 → 重畫（卡片/文字即時更新）
window.addEventListener('ks:i18n-changed', () => { if (typeof render === 'function') render(); });

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

  console.debug('[KS] bindEvents:', !!els.form, !!els.btnSave, !!els.title, !!els.identity, !!els.type);
}

// 在 bindEvents() 末尾加：
els.cards?.addEventListener('click', async (e) => {
  const btn = e.target.closest('.file-actions .linkbtn');
  if (!btn) return;

  const act = btn.dataset.act;
  const url = btn.dataset.url;

  if (act === 'copy' && url) {
    try {
      await navigator.clipboard.writeText(url);
      const orig = btn.textContent;
      btn.textContent = (window.i18n?.t('card.copied') || 'Copied!');
      setTimeout(() => { btn.textContent = orig; }, 1200);
    } catch {
      alert((window.i18n?.t('card.copyFail') || 'Copy failed. Please copy manually:\n') + url);
    }
  }

  if (act === 'why') {
    alert(
      window.i18n?.t('card.fileBlockedMsg')
      || 'Browsers block opening file:// links from websites for security.\nUse the desktop app, or copy the path and open it in your file manager.'
    );
  }
});


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

// === Demo cards（僅顯示，不寫入 DB；支援 i18n） ===
function getDemoCards(){
  const t = (k, fb) => (window.i18n?.t ? window.i18n.t(k) : k) || fb || k;
  const now = new Date().toISOString();
  return [
    {
      id: 'demo-quickstart',
      _demo: true,
      title: t('demo.quickstart.title', 'Quick start'),
      identity: 'Company',
      type: 'Knowledge',
      tags: ['demo','getting-started'],
      links: ['https://keysearch-app.com'],
      content: t('demo.quickstart.content', 'This is a quick start card.'),
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'demo-project',
      _demo: true,
      title: t('demo.project.title', 'Sample project'),
      identity: 'Company',
      type: 'Project',
      tags: ['demo','web','design'],
      links: ['https://keysearch-app.com','https://keysearch-app.com'],
      content: t('demo.project.content', 'This is a sample project card.'),
      createdAt: now,
      updatedAt: now
    }
  ];
}

/* ---------- 小工具 ---------- */
function isWeb() {
  return document.documentElement.classList.contains('is-web') ||
         !(/\bElectron\/\d/.test(navigator.userAgent));
}
const IS_WEB = isWeb();

/* ---------- 渲染主流程 ---------- */
function render() {
  const { q, identity, type, tag, sort } = readFilters();
  let items = filterAndSearch(cache, { q, identity, type, tag });
  items = sortItems(items, sort || 'updatedAt_desc');
  currentSort = sort || 'updatedAt_desc';

  // DB 為空時顯示示例卡（i18n）
  const useDemo = (cache.length === 0);
  if (useDemo) items = getDemoCards();

  if (els.stats) {
    const tt = (k, fb) => (window.i18n?.t ? window.i18n.t(k) : k) || fb || k;
    els.stats.textContent = useDemo
      ? tt('stats.examples', `${items.length} examples`)
      : `${items.length} result${items.length === 1 ? '' : 's'}`;
  }

  if (els.cards) {
    els.cards.innerHTML = items.map(renderCard).join('');

    // Edit 綁定（示例卡不可編輯）
    $$('.card').forEach(card => {
      const isDemo = card.hasAttribute('data-demo');
      const btn = card.querySelector('.edit-btn');
      if (!btn) return;
      if (isDemo) {
        btn.disabled = true;
        btn.title = (window.i18n?.t?.('hint.exampleCard') || 'This is an example card');
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

/* ---------- 卡片連結行為（只綁一次） ---------- */
if (!window.__KS_LINK_HANDLER_BOUND__) {
  window.__KS_LINK_HANDLER_BOUND__ = true;

  els.cards?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.link-btn');
    if (!btn) return;

    // 在監聽器內就地提供 i18n 取字
    const t = (k, fb) => (window.i18n?.t ? window.i18n.t(k) : k) || fb || k;

    const act = btn.dataset.act;
    const url = btn.dataset.url || '';

    if (act === 'copy-path') {
      // 讓複製內容更好看（移除 file:///、還原空白）
      const pretty = url.replace(/^file:\/+/, '').replace(/%20/g, ' ');
      try {
        await navigator.clipboard.writeText(pretty);
        const old = btn.textContent;
        btn.textContent = t('card.copied','Copied!');
        btn.disabled = true;
        setTimeout(() => {
          btn.textContent = t('card.copyPath','Copy Path');
          btn.disabled = false;
        }, 900);
      } catch (err) {
        alert(t('card.copyFailed','Copy failed. Please try again.'));
      }
      return;
    }

    if (act === 'open-file') {
      // 只在桌面版有效
      if (window.electronAPI?.openPath) {
        try { await window.electronAPI.openPath(url); }
        catch (err) { alert(t('card.openFailed','Open failed.')); }
      } else {
        alert(t('card.desktopOnly','This action is available in the desktop app.'));
      }
      return;
    }
  }, { passive: true });
}

/* ---------- 卡片模板 ---------- */
function renderCard(it) {
  const t = (k, fb) => (window.i18n?.t ? window.i18n.t(k) : k) || fb || k;

  const tags = (it.tags || []).map(tag =>
    `<span class="badge">${escapeHtml(tag)}</span>`).join('');

  // file:// → web 顯示 Copy Path；桌面顯示 Open File；http/https → <a>
  const rawLinks = it.links || [];
  const links = rawLinks.length
    ? rawLinks.map(u => {
        if (u.startsWith('file:///')) {
          if (IS_WEB) {
            return `
              <button class="link-btn"
                      data-act="copy-path"
                      data-url="${escapeAttr(u)}"
                      title="${t('card.cannotOpenWeb','Browsers can’t open local files. Click to copy the path.')}">
                ${t('card.copyPath','Copy Path')}
              </button>`;
          } else {
            return `
              <button class="link-btn"
                      data-act="open-file"
                      data-url="${escapeAttr(u)}">
                ${t('card.openFile','Open File')}
              </button>`;
          }
        }
        return `<a href="${escapeAttr(u)}" target="_blank" rel="noopener">${t('card.openLink','Open Link')}</a>`;
      }).join('')
    : `<span class="no-link" style="opacity:.7">${t('card.noLink','No link set')}</span>`;

  const snippet = (it.content || '').slice(0, 220);
  const updated = it.updatedAt ? new Date(it.updatedAt).toLocaleString() : '';
  const identityLabel = it.identity === 'Company'
    ? t('identity.company','Company')
    : t('identity.personal','Personal');
  const typeLabel = t(`type.${(it.type || '').toLowerCase()}`, it.type || '');
  const demoAttr = it._demo ? ' data-demo="1"' : '';

  return `
    <article class="card"${demoAttr} data-id="${escapeAttr(it.id)}">
      <div class="row">
        <div class="title">${escapeHtml(it.title)}</div>
        <button class="edit-btn">${t('btn.edit','Edit')}</button>
      </div>
      <div class="badges">
        <span class="badge ${it.identity==='Company' ? 'green' : ''}">${identityLabel}</span>
        <span class="badge">${typeLabel}</span>
        ${tags}
      </div>
      <div class="snippet">${escapeHtml(snippet)}${(it.content || '').length > 220 ? '…' : ''}</div>
      <div class="links">${links}</div>
      <div class="meta">
        <span class="pill">${identityLabel}</span>
        <span class="pill">${typeLabel}</span>
        <span style="margin-left:8px">${t('meta.updated','Updated')}: ${escapeHtml(updated)}</span>
        ${typeof it._score === 'number' ? `<span style="margin-left:auto">Score: ${it._score}</span>` : ''}
      </div>
    </article>
  `;
}



/* ======================= 表單 ======================= */
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

/* ======================= 事件：新增/更新/刪除 ======================= */
async function onSave(e) {
  e?.preventDefault?.();

  const title = (els.title?.value || '').trim();
  if (!title) { alert('Title is required.'); return; }

  // 🔢 ID：編輯就沿用；新增就用遞增序號
  let id = els.id?.value;
  if (!id) id = String(KS_SEQ++);

  // 🕒 時間：建立時間用自訂格式；更新時間仍保留 ISO（方便排序/顯示）
  const nowISO = new Date().toISOString();

  // 如果是「新增」，給自訂建立時間；如果是「編輯」，保留原建立時間
  const existing = cache.find(x => x.id === id);
  const createdAt =
    existing?.createdAt
      ? existing.createdAt
      : formatCreatedAt(new Date()); // ← 這裡即你要的格式：YYYY-MM-DD Time:hh:mmam

  const item = {
    id,
    title,
    identity: els.identity?.value || 'Company',
    type: els.type?.value || 'Project',
    tags: splitComma(els.tags?.value),
    links: normalizeLinksFromInput(els.links?.value),
    content: els.content?.value || '',
    createdAt,          // ⬅️ 使用自訂建立時間
    updatedAt: nowISO,  // ⬅️ 仍用 ISO，給排序/顯示 toLocaleString()
    _v: (existing?._v || 0) + 1
  };

  let dbOK = false;
  try {
    if (typeof dbAddOrUpdate === 'function') {
      await dbAddOrUpdate(item);
      dbOK = true;
    }
  } catch (err) { console.error('[KS] dbAddOrUpdate failed:', err); }

  try {
    if (dbOK && typeof dbAll === 'function') {
      cache = await dbAll();
    } else {
      const idx = cache.findIndex(x => x.id === id);
      if (idx >= 0) cache[idx] = item; else cache.push(item);
    }
  } catch (err) {
    console.error('[KS] dbAll failed:', err);
    const idx = cache.findIndex(x => x.id === id);
    if (idx >= 0) cache[idx] = item; else cache.push(item);
  }

  // 清表單 & 重繪
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

// 原生 Save 對話框；不支援時 fallback
async function saveBlobWithPicker(blob, suggestedName, typeSpec = { description: 'File', accept: { 'application/octet-stream': ['.*'] } }) {
  if (window.showSaveFilePicker) {
    const handle = await window.showSaveFilePicker({ suggestedName, types: [typeSpec] });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
  } else {
    let name = prompt('Enter a file name', suggestedName) || suggestedName;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }
}

// 1) 綁定：一定要直接掛在「使用者點擊的按鈕」上
// els.btnExportCsv?.addEventListener('click', onExportCSV);  // 這行保留

// 2) 直接在 onExportCSV 裡，第一個 await 就是 showSaveFilePicker
async function onExportCSV() {
  try {
    const { q, identity, type, sort, tag } = readFilters();

    // 先拿到檔案 handle（第一個 await → 維持使用者手勢）
    const parts = ['keysearch'];
    if (identity) parts.push(identity.toLowerCase());
    if (type)     parts.push(type.toLowerCase());
    if (q?.trim()) parts.push(q.trim().slice(0,24));
    const suggested = parts.join('-') + '.csv';

    let handle = null;
    if ('showSaveFilePicker' in window) {
      handle = await window.showSaveFilePicker({
        suggestedName: suggested,
        types: [{ description: 'CSV File', accept: { 'text/csv': ['.csv'] } }]
      });
    } else {
      // 不支援 (Safari/iOS) → 走後備
      return exportCsvFallback(suggested);
    }

    // 再產生資料（這些 await 放在後面就不影響 activation）
    let items = filterAndSearch(cache, { q, identity, type, tag });
    items = sortItems(items, sort);
    const csv  = itemsToCSV(items);
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8' });

    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
  } catch (err) {
    // 使用者取消 → 靜默
    if (err && (err.name === 'AbortError' || err.name === 'NotAllowedError')) return;

    // 仍被判定沒有 activation → 改走後備下載
    if (String(err?.message || '').includes('User activation is required')) {
      return exportCsvFallback('keysearch-export.csv');
    }
    console.error('[KS] save CSV failed:', err);
    alert('Save failed: ' + (err?.message || err));
  }
}

// 3) 後備方案：a[download] + 自訂檔名
function exportCsvFallback(suggestedName = 'keysearch-export.csv') {
  const { q, identity, type, tag, sort } = readFilters();
  let items = filterAndSearch(cache, { q, identity, type, tag });
  items = sortItems(items, sort);
  const csv  = itemsToCSV(items);
  const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8' });

  let name = prompt('File name', suggestedName) || suggestedName;
  if (!/\.csv$/i.test(name)) name += '.csv';

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
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
function normalizeLinksFromInput(input = '') { return splitComma(input).map(normalizeLink); }

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
