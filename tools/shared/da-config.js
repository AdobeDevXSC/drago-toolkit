/** DA repo config helpers (Config API multi-sheet). */

export const FUSION_CONFIG_KEY = 'endpoint';

const FUSION_HOST_SUFFIX = 'hook.fusion.adobe.com';

/**
 * @param {string} value
 * @returns {string | null}
 */
export function validateFusionEndpointUrl(value) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:') return null;
    if (!url.hostname.endsWith(FUSION_HOST_SUFFIX)) return null;
    return trimmed;
  } catch {
    return null;
  }
}

/**
 * @param {unknown} config
 * @returns {string | null}
 */
export function parseFusionEndpoint(config) {
  if (!config || typeof config !== 'object') return null;
  const sheet = /** @type {{ data?: unknown }} */ (config).fusion;
  if (!sheet || typeof sheet !== 'object' || !Array.isArray(sheet.data)) return null;
  const row = sheet.data.find(
    (item) => item && typeof item === 'object' && item.key === FUSION_CONFIG_KEY,
  );
  if (!row || typeof row !== 'object') return null;
  const { value } = /** @type {{ value?: unknown }} */ (row);
  return validateFusionEndpointUrl(typeof value === 'string' ? value : String(value ?? ''));
}

/**
 * @param {Object} opts
 * @param {(url: string, init?: RequestInit) => Promise<Response>} [opts.daFetch]
 *   Authenticated fetch from DA_SDK (sdk.actions.daFetch); falls back to plain fetch.
 * @param {string} opts.adminOrigin
 * @param {string} opts.org
 * @param {string} opts.repo
 * @param {string} [opts.path]
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<unknown | null>}
 */
export async function fetchDaRepoConfig({
  daFetch,
  adminOrigin,
  org,
  repo,
  path = 'config',
  signal,
}) {
  const base = String(adminOrigin ?? '').replace(/\/+$/, '');
  const url = `${base}/config/${encodeURIComponent(org)}/${encodeURIComponent(repo)}/${path}`;
  const doFetch = typeof daFetch === 'function' ? daFetch : fetch;
  const res = await doFetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });
  if (res.status === 401) {
    throw new Error('Config API: authentication failed (401). Sign in to Document Authoring.');
  }
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Config API: HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * @param {Object} opts
 * @param {(url: string, init?: RequestInit) => Promise<Response>} [opts.daFetch]
 * @param {string} opts.adminOrigin
 * @param {string} opts.org
 * @param {string} opts.repo
 * @param {string} [opts.path]
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<string | null>}
 */
export async function loadFusionEndpointFromConfig(opts) {
  const config = await fetchDaRepoConfig(opts);
  if (!config) return null;
  return parseFusionEndpoint(config);
}

/**
 * Reads org/repo from a DA-style hash route `#/org/repo/...`.
 * @param {string} href
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
 * Resolves org/repo from the embedded windows (self, parent, top). DA editor
 * runs tools in an iframe whose own URL may lack the org/repo hash that the
 * parent frame carries, so all reachable frame URLs are checked.
 * @returns {{ org: string, repo: string } | null}
 */
export function parseDaOrgRepoFromEmbeddedBrowsers() {
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
  for (const href of hrefs) {
    const p = parseDaOrgRepoFromHref(href);
    if (p) return p;
  }
  return null;
}
