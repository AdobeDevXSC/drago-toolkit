/**
 * Spectrum workflow/UI icons for multi-section form navigation.
 * Bundled to deps/spectrum/dist/form-nav-icons.js — import from the form block.
 */
import '@spectrum-web-components/icon/sp-icon.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-document.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-user-group.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-cloud.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-star.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-flag.js';
import '@spectrum-web-components/icons-ui/icons/sp-icon-checkmark100.js';

let registered = false;

/** Register form nav icon custom elements (idempotent). */
export function ensureFormNavIcons() {
  registered = true;
}

/** @returns {boolean} */
export function formNavIconsReady() {
  return registered;
}
