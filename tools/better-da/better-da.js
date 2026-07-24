import DA_SDK from 'https://da.live/nx/utils/sdk.js';
import { LitElement, html, nothing } from '../../deps/lit/dist/index.js';
import { initSpectrum, spectrumThemeDefaults } from '../shared/spectrum-theme.js';

/** Custom element names must include a hyphen (HTML spec). */
const EL_NAME = 'ema-better-da';

/** Filter chips shown above the table (order matters for display). */
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pages', label: 'Pages' },
  { key: 'fragments', label: 'Fragments' },
  { key: 'config', label: 'Config' },
  { key: 'locales', label: 'Locales' },
  { key: 'assets', label: 'Assets' },
  { key: 'folders', label: 'Folders' },
];

/** ISO 639-1 codes for classifying locale folders (heuristic — no config yet). */
const LOCALE_CODES = new Set([
  'en', 'de', 'es', 'fr', 'it', 'ja', 'ko', 'pt', 'zh', 'nl',
  'sv', 'da', 'no', 'fi', 'pl', 'ru', 'ar', 'he', 'tr', 'cs',
]);

/** File extensions treated as media/binary assets. */
const ASSET_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'mp4', 'pdf', 'ico']);

/** App-managed content inventory sheet (self-generating; see buildBetterDaMetadata). */
const BETTER_DA_SHEET_PATH = '.da/better-da.json';

/** Path/Title/Type/Status/Tags column widths for the sheet. */
const SHEET_COL_WIDTHS = [300, 250, 220, 120, 160];

/** Concurrent HTML-source fetches while building the inventory (kind to the Source API). */
const BUILD_CONCURRENCY = 4;

/** Page metadata block keys treated as the tags source (first match wins). */
const TAG_METADATA_KEYS = ['tags', 'keywords'];

/**
 * @typedef {{ path: string, name: string, ext?: string, lastModified?: number }} DaListItem
 * @typedef {{
 *   Path: string, Title?: string, Type?: string, Status?: string, Tags?: string,
 * }} InventoryRow
 * @typedef {{ total: number, limit: number, offset: number, data: InventoryRow[] }} BetterDaSheet
 */

/**
 * GET List API — https://docs.da.live/developers/api/list (paginates via da-continuation-token).
 * @param {(url: string, init?: RequestInit) => Promise<Response>} daFetch
 * @param {string} adminOrigin
 * @param {string} org
 * @param {string} repo
 * @param {string} folderRel empty string = repo root
 * @param {AbortSignal} [signal]
 * @returns {Promise<DaListItem[]>}
 */
async function fetchListDirectory(daFetch, adminOrigin, org, repo, folderRel, signal) {
  const suffix = String(folderRel ?? '').replace(/^\/+/, '');
  const base = `${adminOrigin}/list/${encodeURIComponent(org)}/${encodeURIComponent(repo)}`;
  const url = suffix ? `${base}/${suffix}` : base;
  const out = [];
  let continuationToken = null;

  do {
    /** @type {Record<string, string>} */
    const headers = { Accept: 'application/json' };
    if (continuationToken) headers['da-continuation-token'] = continuationToken;

    // eslint-disable-next-line no-await-in-loop
    const res = await daFetch(url, { method: 'GET', headers, signal });
    if (res.status === 401) throw new Error('List API: authentication failed (401).');
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`List API: HTTP ${res.status}`);
    // eslint-disable-next-line no-await-in-loop
    const chunk = await res.json();
    if (!Array.isArray(chunk)) throw new Error('List API: expected JSON array.');
    out.push(...chunk);
    continuationToken = res.headers.get('da-continuation-token');
  } while (continuationToken && !signal?.aborted);

  return out;
}

/**
 * @param {DaListItem[]} items
 * @returns {DaListItem[]}
 */
function sortDaListItems(items) {
  return [...items].sort((a, b) => {
    const af = Boolean(a.ext);
    const bf = Boolean(b.ext);
    if (af !== bf) return af ? 1 : -1;
    const an = a.ext ? `${a.name}.${a.ext}` : a.name;
    const bn = b.ext ? `${b.name}.${b.ext}` : b.name;
    return an.localeCompare(bn, undefined, { numeric: true, sensitivity: 'base' });
  });
}

/**
 * Strips the `/{org}/{repo}` prefix List API paths carry, to match the inventory sheet's
 * repo-relative `Path` values (e.g. `/fragments/404.html`). Matched case-insensitively:
 * List API paths are lowercase while the SDK `context.org`/`context.repo` may not be.
 * @param {DaListItem} item
 * @param {string} org
 * @param {string} repo
 * @returns {string}
 */
function repoRelativePath(item, org, repo) {
  const prefix = `/${org}/${repo}`;
  const rel = item.path.toLowerCase().startsWith(prefix.toLowerCase())
    ? item.path.slice(prefix.length)
    : item.path;
  return rel || '/';
}

/**
 * DA's canvas editor URL for a document — works for pages, fragments, sheets, and media
 * alike; DA picks the right editor for the content type. `.html` is stripped since EDS
 * page routes are extensionless; every other extension (json, media, ...) is kept as-is.
 * @param {string} org
 * @param {string} repo
 * @param {string} path repo-relative, leading slash
 * @param {string | undefined} ext
 * @returns {string}
 */
function daCanvasUrl(org, repo, path, ext) {
  const cleanPath = ext === 'html' ? path.replace(/\.html$/i, '') : path;
  return `https://da.live/canvas#/${org}/${repo}${cleanPath}`;
}

/**
 * GET a document's raw source. Returns `null` for a 404 (does not exist yet).
 * @param {(url: string, init?: RequestInit) => Promise<Response>} daFetch
 * @param {string} adminOrigin
 * @param {string} org
 * @param {string} repo
 * @param {string} path repo-relative, no leading slash
 * @param {AbortSignal} [signal]
 * @returns {Promise<Response | null>}
 */
