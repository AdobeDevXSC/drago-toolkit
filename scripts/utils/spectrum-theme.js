/**
 * Spectrum 2 bootstrap for the whole project (site pages, blocks, and tools).
 * @see https://opensource.adobe.com/spectrum-web-components/migrating-to-spectrum2/
 */
import {
  ensureSpectrumElements,
  SPECTRUM_COLOR,
  SPECTRUM_SCALE,
  SPECTRUM_SYSTEM,
} from '../../deps/spectrum/dist/index.js';

let initialized = false;

/** Register sp-theme / sp-button and Spectrum 2 theme fragments (idempotent). */
export function initSpectrum() {
  if (!initialized) {
    ensureSpectrumElements();
    initialized = true;
  }
}

/** Default attributes for `<sp-theme>`. */
export const spectrumThemeDefaults = {
  system: SPECTRUM_SYSTEM,
  scale: SPECTRUM_SCALE,
  color: SPECTRUM_COLOR,
};

export { SPECTRUM_COLOR, SPECTRUM_SCALE, SPECTRUM_SYSTEM };

/**
 * Resolve light/dark color stop from page section metadata classes.
 * @param {ParentNode} [root]
 * @returns {'light' | 'dark'}
 */
export function resolveSpectrumColor(root = document.body) {
  const dark = root.querySelector?.('.dark-scheme')
    || document.documentElement.classList.contains('dark-scheme');
  return dark ? 'dark' : SPECTRUM_COLOR;
}

/**
 * Wrap direct children of `root` in a page-level `<sp-theme>` (site + 404).
 * Skips if a top-level sp-theme already exists.
 * @param {HTMLElement} [root]
 * @returns {HTMLElement | null}
 */
export function applyDocumentSpectrumTheme(root = document.body) {
  initSpectrum();
  const existing = root.querySelector(':scope > sp-theme');
  if (existing) return existing;

  const theme = document.createElement('sp-theme');
  Object.entries(spectrumThemeDefaults).forEach(([key, value]) => {
    theme.setAttribute(key, value);
  });
  theme.setAttribute('color', resolveSpectrumColor(root));

  [...root.childNodes].forEach((node) => theme.append(node));
  root.append(theme);
  return theme;
}
