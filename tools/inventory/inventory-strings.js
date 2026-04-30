/**
 * Loads copy from `inventory.strings.json` (same folder as this module).
 * Fetch + top-level await avoids JSON import attributes (not enabled in this repo’s ESLint parser).
 */
const inventoryStrings = await fetch(new URL('inventory.strings.json', import.meta.url)).then((res) => {
  if (!res.ok) throw new Error(`Could not load inventory.strings.json (${res.status})`);
  return res.json();
});

/**
 * Replace `{key}` placeholders in a string (for copy pulled from JSON).
 * @param {string} template
 * @param {Record<string, string|number>} [vars]
 * @returns {string}
 */
export function invFill(template, vars = {}) {
  if (template == null) return '';
  return String(template).replace(/\{(\w+)\}/g, (_, k) => {
    if (!Object.prototype.hasOwnProperty.call(vars, k)) return `{${k}}`;
    return String(vars[k]);
  });
}

export default inventoryStrings;