async function fetchDaSource(daFetch, adminOrigin, org, repo, path, signal) {
  const url = `${adminOrigin}/source/${encodeURIComponent(org)}/${encodeURIComponent(repo)}/${path}`;
  const res = await daFetch(url, { method: 'GET', signal });
  if (res.status === 401) throw new Error('Source API: authentication failed (401).');
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Source API: HTTP ${res.status}`);
  return res;
}

/**
 * @param {InventoryRow[]} rows
 * @returns {Record<string, InventoryRow>}
 */
function indexRowsByPath(rows) {
  /** @type {Record<string, InventoryRow>} */
  const byPath = {};
  rows.forEach((row) => {
    if (row && typeof row.Path === 'string') byPath[row.Path] = row;
  });
  return byPath;
}

/**
 * POST (create or replace) the `.da/better-da.json` inventory sheet.
 * @param {(url: string, init?: RequestInit) => Promise<Response>} daFetch
 * @param {string} adminOrigin
 * @param {string} org
 * @param {string} repo
 * @param {BetterDaSheet} sheet
 */
async function writeBetterDaSheet(daFetch, adminOrigin, org, repo, sheet) {
  const url = `${adminOrigin}/source/${encodeURIComponent(org)}/${encodeURIComponent(repo)}/${BETTER_DA_SHEET_PATH}`;
  const body = new FormData();
  const blob = new Blob([JSON.stringify(sheet)], { type: 'application/json' });
  body.append('data', blob, 'better-da.json');
  const res = await daFetch(url, { method: 'POST', body });
  if (!res.ok) throw new Error(`Source API: failed to save inventory (HTTP ${res.status})`);
}

/**
 * kebab/snake/camel-case filename → Title Case, for items with no better label available.
 * @param {string} name
 * @returns {string}
 */
function humanizeName(name) {
  const spaced = name
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return spaced.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * First non-empty `<h1>` or `<h2>` text in a DA page's HTML body, tags stripped.
 * @param {string} pageHtml
 * @returns {string | null}
 */
function extractHeading(pageHtml) {
  const headings = [...pageHtml.matchAll(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi)]
    .map((m) => m[1].replace(/<[^>]+>/g, '').trim());
  return headings.find((text) => text) || null;
}

/**
 * Value of a key/value row in a DA page's `metadata` block (e.g. `<p>tags</p></div>
 * <div><p>a, b</p>`), matched case-insensitively. `null` if the block has no such row.
 * @param {string} pageHtml
 * @param {string} fieldName
 * @returns {string | null}
 */
function extractMetadataField(pageHtml, fieldName) {
  const re = new RegExp(`<p>\\s*${fieldName}\\s*</p>\\s*</div>\\s*<div>\\s*<p>([\\s\\S]*?)</p>`, 'i');
  const match = re.exec(pageHtml);
  if (!match) return null;
  const text = match[1].replace(/<[^>]+>/g, '').trim();
  return text || null;
}

/**
 * Folder segments of a repo-relative path, lowercased — used as a tags fallback when a
 * page has no `tags`/`keywords` metadata row.
 * @param {string} relPath
 * @param {boolean} isFolder
 * @returns {string[]}
 */
function deriveAutoTags(relPath, isFolder) {
  const segments = relPath.split('/').filter(Boolean).map((s) => s.toLowerCase());
  return isFolder ? segments : segments.slice(0, -1);
}

/**
 * Tags for an item: a real `tags`/`keywords` metadata row when the page has one,
 * otherwise the folder-path fallback.
 * @param {string | null} pageHtml `null` for folders/non-HTML files (no source to inspect)
 * @param {string} relPath
 * @param {boolean} isFolder
 * @returns {string[]}
 */
function deriveTags(pageHtml, relPath, isFolder) {
  if (pageHtml) {
    const raw = TAG_METADATA_KEYS.map((key) => extractMetadataField(pageHtml, key)).find(Boolean);
    if (raw) return raw.split(',').map((t) => t.trim()).filter(Boolean);
  }
  return deriveAutoTags(relPath, isFolder);
}

/**
 * Best-effort Type label for an item with no page content to inspect (folders, non-HTML files).
 * @param {DaListItem} item
 * @returns {string}
 */
function deriveAutoType(item) {
  if (!item.ext) return 'Folder';
  const segments = item.path.toLowerCase().split('/').filter(Boolean);
  const ext = item.ext.toLowerCase();
  if (ext === 'html') return segments.includes('fragments') ? 'Fragment' : 'Page';
  if (ext === 'svg') return 'Icon';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'Image';
  if (ext === 'mp4') return 'Video';
  if (ext === 'pdf') return 'Document';
  if (ext === 'json') {
    if (item.name === 'redirects' || segments.includes('config')) return 'Config';
    return 'Data';
  }
  return ext.toUpperCase();
}

/**
 * BFS over every folder in the repo via the List API; returns a flat list of every
 * file and folder encountered (folders included, since the sheet gets a row for each).
 * @param {(url: string, init?: RequestInit) => Promise<Response>} daFetch
 * @param {string} adminOrigin
 * @param {string} org
 * @param {string} repo
 * @returns {Promise<DaListItem[]>}
 */
async function crawlAllItems(daFetch, adminOrigin, org, repo) {
  /** @type {DaListItem[]} */
  const all = [];
  const queue = [''];
  const seen = new Set(['']);
  while (queue.length) {
    const folderRel = queue.shift();
    // eslint-disable-next-line no-await-in-loop
    const items = await fetchListDirectory(daFetch, adminOrigin, org, repo, folderRel);
    items.forEach((item) => {
      all.push(item);
      if (!item.ext) {
        const rel = repoRelativePath(item, org, repo).replace(/^\/+/, '');
        if (!seen.has(rel)) {
          seen.add(rel);
          queue.push(rel);
        }
      }
    });
  }
  return all;
}

/**
 * Crawls the whole repo and derives Title/Type/Status for every item, fetching each
 * HTML page's source to pull a real heading where one exists.
 * @param {(url: string, init?: RequestInit) => Promise<Response>} daFetch
 * @param {string} adminOrigin
 * @param {string} org
 * @param {string} repo
 * @param {(done: number, total: number) => void} onProgress
 * @returns {Promise<BetterDaSheet>}
 */
async function buildBetterDaMetadata(daFetch, adminOrigin, org, repo, onProgress) {
  const items = await crawlAllItems(daFetch, adminOrigin, org, repo);
  const total = items.length;
  let done = 0;
  onProgress(done, total);

  const rows = new Array(items.length);
  const htmlIndexes = [];
  items.forEach((item, i) => {
    if (!item.ext) {
      const path = repoRelativePath(item, org, repo);
      rows[i] = {
        Path: path,
        Title: humanizeName(item.name),
        Type: 'Folder',
        Status: 'N/A',
        Tags: deriveAutoTags(path, true).join(', '),
      };
      done += 1;
      onProgress(done, total);
    } else if (item.ext === 'html') {
      htmlIndexes.push(i);
    } else {
      const path = repoRelativePath(item, org, repo);
      rows[i] = {
        Path: path,
        Title: 'no title',
        Type: deriveAutoType(item),
        Status: 'N/A',
        Tags: deriveAutoTags(path, false).join(', '),
      };
      done += 1;
      onProgress(done, total);
    }
  });

  let cursor = 0;
  const worker = async () => {
    while (cursor < htmlIndexes.length) {
      const i = htmlIndexes[cursor];
      cursor += 1;
      const item = items[i];
      const path = repoRelativePath(item, org, repo);
      let heading = null;
      let pageHtml = '';
      try {
        // eslint-disable-next-line no-await-in-loop
        const res = await fetchDaSource(daFetch, adminOrigin, org, repo, path.replace(/^\/+/, ''));
        // eslint-disable-next-line no-await-in-loop
        pageHtml = res ? await res.text() : '';
        heading = extractHeading(pageHtml);
      } catch {
        /* leave heading null → fall back below */
      }
      rows[i] = {
        Path: path,
        Title: heading || humanizeName(item.name),
        Type: deriveAutoType(item),
        Status: heading ? 'OK' : 'Missing Title',
        Tags: deriveTags(pageHtml, path, false).join(', '),
      };
      done += 1;
      onProgress(done, total);
    }
  };
  const workerCount = Math.min(BUILD_CONCURRENCY, htmlIndexes.length);
  await Promise.all(Array.from({ length: workerCount }, worker));

  return {
    total: rows.length,
    limit: rows.length,
    offset: 0,
    data: rows,
    ':colWidths': SHEET_COL_WIDTHS,
    ':sheetname': 'data',
    ':type': 'sheet',
  };
}

/**
 * Buckets an inventory Type string (e.g. "Fragment (Promo)") into a filter-chip key.
 * @param {string | undefined} metaType
 * @returns {'pages' | 'fragments' | 'config' | 'assets' | null}
 */
function classifyMetaType(metaType) {
  if (!metaType) return null;
  const t = metaType.toLowerCase();
  if (t.includes('fragment')) return 'fragments';
  if (t.includes('config')) return 'config';
  if (t.includes('image') || t.includes('video') || t.includes('icon')) return 'assets';
  if (t.includes('page')) return 'pages';
  return null;
}

/**
 * @param {string | undefined} status
 * @returns {'good' | 'warning' | 'neutral' | null}
 */
function statusModifier(status) {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s === 'ok') return 'good';
  if (s === 'n/a') return 'neutral';
  return 'warning';
}

/**
 * Human display label for the Type column. Real (derived from `ext`), not a placeholder.
 * @param {DaListItem} item
 * @returns {string}
 */
function displayType(item) {
  if (!item.ext) return 'Folder';
  if (item.ext === 'html') return 'Page';
  return item.ext.toUpperCase();
}

/**
 * Filter-chip bucket for an item. Prefers the real `inventory.json` Type when available,
 * falling back to a name/ext/path heuristic (e.g. for folders, which the sheet has no rows for).
 * @param {DaListItem} item
 * @param {InventoryRow} [meta]
 * @returns {'pages' | 'fragments' | 'config' | 'locales' | 'assets' | 'folders'}
 */
function itemBucket(item, meta) {
  const fromMeta = classifyMetaType(meta?.Type);
  if (fromMeta) return fromMeta;
  const segments = item.path.split('/').filter(Boolean);
  if (segments.includes('fragments')) return 'fragments';
  if (!item.ext) {
    if (item.name === 'config') return 'config';
    if (LOCALE_CODES.has(item.name.toLowerCase())) return 'locales';
    return 'folders';
  }
  if (ASSET_EXTS.has(item.ext.toLowerCase())) return 'assets';
  if (item.ext === 'html') return 'pages';
  return 'assets';
}

/**
 * @param {number | undefined} lastModified epoch milliseconds
 * @returns {string}
 */
function formatModified(lastModified) {
  if (!lastModified) return '—';
  const date = new Date(lastModified);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Type-badge modifier, aligned with `displayType` (folder | page | file).
 * @param {DaListItem} item
 * @returns {'folder' | 'page' | 'file'}
 */
function typeModifier(item) {
  if (!item.ext) return 'folder';
  if (item.ext === 'html') return 'page';
  return 'file';
}

/** Badge label/color per filter bucket — mirrors da-prototype's .b-page/.b-fragment/etc. */
const BUCKET_TYPE = {
  pages: { label: 'Page', modifier: 'page' },
  fragments: { label: 'Fragment', modifier: 'fragment' },
  config: { label: 'Config', modifier: 'config' },
  locales: { label: 'Locale', modifier: 'locale' },
  assets: { label: 'Asset', modifier: 'asset' },
  folders: { label: 'Folder', modifier: 'folder' },
};

/**
 * Type badge label + color modifier, preferring the richer `inventory.json` Type
 * (e.g. "Fragment (Promo)") over the bare ext/folder heuristic.
 * @param {DaListItem} item
 * @param {InventoryRow} [meta]
 * @returns {{ label: string, modifier: string }}
 */
function resolveType(item, meta) {
  if (meta?.Type) {
    const bucket = classifyMetaType(meta.Type);
    return { label: meta.Type, modifier: bucket ? BUCKET_TYPE[bucket].modifier : 'file' };
  }
  if (!item.ext) return BUCKET_TYPE[itemBucket(item, meta)];
  return { label: displayType(item), modifier: typeModifier(item) };
}

const ICON_FOLDER = html`
  <svg class="better-da__icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path d="M1.5 3.5A1 1 0 0 1 2.5 2.5h3.379a1 1 0 0 1 .707.293L7.914 4H13.5a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-8.5z"
      fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round" />
  </svg>
`;

const ICON_FILE = html`
  <svg class="better-da__icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path d="M4 1.5h5.5L12.5 4.5V14.5h-8.5z" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round" />
    <path d="M9.5 1.5V4.5h3" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round" />
  </svg>
`;

/** File extensions the Gallery view shows as an actual image thumbnail. */
const GALLERY_IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico']);

/** Real Spectrum 2 workflow icons (@spectrum-web-components/icons-workflow, icons-s2 set). */
const ICON_S2_FOLDER = html`
  <svg class="better-da__gallery-icon" viewBox="0 0 20 20" aria-hidden="true" fill="currentColor">
    <path d="m16.75,5h-5.96387c-.21777,0-.42383-.09473-.56689-.25879l-1.70361-1.96484c-.42773-.49316-1.04736-.77637-1.7002-.77637h-3.56543c-1.24072,0-2.25,1.00977-2.25,2.25v10.5c0,1.24023,1.00928,2.25,2.25,2.25h13.5c1.24072,0,2.25-1.00977,2.25-2.25v-7.5c0-1.24023-1.00928-2.25-2.25-2.25ZM3.25,3.5h3.56543c.21777,0,.42383.09473.56689.25879l1.07617,1.24121H2.5v-.75c0-.41309.33643-.75.75-.75Zm14.25,11.25c0,.41309-.33643.75-.75.75H3.25c-.41357,0-.75-.33691-.75-.75V6.5h14.25c.41357,0,.75.33691.75.75v7.5Z" />
  </svg>
`;

const ICON_S2_FILE = html`
  <svg class="better-da__gallery-icon" viewBox="0 0 20 20" aria-hidden="true" fill="currentColor">
    <path d="m16.34131,5.28027l-3.62207-3.62109c-.4248-.4248-.98975-.65918-1.59033-.65918h-5.87891c-1.24072,0-2.25,1.00977-2.25,2.25v12.5c0,1.24023,1.00928,2.25,2.25,2.25h9.5c1.24072,0,2.25-1.00977,2.25-2.25V6.87109c0-.5918-.23975-1.17188-.65869-1.59082Zm-1.06104,1.06055c.04565.04565.07385.10376.10602.15918h-3.13629c-.41357,0-.75-.33691-.75-.75v-3.13599c.05518.03223.11316.06018.15869.10571l3.62158,3.62109Zm-.53027,10.15918H5.25c-.41357,0-.75-.33691-.75-.75V3.25c0-.41309.33643-.75.75-.75h4.75v3.25c0,1.24023,1.00928,2.25,2.25,2.25h3.25v7.75c0,.41309-.33643.75-.75.75Z" />
  </svg>
`;

const ICON_HOME = html`
  <svg class="better-da__icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <path d="M2 7.5 8 2l6 5.5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M3.5 6.5V13.5h9V6.5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" />
  </svg>
`;

class EmaBetterDa extends LitElement {
  static properties = {
    context: { type: Object },
    /** @type {((url: string, opts?: RequestInit) => Promise<Response>) | null} */
    daFetch: { type: Object },
    adminOrigin: { type: String },
    /** Repo-relative folder path, `''` = root */
    currentPath: { type: String, state: true },
    /** @type {Record<string, DaListItem[]>} folder path → items */
    folderCache: { type: Object, state: true },
    loading: { type: Boolean, state: true },
    error: { type: String, state: true },
    activeFilter: { type: String, state: true },
    nameFilter: { type: String, state: true },
    /** Exact Type value to match, `''` = all types */
    typeFilter: { type: String, state: true },
    /** @type {Set<string>} selected tag chips (OR'd together), empty = no tag filter */
    tagFilters: { type: Object, state: true },
    /** @type {InventoryRow[]} the `.da/better-da.json` sheet's `data`, in sheet order */
    metadataRows: { type: Array, state: true },
    metadataError: { type: String, state: true },
    /** 'idle' | 'checking' | 'building' | 'ready' | 'error' */
    metadataStatus: { type: String, state: true },
    /** @type {{ done: number, total: number }} progress while metadataStatus === 'building' */
    buildProgress: { type: Object, state: true },
    /** @type {{ path: string, field: string } | null} cell currently being edited */
    editingCell: { type: Object, state: true },
    editingValue: { type: String, state: true },
    saveError: { type: String, state: true },
    /** 'tree' | 'taxonomy' | 'gallery' */
    viewMode: { type: String, state: true },
    /** @type {DaListItem[] | null} every file/folder in the repo, crawled once for Taxonomy */
    allItems: { type: Object, state: true },
    allItemsLoading: { type: Boolean, state: true },
    allItemsError: { type: String, state: true },
    /** How many of the filtered Taxonomy results are currently rendered (grows by 20) */
    taxonomyVisibleCount: { type: Number, state: true },
    /** @type {Record<string, string>} repo-relative path → object URL, for Gallery thumbnails */
    thumbnailUrls: { type: Object, state: true },
  };

  constructor() {
    super();
    this.context = null;
    this.daFetch = null;
    this.adminOrigin = 'https://admin.da.live';
    this.currentPath = '';
    this.folderCache = {};
    this.loading = false;
    this.error = '';
    this.activeFilter = 'all';
    this.nameFilter = '';
    this.typeFilter = '';
    this.tagFilters = new Set();
    this.metadataRows = [];
    this.metadataError = '';
    this.metadataStatus = 'idle';
    this.buildProgress = { done: 0, total: 0 };
    this.editingCell = null;
    this.editingValue = '';
    this.saveError = '';
    /** Set by _cancelEdit() so the blur that follows Escape doesn't also commit. */
    this._editCancelled = false;
    this.viewMode = 'tree';
    this.allItems = null;
    this.allItemsLoading = false;
    this.allItemsError = '';
    this.taxonomyVisibleCount = 20;
    /** @type {IntersectionObserver | null} */
    this._scrollObserver = null;
    this._observedSentinel = null;
    this.thumbnailUrls = {};
    /** @type {Set<string>} paths already fetched/fetching — avoids re-requesting per render */
    this._thumbnailsRequested = new Set();
  }

  connectedCallback() {
    super.connectedCallback();
    initSpectrum();
    if (this._ready) {
      this._loadFolder(this.currentPath);
      this._initMetadata();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._scrollObserver?.disconnect();
    Object.values(this.thumbnailUrls).forEach((url) => URL.revokeObjectURL(url));
  }

  /** Light DOM so `better-da.css` applies (Spectrum-style tokens). */
  createRenderRoot() {
    return this;
  }

  /**
   * Autofocuses the inline-edit input (programmatic DOM insertion ignores `autofocus`) and
   * (re)attaches the Taxonomy infinite-scroll observer to its sentinel after every render.
   */
  updated(changed) {
    if (changed.has('editingCell') && this.editingCell) {
      const input = this.querySelector('.better-da__cell-input');
      if (input) {
        input.focus();
        input.select();
      }
    }
    this._ensureScrollObserver();
  }

  /** Watches the Taxonomy view's scroll sentinel; loads 20 more items when it comes into view. */
  _ensureScrollObserver() {
    const sentinel = this.querySelector('.better-da__scroll-sentinel');
    if (!sentinel) {
      this._scrollObserver?.disconnect();
      this._observedSentinel = null;
      return;
    }
    if (this._observedSentinel === sentinel) return;
    this._scrollObserver?.disconnect();
    this._scrollObserver = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) this._loadMoreTaxonomy();
    });
    this._scrollObserver.observe(sentinel);
    this._observedSentinel = sentinel;
  }

  _loadMoreTaxonomy() {
    const total = this._filteredAllItems.length;
    if (this.taxonomyVisibleCount >= total) return;
    this.taxonomyVisibleCount = Math.min(this.taxonomyVisibleCount + 20, total);
  }

  _switchToTaxonomy() {
    this.viewMode = 'taxonomy';
    this.taxonomyVisibleCount = 20;
    this._loadAllItems();
  }

  /** Crawls the whole repo once for the Taxonomy view; cached in `allItems` afterward. */
  async _loadAllItems() {
    if (!this._ready || this.allItems) return;
    this.allItemsLoading = true;
    this.allItemsError = '';
    try {
      const { org, repo } = this.context;
      this.allItems = await crawlAllItems(this.daFetch, this.adminOrigin, org, repo);
    } catch (err) {
      this.allItemsError = err?.message ?? String(err);
    } finally {
      this.allItemsLoading = false;
    }
  }

  /**
   * Fetches an image's bytes through `daFetch` (content.da.live needs the same Bearer
   * auth as any other source) and caches it as an object URL for the Gallery thumbnail.
   * Fire-and-forget: `_renderGalleryCard` calls this and re-renders once it resolves.
   * @param {string} path
   */
  async _ensureThumbnail(path) {
    if (!this._ready || this._thumbnailsRequested.has(path)) return;
    this._thumbnailsRequested.add(path);
    try {
      const { org, repo } = this.context;
      const res = await fetchDaSource(this.daFetch, this.adminOrigin, org, repo, path.replace(/^\/+/, ''));
      if (!res) return;
      const blob = await res.blob();
      this.thumbnailUrls = { ...this.thumbnailUrls, [path]: URL.createObjectURL(blob) };
    } catch {
      /* leave unset — card falls back to the file icon */
    }
  }

  get _ready() {
    return Boolean(this.daFetch && this.context?.org && this.context?.repo);
  }

  /**
   * @param {string} folderRel
   */
  async _loadFolder(folderRel) {
    if (!this._ready || folderRel in this.folderCache) return;
    this.loading = true;
    this.error = '';
    try {
      const { org, repo } = this.context;
      const items = await fetchListDirectory(this.daFetch, this.adminOrigin, org, repo, folderRel);
      this.folderCache = { ...this.folderCache, [folderRel]: sortDaListItems(items) };
    } catch (err) {
      this.error = err?.message ?? String(err);
    } finally {
      this.loading = false;
    }
  }

  /**
   * On first load: use `.da/better-da.json` if it exists, otherwise crawl the whole repo
   * to build it (deriving Title/Type/Status per item) and save it for next time.
   */
  async _initMetadata() {
    if (!this._ready) return;
    const { org, repo } = this.context;
    this.metadataStatus = 'checking';
    this.metadataError = '';
    try {
      const { daFetch, adminOrigin } = this;
      const existing = await fetchDaSource(daFetch, adminOrigin, org, repo, BETTER_DA_SHEET_PATH);
      if (existing) {
        const body = await existing.json();
        this.metadataRows = Array.isArray(body?.data) ? body.data : [];
        this.metadataStatus = 'ready';
        return;
      }

      this.metadataStatus = 'building';
      this.buildProgress = { done: 0, total: 0 };
      const sheet = await buildBetterDaMetadata(
        this.daFetch,
        this.adminOrigin,
        org,
        repo,
        (done, total) => { this.buildProgress = { done, total }; },
      );
      await writeBetterDaSheet(this.daFetch, this.adminOrigin, org, repo, sheet);
      this.metadataRows = sheet.data;
      this.metadataStatus = 'ready';
    } catch (err) {
      this.metadataError = err?.message ?? String(err);
      this.metadataStatus = 'error';
    }
  }

  /**
   * @param {string} folderRel
   */
  _navigateTo(folderRel) {
    this.currentPath = folderRel;
    this._loadFolder(folderRel);
  }

  /**
   * @param {DaListItem} item
   */
  _onRowActivate(item) {
    if (!item.ext) this._navigateTo(this._childPath(item));
  }

  /**
   * @param {DaListItem} item
   * @returns {string}
   */
  _childPath(item) {
    const { org, repo } = this.context ?? {};
    return repoRelativePath(item, org, repo).replace(/^\/+/, '');
  }

  get _breadcrumbs() {
    const { org, repo } = this.context ?? {};
    const rootLabel = repo ? `${org}/${repo}` : (org ?? 'Content');
    const segments = this.currentPath.split('/').filter(Boolean);
    const crumbs = [{ label: rootLabel, path: '' }];
    let acc = '';
    segments.forEach((segment) => {
      acc = acc ? `${acc}/${segment}` : segment;
      crumbs.push({ label: segment, path: acc });
    });
    return crumbs;
  }

  /**
   * Current folder's items paired with their repo-relative path and inventory row (if any).
   * Unfiltered — the base set Tree-mode filtering and filter-option lists draw from.
   * @returns {{ item: DaListItem, path: string, meta: InventoryRow | undefined }[]}
   */
  get _currentFolderEntries() {
    const { org, repo } = this.context ?? {};
    const items = this.folderCache[this.currentPath] ?? [];
    const metaIndex = indexRowsByPath(this.metadataRows);
    return items.map((item) => {
      const path = repoRelativePath(item, org, repo);
      return { item, path, meta: metaIndex[path] };
    });
  }

  /**
   * Every crawled repo item (once `allItems` has loaded), sorted by path so the flattened
   * list reads like a tree. Unfiltered — the base set Taxonomy-mode filtering draws from.
   * @returns {{ item: DaListItem, path: string, meta: InventoryRow | undefined }[]}
   */
  get _allEntries() {
    const { org, repo } = this.context ?? {};
    const metaIndex = indexRowsByPath(this.metadataRows);
    const entries = (this.allItems ?? []).map((item) => {
      const path = repoRelativePath(item, org, repo);
      return { item, path, meta: metaIndex[path] };
    });
    return entries.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: 'base' }));
  }

  /** Unfiltered entries for whichever view is active — what filter-option lists draw from. */
  get _filterableEntries() {
    return this.viewMode === 'taxonomy' ? this._allEntries : this._currentFolderEntries;
  }

  /** Distinct Type values present in the active view, for the Type filter dropdown. */
  get _availableTypes() {
    const types = new Set();
    this._filterableEntries.forEach(({ meta }) => {
      if (meta?.Type) types.add(meta.Type);
    });
    return [...types].sort((a, b) => a.localeCompare(b));
  }

  /** Distinct tag values present in the active view, for the tag filter chips. */
  get _availableTags() {
    const tags = new Set();
    this._filterableEntries.forEach(({ meta }) => {
      (meta?.Tags ?? '').split(',').map((t) => t.trim()).filter(Boolean).forEach((t) => tags.add(t));
    });
    return [...tags].sort((a, b) => a.localeCompare(b));
  }

  /**
   * Applies the active bucket chip, Type dropdown, tag chips, and name/title/tags search
   * to a list of entries. Shared by both Tree and Taxonomy filtering.
   * @param {{ item: DaListItem, path: string, meta: InventoryRow | undefined }[]} entries
   */
  _applyFilters(entries) {
    const term = this.nameFilter.trim().toLowerCase();
    return entries.filter(({ item, meta }) => {
      if (this.activeFilter !== 'all' && itemBucket(item, meta) !== this.activeFilter) return false;
      if (this.typeFilter && meta?.Type !== this.typeFilter) return false;
      if (this.tagFilters.size) {
        const itemTags = (meta?.Tags ?? '').split(',').map((t) => t.trim()).filter(Boolean);
        if (!itemTags.some((t) => this.tagFilters.has(t))) return false;
      }
      if (!term) return true;
      const label = item.ext ? `${item.name}.${item.ext}` : item.name;
      const title = meta?.Title;
      if (title && title !== 'no title' && title.toLowerCase().includes(term)) return true;
      if (meta?.Tags && meta.Tags.toLowerCase().includes(term)) return true;
      return label.toLowerCase().includes(term);
    });
  }

  get _filteredItems() {
    return this._applyFilters(this._currentFolderEntries);
  }

  get _filteredAllItems() {
    return this._applyFilters(this._allEntries);
  }

  _resetTaxonomyPagination() {
    this.taxonomyVisibleCount = 20;
  }

  /** @param {string} tag */
  _toggleTagFilter(tag) {
    const next = new Set(this.tagFilters);
    if (next.has(tag)) next.delete(tag);
    else next.add(tag);
    this.tagFilters = next;
    this._resetTaxonomyPagination();
  }

  /**
   * @param {string} path
   * @param {'Title' | 'Type' | 'Status' | 'Tags'} field
   * @param {string} rawValue
   */
  _startEdit(path, field, rawValue) {
    this.editingCell = { path, field };
    this.editingValue = rawValue ?? '';
  }

  _cancelEdit() {
    this._editCancelled = true;
    this.editingCell = null;
    this.editingValue = '';
  }

  /** @param {KeyboardEvent} e */
  _onCellKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.target.blur();
    } else if (e.key === 'Escape') {
      this._cancelEdit();
      e.target.blur();
    }
  }

  _commitEdit() {
    if (this._editCancelled) {
      this._editCancelled = false;
      return;
    }
    const cell = this.editingCell;
    if (!cell) return;
    const value = this.editingValue.trim();
    this.editingCell = null;
    this._saveField(cell.path, cell.field, value);
  }

  /**
   * Optimistically updates the row locally, then persists the whole sheet.
   * @param {string} path
   * @param {'Title' | 'Type' | 'Status' | 'Tags'} field
   * @param {string} value
   */
  async _saveField(path, field, value) {
    const rows = [...this.metadataRows];
    const idx = rows.findIndex((r) => r.Path === path);
    if (idx === -1) {
      rows.push({
        Path: path, Title: '', Type: '', Status: '', Tags: '', [field]: value,
      });
    } else {
      rows[idx] = { ...rows[idx], [field]: value };
    }
    this.metadataRows = rows;
    this.saveError = '';
    try {
      const { org, repo } = this.context;
      const sheet = {
        total: rows.length,
        limit: rows.length,
        offset: 0,
        data: rows,
        ':colWidths': SHEET_COL_WIDTHS,
        ':sheetname': 'data',
        ':type': 'sheet',
      };
      await writeBetterDaSheet(this.daFetch, this.adminOrigin, org, repo, sheet);
    } catch (err) {
      this.saveError = err?.message ?? String(err);
    }
  }

  _renderBreadcrumbs() {
    const crumbs = this._breadcrumbs;
    return html`
      <nav class="better-da__breadcrumb" aria-label="Folder path">
        ${crumbs.map((crumb, i) => html`
          ${i > 0 ? html`<span class="better-da__breadcrumb-sep" aria-hidden="true">/</span>` : nothing}
          ${i === crumbs.length - 1
            ? html`
              <span class="better-da__breadcrumb-current" aria-current="location">
                ${i === 0 ? ICON_HOME : nothing}${crumb.label}
              </span>
            `
            : html`
              <button
                type="button"
                class="better-da__breadcrumb-link"
                @click=${() => this._navigateTo(crumb.path)}
              >${i === 0 ? ICON_HOME : nothing}${crumb.label}</button>
            `}
        `)}
      </nav>
    `;
  }

  _renderToolbar() {
    const types = this._availableTypes;
    const tags = this._availableTags;
    return html`
      <div class="better-da__toolbar">
        <div class="better-da__filters" role="tablist" aria-label="Content type filter">
          ${FILTERS.map((f) => html`
            <button
              type="button"
              role="tab"
              class="better-da__filter-chip"
              aria-selected=${this.activeFilter === f.key}
              ?data-active=${this.activeFilter === f.key}
              @click=${() => { this.activeFilter = f.key; this._resetTaxonomyPagination(); }}
            >${f.label}</button>
          `)}
        </div>
        <input
          class="better-da__search"
          type="search"
          placeholder="Filter by name or title…"
          .value=${this.nameFilter}
          @input=${(e) => { this.nameFilter = e.target.value; this._resetTaxonomyPagination(); }}
        />
      </div>
      ${types.length || tags.length
        ? html`
          <div class="better-da__toolbar better-da__toolbar--secondary">
            ${types.length
              ? html`
                <label class="better-da__type-filter">
                  <span class="better-da__sr-only">Filter by Type</span>
                  <select
                    .value=${this.typeFilter}
                    @change=${(e) => { this.typeFilter = e.target.value; this._resetTaxonomyPagination(); }}
                  >
                    <option value="">All types</option>
                    ${types.map((t) => html`<option value=${t}>${t}</option>`)}
                  </select>
                </label>
              `
              : nothing}
            ${tags.length
              ? html`
                <div class="better-da__tag-filters" role="group" aria-label="Filter by tag">
                  ${tags.map((tag) => html`
                    <button
                      type="button"
                      class="better-da__tag-chip"
                      aria-pressed=${this.tagFilters.has(tag)}
                      ?data-active=${this.tagFilters.has(tag)}
                      @click=${() => this._toggleTagFilter(tag)}
                    >${tag}</button>
                  `)}
                </div>
              `
              : nothing}
          </div>
        `
        : nothing}
    `;
  }

  /**
   * @param {string | undefined} tagsStr comma-separated, as stored in the sheet
   */
  _renderTags(tagsStr) {
    const tags = (tagsStr ?? '').split(',').map((t) => t.trim()).filter(Boolean);
    if (!tags.length) return html`<span class="better-da__placeholder">—</span>`;
    return html`
      <div class="better-da__tags">
        ${tags.map((tag) => html`<span class="better-da__tag">${tag}</span>`)}
      </div>
    `;
  }

  /**
   * A table cell that's plain display until clicked, then becomes a text input.
   * @param {string} path
   * @param {'Title' | 'Type' | 'Status' | 'Tags'} field
   * @param {string} rawValue value the input starts from / saves
   * @param {unknown} display Lit template shown when not editing
   */
  _renderEditableCell(path, field, rawValue, display) {
    if (this.editingCell?.path === path && this.editingCell?.field === field) {
      return html`
        <input
          class="better-da__cell-input"
          type="text"
          .value=${this.editingValue}
          @input=${(e) => { this.editingValue = e.target.value; }}
          @keydown=${(e) => this._onCellKeydown(e)}
          @blur=${() => this._commitEdit()}
        />
      `;
    }
    return html`
      <button
        type="button"
        class="better-da__cell-edit"
        @click=${() => this._startEdit(path, field, rawValue)}
      >${display}</button>
    `;
  }

  _renderTableHead() {
    return html`
      <thead>
        <tr>
          <th scope="col" class="better-da__col-name">${this.viewMode === 'taxonomy' ? 'Taxonomy' : 'Name'}</th>
          <th scope="col">Title</th>
          <th scope="col">Type</th>
          <th scope="col">Status</th>
          <th scope="col">Tags</th>
          <th scope="col">Modified</th>
          <th scope="col" class="better-da__col-actions"><span class="better-da__sr-only">Actions</span></th>
        </tr>
      </thead>
    `;
  }

  /**
   * One table row, shared by Tree and Taxonomy — they differ only in what the Name cell
   * shows and what clicking a folder's name does.
   * @param {{ item: DaListItem, path: string, meta: InventoryRow | undefined }} entry
   * @param {string} nameLabel
   * @param {(item: DaListItem, path: string) => void} onFolderActivate
   */
  _renderRow({ item, path, meta }, nameLabel, onFolderActivate) {
    const isFolder = !item.ext;
    const icon = isFolder ? ICON_FOLDER : ICON_FILE;
    const title = meta?.Title && meta.Title !== 'no title' ? meta.Title : '';
    const type = resolveType(item, meta);
    const statusMod = statusModifier(meta?.Status);
    const { org, repo } = this.context ?? {};
    return html`
      <tr>
        <td class="better-da__col-name">
          ${isFolder
            ? html`
              <button type="button" class="better-da__row-link" @click=${() => onFolderActivate(item, path)}>
                ${icon}${nameLabel}
              </button>
            `
            : html`
              <a
                class="better-da__row-link"
                href=${daCanvasUrl(org, repo, path, item.ext)}
                target="_blank"
                rel="noopener noreferrer"
              >${icon}${nameLabel}</a>
            `}
        </td>
        <td>${this._renderEditableCell(
          path,
          'Title',
          title,
          title ? html`${title}` : html`<span class="better-da__placeholder">—</span>`,
        )}</td>
        <td>${this._renderEditableCell(
          path,
          'Type',
          meta?.Type ?? '',
          html`<span class="better-da__badge better-da__badge--${type.modifier}">${type.label}</span>`,
        )}</td>
        <td>${this._renderEditableCell(
          path,
          'Status',
          meta?.Status ?? '',
          statusMod
            ? html`
              <span class="better-da__status better-da__status--${statusMod}">
                <span class="better-da__status-dot"></span>${meta.Status}
              </span>
            `
            : html`<span class="better-da__placeholder">—</span>`,
        )}</td>
        <td>${this._renderEditableCell(path, 'Tags', meta?.Tags ?? '', this._renderTags(meta?.Tags))}</td>
        <td>${formatModified(item.lastModified)}</td>
        <td class="better-da__col-actions">
          <button type="button" class="better-da__row-menu" disabled aria-label="Actions (coming soon)">⋯</button>
        </td>
      </tr>
    `;
  }

  _renderTable() {
    const entries = this._filteredItems;
    if (!entries.length) {
      return html`<p class="better-da__empty">No items match this filter.</p>`;
    }
    return html`
      <table class="better-da__table">
        ${this._renderTableHead()}
        <tbody>
          ${entries.map((entry) => {
            const { item } = entry;
            const label = item.ext ? `${item.name}.${item.ext}` : item.name;
            return this._renderRow(entry, label, (folderItem) => this._onRowActivate(folderItem));
          })}
        </tbody>
      </table>
    `;
  }

  _renderTaxonomyTable() {
    if (this.allItemsLoading) {
      return html`<p class="better-da__loading">Loading the entire repo…</p>`;
    }
    if (this.allItemsError) {
      return html`<p class="better-da__error">${this.allItemsError}</p>`;
    }
    const filtered = this._filteredAllItems;
    if (!filtered.length) {
      return html`<p class="better-da__empty">No items match this filter.</p>`;
    }
    const visible = filtered.slice(0, this.taxonomyVisibleCount);
    return html`
      <table class="better-da__table">
        ${this._renderTableHead()}
        <tbody>
          ${visible.map((entry) => {
            const displayPath = entry.path.replace(/^\/+/, '');
            return this._renderRow(entry, displayPath, (folderItem, folderPath) => {
              this.viewMode = 'tree';
              this._navigateTo(folderPath.replace(/^\/+/, ''));
            });
          })}
        </tbody>
      </table>
      ${visible.length < filtered.length ? html`<div class="better-da__scroll-sentinel"></div>` : nothing}
    `;
  }

  /**
   * One Gallery tile: an image thumbnail for image files, a Spectrum 2 icon otherwise
   * (Folder for folders, File for everything else).
   * @param {{ item: DaListItem, path: string, meta: InventoryRow | undefined }} entry
   */
  _renderGalleryCard({ item, path, meta }) {
    const isFolder = !item.ext;
    const label = item.ext ? `${item.name}.${item.ext}` : item.name;
    const title = meta?.Title && meta.Title !== 'no title' ? meta.Title : '';
    const isImage = !isFolder && GALLERY_IMAGE_EXTS.has(item.ext.toLowerCase());
    if (isImage) this._ensureThumbnail(path);
    const thumbUrl = this.thumbnailUrls[path];

    let thumb = isFolder ? ICON_S2_FOLDER : ICON_S2_FILE;
    if (isImage) {
      thumb = thumbUrl
        ? html`<img src=${thumbUrl} alt="" loading="lazy" />`
        : html`<span class="better-da__gallery-thumb-loading"></span>`;
    }

    const { org, repo } = this.context ?? {};
    const activate = isFolder
      ? () => this._onRowActivate(item)
      : () => window.open(daCanvasUrl(org, repo, path, item.ext), '_blank', 'noopener,noreferrer');

    return html`
      <button type="button" class="better-da__gallery-card" @click=${activate} title=${label}>
        <span class="better-da__gallery-thumb">${thumb}</span>
        <span class="better-da__gallery-name">${label}</span>
        ${title ? html`<span class="better-da__gallery-title">${title}</span>` : nothing}
      </button>
    `;
  }

  _renderGallery() {
    const entries = this._filteredItems;
    if (!entries.length) {
      return html`<p class="better-da__empty">No items match this filter.</p>`;
    }
    return html`
      <div class="better-da__gallery">
        ${entries.map((entry) => this._renderGalleryCard(entry))}
      </div>
    `;
  }

  /** Breadcrumb + current folder's contents — Tree (table) or Gallery, whichever is active. */
  _renderCurrentFolderBody() {
    let body = html`<p class="better-da__loading">Loading…</p>`;
    if (!this.loading) {
      body = this.viewMode === 'gallery' ? this._renderGallery() : this._renderTable();
    }
    return html`
      ${this._renderBreadcrumbs()}
      ${body}
    `;
  }

  _renderMetadataModal() {
    if (this.metadataStatus !== 'checking' && this.metadataStatus !== 'building') return nothing;
    const { done, total } = this.buildProgress;
    return html`
      <div class="better-da__modal-backdrop">
        <div class="better-da__modal" role="alertdialog" aria-live="polite" aria-label="Content inventory">
          <p class="better-da__modal-title">
            ${this.metadataStatus === 'checking'
              ? 'Checking for a content inventory…'
              : 'Building content inventory…'}
          </p>
          ${this.metadataStatus === 'building'
            ? html`<p class="better-da__modal-progress">Scanned ${done} of ${total || '…'} items</p>`
            : nothing}
        </div>
      </div>
    `;
  }

  _renderViewSwitch() {
    return html`
      <div class="better-da__view-switch" role="tablist" aria-label="View">
        <button
          type="button"
          role="tab"
          aria-selected=${this.viewMode === 'tree'}
          ?data-active=${this.viewMode === 'tree'}
          @click=${() => { this.viewMode = 'tree'; }}
        >Tree</button>
        <button
          type="button"
          role="tab"
          aria-selected=${this.viewMode === 'taxonomy'}
          ?data-active=${this.viewMode === 'taxonomy'}
          @click=${() => this._switchToTaxonomy()}
        >Taxonomy</button>
        <button
          type="button"
          role="tab"
          aria-selected=${this.viewMode === 'gallery'}
          ?data-active=${this.viewMode === 'gallery'}
          @click=${() => { this.viewMode = 'gallery'; }}
        >Gallery</button>
      </div>
    `;
  }

  render() {
    const { system, scale, color } = spectrumThemeDefaults;
    return html`
      <sp-theme system=${system} scale=${scale} color=${color}>
        <div class="better-da">
          ${this._renderViewSwitch()}
          <header class="better-da__header">
            <h1 class="better-da__title">A Better DA for a Happier SC</h1>
          </header>
          ${!this._ready
            ? html`<p class="better-da__error">Sign in to Document Authoring to browse content.</p>`
            : html`
              ${this._renderToolbar()}
              ${this.error ? html`<p class="better-da__error">${this.error}</p>` : nothing}
              ${this.metadataStatus === 'error'
                ? html`<p class="better-da__metadata-warning">Content inventory unavailable: ${this.metadataError}</p>`
                : nothing}
              ${this.saveError
                ? html`<p class="better-da__metadata-warning">Couldn't save edit: ${this.saveError}</p>`
                : nothing}
              <div class="better-da__card">
                ${this.viewMode === 'taxonomy' ? this._renderTaxonomyTable() : this._renderCurrentFolderBody()}
              </div>
              ${this._renderMetadataModal()}
            `}
        </div>
      </sp-theme>
    `;
  }
}

