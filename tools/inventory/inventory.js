import { LitElement, html, nothing } from '../../deps/lit/dist/index.js';
import STR, {
  invFill,
} from './inventory-strings.js';
import { parseSitemap, analyzeSitemap, classifyURL, getRecentURLs } from './sitemap-analyzer.js';
import DA_SDK from 'https://da.live/nx/utils/sdk.js';

/** Sitemap protocol namespace */
const SM_NS = 'http://www.sitemaps.org/schemas/sitemap/0.9';

/** Custom element names must include a hyphen (HTML spec). */
const EL_NAME = 'ema-inventory';

/**
 * @param {string} xmlText
 * @returns {string[]}
 */
function parseUrlsetLocs(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  const err = doc.querySelector('parsererror');
  if (err) {
    throw new Error(STR.errors.invalidXmlResponse);
  }
  const root = doc.documentElement;
  if (!root) return [];

  if (root.localName === 'urlset') {
    return collectLocUnderParents(doc, 'url');
  }

  if (root.localName === 'sitemapindex') {
    return [...doc.getElementsByTagNameNS(SM_NS, 'loc')]
      .filter((n) => n.parentElement?.localName === 'sitemap')
      .map((n) => n.textContent.trim())
      .filter(Boolean);
  }

  return [...doc.getElementsByTagNameNS(SM_NS, 'loc')]
    .map((n) => n.textContent.trim())
    .filter(Boolean);
}

/**
 * @param {Document} doc
 * @param {string} parentLocal
 */
function collectLocUnderParents(doc, parentLocal) {
  const out = [];
  let parents = [...doc.getElementsByTagNameNS(SM_NS, parentLocal)];
  if (!parents.length) parents = [...doc.getElementsByTagName(parentLocal)];
  for (let i = 0; i < parents.length; i += 1) {
    const p = parents[i];
    let locs = [...p.getElementsByTagNameNS(SM_NS, 'loc')];
    if (!locs.length) locs = [...p.getElementsByTagName('loc')];
    for (let j = 0; j < locs.length; j += 1) {
      const u = locs[j].textContent.trim();
      if (u) out.push(u);
    }
  }
  return out;
}

/**
 * Expand sitemap index: fetch child sitemaps (capped) and merge page URLs.
 * @param {string} xmlText
 * @param {{ maxChildren?: number, signal?: AbortSignal }} [opts]
 * @returns {Promise<string[]>}
 */
async function expandToPageUrls(xmlText, opts = {}) {
  const { maxChildren = 40, signal } = opts;
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error(STR.errors.invalidXmlResponse);
  }
  const root = doc.documentElement;
  if (!root) return [];

  if (root.localName === 'urlset') {
    return collectLocUnderParents(doc, 'url');
  }

  if (root.localName === 'sitemapindex') {
    const childMaps = [...doc.getElementsByTagNameNS(SM_NS, 'loc')]
      .filter((n) => n.parentElement?.localName === 'sitemap')
      .map((n) => n.textContent.trim())
      .filter(Boolean)
      .slice(0, maxChildren);

    const pages = [];
    for (const smUrl of childMaps) {
      if (signal?.aborted) break;
      try {
        const res = await fetch(smUrl, { signal, mode: 'cors' });
        if (!res.ok) continue;
        const t = await res.text();
        pages.push(...collectLocUnderParents(new DOMParser().parseFromString(t, 'application/xml'), 'url'));
      } catch {
        /* CORS or network — skip child */
      }
    }
    return [...new Set(pages)];
  }

  return parseUrlsetLocs(xmlText);
}

/**
 * @param {File} file
 * @returns {Promise<string>}
 */
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error(STR.errors.readFile));
    reader.readAsText(file);
  });
}

/**
 * @param {string} text
 * @returns {Promise<void>}
 */
async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  ta.style.top = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    const ok = document.execCommand('copy');
    if (!ok) throw new Error('Clipboard command was rejected.');
  } finally {
    document.body.removeChild(ta);
  }
}

/**
 * @typedef {{ segment: string, children: Map<string, TreeNode>, urls: string[] }} TreeNode
 */

/** @param {string} segment @returns {TreeNode} */
function makeTreeNode(segment) {
  return { segment, children: new Map(), urls: [] };
}

/**
 * Insert a URL into a tree keyed by hostname then each pathname segment (URL pattern / path tree).
 * @param {TreeNode} root
 * @param {string} urlString
 */
function insertUrlIntoTree(root, urlString) {
  const raw = urlString.trim();
  if (!raw) return;
  try {
    const u = new URL(raw);
    const host = u.hostname || '(no host)';
    const pathParts = u.pathname.split('/').filter(Boolean);
    const segments = [host, ...pathParts];
    let node = root;
    for (let i = 0; i < segments.length; i += 1) {
      const seg = segments[i];
      const isLast = i === segments.length - 1;
      if (!node.children.has(seg)) {
        node.children.set(seg, makeTreeNode(seg));
      }
      node = /** @type {TreeNode} */ (node.children.get(seg));
      if (isLast) {
        node.urls.push(raw);
      }
    }
  } catch {
    root.urls.push(raw);
  }
}

/** @param {string[]} urls @returns {TreeNode} */
function buildUrlPatternTree(urls) {
  const root = makeTreeNode('');
  for (const u of urls) insertUrlIntoTree(root, u);
  return root;
}

/**
 * Path under the DA repo that typically matches the live site path (same as URL pathname).
 * @param {string} urlString
 * @returns {string}
 */
function siteUrlToRepoSourcePath(urlString) {
  try {
    const u = new URL(urlString);
    let p = u.pathname || '/';
    if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
    try {
      p = decodeURI(p);
    } catch {
      /* keep encoded */
    }
    return p || '/';
  } catch {
    return '';
  }
}

/** Cap for URL picker list when filtering (performance). */
const URL_PICK_LIST_CAP = 200;

/**
 * Pathname directory segments only (drops a terminal filename when it has a common extension).
 * @param {string} pathname
 * @returns {string[]}
 */
function pathnameDirectorySegments(pathname) {
  let p = pathname || '/';
  try {
    p = decodeURI(p);
  } catch {
    /* keep */
  }
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  const parts = p.split('/').filter(Boolean);
  if (!parts.length) return [];
  const last = parts[parts.length - 1];
  if (/\.[a-z0-9]{2,8}$/i.test(last)) return parts.slice(0, -1);
  return parts;
}

/**
 * @param {string} seg
 */
function looksLikeLocaleSegment(seg) {
  return /^[a-z]{2}(-[a-z]{2})?$/i.test(seg);
}

/**
 * Site "section" bucket: hostname + first 1–2 path folders (locale + area when applicable).
 * @param {string} urlString
 * @returns {{ host: string, sectionPath: string, display: string }}
 */
function urlSiteSection(urlString) {
  try {
    const u = new URL(urlString);
    const host = u.hostname || '(no host)';
    const dirs = pathnameDirectorySegments(u.pathname);
    if (dirs.length === 0) {
      return { host, sectionPath: '/', display: `${host}/` };
    }
    let depth = 1;
    if (dirs.length >= 2 && looksLikeLocaleSegment(dirs[0])) depth = 2;
    depth = Math.min(depth, dirs.length);
    const prefix = `/${dirs.slice(0, depth).join('/')}`;
    return { host, sectionPath: prefix, display: `${host}${prefix}` };
  } catch {
    return { host: '(invalid)', sectionPath: '/', display: '(invalid)/' };
  }
}

/** Section rows shown in the dark dashboard preview (full list stays in the table below). */
const DASH_SECTION_PREVIEW_CAP = 48;

/** Page-type rows in the USTA dashboard preview. */
const DASH_USTA_TYPE_PREVIEW_CAP = 36;

/** Cap rows shown in “Recently modified” (urlset sitemaps only). */
const RECENT_URLS_PREVIEW_CAP = 40;

/**
 * @param {string[]} urls
 * @returns {boolean}
 */
function looksLikeUstaSitemap(urls) {
  return urls.some((u) => /usta\.com/i.test(u));
}

/**
 * Aggregate site sections from parsed sitemap URLs.
 * @param {string[]} urls
 */
function analyzeSitemapUrls(urls) {
  /** @type {Map<string, { display: string, host: string, sectionPath: string, count: number }>} */
  const sectionMap = new Map();

  const hostsSet = new Set();
  for (const url of urls) {
    try {
      const u = new URL(url);
      hostsSet.add(u.hostname || '');
    } catch {
      /* skip */
    }

    const sec = urlSiteSection(url);
    const prevS = sectionMap.get(sec.display);
    sectionMap.set(sec.display, {
      display: sec.display,
      host: sec.host,
      sectionPath: sec.sectionPath,
      count: (prevS?.count ?? 0) + 1,
    });
  }

  const sections = [...sectionMap.values()].sort((a, b) => b.count - a.count);

  return {
    pageCount: urls.length,
    uniqueHosts: hostsSet.size,
    hosts: [...hostsSet].filter(Boolean).sort(),
    sections,
  };
}

/**
 * @param {string} raw
 */
function titleCaseSegment(raw) {
  try {
    return decodeURIComponent(String(raw ?? '').trim())
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
  } catch {
    return String(raw ?? '').trim();
  }
}

/**
 * Turn `hostname/path/prefix` into a short readable title (host path segments only).
 * @param {string} display from urlSiteSection().display
 */
function prettifySectionDisplay(display) {
  const trimmed = String(display ?? '').trim();
  const slashIdx = trimmed.indexOf('/');
  if (slashIdx < 0) return titleCaseSegment(trimmed.replace(/\./g, ' · ')) || trimmed || '—';
  const path = trimmed.slice(slashIdx + 1);
  const segments = path.split('/').filter(Boolean);
  if (!segments.length) return titleCaseSegment(trimmed.slice(0, slashIdx)) || '—';
  return segments.map((s) => titleCaseSegment(s)).join(' / ');
}

/**
 * Repo display path → path segment for Source API (no leading slash).
 * @param {string} repoPath
 */
function repoPathToSourceRel(repoPath) {
  return (repoPath ?? '').replace(/^\/+/, '');
}

/**
 * Absolute List API `path` (`/org/repo/...`) → repo-relative segment for nested List calls (no leading slash).
 * Org/repo segments are matched case-insensitively — API paths are often lowercase while SDK context may not be.
 * @param {string} absPath
 * @param {string} org
 * @param {string} repo
 */
function relUnderRepoFromAbs(absPath, org, repo) {
  const raw = String(absPath ?? '')
    .trim()
    .replace(/\/{2,}/g, '/')
    .replace(/\/+$/, '');
  if (!raw) return '';

  const segments = raw.startsWith('/') ? raw.slice(1).split('/').filter(Boolean) : raw.split('/').filter(Boolean);
  const o = String(org ?? '').trim();
  const r = String(repo ?? '').trim();
  if (!o || !r || segments.length < 2) return '';

  if (segments[0].toLowerCase() !== o.toLowerCase() || segments[1].toLowerCase() !== r.toLowerCase()) {
    return '';
  }

  if (segments.length === 2) return '';

  return segments.slice(2).join('/');
}

/**
 * GET List API — returns JSON array per https://docs.da.live/developers/api/list (supports da-continuation-token).
 * @param {(url: string, init?: RequestInit) => Promise<Response>} daFetch
 * @param {string} adminOrigin
 * @param {string} org
 * @param {string} repo
 * @param {string} folderRel empty string = repo root
 * @param {AbortSignal} [signal]
 */
