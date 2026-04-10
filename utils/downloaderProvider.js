const settings = require('../setting');

function looksLikeUrl(text) {
  return /^https?:\/\//i.test(String(text || '').trim());
}

function firstValue(obj, paths) {
  for (const path of paths) {
    let cur = obj;
    let found = true;
    for (const key of path) {
      if (cur && Object.prototype.hasOwnProperty.call(cur, key)) {
        cur = cur[key];
      } else {
        found = false;
        break;
      }
    }
    if (found && cur) return cur;
  }
  return '';
}

function normalizeResult(data, fallbackInput) {
  const root = data?.result || data?.data || data;

  return {
    title: firstValue(root, [
      ['title'],
      ['name'],
      ['track'],
      ['video', 'title']
    ]) || fallbackInput,
    download: firstValue(root, [
      ['downloadUrl'],
      ['download_url'],
      ['url'],
      ['link'],
      ['dl'],
      ['audio'],
      ['video'],
      ['result']
    ]),
    thumbnail: firstValue(root, [['thumbnail'], ['thumb'], ['image']]),
    duration: firstValue(root, [['duration'], ['length']]),
    source: firstValue(root, [['source'], ['platform'], ['provider']]) || 'provider'
  };
}

async function requestDownload({ type, input }) {
  const cfg = settings.DOWNLOADER || {};
  if (!cfg.ENABLED || !cfg.API_BASE_URL) {
    return { ok: false, error: 'Downloader provider not configured.' };
  }

  const base = String(cfg.API_BASE_URL).replace(/\/$/, '');
  const endpoint = cfg.ENDPOINT || '/download';
  const url = new URL(`${base}${endpoint}`);

  url.searchParams.set('type', type);
  if (looksLikeUrl(input)) url.searchParams.set('url', input);
  else url.searchParams.set('query', input);

  if (cfg.DEFAULT_QUALITY) url.searchParams.set('quality', cfg.DEFAULT_QUALITY);
  if (cfg.API_KEY_QUERY_NAME && cfg.API_KEY) {
    url.searchParams.set(cfg.API_KEY_QUERY_NAME, cfg.API_KEY);
  }

  const headers = {};
  if (cfg.API_KEY && cfg.API_KEY_HEADER) {
    headers[cfg.API_KEY_HEADER] = cfg.API_KEY;
  }

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers
    });

    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!res.ok) {
      return { ok: false, error: data?.message || data?.error || `HTTP ${res.status}` };
    }

    const normalized = normalizeResult(data, input);
    if (!normalized.download) {
      return { ok: false, error: 'Provider did not return a download URL.' };
    }

    return { ok: true, ...normalized };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = {
  looksLikeUrl,
  requestDownload
};