customElements.define(EL_NAME, EmaBetterDa);

/**
 * `?org=` and `?repo=` on a page URL — explicit override for embedded/testing use.
 * @param {string} href
 * @returns {{ org: string, repo: string } | null}
 */
function parseDaOrgRepoFromHrefSearchParams(href) {
  try {
    const u = new URL(href);
    const org = (u.searchParams.get('org') ?? '').trim();
    const repo = (u.searchParams.get('repo') ?? '').trim();
    if (!org || !repo) return null;
    return { org, repo };
  } catch {
    return null;
  }
}

/**
 * Resolves `?org=&repo=` from this window, then parent, then top — the tool may run in an
 * iframe whose own URL has no query string while a parent/top frame's does.
 * @returns {{ org: string, repo: string } | null}
 */
function parseDaOrgRepoFromEmbeddedBrowsers() {
  /** @type {string[]} */
  const hrefs = [];
  const tryPush = (loc) => {
    try {
      const h = loc?.href;
      if (typeof h === 'string' && h && !hrefs.includes(h)) hrefs.push(h);
    } catch {
      /* cross-origin frame: reading .href throws */
    }
  };
  tryPush(globalThis.location);
  if (globalThis.parent !== globalThis) tryPush(globalThis.parent.location);
  if (globalThis.top !== globalThis) tryPush(globalThis.top.location);

  for (const href of hrefs) {
    const q = parseDaOrgRepoFromHrefSearchParams(href);
    if (q) return q;
  }
  return null;
}