async function fetchListDirectory(daFetch, adminOrigin, org, repo, folderRel, signal) {
  const suffix = String(folderRel ?? '').replace(/^\/+/, '');
  const base = `${adminOrigin}/list/${org}/${repo}`;
  const url = suffix ? `${base}/${suffix}` : base;
  const out = [];
  let continuationToken = null;

  do {
    /** @type {Record<string, string>} */
    const headers = { Accept: 'application/json' };
    if (continuationToken) headers['da-continuation-token'] = continuationToken;

    const res = await daFetch(url, { method: 'GET', headers, signal });
    if (res.status === 401) throw new Error('List API: authentication failed (401).');
    if (!res.ok) throw new Error(`List API: HTTP ${res.status}`);
    const chunk = await res.json();
    if (!Array.isArray(chunk)) throw new Error('List API: expected JSON array.');
    out.push(...chunk);
    continuationToken = res.headers.get('da-continuation-token');
  } while (continuationToken && !signal?.aborted);

  return out;
}

/**
 * @typedef {{ path: string, name: string, ext?: string, lastModified?: number }} DaListItem
 * @param {DaListItem[]} items
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

/** Safety cap on folders visited during full-repo crawl (List API). */
const DA_CRAWL_MAX_FOLDERS = 6000;

/** Max paths listed per compare bucket in UI (full counts still shown). */
const COMPARE_LIST_PREVIEW_CAP = 120;

/**
 * BFS crawl of every folder via List API; returns repo-relative file paths (`en/page.html`).
 * @param {{ maxFolders?: number }} [opts]
 * @returns {Promise<{ files: Set<string>, truncated: boolean, foldersVisited: number }>}
 */
async function crawlRepoAllFileRels(daFetch, adminOrigin, org, repo, signal, opts = {}) {
  const maxFolders = opts.maxFolders ?? DA_CRAWL_MAX_FOLDERS;
  /** @type {Set<string>} */
  const files = new Set();
  const folderQueue = [''];
  const seenFolders = new Set(['']);

  let foldersVisited = 0;
  let truncated = false;

  while (folderQueue.length && !signal?.aborted) {
    if (foldersVisited >= maxFolders) {
      truncated = true;
      break;
    }

    const folderRel = /** @type {string} */ (folderQueue.shift());
    foldersVisited += 1;

    let items;
    try {
      items = await fetchListDirectory(daFetch, adminOrigin, org, repo, folderRel, signal);
    } catch (e) {
      if (signal?.aborted) break;
      throw e;
    }

    for (const item of sortDaListItems(items)) {
      const rel = relUnderRepoFromAbs(item.path, org, repo);
      if (!rel) continue;
      if (item.ext) {
        files.add(rel);
      } else if (!seenFolders.has(rel)) {
        seenFolders.add(rel);
        folderQueue.push(rel);
      }
    }
  }

  return { files, truncated, foldersVisited };
}

/** Unique repo-relative paths from sitemap URLs (no leading slash). */
function uniqueSitemapRepoRels(urls) {
  const out = new Set();
  for (const url of urls) {
    const repoPath = siteUrlToRepoSourcePath(url);
    if (!repoPath || repoPath === '/') continue;
    out.add(repoPathToSourceRel(repoPath));
  }
  return out;
}

/** DA editor deep link: `https://da.live/edit#/<org>/<repo>/<path>` */
const DA_EDIT_ORIGIN = 'https://da.live';

/**
 * Reads org/repo from a DA-style hash route `#/org/repo/...` (same shape as {@link daEditHref}).
 * @param {string} href full document URL, e.g. `window.location.href`
 * @returns {{ org: string, repo: string } | null}
 */
