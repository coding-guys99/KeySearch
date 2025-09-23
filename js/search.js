// Lightweight full-text search (no external deps).
// Strategy: tokenize query -> score fields (title, tags, content) with weights.
// Supports simple AND (all tokens must appear somewhere) and ranks by weighted hits.

function tokenize(text) {
  return (text || '')
    .toString()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s\-./]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

const FIELD_WEIGHTS = {
  title: 5,
  tags: 3,
  content: 1
};

function scoreItem(item, tokens) {
  if (!tokens || !tokens.length) return { ok: true, score: 0 };

  const titleTokens = tokenize(item.title);
  const contentTokens = tokenize(item.content);
  const tagsTokens = (item.tags || []).map(String).flatMap(tokenize);

  let score = 0;
  // All tokens must appear at least in one field
  for (const tk of tokens) {
    const inTitle = titleTokens.includes(tk);
    const inTags = tagsTokens.includes(tk);
    const inContent = contentTokens.includes(tk);
    if (!inTitle && !inTags && !inContent) return { ok: false, score: 0 };

    if (inTitle) score += FIELD_WEIGHTS.title;
    if (inTags) score += FIELD_WEIGHTS.tags;
    if (inContent) score += FIELD_WEIGHTS.content;
  }
  // small bonus for shorter titles
  score += Math.max(0, 3 - Math.floor((item.title || '').length / 20));
  return { ok: true, score };
}

function filterAndSearch(items, { q, identity, type, tag }) {
  const tokens = tokenize(q || '');

  let out = items.filter(it => {
    if (identity && it.identity !== identity) return false;
    if (type && it.type !== type) return false;
    if (tag) {
      const tagL = tag.toLowerCase();
      const hasTag = (it.tags || []).some(t => String(t).toLowerCase() === tagL);
      if (!hasTag) return false;
    }
    return true;
  });

  if (tokens.length) {
    out = out
      .map(it => {
        const { ok, score } = scoreItem(it, tokens);
        return ok ? { ...it, _score: score } : null;
      })
      .filter(Boolean);
  } else {
    out = out.map(it => ({ ...it, _score: 0 }));
  }
  return out;
}

function sortItems(items, sortKey) {
  switch (sortKey) {
    case 'updatedAt_desc':
      return items.sort((a,b)=> (b.updatedAt||'').localeCompare(a.updatedAt||''));
    case 'createdAt_desc':
      return items.sort((a,b)=> (b.createdAt||'').localeCompare(a.createdAt||''));
    case 'title_asc':
      return items.sort((a,b)=> (a.title||'').localeCompare(b.title||''));
    case 'score_desc':
      return items.sort((a,b)=> (b._score||0)-(a._score||0) || (b.updatedAt||'').localeCompare(a.updatedAt||''));
    default:
      return items;
  }
}

export { filterAndSearch, sortItems };