export default async function init(el) {
  let daFetch = null;
  let context = null;
  let adminOrigin = 'https://admin.da.live';
  try {
    const sdk = await DA_SDK;
    daFetch = sdk.actions?.daFetch ?? null;
    context = sdk.context ?? null;
  } catch {
    /* Standalone: no DA parent */
  }
  try {
    const mod = await import('https://da.live/nx/public/utils/constants.js');
    if (mod.DA_ORIGIN) adminOrigin = mod.DA_ORIGIN;
  } catch {
    /* default adminOrigin */
  }

  const base = context ? { ...context } : {};
  const urlOrgRepo = parseDaOrgRepoFromEmbeddedBrowsers();
  if (urlOrgRepo) {
    base.org = urlOrgRepo.org;
    base.repo = urlOrgRepo.repo;
  }

  const cmp = document.createElement(EL_NAME);
  cmp.daFetch = daFetch;
  cmp.context = Object.keys(base).length ? base : null;
  cmp.adminOrigin = adminOrigin;
  el.replaceChildren();
  el.append(cmp);
}

function boot() {
  const root = document.getElementById('better-da-root');
  if (!root) return;
  Promise.resolve(init(root)).catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    root.replaceChildren();
    const p = document.createElement('p');
    p.textContent = `Could not start Better DA: ${err?.message ?? err}`;
    p.style.cssText = 'padding:1rem;font-family:system-ui,sans-serif';
    root.append(p);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