function parseDaOrgRepoFromHref(href) {
  try {
    const u = new URL(href);
    const raw = (u.hash ?? '').replace(/^#\/?/, '').replace(/\/+$/, '');
    const parts = raw.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    const org = parts[0].trim();
    const repo = parts[1].trim();
    if (!org || !repo) return null;
    return { org, repo };
  } catch {
    return null;
  }
}

/**
 * `?org=` and `?repo=` on the page URL (explicit override for embedded tools).
 * @param {string} href full document URL
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
 * Resolves org/repo from embedded windows (self, parent, top).
 * Precedence: {@link parseDaOrgRepoFromHrefSearchParams} on each URL first, then {@link parseDaOrgRepoFromHref} (hash `#/org/repo/...`).
 * Embedded blocks often run in an iframe whose URL has no hash while the DA editor hash is on a parent frame.
 * @returns {{ org: string, repo: string } | null}
 */
function parseDaOrgRepoFromEmbeddedBrowsers() {
  /** @type {string[]} */
  const hrefs = [];
  /**
   * @param {Location | undefined} loc
   */
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
  for (const href of hrefs) {
    const p = parseDaOrgRepoFromHref(href);
    if (p) return p;
  }
  return null;
}

/**
 * @param {string} org
 * @param {string} repo
 * @param {string} repoPath pathname-style path, e.g. `/en/home/home.html`
 * @returns {string} empty if org/repo/rel invalid
 */
function daEditHref(org, repo, repoPath) {
  const o = String(org ?? '').trim();
  const r = String(repo ?? '').trim();
  const rel = repoPathToSourceRel(repoPath);
  if (!o || !r || !rel) return '';
  return `${DA_EDIT_ORIGIN}/edit#/${o}/${r}/${rel}`;
}

/**
 * Repo path links to DA edit only after Source API confirms the file exists (`ok`).
 * @param {string} repoPath
 * @param {string} [org]
 * @param {string} [repo]
 * @param {Record<string, 'pending'|'ok'|'missing'|'error'>} daExistence
 * @param {boolean} daReady
 */
function renderRepoPathLabel(repoPath, org, repo, daExistence, daReady) {
  if (!repoPath) return nothing;
  const staticTitle = STR.tree.repoPathTitle;
  const fileInDa = daReady && Boolean(org && repo) && daExistence[repoPath] === 'ok';
  const editHref = fileInDa ? daEditHref(org, repo, repoPath) : '';
  if (editHref) {
    return html`<a
      class="ema-inv-tree__source-path ema-inv-tree__source-link"
      href=${editHref}
      target="_blank"
      rel="noopener noreferrer"
      title=${STR.repo.openInDa}
      >${repoPath}</a>`;
  }
  const pendingHint =
    daReady && org && repo && daExistence[repoPath] === 'pending' ? STR.tree.pendingLinkHint : '';
  return html`<code class="ema-inv-tree__source-path" title=${staticTitle + pendingHint}>${repoPath}</code>`;
}

/** Max unique repo paths checked per parse (rest skipped, see info line). */
const DA_VERIFY_MAX_PATHS = 2500;

/** Concurrent Source GET checks. */
const DA_VERIFY_CONCURRENCY = 8;

/**
 * @param {string} repoPath
 * @param {Record<string, 'pending'|'ok'|'missing'|'error'>} daExistence
 * @param {boolean} daReady
 */
function renderDaStatus(repoPath, daExistence, daReady) {
  if (!repoPath || repoPath === '/') return nothing;
  if (!daReady) return nothing;
  const st = daExistence[repoPath];
  if (!st || st === 'pending') {
    return html`<span class="ema-inv-da-pill ema-inv-da-pill--pending" aria-live="polite">${STR.tree.checking}</span>`;
  }
  if (st === 'ok') {
    return html`<span class="ema-inv-da-pill ema-inv-da-pill--ok" title=${STR.tree.inDaTitle}>${STR.tree.inDa}</span>`;
  }
  if (st === 'missing') {
    return html`<span class="ema-inv-da-pill ema-inv-da-pill--missing" title=${STR.tree.notInDaTitle}>${STR.tree.notInDa}</span>`;
  }
  return html`<span class="ema-inv-da-pill ema-inv-da-pill--error" title=${STR.tree.daErrorTitle}>${STR.tree.daError}</span>`;
}

/**
 * GET Source for each path; cancels body without reading HTML. Aborts when `signal` aborts.
 * @param {{
 *   paths: string[],
 *   daFetch: (url: string, init?: RequestInit) => Promise<Response>,
 *   adminOrigin: string,
 *   org: string,
 *   repo: string,
 *   signal: AbortSignal,
 *   onUpdate: (path: string, status: 'ok'|'missing'|'error') => void,
 *   concurrency: number,
 * }} opts
 */
async function verifyRepoPathsAgainstDa(opts) {
  const { paths, daFetch, adminOrigin, org, repo, signal, onUpdate, concurrency } = opts;
  if (!paths.length) return;

  let idx = 0;
  const worker = async () => {
    while (!signal.aborted) {
      const i = idx;
      if (i >= paths.length) return;
      idx += 1;
      const path = paths[i];
      const rel = repoPathToSourceRel(path);
      if (!rel) {
        onUpdate(path, 'missing');
        continue;
      }
      const url = `${adminOrigin}/source/${org}/${repo}/${rel}`;
      try {
        const res = await daFetch(url, { method: 'GET', signal });
        try {
          res.body?.cancel?.();
        } catch {
          /* ignore */
        }
        if (signal.aborted) return;
        if (res.status === 404) onUpdate(path, 'missing');
        else if (res.ok) onUpdate(path, 'ok');
        else onUpdate(path, 'error');
      } catch {
        if (!signal.aborted) onUpdate(path, 'error');
      }
    }
  };

  const workers = Math.min(concurrency, paths.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
}

/** @param {TreeNode} node */
function sortedChildren(node) {
  return [...node.children.values()].sort((a, b) =>
    a.segment.localeCompare(b.segment, undefined, { numeric: true, sensitivity: 'base' }),
  );
}

function renderTreeBranch(node, depth, daExistence, daReady, org, repo) {
  const subs = sortedChildren(node);
  const hasSubs = subs.length > 0;
  const { urls } = node;

  if (!hasSubs && urls.length === 0) return html``;

  if (!hasSubs && urls.length === 1) {
    const href = urls[0];
    const repoPath = siteUrlToRepoSourcePath(href);
    return html`
      <li class="ema-inv-tree__item ema-inv-tree__item--leaf" role="treeitem" style="--depth: ${depth}">
        <div class="ema-inv-tree__leaf-row">
          <a
            class="ema-inv-tree__link"
            href=${href}
            target="_blank"
            rel="noopener noreferrer"
            title=${href}
            >${node.segment}</a>
          ${repoPath
            ? html`
                <div class="ema-inv-tree__source-row">
                  ${renderRepoPathLabel(repoPath, org, repo, daExistence, daReady)}
                  ${renderDaStatus(repoPath, daExistence, daReady)}
                </div>
              `
            : nothing}
        </div>
      </li>
    `;
  }

  return html`
    <li class="ema-inv-tree__item ema-inv-tree__item--branch" role="treeitem">
      <details class="ema-inv-tree__details" ?open=${depth < 2}>
        <summary class="ema-inv-tree__summary" style="--depth: ${depth}">
          <span class="ema-inv-tree__chevron" aria-hidden="true">▸</span>
          <span class="ema-inv-tree__label">${node.segment}</span>
          ${urls.length ? html`<span class="ema-inv-tree__badge">${urls.length}</span>` : nothing}
        </summary>
        <div class="ema-inv-tree__body">
          ${urls.length
            ? html`
                <ul class="ema-inv-tree__urls">
                  ${urls.map((href) => {
                    const repoPath = siteUrlToRepoSourcePath(href);
                    return html`
                      <li class="ema-inv-tree__url-row">
                        <a class="ema-inv-tree__link" href=${href} target="_blank" rel="noopener noreferrer">${href}</a>
                        ${repoPath
                          ? html`
                              <div class="ema-inv-tree__source-row">
                                ${renderRepoPathLabel(repoPath, org, repo, daExistence, daReady)}
                                ${renderDaStatus(repoPath, daExistence, daReady)}
                              </div>
                            `
                          : nothing}
                      </li>
                    `;
                  })}
                </ul>
              `
            : nothing}
          ${hasSubs
            ? html`<ul class="ema-inv-tree__nested" role="group">${subs.map((ch) => renderTreeBranch(ch, depth + 1, daExistence, daReady, org, repo))}</ul>`
            : nothing}
        </div>
      </details>
    </li>
  `;
}

/**
 * @param {TreeNode} root
 * @param {Record<string, 'pending'|'ok'|'missing'|'error'>} daExistence
 * @param {boolean} daReady
 */
function renderUrlTree(root, daExistence, daReady, org, repo) {
  const subs = sortedChildren(root);
  const stray = root.urls;

  if (!subs.length && !stray.length) {
    return html`<p class="ema-inv__empty">${STR.tree.noHierarchy}</p>`;
  }

  return html`
    <div class="ema-inv-tree" role="tree">
      ${stray.length
        ? html`
            <div class="ema-inv-tree__section">
              <div class="ema-inv-tree__section-title">${STR.tree.unparsedSection}</div>
              <ul class="ema-inv-tree__urls">
                ${stray.map((href) => {
                  const repoPath = siteUrlToRepoSourcePath(href);
                  return html`
                    <li class="ema-inv-tree__url-row">
                      <a class="ema-inv-tree__link" href=${href} target="_blank" rel="noopener noreferrer">${href}</a>
                      ${repoPath
                        ? html`
                            <div class="ema-inv-tree__source-row">
                              ${renderRepoPathLabel(repoPath, org, repo, daExistence, daReady)}
                              ${renderDaStatus(repoPath, daExistence, daReady)}
                            </div>
                          `
                        : nothing}
                    </li>
                  `;
                })}
              </ul>
            </div>
          `
        : nothing}
      ${subs.length
        ? html`<ul class="ema-inv-tree__nested ema-inv-tree__nested--root" role="group">${subs.map((ch) => renderTreeBranch(ch, 0, daExistence, daReady, org, repo))}</ul>`
        : nothing}
    </div>
  `;
}

class EmaInventory extends LitElement {
  static properties = {
    details: { type: Object },
    context: { type: Object },
    /** @type {((url: string, opts?: RequestInit) => Promise<Response>) | null} */
    daFetch: { type: Object },
    adminOrigin: { type: String },
    fileName: { type: String, state: true },
    urls: { type: Array, state: true },
    loading: { type: Boolean, state: true },
    error: { type: String, state: true },
    info: { type: String, state: true },
    /** @type {Record<string, 'pending'|'ok'|'missing'|'error'>} */
    daExistence: { type: Object, state: true },
    /** `'upload'` | `'repo'` | `'sitemap'` | `'migration'` */
    activeTab: { type: String, state: true },
    /** List API: repo-relative folder key → items (`''` = root) */
    repoListCache: { type: Object, state: true },
    repoListLoadingRoot: { type: Boolean, state: true },
    /** @type {Record<string, boolean>} */
    repoListLoadingFolders: { type: Object, state: true },
    repoListError: { type: String, state: true },
    /** Expanded folder keys (repo-relative); children render only when open — avoids stack overflow on deep trees. */
    repoOpenFolders: { type: Object, state: true },
    compareLoading: { type: Boolean, state: true },
    compareError: { type: String, state: true },
    /** @type {{ daFileCount: number, sitemapUniqueCount: number, bothCount: number, sitemapOnlyCount: number, daOnlyCount: number, truncated: boolean, foldersVisited: number } | null} */
    compareSummary: { type: Object, state: true },
    compareBothList: { type: Array, state: true },
    compareSitemapOnlyList: { type: Array, state: true },
    compareDaOnlyList: { type: Array, state: true },
    migrationLoading: { type: Boolean, state: true },
    migrationError: { type: String, state: true },
    /** @type {{ daFileCount: number, sitemapUniqueCount: number, bothCount: number, sitemapOnlyCount: number, daOnlyCount: number, truncated: boolean, foldersVisited: number } | null} */
    migrationSnapshot: { type: Object, state: true },
    /**
     * Generic: `{ kind: 'generic', path }`. USTA: `{ kind: 'usta', path, usta, recent }`.
     * @type {{ kind: 'generic', path: ReturnType<typeof analyzeSitemapUrls> } | { kind: 'usta', path: ReturnType<typeof analyzeSitemapUrls>, usta: { total: number, typeCount: number, types: { type: string, count: number, percentage: number, example: string }[] }, recent: { url: string, lastmod: string }[] } | null}
     */
    sitemapAnalysis: { type: Object, state: true },
    /** Section bucket key (`urlSiteSection(...).display`) when scoping inventory to a section (clears picked URLs) */
    selectedSectionDisplay: { type: String, state: true },
    /** USTA: `classifyURL()` label when scoping by page type (mutually exclusive with section / picked URLs) */
    selectedPageType: { type: String, state: true },
    /** Sitemap URLs chosen in the pick list (subset scope; mutually exclusive with section / page type) */
    selectedUrls: { type: Array, state: true },
    /** Filter substring for URL picker list */
    urlPickFilter: { type: String, state: true },
    /** Ephemeral message after copy-to-clipboard */
    copyFeedback: { type: String, state: true },
  };

  constructor() {
    super();
    this.details = {};
    this.context = null;
    this.daFetch = null;
    this.adminOrigin = 'https://admin.da.live';
    this.activeTab = 'upload';
    this.repoListCache = {};
    this.repoListLoadingRoot = false;
    this.repoListLoadingFolders = {};
    this.repoListError = '';
    this.repoOpenFolders = {};
    this.compareLoading = false;
    this.compareError = '';
    this.compareSummary = null;
    this.compareBothList = [];
    this.compareSitemapOnlyList = [];
    this.compareDaOnlyList = [];
    this.migrationLoading = false;
    this.migrationError = '';
    this.migrationSnapshot = null;
    this.sitemapAnalysis = null;
    this.selectedSectionDisplay = '';
    this.selectedPageType = '';
    this.selectedUrls = [];
    this.urlPickFilter = '';
    this.copyFeedback = '';
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    this._copyFeedbackTimer = undefined;
    /** @type {AbortController | null} */
    this._compareAbort = null;
    /** @type {AbortController | null} */
    this._migrationAbort = null;
    this.fileName = '';
    this.urls = [];
    this.loading = false;
    this.error = '';
    this.info = '';
    this.daExistence = {};
    /** @type {File | null} */
    this._pendingFile = null;
    /** @type {AbortController | null} */
    this._abort = null;
    /** @type {symbol | null} */
    this._parseToken = null;
    /** @type {AbortController | null} */
    this._daVerifyAbort = null;
    /** @type {Record<string, 'ok'|'missing'|'error'> | null} */
    this._daExistenceFlush = null;
    /** @type {number} */
    this._daExistenceRaf = 0;
  }

  get _daVerifyReady() {
    return Boolean(this.daFetch && this.context?.org && this.context?.repo);
  }

  /** URLs included in tree, DA checks, and repo compare (whole sitemap or current scope). */
  get _effectiveInventoryUrls() {
    const all = this.urls;
    if (!all.length) return [];
    if (this.selectedUrls?.length) {
      const sel = new Set(this.selectedUrls);
      return all.filter((u) => sel.has(u));
    }
    if (this.selectedPageType) {
      return all.filter((u) => classifyURL(u) === this.selectedPageType);
    }
    if (this.selectedSectionDisplay) {
      return all.filter((u) => urlSiteSection(u).display === this.selectedSectionDisplay);
    }
    return all;
  }

  get _urlPickCandidates() {
    const q = (this.urlPickFilter || '').trim().toLowerCase();
    const base = this.urls;
    if (!q) return base.slice(0, URL_PICK_LIST_CAP);
    return base.filter((u) => u.toLowerCase().includes(q)).slice(0, URL_PICK_LIST_CAP);
  }

  /** Every sitemap URL matching the current filter (same rule as {@link _urlPickMatchCount}; not list-capped). */
  get _urlPickFilteredAll() {
    const q = (this.urlPickFilter || '').trim().toLowerCase();
    const base = this.urls;
    if (!base.length) return [];
    if (!q) return [...base];
    return base.filter((u) => u.toLowerCase().includes(q));
  }

  _selectAllFilteredUrls() {
    const matched = this._urlPickFilteredAll;
    if (!matched.length) return;
    this.selectedUrls = matched;
    this.selectedSectionDisplay = '';
    this.selectedPageType = '';
    this._refreshDaVerificationAfterScopeChange();
  }

  _refreshDaVerificationAfterScopeChange() {
    this._clearCompareAnalysis();
    this._startDaVerification();
  }

  /**
   * @param {string} display Section display key from analysis table
   */
  _toggleSectionSelection(display) {
    if (this.selectedSectionDisplay === display) {
      this.selectedSectionDisplay = '';
    } else {
      this.selectedSectionDisplay = display;
      this.selectedUrls = [];
      this.selectedPageType = '';
    }
    this._refreshDaVerificationAfterScopeChange();
  }

  /**
   * @param {string} type Page type label from `classifyURL()`
   */
  _togglePageTypeSelection(type) {
    if (this.selectedPageType === type) {
      this.selectedPageType = '';
    } else {
      this.selectedPageType = type;
      this.selectedSectionDisplay = '';
      this.selectedUrls = [];
    }
    this._refreshDaVerificationAfterScopeChange();
  }

  /**
   * @param {string} url
   */
  _togglePickedUrlSelection(url) {
    const cur = this.selectedUrls ?? [];
    const has = cur.includes(url);
    const next = has ? cur.filter((u) => u !== url) : [...cur, url];
    this.selectedUrls = next;
    if (next.length) {
      this.selectedSectionDisplay = '';
      this.selectedPageType = '';
    }
    this._refreshDaVerificationAfterScopeChange();
  }

  _clearScopeSelection() {
    if (!this.selectedSectionDisplay && !this.selectedUrls?.length && !this.selectedPageType) return;
    this.selectedSectionDisplay = '';
    this.selectedPageType = '';
    this.selectedUrls = [];
    this.urlPickFilter = '';
    this._refreshDaVerificationAfterScopeChange();
  }

  _scheduleCopyFeedbackClear(ms) {
    clearTimeout(this._copyFeedbackTimer);
    this._copyFeedbackTimer = setTimeout(() => {
      this.copyFeedback = '';
    }, ms);
  }

  /** Copies scoped URLs (full sitemap, one section, page type, or picked URLs) as plain text, one URL per line. */
  async _copyEffectiveUrlsToClipboard() {
    const urls = this._effectiveInventoryUrls;
    if (!urls.length || this.loading) return;
    try {
      await copyTextToClipboard(urls.join('\n'));
      const n = urls.length;
      this.copyFeedback =
        n === 1 ? STR.copy.oneCopied : invFill(STR.copy.manyCopied, { n });
      this._scheduleCopyFeedbackClear(4500);
    } catch (e) {
      this.copyFeedback = `${STR.copy.failedPrefix} ${e?.message ?? e}`;
      this._scheduleCopyFeedbackClear(6000);
    }
  }

  /** @param {{ compact?: boolean }} [opts] */
  _renderCopyUrlsButton(opts = {}) {
    const n = this._effectiveInventoryUrls.length;
    const label =
      n === 0 ? STR.copy.urls : n === 1 ? STR.copy.oneUrl : invFill(STR.copy.manyUrls, { n });
    const compact = Boolean(opts.compact);
    return html`
      <button
        type="button"
        class="ema-inv__btn ${compact ? 'ema-inv__btn--compact' : ''}"
        ?disabled=${!n || this.loading}
        aria-label=${n === 0
          ? STR.copy.ariaNone
          : invFill(STR.copy.ariaMany, { n, sPlural: n === 1 ? '' : 's' })}
        @click=${() => this._copyEffectiveUrlsToClipboard()}
      >
        ${label}
      </button>
    `;
  }

  /** Tab keys currently shown (sitemap + migration only after URLs exist; migration needs DA context). */
  get _visibleTabKeys() {
    const keys = ['upload', 'repo'];
    if (this.urls.length > 0) keys.push('sitemap');
    if (this.urls.length > 0 && this._daVerifyReady) keys.push('migration');
    return keys;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearTimeout(this._copyFeedbackTimer);
    this._migrationAbort?.abort();
  }

  firstUpdated() {
    if (this.activeTab === 'repo') void this._ensureRepoRootLoaded();
  }

  updated(changed) {
    if (
      !this.loading &&
      this.activeTab === 'sitemap' &&
      !this.urls.length &&
      (changed.has('urls') || changed.has('activeTab') || changed.has('loading'))
    ) {
      this.activeTab = 'upload';
      return;
    }
    if (
      !this.loading &&
      this.activeTab === 'migration' &&
      (!this.urls.length || !this._daVerifyReady) &&
      (changed.has('urls') || changed.has('activeTab') || changed.has('loading'))
    ) {
      this.activeTab = 'upload';
      return;
    }
    if (changed.has('activeTab') && this.activeTab === 'repo') void this._ensureRepoRootLoaded();
    if (
      changed.has('activeTab') &&
      this.activeTab === 'migration' &&
      this._daVerifyReady &&
      this.urls.length &&
      !this.migrationSnapshot &&
      !this.migrationLoading
    ) {
      void this._refreshMigrationSnapshot();
    }
  }

  async _ensureRepoRootLoaded() {
    if (!this._daVerifyReady) return;
    if ('' in this.repoListCache || this.repoListLoadingRoot) return;
    this.repoListLoadingRoot = true;
    this.repoListError = '';
    try {
      const { org, repo } = this.context;
      const items = await fetchListDirectory(this.daFetch, this.adminOrigin, org, repo, '', undefined);
      this.repoListCache = { ...this.repoListCache, '': sortDaListItems(items) };
    } catch (e) {
      this.repoListError = e?.message ?? String(e);
    } finally {
      this.repoListLoadingRoot = false;
    }
  }

  async _loadRepoFolder(folderRel) {
    if (!this._daVerifyReady || folderRel in this.repoListCache) return;
    this.repoListLoadingFolders = { ...this.repoListLoadingFolders, [folderRel]: true };
    this.repoListError = '';
    try {
      const { org, repo } = this.context;
      const items = await fetchListDirectory(this.daFetch, this.adminOrigin, org, repo, folderRel, undefined);
      this.repoListCache = { ...this.repoListCache, [folderRel]: sortDaListItems(items) };
    } catch (e) {
      this.repoListError = e?.message ?? String(e);
    } finally {
      const next = { ...this.repoListLoadingFolders };
      delete next[folderRel];
      this.repoListLoadingFolders = next;
    }
  }

  /**
   * @param {string} relFolder
   * @param {number} depth
   */
  _renderDaRepoNodes(relFolder, depth) {
    const org = this.context?.org ?? '';
    const repo = this.context?.repo ?? '';

    if (relFolder === '' && !('' in this.repoListCache)) {
      return html`<li class="ema-inv-da-repo__pending">${this.repoListLoadingRoot ? STR.repo.loadingRoot : STR.repo.rootNotLoaded}</li>`;
    }

    const cached = this.repoListCache[relFolder];
    if (cached === undefined) {
      return html`<li class="ema-inv-da-repo__pending">${STR.repo.loading}</li>`;
    }

    if (cached.length === 0) {
      return html`<li class="ema-inv-da-repo__empty">${STR.repo.emptyFolder}</li>`;
    }

    return cached.map((item) => {
      const rel = relUnderRepoFromAbs(item.path, org, repo);
      const label = item.ext ? `${item.name}.${item.ext}` : item.name;
      const repoPath = rel ? `/${rel}` : '/';

      if (!item.ext) {
        if (!rel) {
          return html`
            <li class="ema-inv-da-repo__item ema-inv-da-repo__item--folder" role="treeitem">
              <span class="ema-inv-da-repo__pending">${invFill(STR.repo.skippedFolder, { path: item.path })}</span>
            </li>
          `;
        }
        const isOpen = Boolean(this.repoOpenFolders[rel]);
        return html`
          <li class="ema-inv-da-repo__item ema-inv-da-repo__item--folder" role="treeitem">
            <details
              class="ema-inv-da-repo__details"
              ?open=${isOpen}
              @toggle=${(e) => this._onDaRepoFolderToggle(rel, e)}
            >
              <summary class="ema-inv-da-repo__summary" style="--depth: ${depth}">
                <span class="ema-inv-tree__chevron" aria-hidden="true">▸</span>
                <span class="ema-inv-da-repo__label">${label}</span>
                <code class="ema-inv-da-repo__rel">${repoPath}</code>
              </summary>
              ${isOpen
                ? html`<ul class="ema-inv-da-repo__nested" role="group">${this._renderDaRepoNodes(rel, depth + 1)}</ul>`
                : nothing}
            </details>
          </li>
        `;
      }

      const editHref = daEditHref(org, repo, repoPath);
      return html`
        <li class="ema-inv-da-repo__item ema-inv-da-repo__item--file" role="treeitem">
          <div class="ema-inv-da-repo__file-row">
            ${editHref
              ? html`<a class="ema-inv-da-repo__file-link" href=${editHref} target="_blank" rel="noopener noreferrer">${label}</a>`
              : html`<span class="ema-inv-da-repo__file-link">${label}</span>`}
            <code class="ema-inv-da-repo__path">${repoPath}</code>
            ${item.ext ? html`<span class="ema-inv-da-repo__badge">${item.ext}</span>` : nothing}
          </div>
        </li>
      `;
    });
  }

  /**
   * @param {string} folderRel
   * @param {Event} e
   */
  _onDaRepoFolderToggle(folderRel, e) {
    const el = e.target;
    if (!(el instanceof HTMLDetailsElement)) return;
    const open = el.open;
    const next = { ...this.repoOpenFolders };
    if (open) next[folderRel] = true;
    else delete next[folderRel];
    this.repoOpenFolders = next;

    if (open && !(folderRel in this.repoListCache)) void this._loadRepoFolder(folderRel);
  }

  /** Light DOM so `inventory.css` applies (Spectrum-style tokens). */
  createRenderRoot() {
    return this;
  }

  /** Horizontal Tabs keyboard model aligned with React Spectrum / ARIA (Arrow keys, Home, End). */
  _onTabListKeydown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const keys = this._visibleTabKeys;
    let i = keys.indexOf(this.activeTab);
    if (i < 0) i = 0;

    let next = i;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      next = Math.min(i + 1, keys.length - 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      next = Math.max(i - 1, 0);
    } else if (e.key === 'Home') {
      e.preventDefault();
      next = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      next = keys.length - 1;
    } else {
      return;
    }

    if (next === i) return;
    const nextKey = keys[next];
    this.activeTab = nextKey;
    void this.updateComplete.then(() => {
      const btn = this.querySelector(`#ema-inv-tab-${nextKey}`);
      if (btn instanceof HTMLElement) btn.focus();
    });
  }

  _focusTab(key) {
    if (key === 'sitemap' && !this.urls.length) return;
    if (key === 'migration' && (!this.urls.length || !this._daVerifyReady)) return;
    this.activeTab = key;
    void this.updateComplete.then(() => {
      const btn = this.querySelector(`#ema-inv-tab-${key}`);
      if (btn instanceof HTMLElement) btn.focus();
    });
  }

  _onFileChange(e) {
    const input = e.target;
    const f = input.files?.[0] ?? null;
    this._abort?.abort();
    this._pendingFile = f;
    this.fileName = f?.name ?? '';
    this.error = '';
    this.info = '';

    this.urls = [];
    this.sitemapAnalysis = null;
    this.selectedSectionDisplay = '';
    this.selectedPageType = '';
    this.selectedUrls = [];
    this.urlPickFilter = '';
    this.copyFeedback = '';
    clearTimeout(this._copyFeedbackTimer);
    this.daExistence = {};
    this._daVerifyAbort?.abort();
    this._migrationAbort?.abort();
    this.migrationSnapshot = null;
    this.migrationError = '';
    this.migrationLoading = false;
    this._clearCompareAnalysis();
    if (this.activeTab === 'sitemap' || this.activeTab === 'migration') this.activeTab = 'upload';

    if (!f) {
      this.loading = false;
      this._parseToken = null;
      return;
    }
    void this._parseSitemapFile(f);
  }

  _flushDaExistence() {
    this._daExistenceRaf = 0;
    const batch = this._daExistenceFlush;
    this._daExistenceFlush = null;
    if (!batch || !Object.keys(batch).length) return;
    this.daExistence = { ...this.daExistence, ...batch };
  }

  _queueDaExistenceUpdate(path, status) {
    if (!this._daExistenceFlush) this._daExistenceFlush = {};
    this._daExistenceFlush[path] = status;
    if (this._daExistenceRaf) return;
    this._daExistenceRaf = requestAnimationFrame(() => this._flushDaExistence());
  }

  _startDaVerification() {
    this._daVerifyAbort?.abort();
    if (this._daExistenceRaf) {
      cancelAnimationFrame(this._daExistenceRaf);
      this._daExistenceRaf = 0;
    }
    this._daExistenceFlush = null;

    this._daVerifyAbort = new AbortController();
    const { signal } = this._daVerifyAbort;

    if (!this._daVerifyReady) {
      this.daExistence = {};
      return;
    }

    const org = this.context.org;
    const repo = this.context.repo;
    const { daFetch, adminOrigin } = this;

    const scoped = this._effectiveInventoryUrls;
    const allPaths = [...new Set(scoped.map(siteUrlToRepoSourcePath).filter((p) => p && p !== '/'))];
    const truncated = allPaths.length > DA_VERIFY_MAX_PATHS;
    const paths = allPaths.slice(0, DA_VERIFY_MAX_PATHS);

    if (paths.length === 0) {
      this.daExistence = {};
      return;
    }

    this.daExistence = Object.fromEntries(paths.map((p) => [p, 'pending']));

    if (truncated) {
      const skipped = allPaths.length - DA_VERIFY_MAX_PATHS;
      const msg = invFill(STR.verify.truncated, { maxPaths: DA_VERIFY_MAX_PATHS, skipped });
      this.info = this.info ? `${this.info} ${msg}` : msg;
    }

    void verifyRepoPathsAgainstDa({
      paths,
      daFetch,
      adminOrigin,
      org,
      repo,
      signal,
      onUpdate: (path, status) => {
        if (signal.aborted) return;
        this._queueDaExistenceUpdate(path, status);
      },
      concurrency: DA_VERIFY_CONCURRENCY,
    }).then(() => {
      if (!signal.aborted) this._flushDaExistence();
    });
  }

  _clearCompareAnalysis() {
    this._compareAbort?.abort();
    this._compareAbort = null;
    this.compareLoading = false;
    this.compareError = '';
    this.compareSummary = null;
    this.compareBothList = [];
    this.compareSitemapOnlyList = [];
    this.compareDaOnlyList = [];
  }

  async _onCompareWithRepo() {
    if (!this._daVerifyReady || !this._effectiveInventoryUrls.length) return;

    this._compareAbort?.abort();
    this._compareAbort = new AbortController();
    const { signal } = this._compareAbort;

    this.compareLoading = true;
    this.compareError = '';
    this.compareSummary = null;
    this.compareBothList = [];
    this.compareSitemapOnlyList = [];
    this.compareDaOnlyList = [];

    try {
      const { org, repo } = this.context;
      const { daFetch, adminOrigin } = this;

      const { files: daFiles, truncated, foldersVisited } = await crawlRepoAllFileRels(
        daFetch,
        adminOrigin,
        org,
        repo,
        signal,
        { maxFolders: DA_CRAWL_MAX_FOLDERS },
      );

      if (signal.aborted) return;

      const smSet = uniqueSitemapRepoRels(this._effectiveInventoryUrls);
      const smSorted = [...smSet].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      const daSorted = [...daFiles].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      const both = smSorted.filter((r) => daFiles.has(r));
      const sitemapOnly = smSorted.filter((r) => !daFiles.has(r));
      const daOnly = daSorted.filter((r) => !smSet.has(r));

      this.compareSummary = {
        daFileCount: daFiles.size,
        sitemapUniqueCount: smSet.size,
        bothCount: both.length,
        sitemapOnlyCount: sitemapOnly.length,
        daOnlyCount: daOnly.length,
        truncated,
        foldersVisited,
      };

      const capSlice = (arr) => arr.slice(0, COMPARE_LIST_PREVIEW_CAP);
      this.compareBothList = capSlice(both);
      this.compareSitemapOnlyList = capSlice(sitemapOnly);
      this.compareDaOnlyList = capSlice(daOnly);
    } catch (e) {
      if (signal.aborted || e?.name === 'AbortError') return;
      this.compareError = e?.message ?? String(e);
    } finally {
      if (!signal.aborted) this.compareLoading = false;
    }
  }

  async _refreshMigrationSnapshot() {
    if (!this._daVerifyReady || !this.urls.length) return;

    this._migrationAbort?.abort();
    this._migrationAbort = new AbortController();
    const { signal } = this._migrationAbort;

    this.migrationLoading = true;
    this.migrationError = '';

    try {
      const { org, repo } = this.context;
      const { daFetch, adminOrigin } = this;

      const { files: daFiles, truncated, foldersVisited } = await crawlRepoAllFileRels(
        daFetch,
        adminOrigin,
        org,
        repo,
        signal,
        { maxFolders: DA_CRAWL_MAX_FOLDERS },
      );

      if (signal.aborted) return;

      const smSet = uniqueSitemapRepoRels(this.urls);

      const both = [...smSet].filter((r) => daFiles.has(r)).length;
      const sitemapOnly = smSet.size - both;
      const daOnly = [...daFiles].filter((r) => !smSet.has(r)).length;

      this.migrationSnapshot = {
        daFileCount: daFiles.size,
        sitemapUniqueCount: smSet.size,
        bothCount: both,
        sitemapOnlyCount: sitemapOnly,
        daOnlyCount: daOnly,
        truncated,
        foldersVisited,
      };
    } catch (e) {
      if (signal.aborted || e?.name === 'AbortError') return;
      this.migrationError = e?.message ?? String(e);
    } finally {
      if (!signal.aborted) this.migrationLoading = false;
    }
  }

  /**
   * Parse a local sitemap file (called automatically on file selection).
   * Ignores stale completions if the user picks another file while parsing.
   * @param {File} file
   */
  async _parseSitemapFile(file) {
    this._abort?.abort();
    this._abort = new AbortController();
    const { signal } = this._abort;
    const token = Symbol('parse');
    this._parseToken = token;

    this._daVerifyAbort?.abort();
    this._migrationAbort?.abort();
    this.daExistence = {};
    this._clearCompareAnalysis();
    this.migrationSnapshot = null;
    this.migrationError = '';
    this.migrationLoading = false;

    this.loading = true;
    this.error = '';
    this.info = '';

    try {
      const xmlText = await readFileAsText(file);
      if (signal.aborted || this._pendingFile !== file) return;

      const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
      if (doc.querySelector('parsererror')) {
        throw new Error(STR.errors.invalidSitemapXml);
      }

      const root = doc.documentElement?.localName;
      /** @type {string[]} */
      let urls = [];
      if (root === 'sitemapindex') {
        this.info = STR.parse.sitemapIndexInfo;
        urls = await expandToPageUrls(xmlText, { signal });
        if (urls.length === 0) {
          urls = parseUrlsetLocs(xmlText);
          if (urls.length > 0) {
            this.info = STR.parse.nestedFailedInfo;
          }
        }
      } else {
        urls = parseUrlsetLocs(xmlText);
      }

      if (signal.aborted || this._pendingFile !== file) return;

      const isUsta = looksLikeUstaSitemap(urls);
      let finalUrls = urls;
      if (isUsta) {
        if (root !== 'sitemapindex') {
          const enOnly = parseSitemap(xmlText);
          finalUrls = enOnly.length ? enOnly : urls.filter((u) => u.includes('/en/'));
        } else {
          finalUrls = urls.filter((u) => u.includes('/en/'));
        }
      }

      this.urls = finalUrls;

      if (this.urls.length === 0) {
        this.sitemapAnalysis = null;
        this.selectedSectionDisplay = '';
        this.selectedPageType = '';
        this.selectedUrls = [];
        this.urlPickFilter = '';
        this.info = isUsta ? STR.parse.noUrlsUsta : STR.parse.noUrlsGeneric;
      } else {
        this.selectedSectionDisplay = '';
        this.selectedPageType = '';
        this.selectedUrls = [];
        this.urlPickFilter = '';
        const pathBuckets = analyzeSitemapUrls(this.urls);
        if (isUsta) {
          const recent =
            root !== 'sitemapindex'
              ? getRecentURLs(xmlText).slice(0, RECENT_URLS_PREVIEW_CAP)
              : [];
          this.sitemapAnalysis = {
            kind: 'usta',
            path: pathBuckets,
            usta: analyzeSitemap(this.urls),
            recent,
          };
        } else {
          this.sitemapAnalysis = { kind: 'generic', path: pathBuckets };
        }
        this._startDaVerification();
      }
    } catch (e) {
      if (signal.aborted || this._pendingFile !== file) return;
      const msg = e?.name === 'AbortError' ? STR.errors.cancelled : (e?.message ?? String(e));
      this.error = msg;
      this.urls = [];
      this.sitemapAnalysis = null;
      this.selectedSectionDisplay = '';
      this.selectedPageType = '';
      this.selectedUrls = [];
      this.urlPickFilter = '';
      this.daExistence = {};
    } finally {
      if (this._parseToken === token) this.loading = false;
      if (
        !this.urls.length &&
        (this.activeTab === 'sitemap' || this.activeTab === 'migration')
      ) {
        this.activeTab = 'upload';
      }
    }
  }

  /**
   * @param {string[]} paths preview slice
   * @param {number} totalCount
   */
  _renderComparePathRows(paths, totalCount) {
    const extra = Math.max(0, totalCount - paths.length);
    return html`
      <ul class="ema-inv__compare-list">
        ${paths.map((rel) => html`<li><code class="ema-inv__compare-code">/${rel}</code></li>`)}
      </ul>
      ${extra > 0
        ? html`<p class="ema-inv__compare-foot">${invFill(STR.compare.pathsFoot, { shown: paths.length, total: totalCount })}</p>`
        : nothing}
    `;
  }

  _renderSitemapComparePanel() {
    return html`
      <div class="ema-inv__panel ema-inv__panel--compare">
        <div class="ema-inv__panel-head">
          <span>${STR.compare.panelTitle}</span>
          <span>${STR.compare.panelSubtitle}</span>
        </div>
        <div class="ema-inv__panel-note ema-inv__panel-note--flush">
          ${STR.compare.noteBeforeLink}
          <a href="https://docs.da.live/developers/api/list" target="_blank" rel="noopener noreferrer">${STR.compare.listApiLinkText}</a>${STR.compare.noteAfterLink}
          ${this.compareSummary?.truncated
            ? html`<strong>${invFill(STR.compare.truncatedStrong, { maxFolders: DA_CRAWL_MAX_FOLDERS })}</strong>`
            : nothing}
        </div>
        <div class="ema-inv__compare-actions">
          <button
            type="button"
            class="ema-inv__btn ema-inv__btn--primary"
            ?disabled=${!this._effectiveInventoryUrls.length || !this._daVerifyReady || this.compareLoading || this.loading}
            @click=${() => this._onCompareWithRepo()}
          >
            ${this.compareLoading ? STR.compare.scanning : STR.compare.compareButton}
          </button>
        </div>
        ${!this._daVerifyReady && this.urls.length
          ? html`
              <p class="ema-inv__status ema-inv__status--info">
                ${STR.compare.needDa}
              </p>
            `
          : nothing}
        ${this.compareError ? html`<p class="ema-inv__status ema-inv__status--error" role="alert">${this.compareError}</p>` : nothing}
        ${this.compareSummary
          ? html`
              <div class="ema-inv__compare-stats">
                <span><strong>${this.compareSummary.bothCount}</strong> ${STR.compare.statBoth}</span>
                <span><strong>${this.compareSummary.sitemapOnlyCount}</strong> ${STR.compare.statSitemapOnly}</span>
                <span><strong>${this.compareSummary.daOnlyCount}</strong> ${STR.compare.statRepoOnly}</span>
                <span class="ema-inv__compare-stats-meta">${invFill(STR.compare.statMeta, {
                  daFiles: this.compareSummary.daFileCount,
                  sitemapPaths: this.compareSummary.sitemapUniqueCount,
                  foldersVisited: this.compareSummary.foldersVisited,
                })}</span>
              </div>
              <div class="ema-inv__compare-columns">
                <div class="ema-inv__compare-column">
                  <h3 class="ema-inv__compare-col-title">${STR.compare.colBoth}</h3>
                  ${this._renderComparePathRows(this.compareBothList, this.compareSummary.bothCount)}
                </div>
                <div class="ema-inv__compare-column">
                  <h3 class="ema-inv__compare-col-title">${STR.compare.colSitemapOnly}</h3>
                  ${this._renderComparePathRows(this.compareSitemapOnlyList, this.compareSummary.sitemapOnlyCount)}
                </div>
                <div class="ema-inv__compare-column">
                  <h3 class="ema-inv__compare-col-title">${STR.compare.colRepoOnly}</h3>
                  ${this._renderComparePathRows(this.compareDaOnlyList, this.compareSummary.daOnlyCount)}
                </div>
              </div>
            `
          : nothing}
      </div>
    `;
  }

  /** Match count for URL picker hint (may exceed list cap). */
  get _urlPickMatchCount() {
    const q = (this.urlPickFilter || '').trim().toLowerCase();
    if (!this.urls.length) return 0;
    if (!q) return this.urls.length;
    return this.urls.filter((u) => u.toLowerCase().includes(q)).length;
  }

  /**
   * Dark overview: stats + scrollable list of **actual sections** (real URL path prefixes per hostname).
   * Same grouping as `urlSiteSection`: first folder, or locale + second folder when applicable.
   * @param {ReturnType<typeof analyzeSitemapUrls>} a
   */
  _renderSitemapDashboard(a) {
    const sections = a.sections ?? [];
    const preview = sections.slice(0, DASH_SECTION_PREVIEW_CAP);
    const overflow = Math.max(0, sections.length - preview.length);

    const top = sections[0];
    const second = sections[1];
    const topLabel = top ? prettifySectionDisplay(top.display) : '—';
    const secondLabel = second ? prettifySectionDisplay(second.display) : '—';

    return html`
      <div class="ema-inv-dash" aria-label="Sitemap overview">
        <p class="ema-inv-dash__explainer">
          <strong>Sections</strong> come straight from each URL’s path: same hostname plus the first directory segment after
          the root, or <strong>two</strong> segments when the first looks like a locale (<code>en</code>,
          <code>fr-CA</code>, …). Every URL is counted in exactly one section — these are site areas, not inferred templates.
        </p>

        <div class="ema-inv-dash__cards">
          <div class="ema-inv-dash__card">
            <div class="ema-inv-dash__card-label">Total URLs</div>
            <div class="ema-inv-dash__card-value">${a.pageCount.toLocaleString()}</div>
          </div>
          <div class="ema-inv-dash__card">
            <div class="ema-inv-dash__card-label">Sections</div>
            <div class="ema-inv-dash__card-value">${sections.length.toLocaleString()}</div>
            <div class="ema-inv-dash__card-hint">Distinct path prefixes</div>
          </div>
          <div class="ema-inv-dash__card">
            <div class="ema-inv-dash__card-label">Top section</div>
            <div class="ema-inv-dash__card-value ema-inv-dash__card-value--text" title=${top?.display ?? ''}>
              ${topLabel}
            </div>
          </div>
          <div class="ema-inv-dash__card">
            <div class="ema-inv-dash__card-label">Runner-up</div>
            <div class="ema-inv-dash__card-value ema-inv-dash__card-value--text" title=${second?.display ?? ''}>
              ${secondLabel}
            </div>
          </div>
        </div>
        ${a.hosts.length
          ? html`<p class="ema-inv-dash__hosts">Hostnames: <code>${a.hosts.join(', ')}</code></p>`
          : nothing}

        <div class="ema-inv-dash__sections" role="region" aria-label="URLs by section">
          <div class="ema-inv-dash__sections-head">
            <span>Sections</span>
            <span>${sections.length.toLocaleString()} total · click to scope</span>
          </div>
          <ul class="ema-inv-dash__sections-list">
            ${preview.map((row) => {
              const selected =
                this.selectedSectionDisplay === row.display && !this.selectedUrls?.length;
              return html`
                <li>
                  <button
                    type="button"
                    class="ema-inv-dash__section-row ${selected ? 'ema-inv-dash__section-row--selected' : ''}"
                    title=${row.display}
                    aria-pressed=${selected ? 'true' : 'false'}
                    @click=${() => this._toggleSectionSelection(row.display)}
                  >
                    <span class="ema-inv-dash__section-row-main">
                      <span class="ema-inv-dash__section-title">${prettifySectionDisplay(row.display)}</span>
                      <code class="ema-inv-dash__section-key">${row.display}</code>
                    </span>
                    <span class="ema-inv-dash__section-count">${row.count.toLocaleString()}</span>
                  </button>
                </li>
              `;
            })}
          </ul>
          ${overflow > 0
            ? html`<p class="ema-inv-dash__sections-overflow">${overflow} more section${overflow === 1 ? '' : 's'} — full list in the table below.</p>`
            : nothing}
          <p class="ema-inv-dash__sections-hint">
            Click a row to scope URLs under that prefix · <strong>Copy URLs</strong> copies the scoped list (one per line)
          </p>
        </div>
      </div>
    `;
  }

  /**
   * @param {{ total: number, typeCount: number, types: { type: string, count: number, percentage: number, example: string }[] }} usta
   * @param {ReturnType<typeof analyzeSitemapUrls>} pathAnalysis
   */
  _renderUstaPageTypeDashboard(usta, pathAnalysis) {
    const types = usta.types ?? [];
    const preview = types.slice(0, DASH_USTA_TYPE_PREVIEW_CAP);
    const overflow = Math.max(0, types.length - preview.length);
    const top = types[0];
    const second = types[1];

    return html`
      <div class="ema-inv-dash" aria-label="USTA sitemap page-type overview">
        <p class="ema-inv-dash__explainer">
          English-only URLs (<code>/en/</code>) from <code>parseSitemap()</code> are classified with
          <code>classifyURL()</code> using path segments and keywords — no external calls. Counts and examples come from
          <code>analyzeSitemap()</code>.
        </p>

        <div class="ema-inv-dash__cards">
          <div class="ema-inv-dash__card">
            <div class="ema-inv-dash__card-label">Total URLs</div>
            <div class="ema-inv-dash__card-value">${usta.total.toLocaleString()}</div>
          </div>
          <div class="ema-inv-dash__card">
            <div class="ema-inv-dash__card-label">Page types</div>
            <div class="ema-inv-dash__card-value">${usta.typeCount.toLocaleString()}</div>
            <div class="ema-inv-dash__card-hint">Distinct labels</div>
          </div>
          <div class="ema-inv-dash__card">
            <div class="ema-inv-dash__card-label">Top type</div>
            <div class="ema-inv-dash__card-value ema-inv-dash__card-value--text" title=${top?.type ?? ''}>
              ${top?.type ?? '—'}
            </div>
          </div>
          <div class="ema-inv-dash__card">
            <div class="ema-inv-dash__card-label">Runner-up</div>
            <div class="ema-inv-dash__card-value ema-inv-dash__card-value--text" title=${second?.type ?? ''}>
              ${second?.type ?? '—'}
            </div>
          </div>
        </div>
        ${pathAnalysis.hosts.length
          ? html`<p class="ema-inv-dash__hosts">Hostnames: <code>${pathAnalysis.hosts.join(', ')}</code></p>`
          : nothing}

        <div class="ema-inv-dash__sections" role="region" aria-label="URLs by page type">
          <div class="ema-inv-dash__sections-head">
            <span>Page types</span>
            <span>${types.length.toLocaleString()} total · click to scope</span>
          </div>
          <ul class="ema-inv-dash__sections-list">
            ${preview.map((row) => {
              const selected =
                this.selectedPageType === row.type && !this.selectedUrls?.length;
              return html`
                <li>
                  <button
                    type="button"
                    class="ema-inv-dash__section-row ${selected ? 'ema-inv-dash__section-row--selected' : ''}"
                    title=${row.example}
                    aria-pressed=${selected ? 'true' : 'false'}
                    @click=${() => this._togglePageTypeSelection(row.type)}
                  >
                    <span class="ema-inv-dash__section-row-main">
                      <span class="ema-inv-dash__section-title">${row.type}</span>
                      <span class="ema-inv-dash__section-key">${row.percentage}%</span>
                    </span>
                    <span class="ema-inv-dash__section-count">${row.count.toLocaleString()}</span>
                  </button>
                </li>
              `;
            })}
          </ul>
          ${overflow > 0
            ? html`<p class="ema-inv-dash__sections-overflow">${overflow} more type${overflow === 1 ? '' : 's'} — full list in the table below.</p>`
            : nothing}
          <p class="ema-inv-dash__sections-hint">
            Click a row to scope URLs of that type · <strong>Copy URLs</strong> copies the scoped list (one per line)
          </p>
        </div>
      </div>
    `;
  }

  /**
   * @param {{ url: string, lastmod: string }[]} recent
   */
  _renderUstaRecentPanel(recent) {
    if (!recent?.length) return nothing;
    return html`
      <div class="ema-inv__panel ema-inv__panel--analysis">
        <div class="ema-inv__panel-head">
          <span>Recently modified</span>
          <span>&lt;lastmod&gt; from urlset · newest first</span>
        </div>
        <p class="ema-inv__panel-note ema-inv__panel-note--flush">
          From <code>getRecentURLs()</code>: English URLs only, sorted by <code>lastmod</code> string (ISO dates sort
          chronologically).
        </p>
        <div class="ema-inv__analysis-table-wrap">
          <table class="ema-inv__analysis-table">
            <thead>
              <tr>
                <th scope="col">URL</th>
                <th scope="col" class="ema-inv__analysis-num">Last modified</th>
              </tr>
            </thead>
            <tbody>
              ${recent.map(
                (row) => html`
                  <tr>
                    <td>
                      <a class="ema-inv-tree__link" href=${row.url} target="_blank" rel="noopener noreferrer">${row.url}</a>
                    </td>
                    <td class="ema-inv__analysis-num"><code class="ema-inv__analysis-code">${row.lastmod || '—'}</code></td>
                  </tr>
                `,
              )}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  /**
   * @param {boolean} listTruncated
   * @param {number} matchCount
   */
  _renderUrlPickPanel(listTruncated, matchCount) {
    return html`
      <div class="ema-inv__panel ema-inv__panel--analysis">
        <div class="ema-inv__panel-head">
          <span>Pick URLs</span>
          <span>filter · click to add or remove from scope</span>
        </div>
        <p class="ema-inv__panel-note ema-inv__panel-note--flush">
          Type to narrow the list. Click a URL to include it in the scoped set; click again to remove.
          <strong>Select all matching</strong> adds every URL that matches the filter (including matches not shown in the
          list when it is truncated). Choosing a section or page type clears the URL pick.
        </p>
        <div class="ema-inv__field ema-inv__field--compact">
          <label class="ema-inv__label" for="ema-inv-url-filter">Filter URLs</label>
          <input
            id="ema-inv-url-filter"
            class="ema-inv__input"
            type="search"
            autocomplete="off"
            placeholder="Substring match…"
            .value=${this.urlPickFilter}
            @input=${(e) => {
              const el = e.target;
              if (el instanceof HTMLInputElement) this.urlPickFilter = el.value;
            }}
          />
        </div>
        <div class="ema-inv__url-pick-actions">
          <button
            type="button"
            class="ema-inv__btn ema-inv__btn--compact"
            ?disabled=${!matchCount || this.loading}
            aria-label=${matchCount
              ? `Select all ${matchCount.toLocaleString()} URL${matchCount === 1 ? '' : 's'} matching the current filter`
              : 'Select all matching (no URLs match the filter)'}
            @click=${() => this._selectAllFilteredUrls()}
          >
            Select all matching${matchCount ? ` (${matchCount.toLocaleString()})` : ''}
          </button>
        </div>
        ${listTruncated
          ? html`<p class="ema-inv__analysis-foot">
              Showing first ${URL_PICK_LIST_CAP} of ${matchCount} match${matchCount === 1 ? '' : 'es'} — refine the filter
              to find a URL.
            </p>`
          : nothing}
        <ul class="ema-inv__url-pick-list" aria-label="URLs matching filter">
          ${this._urlPickCandidates.map(
            (u) => html`
              <li>
                <button
                  type="button"
                  class="ema-inv__url-pick-item ${this.selectedUrls?.includes(u) ? 'ema-inv__url-pick-item--selected' : ''}"
                  aria-pressed=${this.selectedUrls?.includes(u) ? 'true' : 'false'}
                  @click=${() => this._togglePickedUrlSelection(u)}
                >
                  ${u}
                </button>
              </li>
            `,
          )}
        </ul>
      </div>
    `;
  }

  _renderSitemapAnalysis() {
    if (this.loading && !this.urls.length) {
      return html`<p class="ema-inv__status ema-inv__status--info">Parsing sitemap…</p>`;
    }
    const bundle = this.sitemapAnalysis;
    if (!bundle || !this.urls.length) return nothing;

    const matchCount = this._urlPickMatchCount;
    const listTruncated = matchCount > URL_PICK_LIST_CAP;

    if (bundle.kind === 'usta' && bundle.usta) {
      const scopeActive = Boolean(
        this.selectedPageType || this.selectedSectionDisplay || this.selectedUrls?.length,
      );
      const usta = bundle.usta;
      const types = usta.types ?? [];

      return html`
        <div class="ema-inv__analysis">
          ${this._renderUstaPageTypeDashboard(usta, bundle.path)}
          ${this._renderUstaRecentPanel(bundle.recent ?? [])}

          <div class="ema-inv__analysis-scope-intro">
            <span class="ema-inv__analysis-scope-intro-text">
              Scope using the dashboard <strong>page types</strong>, the full <strong>page types</strong> table, or
              <strong>one or more URLs</strong> from the pick list. <strong>Copy URLs</strong> copies that set; scope also drives the
              Sitemap inventory tab and DA / repo checks.
              ${scopeActive
                ? html`
                    Active scope: <strong>${this._effectiveInventoryUrls.length}</strong> URL(s).
                    <button type="button" class="ema-inv__btn" @click=${() => this._clearScopeSelection()}>
                      Clear scope
                    </button>
                  `
                : html` Nothing scoped — clipboard and inventory use the full English URL list.`}
            </span>
            <span class="ema-inv__scope-actions">${this._renderCopyUrlsButton()}</span>
          </div>

          <div class="ema-inv__panel ema-inv__panel--analysis">
            <div class="ema-inv__panel-head">
              <span>Page types</span>
              <span>${types.length} types · click to scope</span>
            </div>
            <p class="ema-inv__panel-note ema-inv__panel-note--flush">
              Each row is a label from <code>classifyURL()</code>. Click again on the selected row to clear (or use Clear
              scope). Example opens the representative URL in a new tab.
            </p>
            <div class="ema-inv__analysis-table-wrap ema-inv__analysis-table-wrap--sections">
              <table class="ema-inv__analysis-table">
                <thead>
                  <tr>
                    <th scope="col">Type</th>
                    <th scope="col" class="ema-inv__analysis-num">Pages</th>
                    <th scope="col" class="ema-inv__analysis-num">%</th>
                    <th scope="col">Example</th>
                  </tr>
                </thead>
                <tbody>
                  ${types.map(
                    (row) => html`
                      <tr
                        class="ema-inv__analysis-select-row ${this.selectedPageType === row.type
                          ? 'ema-inv__analysis-select-row--selected'
                          : ''}"
                        tabindex="0"
                        role="button"
                        aria-pressed=${this.selectedPageType === row.type ? 'true' : 'false'}
                        @click=${() => this._togglePageTypeSelection(row.type)}
                        @keydown=${(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            this._togglePageTypeSelection(row.type);
                          }
                        }}
                      >
                        <td>${row.type}</td>
                        <td class="ema-inv__analysis-num">${row.count}</td>
                        <td class="ema-inv__analysis-num">${row.percentage}</td>
                        <td>
                          <a
                            class="ema-inv-tree__link"
                            href=${row.example}
                            target="_blank"
                            rel="noopener noreferrer"
                            @click=${(e) => e.stopPropagation()}
                            ><code class="ema-inv__analysis-code">${row.example}</code></a
                          >
                        </td>
                      </tr>
                    `,
                  )}
                </tbody>
              </table>
            </div>
          </div>

          ${this._renderUrlPickPanel(listTruncated, matchCount)}
        </div>
      `;
    }

    const p = bundle.path;
    if (!p) return nothing;

    const scopeActive = Boolean(this.selectedSectionDisplay || this.selectedUrls?.length);

    return html`
      <div class="ema-inv__analysis">
        ${this._renderSitemapDashboard(p)}

        <div class="ema-inv__analysis-scope-intro">
          <span class="ema-inv__analysis-scope-intro-text">
            Scope using the dashboard <strong>sections</strong> list, the full <strong>sections</strong> table, or
            <strong>one or more URLs</strong> from the pick list. <strong>Copy URLs</strong> copies that set; scope also drives the
            Sitemap inventory tab and DA / repo checks.
            ${scopeActive
              ? html`
                  Active scope: <strong>${this._effectiveInventoryUrls.length}</strong> URL(s).
                  <button type="button" class="ema-inv__btn" @click=${() => this._clearScopeSelection()}>Clear scope</button>
                `
              : html` Nothing scoped — clipboard and inventory use the full sitemap.`}
          </span>
          <span class="ema-inv__scope-actions">${this._renderCopyUrlsButton()}</span>
        </div>

        <div class="ema-inv__panel ema-inv__panel--analysis">
          <div class="ema-inv__panel-head">
            <span>Site sections</span>
            <span>${p.sections.length} buckets · click to scope</span>
          </div>
          <p class="ema-inv__panel-note ema-inv__panel-note--flush">
            Groups URLs by hostname plus the first path folder, or two folders when the first looks like a locale code
            (<code>en</code>, <code>fr-CA</code>, …). Click again on the selected row to clear that selection (or use Clear
            scope).
          </p>
          <div class="ema-inv__analysis-table-wrap ema-inv__analysis-table-wrap--sections">
            <table class="ema-inv__analysis-table">
              <thead>
                <tr>
                  <th scope="col">Section</th>
                  <th scope="col" class="ema-inv__analysis-num">Pages</th>
                </tr>
              </thead>
              <tbody>
                ${p.sections.map(
                  (row) => html`
                    <tr
                      class="ema-inv__analysis-select-row ${this.selectedSectionDisplay === row.display
                        ? 'ema-inv__analysis-select-row--selected'
                        : ''}"
                      tabindex="0"
                      role="button"
                      aria-pressed=${this.selectedSectionDisplay === row.display ? 'true' : 'false'}
                      @click=${() => this._toggleSectionSelection(row.display)}
                      @keydown=${(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          this._toggleSectionSelection(row.display);
                        }
                      }}
                    >
                      <td><code class="ema-inv__analysis-code">${row.display}</code></td>
                      <td class="ema-inv__analysis-num">${row.count}</td>
                    </tr>
                  `,
                )}
              </tbody>
            </table>
          </div>
        </div>

        ${this._renderUrlPickPanel(listTruncated, matchCount)}
      </div>
    `;
  }

  _renderUploadPanel() {
    return html`
      <p class="ema-inv__lead ema-inv__lead--tab">
        Choose your sitemap file below — we read it as soon as you pick it. Use <strong>Sitemap inventory</strong> when you
        want to browse URLs as a tree, see what exists in Document Authoring, or compare the list to your repository. If
        your file is a <strong>master list</strong> that points to other sitemap files, we try to load up to 40 of those
        links over the web; if that is not possible from your browser, you will only see the entries from the master file
        itself.
      </p>

      <div class="ema-inv__field">
        <label class="ema-inv__label" for="ema-inv-sitemap-file">Sitemap file</label>
        <input
          id="ema-inv-sitemap-file"
          class="ema-inv__file"
          type="file"
          accept=".xml,.txt,text/xml,application/xml,application/xhtml+xml"
          ?disabled=${this.loading}
          @change=${this._onFileChange}
        />
        ${this.fileName ? html`<p class="ema-inv__file-name">Selected: <strong>${this.fileName}</strong></p>` : ''}
      </div>

      ${this.error ? html`<p class="ema-inv__status ema-inv__status--error" role="alert">${this.error}</p>` : nothing}
      ${this.info && !this.error ? html`<p class="ema-inv__status ema-inv__status--info">${this.info}</p>` : nothing}

      ${this._renderSitemapAnalysis()}
    `;
  }

  _renderRepoBrowserPanel() {
    if (!this._daVerifyReady) {
      return html`
        <p class="ema-inv__status ema-inv__status--info">
          Open this tool inside Document Authoring to browse the repository with the
          <a href="https://docs.da.live/developers/api/list" target="_blank" rel="noopener noreferrer">List API</a>.
        </p>
      `;
    }
    const org = this.context.org;
    const repo = this.context.repo;
    return html`
      <p class="ema-inv__lead ema-inv__lead--tab">
        Current content in <strong>${org}</strong> / <strong>${repo}</strong>, loaded via the
        <a href="https://docs.da.live/developers/api/list" target="_blank" rel="noopener noreferrer">List API</a>
        (<code>${this.adminOrigin}/list/${org}/${repo}/…</code>). Expand folders to load their children.
      </p>
      ${this.repoListError ? html`<p class="ema-inv__status ema-inv__status--error" role="alert">${this.repoListError}</p>` : nothing}
      <div class="ema-inv__panel">
        <div class="ema-inv__panel-head">
          <span>Repository tree</span>
          <span>${this.adminOrigin}</span>
        </div>
        <div class="ema-inv__panel-scroll">
          <div class="ema-inv-da-repo" role="tree">
            <ul class="ema-inv-da-repo__nested ema-inv-da-repo__nested--root" role="group">
              ${this._renderDaRepoNodes('', 0)}
            </ul>
          </div>
        </div>
      </div>
    `;
  }

  _renderMigrationPanel() {
    const ready = this._daVerifyReady && this.urls.length > 0;
    if (!ready) {
      return html`
        <p class="ema-inv__status ema-inv__status--info">
          Upload and parse a sitemap first, then open this tab inside Document Authoring so the repo can be crawled.
        </p>
      `;
    }

    const sn = this.migrationSnapshot;
    const pctRounded =
      sn && sn.sitemapUniqueCount > 0
        ? Math.round((100 * sn.bothCount) / sn.sitemapUniqueCount)
        : 0;
    const pctStyle = sn && sn.sitemapUniqueCount > 0 ? `${pctRounded}%` : '0%';

    return html`
      <p class="ema-inv__lead ema-inv__lead--tab">
        <strong>Migration snapshot</strong> — every URL in the parsed sitemap is mapped to a repo-relative path (same rule
        as the URL tree). The chart compares those <strong>${this.urls.length}</strong> sitemap URL line(s) to
        <strong>all files</strong> discovered in this org/repo via the List API (not scoped by section).
      </p>

      <div class="ema-inv__panel ema-inv__panel--migrate">
        <div class="ema-inv__panel-head ema-inv__panel-head--wrap">
          <span class="ema-inv__panel-head-title">Sitemap vs DA repository</span>
          <button
            type="button"
            class="ema-inv__btn ema-inv__btn--compact"
            ?disabled=${this.migrationLoading}
            @click=${() => this._refreshMigrationSnapshot()}
          >
            ${this.migrationLoading ? 'Refreshing…' : 'Refresh snapshot'}
          </button>
        </div>

        ${this.migrationLoading && !sn
          ? html`<p class="ema-inv__panel-note" aria-live="polite">Crawling repository and comparing paths…</p>`
          : nothing}
        ${this.migrationLoading && sn
          ? html`<p class="ema-inv__panel-note" aria-live="polite">Refreshing snapshot…</p>`
          : nothing}
        ${this.migrationError
          ? html`<p class="ema-inv__status ema-inv__status--error" role="alert">${this.migrationError}</p>`
          : nothing}

        ${sn
          ? html`
              ${sn.truncated
                ? html`<p class="ema-inv__panel-note">
                    List crawl hit the folder limit (${DA_CRAWL_MAX_FOLDERS} folders visited). Counts may be incomplete.
                  </p>`
                : nothing}
              <div class="ema-inv-migrate">
                <div aria-hidden="true">
                  <div class="ema-inv-migrate__donut-wrap">
                    <div class="ema-inv-migrate__donut" style=${`--ema-migrate-pct: ${pctStyle}`}></div>
                    <div class="ema-inv-migrate__donut-hole">
                      <span class="ema-inv-migrate__donut-value">${pctRounded}%</span>
                      <span class="ema-inv-migrate__donut-label">of sitemap paths in repo</span>
                    </div>
                  </div>
                </div>
                <div class="ema-inv-migrate__stats">
                  <div class="ema-inv-migrate__tile">
                    <span class="ema-inv-migrate__tile-value">${sn.sitemapUniqueCount}</span>
                    <span class="ema-inv-migrate__tile-label">Unique sitemap paths</span>
                  </div>
                  <div class="ema-inv-migrate__tile">
                    <span class="ema-inv-migrate__tile-value">${sn.daFileCount}</span>
                    <span class="ema-inv-migrate__tile-label">Files in DA repo</span>
                  </div>
                  <div class="ema-inv-migrate__tile ema-inv-migrate__tile--ok">
                    <span class="ema-inv-migrate__tile-value">${sn.bothCount}</span>
                    <span class="ema-inv-migrate__tile-label">Matched (in both)</span>
                  </div>
                  <div class="ema-inv-migrate__tile ema-inv-migrate__tile--pending">
                    <span class="ema-inv-migrate__tile-value">${sn.sitemapOnlyCount}</span>
                    <span class="ema-inv-migrate__tile-label">Sitemap paths not found in crawl</span>
                  </div>
                  <div class="ema-inv-migrate__tile ema-inv-migrate__tile--extra">
                    <span class="ema-inv-migrate__tile-value">${sn.daOnlyCount}</span>
                    <span class="ema-inv-migrate__tile-label">Repo files not on sitemap list</span>
                  </div>
                </div>
              </div>
              <ul class="ema-inv-migrate__legend">
                <li><span class="ema-inv-migrate__swatch ema-inv-migrate__swatch--ok"></span> Blue slice — matched paths</li>
                <li>
                  <span class="ema-inv-migrate__swatch ema-inv-migrate__swatch--pending"></span> Gray slice — still missing
                  from crawl match
                </li>
              </ul>
            `
          : nothing}
      </div>
    `;
  }

  render() {
    /* Tab shell mirrors React Spectrum Tabs (TabList + Tab + TabPanel); Lit-only — see https://react-spectrum.adobe.com/Tabs */
    return html`
      <h1 class="ema-inv__title">Inventory</h1>

      ${this.copyFeedback
        ? html`<p class="ema-inv__copy-banner" role="status" aria-live="polite">${this.copyFeedback}</p>`
        : nothing}

      <div class="ema-inv-sp-tabs">
        <div class="ema-inv-sp-tabs__tablist-wrap">
          <div
            class="ema-inv-sp-tabs__tablist"
            role="tablist"
            aria-label="Inventory views"
            @keydown=${this._onTabListKeydown}
          >
            <button
              type="button"
              class="ema-inv-sp-tabs__tab"
              role="tab"
              id="ema-inv-tab-upload"
              aria-selected=${this.activeTab === 'upload' ? 'true' : 'false'}
              aria-controls="ema-inv-panel-upload"
              tabindex=${this.activeTab === 'upload' ? 0 : -1}
              @click=${() => this._focusTab('upload')}
            >
              <span class="ema-inv-sp-tabs__tab-label">Upload sitemap</span>
            </button>
            <button
              type="button"
              class="ema-inv-sp-tabs__tab"
              role="tab"
              id="ema-inv-tab-repo"
              aria-selected=${this.activeTab === 'repo' ? 'true' : 'false'}
              aria-controls="ema-inv-panel-repo"
              tabindex=${this.activeTab === 'repo' ? 0 : -1}
              @click=${() => this._focusTab('repo')}
            >
              <span class="ema-inv-sp-tabs__tab-label">Repo browser</span>
            </button>
            ${this.urls.length > 0
              ? html`
                  <button
                    type="button"
                    class="ema-inv-sp-tabs__tab"
                    role="tab"
                    id="ema-inv-tab-sitemap"
                    aria-selected=${this.activeTab === 'sitemap' ? 'true' : 'false'}
                    aria-controls="ema-inv-panel-sitemap"
                    tabindex=${this.activeTab === 'sitemap' ? 0 : -1}
                    @click=${() => this._focusTab('sitemap')}
                  >
                    <span class="ema-inv-sp-tabs__tab-label">Sitemap inventory</span>
                  </button>
                `
              : nothing}
            ${this.urls.length > 0 && this._daVerifyReady
              ? html`
                  <button
                    type="button"
                    class="ema-inv-sp-tabs__tab"
                    role="tab"
                    id="ema-inv-tab-migration"
                    aria-selected=${this.activeTab === 'migration' ? 'true' : 'false'}
                    aria-controls="ema-inv-panel-migration"
                    tabindex=${this.activeTab === 'migration' ? 0 : -1}
                    @click=${() => this._focusTab('migration')}
                  >
                    <span class="ema-inv-sp-tabs__tab-label">Migration snapshot</span>
                  </button>
                `
              : nothing}
          </div>
        </div>

        <div
          id="ema-inv-panel-upload"
          class="ema-inv-sp-tabs__panel"
          role="tabpanel"
          tabindex=${this.activeTab === 'upload' ? 0 : -1}
          aria-labelledby="ema-inv-tab-upload"
          ?hidden=${this.activeTab !== 'upload'}
        >
          ${this._renderUploadPanel()}
        </div>

        <div
          id="ema-inv-panel-repo"
          class="ema-inv-sp-tabs__panel"
          role="tabpanel"
          tabindex=${this.activeTab === 'repo' ? 0 : -1}
          aria-labelledby="ema-inv-tab-repo"
          ?hidden=${this.activeTab !== 'repo'}
        >
          ${this._renderRepoBrowserPanel()}
        </div>

        ${this.urls.length > 0
          ? html`
              <div
                id="ema-inv-panel-sitemap"
                class="ema-inv-sp-tabs__panel"
                role="tabpanel"
                tabindex=${this.activeTab === 'sitemap' ? 0 : -1}
                aria-labelledby="ema-inv-tab-sitemap"
                ?hidden=${this.activeTab !== 'sitemap'}
              >
                <p class="ema-inv__lead ema-inv__lead--tab">
                  URLs are grouped in a <strong>tree view</strong> by hostname and path segments. Scope (section, page type,
                  or picked URLs) is chosen on the <strong>Upload sitemap</strong> tab. For each page, the <strong>repo path</strong>
                  is the URL pathname (for example <code>/en/home/home.html</code>) — the same path under org/repo when the
                  site mirrors the repo. When this tool runs inside <strong>Document Authoring</strong>, each path is
                  checked with the Source API (<strong>In DA</strong> vs <strong>Not in DA</strong> for 404); the repo path
                  is only a <strong>link to DA edit</strong> when that check confirms a file exists. Use
                  <strong>Compare with repository</strong> below to diff the scoped URLs against every file discovered via
                  the List API crawl.
                </p>

                ${this._renderSitemapComparePanel()}

                <div class="ema-inv__panel">
                  <div class="ema-inv__panel-head ema-inv__panel-head--wrap">
                    <span class="ema-inv__panel-head-title">URL tree + repo path + DA</span>
                    <span class="ema-inv__panel-head-meta">
                      ${this._effectiveInventoryUrls.length} in scope                      ${this.selectedSectionDisplay ||
                      this.selectedPageType ||
                      this.selectedUrls?.length
                        ? html` · ${this.urls.length} in sitemap`
                        : nothing}
                    </span>
                    ${this._renderCopyUrlsButton({ compact: true })}
                  </div>
                  ${!this._daVerifyReady
                    ? html`
                        <p class="ema-inv__panel-note">
                          DA file checks appear only when this tool is opened inside Document Authoring (authenticated
                          Source API).
                        </p>
                      `
                    : nothing}
                  <div class="ema-inv__panel-scroll">
                    ${this._effectiveInventoryUrls.length
                      ? renderUrlTree(
                          buildUrlPatternTree(this._effectiveInventoryUrls),
                          this.daExistence,
                          this._daVerifyReady,
                          this.context?.org ?? '',
                          this.context?.repo ?? '',
                        )
                      : html`<p class="ema-inv__empty">No URLs in the current scope.</p>`}
                  </div>
                </div>
              </div>
            `
          : nothing}
        ${this.urls.length > 0 && this._daVerifyReady
          ? html`
              <div
                id="ema-inv-panel-migration"
                class="ema-inv-sp-tabs__panel"
                role="tabpanel"
                tabindex=${this.activeTab === 'migration' ? 0 : -1}
                aria-labelledby="ema-inv-tab-migration"
                ?hidden=${this.activeTab !== 'migration'}
              >
                ${this._renderMigrationPanel()}
              </div>
            `
          : nothing}
      </div>
    `;
  }
}

customElements.define(EL_NAME, EmaInventory);

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

  const cmp = document.createElement(EL_NAME);
  cmp.details = typeof getBlockDetails === 'function' ? getBlockDetails(el) : {};
  cmp.daFetch = daFetch;
  const base = context ? { ...context } : {};
  const urlOrgRepo = parseDaOrgRepoFromEmbeddedBrowsers();
  if (urlOrgRepo) {
    base.org = urlOrgRepo.org;
    base.repo = urlOrgRepo.repo;
  }
  cmp.context = Object.keys(base).length ? base : null;
  cmp.adminOrigin = adminOrigin;
  el.replaceChildren();
  el.append(cmp);
}

function boot() {
  const root = document.getElementById('inventory-root');
  if (!root) return;
  Promise.resolve(init(root)).catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    root.replaceChildren();
    const p = document.createElement('p');
    p.textContent = `Could not start inventory: ${err?.message ?? err}`;
    p.style.cssText = 'padding:1rem;font-family:system-ui,sans-serif';
    root.append(p);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
