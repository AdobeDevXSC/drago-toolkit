/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isRequiredFlag(value) {
  return value === 'true' || value === true;
}

/**
 * @param {HTMLElement} el
 * @returns {boolean}
 */
export function isFieldHidden(el) {
  const field = el.closest('.form-field');
  return field?.getAttribute('aria-hidden') === 'true';
}

/**
 * @param {HTMLElement} sectionEl
 * @returns {HTMLElement[]}
 */
export function getVisibleSectionControls(sectionEl) {
  return [...sectionEl.querySelectorAll('input, textarea, select')].filter((el) => {
    if (el.type === 'submit' || el.disabled) return false;
    return !isFieldHidden(el);
  });
}

/**
 * @param {HTMLElement} sectionEl
 * @returns {HTMLElement[]}
 */
export function getVisibleRequiredControls(sectionEl) {
  return getVisibleSectionControls(sectionEl).filter((el) => el.required);
}

/**
 * @param {HTMLElement} sectionEl
 * @param {boolean} [requiredOnly]
 * @returns {boolean}
 */
function validateMultiselectGroups(sectionEl, requiredOnly = false) {
  let valid = true;
  sectionEl.querySelectorAll('.multiselect-field[data-required="true"]').forEach((fieldset) => {
    if (requiredOnly && fieldset.getAttribute('aria-hidden') === 'true') return;
    const checked = fieldset.querySelector('input:checked');
    fieldset.classList.toggle('invalid', !checked);
    if (!checked) valid = false;
  });
  return valid;
}

/**
 * @param {HTMLElement} sectionEl
 * @returns {boolean}
 */
export function validateRequiredMultiselectGroups(sectionEl) {
  return validateMultiselectGroups(sectionEl, true);
}

/**
 * @param {HTMLElement} sectionEl
 * @returns {boolean}
 */
export function validateSection(sectionEl) {
  const controls = getVisibleSectionControls(sectionEl);
  let valid = controls.every((el) => el.checkValidity());
  if (!validateMultiselectGroups(sectionEl)) valid = false;
  return valid;
}

/**
 * @param {HTMLElement} sectionEl
 * @returns {boolean}
 */
export function areRequiredFieldsComplete(sectionEl) {
  const controls = getVisibleRequiredControls(sectionEl);
  let valid = controls.every((el) => el.checkValidity());
  if (!validateRequiredMultiselectGroups(sectionEl)) valid = false;
  return valid;
}
