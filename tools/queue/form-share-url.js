/**
 * Build the intake-form URL for a queue submission's share id.
 *
 * Opening `/intake/form?share=<id>` restores that submission in the form
 * (see blocks/form/form.js). The queue runs embedded in DA, so callers open
 * the result in a new tab.
 */

/** Preview ref for the AEM host — matches the DA-authored preview environment. */
const AEM_REF = 'main';
/** Path to the intake form on the AEM site. */
const FORM_PATH = '/intake/form';
/** Query param the form reads to restore a saved share. */
const SHARE_PARAM = 'share';
/** Same rule the form uses to validate a share id (blocks/form/form.js). */
const SHARE_ID_RE = /^[a-zA-Z0-9-]{4,128}$/;

/**
 * @param {{ org?: string, repo?: string } | null | undefined} context DA org/repo context.
 * @param {string | null | undefined} shareId Submission share id (Fusion key).
 * @returns {string | null} Absolute intake-form URL, or null if inputs are missing/invalid.
 */
export function buildFormShareUrl(context, shareId) {
  const org = typeof context?.org === 'string' ? context.org.trim() : '';
  const repo = typeof context?.repo === 'string' ? context.repo.trim() : '';
  const id = typeof shareId === 'string' ? shareId.trim() : '';
  if (!org || !repo || !SHARE_ID_RE.test(id)) return null;

  try {
    const url = new URL(`https://${AEM_REF}--${repo}--${org}.aem.page${FORM_PATH}`);
    url.searchParams.set(SHARE_PARAM, id);
    return url.href;
  } catch {
    return null;
  }
}
