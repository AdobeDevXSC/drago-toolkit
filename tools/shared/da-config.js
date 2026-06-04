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
 * @param {string} opts.token IMS bearer from DA_SDK
 * @param {string} opts.adminOrigin
 * @param {string} opts.org
 * @param {string} opts.repo
 * @param {string} [opts.path]
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<unknown | null>}
 */
export async function fetchDaRepoConfig({
  token,
  adminOrigin,
  org,
  repo,
  path = 'config',
  signal,
}) {
  const base = String(adminOrigin ?? '').replace(/\/+$/, '');
  const url = `${base}/config/${encodeURIComponent(org)}/${encodeURIComponent(repo)}/${path}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
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
 * @param {string} opts.token
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
