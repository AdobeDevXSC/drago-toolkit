/**
 * Registers Spectrum 2 theme context and starter primitives for tool UIs.
 * Bundled to deps/spectrum/dist/index.js — import once per page.
 * @see https://opensource.adobe.com/spectrum-web-components/migrating-to-spectrum2/
 */
import '@spectrum-web-components/theme/sp-theme.js';
import '@spectrum-web-components/theme/spectrum-two/scale-medium.js';
import '@spectrum-web-components/theme/spectrum-two/scale-large.js';
import '@spectrum-web-components/theme/spectrum-two/theme-light.js';
import '@spectrum-web-components/theme/spectrum-two/theme-lightest.js';
import '@spectrum-web-components/theme/spectrum-two/theme-dark.js';
import '@spectrum-web-components/theme/spectrum-two/theme-darkest.js';
import '@spectrum-web-components/button/sp-button.js';

/** `sp-theme` system attribute for Spectrum 2. */
export const SPECTRUM_SYSTEM = 'spectrum-two';

/** Default platform scale (maps to medium-spectrum-two internally). */
export const SPECTRUM_SCALE = 'medium';

/** Default color stop (maps to light-spectrum-two internally). */
export const SPECTRUM_COLOR = 'light';

/**
 * Importing this module registers custom elements and theme fragments.
 * Call from initSpectrum() so the registration is explicit.
 */
export function ensureSpectrumElements() {}
