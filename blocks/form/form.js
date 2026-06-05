import { getConfig } from '../../scripts/ak.js';
import { showSubmitModal, hideSubmitModal } from '../submit-modal/submit-modal.js';
import { toCamelCase, toClassName } from '../../scripts/utils/string.js';
import {
  initSpectrum,
  resolveSpectrumColor,
  spectrumThemeDefaults,
} from '../../scripts/utils/spectrum-theme.js';
import { ensureFormNavIcons } from '../../deps/spectrum/dist/form-nav-icons.js';
import {
  areRequiredFieldsComplete,
  getVisibleSectionControls,
  isFieldHidden,
  isRequiredFlag,
  validateSection,
} from './form-validation.js';

/**
 * @param {string} tag
 * @param {string} [className]
 * @returns {HTMLElement}
 */
function createElement(tag, className) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  return el;
}

const SECTION_NAV_ICON_COUNT = 5;

const SECTION_NAV_ICON_TAGS = [
  'sp-icon-document',
  'sp-icon-user-group',
  'sp-icon-cloud',
  'sp-icon-star',
  'sp-icon-flag',
];

const SECTION_NAV_ACTIVE_ARROW = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M14.78583,8.37811a.9915.9915,0,0,0-.21417-1.07794L9.94141,2.66992A.98885.98885,0,0,0,8.543,4.06836l2.94238,2.94238H1.87012a.98926.98926,0,0,0,0,1.97852h9.61523L8.543,11.93164a.98885.98885,0,1,0,1.39844,1.39844l4.63025-4.63025A.98831.98831,0,0,0,14.78583,8.37811Z"/></svg>`;

/**
 * @param {string} tag
 * @param {string} [className]
 * @param {{ size?: string, label?: string }} [attrs]
 * @returns {HTMLElement}
 */
function createSpectrumIcon(tag, className, attrs = {}) {
  const icon = document.createElement(tag);
  if (className) icon.className = className;
  icon.setAttribute('size', attrs.size || 's');
  if (attrs.label) icon.setAttribute('label', attrs.label);
  return icon;
}

/**
 * @param {number} index
 * @returns {HTMLSpanElement}
 */
function buildSectionNavIcon(index) {
  const iconIndex = index % SECTION_NAV_ICON_COUNT;
  const wrapper = createElement('span', 'form-section-nav-icon');
  wrapper.dataset.iconIndex = String(iconIndex);
  wrapper.setAttribute('aria-hidden', 'true');
  wrapper.append(createSpectrumIcon(SECTION_NAV_ICON_TAGS[iconIndex], 'form-section-nav-icon-glyph'));
  return wrapper;
}

/**
 * @returns {HTMLSpanElement}
 */
function buildSectionNavArrow() {
  const arrow = createElement('span', 'form-section-nav-arrow');
  arrow.setAttribute('aria-hidden', 'true');
  arrow.innerHTML = SECTION_NAV_ACTIVE_ARROW;
  return arrow;
}

/**
 * @returns {HTMLElement}
 */
function buildSectionNavCheck() {
  const check = createSpectrumIcon('sp-icon-checkmark100', 'form-section-nav-check');
  check.setAttribute('aria-hidden', 'true');
  return check;
}

/**
 * @param {string} name
 * @param {string} [option]
 * @returns {string}
 */
function generateId(name, option = null) {
  const id = toCamelCase(name);
  return option ? `${id}-${toCamelCase(option)}` : id;
}

/**
 * @param {string} options
 * @returns {string[]}
 */
function parseOptions(options) {
  if (!options) return [];
  return options.split(/\s*\|\s*|\s*,\s*/).map((o) => o.trim()).filter(Boolean);
}

/**
 * @param {Object} field
 * @returns {string}
 */
function inferInputType(field) {
  if (field.type && field.type !== 'text') return field.type;
  const hint = `${field.field || ''} ${field.label || ''}`.toLowerCase();
  if (/date|renewal/.test(hint)) return 'date';
  return field.type || 'text';
}

/**
 * @param {Object} raw
 * @returns {Object}
 */
function normalizeField(raw) {
  const field = { ...raw };
  if (field.notes && !field.help) field.help = field.notes;
  if (!field.type || field.type === 'text') {
    field.type = inferInputType(field);
  }
  if (isRequiredFlag(field.required)) field.required = 'true';
  return field;
}

/**
 * @param {Array} fields
 * @returns {boolean}
 */
function hasSections(fields) {
  return fields.some((f) => f.section
    && f.type !== 'submit'
    && f.type !== 'confirmation');
}

/**
 * @param {Array} fields
 * @returns {Array<{ id: string, label: string, fields: Array }>}
 */
function groupBySection(fields) {
  const sections = [];
  const map = new Map();
  fields.forEach((field) => {
    if (!field.section || field.type === 'submit' || field.type === 'confirmation') return;
    if (!map.has(field.section)) {
      const section = {
        id: toClassName(field.section),
        label: field.section,
        fields: [],
      };
      map.set(field.section, section);
      sections.push(section);
    }
    map.get(field.section).fields.push(field);
  });
  return sections;
}

/**
 * @param {HTMLFormElement} form
 * @returns {Set<number>}
 */
function getSubmittedSections(form) {
  const raw = form.dataset.submittedSections;
  if (!raw) return new Set();
  return new Set(
    raw.split(',')
      .map((value) => Number(value))
      .filter((index) => Number.isInteger(index) && index >= 0),
  );
}

/**
 * @param {HTMLFormElement} form
 * @param {number} index
 */
function markSectionSubmitted(form, index) {
  const submitted = getSubmittedSections(form);
  submitted.add(index);
  form.dataset.submittedSections = [...submitted].sort((a, b) => a - b).join(',');
}

/**
 * @param {HTMLFormElement} form
 * @param {number} activeSection
 */
function restoreSubmittedSections(form, activeSection) {
  for (let i = 0; i < activeSection; i += 1) {
    markSectionSubmitted(form, i);
  }
}

/**
 * @param {HTMLFormElement} form
 * @param {number} index
 * @returns {boolean}
 */
function isSectionSubmitted(form, index) {
  return getSubmittedSections(form).has(index);
}

/**
 * @param {HTMLElement} container
 * @returns {HTMLElement|null}
 */
function focusFirstInvalid(container) {
  const invalid = [...container.querySelectorAll('input, textarea, select')]
    .find((el) => !isFieldHidden(el) && !el.checkValidity());
  if (invalid) {
    invalid.focus();
    invalid.setAttribute('aria-invalid', 'true');
    invalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return invalid;
  }

  const invalidMultiselect = container.querySelector('.multiselect-field.invalid');
  if (invalidMultiselect) {
    invalidMultiselect.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const firstInput = invalidMultiselect.querySelector('input');
    firstInput?.focus();
    return invalidMultiselect;
  }

  return null;
}

/**
 * @param {string} text
 * @param {string} inputId
 * @returns {HTMLParagraphElement}
 */
function writeHelpText(text, inputId) {
  const help = createElement('p', 'field-help-text');
  help.textContent = text;
  help.id = `${inputId}-help`;
  return help;
}

/**
 * @param {string} text
 * @param {'label'|'legend'} [type]
 * @param {string|null} [id]
 * @param {boolean} [required]
 * @returns {HTMLElement}
 */
function buildLabel(text, type = 'label', id = null, required = false) {
  const label = createElement(type);
  label.textContent = text;
  if (id && type === 'label') label.setAttribute('for', id);
  if (required) label.dataset.required = 'true';
  return label;
}

/**
 * @param {Object} field
 * @returns {HTMLInputElement}
 */
function buildInput(field) {
  const {
    type, field: fieldName, required, default: defaultValue, placeholder,
  } = field;

  const input = createElement('input');
  input.type = type || 'text';
  input.id = generateId(fieldName);
  input.name = input.id;
  input.required = isRequiredFlag(required);
  if (defaultValue) input.value = defaultValue;
  if (placeholder) input.placeholder = placeholder;
  return input;
}

/**
 * @param {Object} field
 * @returns {HTMLTextAreaElement}
 */
function buildTextArea(field) {
  const {
    field: fieldName, required, default: defaultValue, placeholder,
  } = field;

  const textarea = createElement('textarea');
  textarea.id = generateId(fieldName);
  textarea.name = textarea.id;
  textarea.required = isRequiredFlag(required);
  textarea.rows = 5;
  if (defaultValue) textarea.value = defaultValue;
  if (placeholder) textarea.placeholder = placeholder;
  return textarea;
}

/**
 * @param {Object} field
 * @param {string} option
 * @returns {HTMLInputElement}
 */
function buildOptionInput(field, option) {
  const {
    type, field: fieldName, default: defaultValue, required,
  } = field;
  const id = generateId(fieldName, option);

  const input = createElement('input');
  input.type = type;
  input.id = id;
  input.name = generateId(fieldName);
  input.value = option;
  input.checked = option === defaultValue;
  input.required = isRequiredFlag(required);

  return input;
}

/**
 * @param {Object} field
 * @param {string|null} controlled
 * @returns {HTMLFieldSetElement|null}
 */
function buildOptions(field, controlled) {
  const {
    type, options, label, required,
  } = field;
  if (!options) return null;

  const fieldset = createElement('fieldset', `form-field ${type}-field`);
  if (controlled) {
    const controller = controlled.split('-')[0];
    fieldset.dataset.controller = controller;
    fieldset.dataset.condition = controlled;
  }
  fieldset.append(buildLabel(label, 'legend', null, isRequiredFlag(required)));

  const inputType = type === 'multiselect' ? 'checkbox' : type;
  if (type === 'multiselect') {
    fieldset.classList.remove(`${type}-field`);
    fieldset.classList.add('multiselect-field', 'checkbox-field');
    if (isRequiredFlag(required)) fieldset.dataset.required = 'true';
  }

  parseOptions(options).forEach((option) => {
    const input = buildOptionInput({
      ...field,
      type: inputType,
      required: type === 'multiselect' ? 'false' : required,
    }, option);
    const span = createElement('span');
    const labelEl = buildLabel(option, 'label', input.id);
    labelEl.prepend(input, span);
    fieldset.append(labelEl);
  });

  return fieldset;
}

/**
 * @param {Object} field
 * @param {string|null} controlled
 * @returns {HTMLElement|null}
 */
function buildSelect(field, controlled) {
  const {
    type, options, field: fieldName, label, required, placeholder,
  } = field;
  if (!options) return null;

  const wrapper = createElement('div', `form-field ${type}-field`);
  if (controlled) {
    const controller = controlled.split('-')[0];
    wrapper.dataset.controller = controller;
    wrapper.dataset.condition = controlled;
  }
  wrapper.append(buildLabel(label, 'label', generateId(fieldName), isRequiredFlag(required)));

  const select = createElement('select');
  select.id = generateId(fieldName);
  select.name = select.id;
  select.required = isRequiredFlag(required);
  wrapper.append(select);

  if (placeholder) {
    const placeholderOption = createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = placeholder;
    placeholderOption.disabled = true;
    placeholderOption.selected = true;
    select.append(placeholderOption);
  }

  parseOptions(options).forEach((option) => {
    const optionEl = createElement('option');
    optionEl.value = option;
    optionEl.textContent = option;
    select.append(optionEl);
  });

  return wrapper;
}

/**
 * @param {Object} field
 * @param {string|null} controlled
 * @returns {HTMLElement}
 */
function buildToggle(field, controlled) {
  const {
    label, required, default: defaultValue,
  } = field;

  const wrapper = createElement('div', 'form-field toggle-field');
  if (controlled) {
    const controller = controlled.split('-')[0];
    wrapper.dataset.controller = controller;
    wrapper.dataset.condition = controlled;
  }

  const input = buildOptionInput({ ...field, type: 'checkbox' }, defaultValue || 'true');
  input.setAttribute('role', 'switch');
  input.setAttribute('aria-checked', input.checked);

  input.addEventListener('change', () => {
    input.setAttribute('aria-checked', input.checked);
  });

  const span = createElement('span');
  const labelEl = buildLabel(label, 'label', input.id, isRequiredFlag(required));
  labelEl.prepend(input, span);
  wrapper.append(labelEl);

  return wrapper;
}

/**
 * @param {Object} field
 * @returns {HTMLElement}
 */
function buildButton(field) {
  const { type, label } = field;
  const button = createElement('sp-button');
  button.setAttribute('variant', type === 'reset' ? 'secondary' : 'accent');
  button.setAttribute('type', type);
  button.textContent = label;
  return button;
}

/**
 * @param {Event} e
 * @param {Map<string, HTMLElement[]>} controllerConfig
 */
function toggleConditional(e, controllerConfig) {
  const { target } = e;
  const controller = target.name;
  if (controllerConfig.has(controller)) {
    const inputs = [...controllerConfig.get(controller)];
    inputs.forEach((i) => {
      const field = i.closest('.form-field');
      const { condition } = field.dataset;
      const conditionMet = condition.includes(toClassName(target.value));
      field.setAttribute('aria-hidden', !conditionMet);

      if (conditionMet) {
        if (i.dataset.originalRequired === 'true') {
          i.setAttribute('required', '');
        }
        i.removeAttribute('tabindex');
      } else {
        i.removeAttribute('required');
        i.setAttribute('tabindex', '-1');
      }
    });
  }
}

/**
 * @param {HTMLFormElement} form
 * @param {Map<string, HTMLElement[]>} controllerConfig
 */
function initConditionals(form, controllerConfig) {
  controllerConfig.forEach((controlledInputs, controller) => {
    let controllerValue = null;
    const checked = form.querySelector(`[name="${controller}"]:checked`);
    const select = form.querySelector(`select[name="${controller}"]`);

    if (checked) {
      controllerValue = checked.value;
    } else if (select) {
      controllerValue = select.value;
    }

    if (controllerValue) {
      controlledInputs.forEach((input) => {
        const field = input.closest('.form-field');
        const { condition } = field.dataset;
        const conditionMet = condition.includes(toClassName(controllerValue));
        field.setAttribute('aria-hidden', !conditionMet);

        if (input.hasAttribute('required')) {
          if (!input.dataset.originalRequired) {
            input.dataset.originalRequired = 'true';
          }

          if (!conditionMet) {
            input.removeAttribute('required');
          }
        }

        if (conditionMet) {
          input.removeAttribute('tabindex');
        } else {
          input.setAttribute('tabindex', '-1');
        }
      });
    } else {
      controlledInputs.forEach((input) => {
        const field = input.closest('.form-field');
        field.setAttribute('aria-hidden', true);

        if (input.hasAttribute('required')) {
          if (!input.dataset.originalRequired) {
            input.dataset.originalRequired = 'true';
          }
          input.removeAttribute('required');
        }

        input.setAttribute('tabindex', '-1');
      });
    }
  });
}

/**
 * @param {HTMLFormElement} form
 */
function enableConditionals(form) {
  const controlled = [...form.querySelectorAll('[data-controller]')];
  const controllerConfig = new Map();

  controlled.forEach((c) => {
    const input = c.querySelector('input, textarea, select');
    const { controller } = c.dataset;

    if (!controllerConfig.has(controller)) controllerConfig.set(controller, []);
    controllerConfig.get(controller).push(input);

    if (input && input.id) {
      const controllerInputs = form.querySelectorAll(`[name="${controller}"]`);

      controllerInputs.forEach((controllerInput) => {
        const existingControls = controllerInput.getAttribute('aria-controls') || '';
        const controlsArray = existingControls.split(' ').filter((ec) => ec);

        if (!controlsArray.includes(input.id)) {
          controlsArray.push(input.id);
        }

        controllerInput.setAttribute('aria-controls', controlsArray.join(' '));
        input.setAttribute('aria-controlledby', controllerInput.id);
      });
    }
  });

  initConditionals(form, controllerConfig);

  form.addEventListener('change', (e) => {
    toggleConditional(e, controllerConfig);
  });
}

/**
 * @param {HTMLFormElement} form
 * @param {boolean} [disabled]
 */
function toggleForm(form, disabled = true) {
  [...form.elements].forEach((el) => {
    el.disabled = disabled;
  });
}

let shareModal;

const SHARE_QUERY_PARAM = 'share';
const SHARE_STORAGE_PREFIX = 'form-share:';
const RESET_QUERY_PARAM = 'reset';

/**
 * @returns {HTMLElement|null}
 */
function getScrollLockRoot() {
  if (document.body.classList.contains('layout-side-nav')) {
    return document.body;
  }
  return document.querySelector('main.site-content') || document.body;
}

/**
 * @param {string} shareId
 * @returns {boolean}
 */
function isValidShareId(shareId) {
  return typeof shareId === 'string' && /^[a-zA-Z0-9-]{4,128}$/.test(shareId);
}

/**
 * @returns {string|null}
 */
function readShareIdFromUrl() {
  const shareId = new URLSearchParams(window.location.search).get(SHARE_QUERY_PARAM);
  return isValidShareId(shareId) ? shareId : null;
}

/**
 * @param {HTMLFormElement} form
 * @returns {string|null}
 */
function getFormShareId(form) {
  const fromForm = form.dataset.shareId;
  if (isValidShareId(fromForm)) return fromForm;
  return readShareIdFromUrl();
}

/**
 * @param {HTMLFormElement} form
 * @param {string} shareId
 */
function setFormShareId(form, shareId) {
  if (!isValidShareId(shareId)) return;
  form.dataset.shareId = shareId;
  if (readShareIdFromUrl() !== shareId) {
    history.replaceState(null, '', buildShareUrl(shareId));
  }
}

/**
 * @param {HTMLFormElement} form
 * @param {Object} body
 * @returns {Object}
 */
function withShareKey(form, body) {
  const shareId = getFormShareId(form);
  if (!shareId) return body;
  return { ...body, share_update: shareId };
}

function clearCachedShareState(shareId) {
  if (!isValidShareId(shareId)) return;
  try {
    localStorage.removeItem(`${SHARE_STORAGE_PREFIX}${shareId}`);
  } catch (error) {
    getConfig().log(error);
  }
}

/**
 * @returns {boolean}
 */
function readResetFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get(RESET_QUERY_PARAM) === '1' || params.get('resetSession') === '1';
}

function clearSessionParamsFromUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete(SHARE_QUERY_PARAM);
  url.searchParams.delete(RESET_QUERY_PARAM);
  url.searchParams.delete('resetSession');
  history.replaceState(null, '', url.toString());
}

/**
 * @param {HTMLFormElement} form
 * @param {{ goToSection?: Function, refreshNav?: Function }} [options]
 */
function resetFormSession(form, { goToSection, refreshNav } = {}) {
  const shareId = getFormShareId(form);
  clearCachedShareState(shareId);
  delete form.dataset.shareId;
  delete form.dataset.submittedSections;
  form.reset();
  form.querySelectorAll('[aria-invalid]').forEach((el) => {
    el.removeAttribute('aria-invalid');
  });
  form.dispatchEvent(new Event('change', { bubbles: true }));
  goToSection?.(0);
  refreshNav?.();
  clearSessionParamsFromUrl();
}

/**
 * @param {string} shareId
 * @returns {string}
 */
function buildShareUrl(shareId) {
  const url = new URL(window.location.href);
  url.searchParams.set(SHARE_QUERY_PARAM, shareId);
  return url.toString();
}

/**
 * @param {string} shareId
 * @param {{ data: Object, activeSection: number }} state
 */
function cacheShareState(shareId, state) {
  try {
    localStorage.setItem(`${SHARE_STORAGE_PREFIX}${shareId}`, JSON.stringify(state));
  } catch (error) {
    getConfig().log(error);
  }
}

/**
 * @param {string} shareId
 * @returns {{ data: Object, activeSection: number }|null}
 */
function loadCachedShareState(shareId) {
  try {
    const raw = localStorage.getItem(`${SHARE_STORAGE_PREFIX}${shareId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * @param {Response} response
 * @returns {Promise<string|undefined>}
 */
async function parseShareIdFromResponse(response) {
  const responseText = await response.text();
  if (!responseText) return undefined;

  try {
    const parsed = JSON.parse(responseText);
    const candidate = parsed.shareId || parsed.id || parsed.share_id;
    return isValidShareId(candidate) ? candidate : undefined;
  } catch {
    const candidate = responseText.trim();
    return isValidShareId(candidate) ? candidate : undefined;
  }
}

/**
 * @param {string} baseUrl
 * @param {string} shareId
 * @returns {string}
 */
function buildShareRestoreUrl(baseUrl, shareId) {
  const url = new URL(baseUrl);
  url.searchParams.set(SHARE_QUERY_PARAM, shareId);
  return url.href;
}

/**
 * @param {unknown} payload
 * @returns {Object|null}
 */
function unwrapShareRecord(payload) {
  if (Array.isArray(payload)) {
    if (!payload.length) return null;
    return payload[0];
  }
  if (payload && typeof payload === 'object') return payload;
  return null;
}

const SHARE_DATA_META_KEYS = new Set([
  'key', 'submitted', 'shareId', 'id', 'share_id', 'shared', 'complete',
  'activeSection', 'sectionId', 'savedAt', 'formPath',
]);

/**
 * @param {Object} data
 * @returns {Object}
 */
function normalizeShareDataKeys(data) {
  return Object.fromEntries(
    Object.entries(data)
      .filter(([key]) => !SHARE_DATA_META_KEYS.has(key))
      .map(([key, value]) => {
        const normalizedKey = key.includes('-') ? generateId(key) : key;
        return [normalizedKey, value];
      }),
  );
}

/**
 * @param {unknown} payload
 * @returns {{ data: Object, activeSection: number }|null}
 */
function normalizeSharePayload(payload) {
  const record = unwrapShareRecord(payload);
  if (!record || typeof record !== 'object') return null;

  let { data } = record;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    data = Object.fromEntries(
      Object.entries(record).filter(([key]) => !SHARE_DATA_META_KEYS.has(key)),
    );
  }

  data = normalizeShareDataKeys(data);

  if (!Object.keys(data).length) return null;

  return {
    data,
    activeSection: typeof record.activeSection === 'number' ? record.activeSection : 0,
  };
}

/**
 * @param {HTMLFormElement} form
 * @param {string} shareId
 * @returns {Promise<{ data: Object, activeSection: number }|null>}
 */
async function fetchShareState(form, shareId) {
  const { log } = getConfig();
  const base = form.dataset.shareRestore || form.dataset.action;
  if (!base) return null;

  try {
    const response = await fetch(buildShareRestoreUrl(base, shareId), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;

    const payload = await response.json();
    return normalizeSharePayload(payload);
  } catch (error) {
    log(error);
    return null;
  }
}

/**
 * @param {HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement} field
 * @param {unknown} value
 * @returns {string|undefined}
 */
function formatValueForField(field, value) {
  if (value === undefined || value === null) return undefined;

  const stringValue = String(value);
  if (field.type === 'date') {
    const date = new Date(stringValue);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
  }

  return stringValue;
}

/**
 * @param {HTMLFormElement} form
 * @param {Object} data
 */
function applyFormValues(form, data) {
  [...form.elements].forEach((field) => {
    if (!field.name || field.disabled) return;
    const value = formatValueForField(field, data[field.name]);
    if (value === undefined) return;

    if (field.type === 'checkbox') {
      const values = value.split(',').map((v) => v.trim());
      field.checked = values.includes(field.value);
    } else if (field.type === 'radio') {
      field.checked = field.value === value;
    } else {
      field.value = value;
    }
  });
  form.dispatchEvent(new Event('change', { bubbles: true }));
}

/** @type {Object<string, string>} */
let activeAutofillOverrides = {};

function autofillFieldKey(name) {
  return name ? generateId(name) : '';
}

/**
 * @param {unknown} payload
 * @returns {Object<string, string>}
 */
function normalizeAutofillPayload(payload) {
  if (!payload || typeof payload !== 'object') return {};

  if (Array.isArray(payload.sections)) {
    return Object.fromEntries(
      payload.sections.flatMap((section) => {
        const fields = section?.fields;
        if (!fields || typeof fields !== 'object') return [];
        return Object.entries(fields).map(([key, value]) => [autofillFieldKey(key), String(value)]);
      }),
    );
  }

  const raw = payload.fields || payload.data;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [autofillFieldKey(key), String(value)]),
  );
}

/**
 * @param {string} source
 * @returns {Promise<Object<string, string>>}
 */
async function loadAutofillOverrides(source) {
  try {
    const url = new URL(source, window.location.origin);
    url.pathname = url.pathname.replace(/\.json$/, '-autofill.json');
    const resp = await fetch(url);
    if (!resp.ok) return {};
    const payload = await resp.json();
    return normalizeAutofillPayload(payload);
  } catch {
    return {};
  }
}

function shouldShowDevTools() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('autofill') === '1' || readResetFromUrl()) return true;
  const { hostname } = window.location;
  if (hostname === 'localhost' || hostname.endsWith('.local')) return true;
  return hostname.endsWith('.aem.page');
}

/**
 * @param {HTMLFormElement} form
 * @param {HTMLButtonElement} btn
 */
function insertDevToolButton(form, btn) {
  const footer = form.querySelector('.form-footer');
  if (footer) {
    const anchor = footer.querySelector('.form-save-share') || footer.firstChild;
    footer.insertBefore(btn, anchor);
    return;
  }

  let toolbar = form.querySelector('.form-toolbar');
  if (!toolbar) {
    toolbar = createElement('div', 'form-toolbar');
    const buttonWrapper = form.querySelector('.button-wrapper');
    if (buttonWrapper) {
      form.insertBefore(toolbar, buttonWrapper);
    } else {
      form.append(toolbar);
    }
  }
  toolbar.append(btn);
}

/**
 * @param {HTMLFormElement} form
 * @param {Array} fields
 * @param {{ goToSection?: Function, refreshNav?: Function }} [options]
 */
function appendDevToolButtons(form, fields, { goToSection, refreshNav } = {}) {
  if (!shouldShowDevTools()) return;

  const resetBtn = createElement('button', 'form-reset-session');
  resetBtn.type = 'button';
  resetBtn.textContent = 'Reset session';
  resetBtn.addEventListener('click', () => {
    resetFormSession(form, { goToSection, refreshNav });
  });
  insertDevToolButton(form, resetBtn);

  const autofillBtn = createElement('button', 'form-autofill');
  autofillBtn.type = 'button';
  autofillBtn.textContent = 'Autofill test data';
  autofillBtn.addEventListener('click', () => {
    applyFormValues(form, buildAutofillData(fields));
    refreshNav?.();
  });
  insertDevToolButton(form, autofillBtn);
}

/**
 * @param {Object} field
 * @returns {string}
 */
function sampleValueForField(field) {
  const key = autofillFieldKey(field.field);
  if (key && activeAutofillOverrides[key] !== undefined) {
    return activeAutofillOverrides[key];
  }

  const opts = parseOptions(field.options);
  switch (field.type) {
    case 'email':
      return 'jane.smith@example.com';
    case 'tel':
      return '+1 555 0100';
    case 'textarea':
      return 'Sample message for testing the form.';
    case 'select':
    case 'radio':
      return opts[0] || '';
    case 'checkbox':
    case 'multiselect':
      return opts.slice(0, Math.min(2, opts.length)).join(',');
    case 'toggle':
      return 'true';
    case 'date':
      return new Date().toISOString().slice(0, 10);
    case 'number':
      return '42';
    default:
      return `Sample ${field.label || field.field || 'value'}`;
  }
}

/**
 * @param {Array} fields
 * @returns {Object}
 */
function buildAutofillData(fields) {
  const data = {};
  fields.forEach((field) => {
    if (!field.field) return;
    if (field.type === 'submit' || field.type === 'confirmation' || field.type === 'reset') return;
    data[autofillFieldKey(field.field)] = sampleValueForField(field);
  });
  return data;
}

function hideShareModal() {
  if (!shareModal) return;
  shareModal.hidden = true;
  document.body.classList.remove('form-share-open');
}

/**
 * @param {string} text
 * @returns {Promise<boolean>}
 */
async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to legacy copy
    }
  }

  const textarea = createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.body.append(textarea);
  textarea.focus();
  textarea.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

const SHARE_COPY_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
    <path fill="currentColor" d="M13 2H6a2 2 0 0 0-2 2v11h1V4h8V2zm3 4H9a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2zm0 13H9V8h7v11z"/>
  </svg>
`;

/**
 * @returns {HTMLElement}
 */
function getShareModal() {
  if (!shareModal) {
    shareModal = createElement('div', 'form-share-modal');
    shareModal.setAttribute('role', 'dialog');
    shareModal.setAttribute('aria-modal', 'true');
    shareModal.setAttribute('aria-labelledby', 'form-share-title');
    shareModal.hidden = true;

    const dialog = createElement('div', 'form-share-dialog');
    const title = createElement('h2', 'form-share-title');
    title.id = 'form-share-title';
    title.textContent = 'Save & Share';

    const message = createElement('p', 'form-share-message');
    message.textContent = 'Copy this link to return to your form later.';

    const field = createElement('div', 'form-share-field');
    const input = createElement('input');
    input.className = 'form-share-url';
    input.type = 'text';
    input.readOnly = true;
    input.setAttribute('aria-label', 'Share link');

    const copyIcon = createElement('span', 'form-share-copy-icon');
    copyIcon.setAttribute('role', 'button');
    copyIcon.tabIndex = 0;
    copyIcon.setAttribute('aria-label', 'Copy link');
    copyIcon.innerHTML = SHARE_COPY_ICON;

    const handleCopy = async () => {
      const { log } = getConfig();
      const url = input.value;
      if (!url) return;
      const copied = await copyTextToClipboard(url);
      if (!copied) {
        log(new Error('Unable to copy share link to clipboard'));
        input.focus();
        input.select();
      }
      hideShareModal();
    };

    copyIcon.addEventListener('click', handleCopy);
    copyIcon.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleCopy();
      }
    });

    shareModal.addEventListener('click', (event) => {
      if (event.target === shareModal) hideShareModal();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && shareModal && !shareModal.hidden) {
        hideShareModal();
      }
    });

    field.append(input, copyIcon);
    dialog.append(title, message, field);
    shareModal.append(dialog);
    document.body.append(shareModal);
  }
  return shareModal;
}

/**
 * @param {string} shareUrl
 */
function showShareModal(shareUrl) {
  const modal = getShareModal();
  const input = modal.querySelector('.form-share-url');
  if (input instanceof HTMLInputElement) {
    input.value = shareUrl;
  }
  modal.hidden = false;
  document.body.classList.add('form-share-open');
  input?.focus();
  input?.select();
}

/**
 * @param {HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement} field
 * @param {Object} payload
 */
function appendFieldToPayload(field, payload) {
  if (!field.name || field.disabled) return;
  if (field.type === 'radio') {
    if (field.checked) payload[field.name] = field.value;
  } else if (field.type === 'checkbox') {
    if (field.checked) {
      payload[field.name] = payload[field.name]
        ? `${payload[field.name]},${field.value}`
        : field.value;
    }
  } else {
    payload[field.name] = field.value;
  }
}

/**
 * @param {HTMLFormElement} form
 * @returns {Object}
 */
function generatePayload(form) {
  const payload = {};
  [...form.elements].forEach((field) => {
    appendFieldToPayload(field, payload);
  });
  return payload;
}

/**
 * @param {HTMLElement} sectionEl
 * @returns {Object}
 */
function generateSectionPayload(sectionEl) {
  const payload = {};
  getVisibleSectionControls(sectionEl).forEach((field) => {
    appendFieldToPayload(field, payload);
  });
  return payload;
}

/**
 * @param {HTMLFormElement} form
 * @param {HTMLElement|null} sectionEl
 * @param {boolean} complete
 * @returns {Object}
 */
function buildPostBody(form, sectionEl, complete) {
  if (complete) {
    const completeInput = form.querySelector('input[name="formComplete"]');
    if (completeInput instanceof HTMLInputElement) {
      completeInput.disabled = false;
      completeInput.value = 'true';
    }
    return withShareKey(form, {
      data: generatePayload(form),
      complete: true,
    });
  }

  return withShareKey(form, {
    data: generateSectionPayload(sectionEl),
    section: sectionEl.querySelector('.form-section-title')?.textContent || '',
    sectionId: sectionEl.dataset.sectionId || '',
    complete: false,
  });
}

/**
 * @param {HTMLFormElement} form
 * @param {Object} body
 * @param {{ disableForm?: boolean }} [options]
 * @returns {Promise<{ ok: boolean, shareId?: string }>}
 */
async function postFormData(form, body, options = {}) {
  const { log } = getConfig();
  const { disableForm = false } = options;
  if (!form.dataset.action) return { ok: false };

  let submitModalShown = false;
  let shareId;
  try {
    if (disableForm) toggleForm(form);
    await showSubmitModal();
    submitModalShown = true;
    const response = await fetch(form.dataset.action, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`${response.status}: ${response.statusText}`);
    }
    shareId = await parseShareIdFromResponse(response);
    if (shareId) setFormShareId(form, shareId);
    return { ok: true, shareId };
  } catch (error) {
    log(error);
    return { ok: false };
  } finally {
    if (submitModalShown) await hideSubmitModal();
    if (disableForm) toggleForm(form, false);
  }
}

/**
 * @param {HTMLFormElement} form
 * @returns {Promise<void>}
 */
async function handleSubmit(form) {
  const body = buildPostBody(form, null, true);
  const result = await postFormData(form, body, { disableForm: true });
  if (result.ok && form.dataset.confirmation) {
    window.location.href = form.dataset.confirmation;
  }
  return result.ok;
}

/**
 * @param {HTMLFormElement} form
 * @param {HTMLElement[]} sectionEls
 * @param {Function} refreshNav
 * @returns {Promise<void>}
 */
async function handleSaveAndShare(form, sectionEls, refreshNav) {
  if (!form.dataset.action) return;

  const activeSection = Number(form.dataset.activeSection || 0);
  const data = generatePayload(form);
  const body = withShareKey(form, {
    shared: true,
    complete: false,
    data,
    activeSection,
    sectionId: sectionEls[activeSection]?.dataset.sectionId || '',
    savedAt: new Date().toISOString(),
    formPath: window.location.pathname,
  });

  const result = await postFormData(form, body);
  if (!result.ok) return;

  const shareId = result.shareId || getFormShareId(form);
  if (!shareId) return;

  cacheShareState(shareId, { data, activeSection });
  setFormShareId(form, shareId);
  showShareModal(buildShareUrl(shareId));
  refreshNav();
}

/**
 * @param {HTMLFormElement} form
 * @param {Function} goToSection
 * @param {Function} refreshNav
 * @returns {Promise<void>}
 */
async function restoreSharedForm(form, goToSection, refreshNav) {
  const shareId = readShareIdFromUrl();
  if (!shareId) return;

  await showSubmitModal();
  try {
    let state = await fetchShareState(form, shareId);
    if (!state?.data) {
      state = loadCachedShareState(shareId);
    }
    if (!state?.data) return;

    setFormShareId(form, shareId);
    applyFormValues(form, state.data);
    cacheShareState(shareId, state);

    if (typeof goToSection === 'function' && typeof state.activeSection === 'number') {
      restoreSubmittedSections(form, state.activeSection);
      goToSection(state.activeSection);
    } else if (typeof refreshNav === 'function') {
      refreshNav();
    }
  } finally {
    await hideSubmitModal();
  }
}

/**
 * @param {HTMLFormElement} form
 * @param {string} submit
 * @param {Array} fields
 */
function enableSubmission(form, submit, fields) {
  form.dataset.action = submit;
  const confirmation = fields.find((f) => f.type === 'confirmation');
  if (confirmation) {
    form.dataset.confirmation = confirmation.field || confirmation.label || confirmation.default;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const valid = form.reportValidity();
    if (valid) {
      handleSubmit(form);
    } else {
      const firstInvalid = form.querySelector(':invalid:not(fieldset)');
      if (firstInvalid) {
        firstInvalid.focus();
        firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstInvalid.setAttribute('aria-invalid', true);
      }
    }
  });

  form.addEventListener('input', (e) => {
    if (e.target.hasAttribute('aria-invalid') && e.target.validity.valid) {
      e.target.removeAttribute('aria-invalid');
    }
  });
}

/**
 * @param {HTMLFormElement} form
 */
function enableDeferredSubmission(form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const valid = form.reportValidity();
    if (!valid) {
      const firstInvalid = form.querySelector(':invalid:not(fieldset)');
      if (firstInvalid) {
        firstInvalid.focus();
        firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstInvalid.setAttribute('aria-invalid', true);
      }
    }
  });

  form.addEventListener('input', (e) => {
    if (e.target.hasAttribute('aria-invalid') && e.target.validity.valid) {
      e.target.removeAttribute('aria-invalid');
    }
  });
}

/**
 * @param {Object} field
 * @returns {HTMLElement}
 */
function buildField(field) {
  const {
    type, label, help, field: fieldName, conditional,
  } = field;
  const controlled = conditional || null;

  if (type === 'submit' || type === 'reset') {
    return buildButton(field);
  }

  if (type === 'radio' || type === 'checkbox' || type === 'multiselect') {
    const fieldset = buildOptions(field, controlled);
    if (help) {
      const helpText = writeHelpText(help, generateId(fieldName));
      fieldset.append(helpText);
    }
    return fieldset;
  }

  if (type === 'toggle') {
    const toggle = buildToggle(field, controlled);
    if (help) {
      const helpText = writeHelpText(help, generateId(fieldName));
      toggle.append(helpText);
    }
    return toggle;
  }

  if (type === 'select') {
    const select = buildSelect(field, controlled);
    if (help) {
      const helpText = writeHelpText(help, generateId(fieldName));
      select.append(helpText);
    }
    return select;
  }

  const wrapper = createElement('div', `form-field ${type}-field`);
  if (controlled) {
    const controller = controlled.split('-')[0];
    wrapper.dataset.controller = controller;
    wrapper.dataset.condition = controlled;
  }
  const inputId = generateId(fieldName);
  wrapper.append(buildLabel(label, 'label', inputId, isRequiredFlag(field.required)));

  let helpText;
  if (help) {
    helpText = writeHelpText(help, inputId);
    wrapper.append(helpText);
  }

  const input = type === 'textarea' ? buildTextArea(field) : buildInput(field);

  if (type === 'textarea') {
    wrapper.append(input);
  } else {
    wrapper.insertBefore(input, wrapper.firstChild.nextSibling);
  }

  if (help) input.setAttribute('aria-describedby', helpText.id);

  return wrapper;
}

/**
 * @param {HTMLFormElement} form
 * @param {number} index
 * @param {HTMLElement[]} sectionEls
 * @param {HTMLElement[]} navItems
 * @param {HTMLElement[]} stepperItems
 * @returns {number}
 */
function activateSection(form, index, sectionEls, navItems, stepperItems) {
  const clamped = Math.max(0, Math.min(index, sectionEls.length - 1));
  sectionEls.forEach((section, i) => {
    const active = i === clamped;
    section.hidden = !active;
    section.setAttribute('aria-hidden', active ? 'false' : 'true');
  });
  navItems.forEach((item, i) => {
    item.setAttribute('aria-current', i === clamped ? 'step' : 'false');
  });
  stepperItems.forEach((item, i) => {
    item.setAttribute('aria-current', i === clamped ? 'step' : 'false');
  });
  form.dataset.activeSection = String(clamped);
  navItems[clamped]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  stepperItems[clamped]?.scrollIntoView({ inline: 'nearest', behavior: 'smooth' });
  return clamped;
}

/**
 * @param {HTMLFormElement} form
 * @param {HTMLElement[]} sectionEls
 * @param {HTMLElement[]} navItems
 * @param {HTMLElement[]} stepperItems
 */
function updateSectionNavState(form, sectionEls, navItems, stepperItems) {
  sectionEls.forEach((sectionEl, i) => {
    const submitted = isSectionSubmitted(form, i);
    navItems[i]?.classList.toggle('submitted', submitted);
    stepperItems[i]?.classList.toggle('submitted', submitted);
    navItems[i]?.setAttribute('aria-label', submitted
      ? `${sectionEl.querySelector('.form-section-title')?.textContent || 'Section'} — completed`
      : '');
    stepperItems[i]?.setAttribute('aria-label', submitted
      ? `${sectionEl.querySelector('.form-section-title')?.textContent || 'Section'} — completed`
      : '');
  });

  const submitBtn = form.querySelector('.form-submit');
  if (submitBtn) {
    const allRequiredComplete = sectionEls.every(
      (sectionEl) => areRequiredFieldsComplete(sectionEl),
    );
    submitBtn.hidden = !allRequiredComplete;
    submitBtn.toggleAttribute('hidden', !allRequiredComplete);
    submitBtn.toggleAttribute('disabled', !allRequiredComplete);
  }

  const activeIndex = Number(form.dataset.activeSection || 0);
  const prevBtn = form.querySelector('.form-prev');
  const nextBtn = form.querySelector('.form-next');
  if (prevBtn) prevBtn.disabled = activeIndex === 0;
  if (nextBtn) {
    const hideNext = activeIndex >= sectionEls.length - 1;
    nextBtn.hidden = hideNext;
    nextBtn.toggleAttribute('hidden', hideNext);
  }
}

/**
 * @param {HTMLFormElement} form
 * @param {Array} fields
 * @param {string|undefined} submit
 * @param {Array} sections
 * @returns {HTMLFormElement}
 */
function buildMultiSectionForm(fields, submit, sections) {
  initSpectrum();
  ensureFormNavIcons();
  const form = createElement('form');
  form.className = 'form-multi';
  form.setAttribute('novalidate', '');

  const layout = createElement('div', 'form-layout');
  const stepper = createElement('div', 'form-stepper');
  stepper.setAttribute('role', 'tablist');
  stepper.setAttribute('aria-label', 'Form sections');

  const panel = createElement('div', 'form-panel');
  const nav = createElement('nav', 'form-section-nav');
  nav.setAttribute('aria-label', 'Form sections');

  const sectionEls = [];
  const navItems = [];
  const stepperItems = [];

  sections.forEach((section, index) => {
    const sectionEl = createElement('section', 'form-section');
    sectionEl.id = `form-section-${section.id}`;
    sectionEl.dataset.sectionId = section.id;
    sectionEl.dataset.sectionIndex = String(index);
    sectionEl.setAttribute('role', 'tabpanel');
    sectionEl.setAttribute('aria-labelledby', `form-section-label-${section.id}`);

    const heading = createElement('h2', 'form-section-title');
    heading.id = `form-section-label-${section.id}`;
    heading.tabIndex = -1;
    heading.textContent = section.label;
    sectionEl.append(heading);

    section.fields.forEach((field) => {
      sectionEl.append(buildField(field));
    });

    sectionEls.push(sectionEl);
    panel.append(sectionEl);

    const navItem = createElement('button', 'form-section-nav-item');
    navItem.type = 'button';
    navItem.dataset.sectionIndex = String(index);
    navItem.setAttribute('role', 'tab');
    navItem.setAttribute('aria-controls', sectionEl.id);

    const navIcon = buildSectionNavIcon(index);
    const navArrow = buildSectionNavArrow();
    const navLabel = createElement('span', 'form-section-nav-label');
    navLabel.textContent = section.label;
    const navCheck = buildSectionNavCheck();

    navItem.append(navIcon, navArrow, navCheck, navLabel);
    navItems.push(navItem);
    nav.append(navItem);

    const stepItem = navItem.cloneNode(true);
    stepItem.className = 'form-stepper-item';
    stepperItems.push(stepItem);
    stepper.append(stepItem);
  });

  layout.append(stepper, panel, nav);
  form.append(layout);

  const footer = createElement('div', 'form-footer');
  const prevBtn = createElement('button', 'form-prev');
  prevBtn.type = 'button';
  prevBtn.textContent = 'Previous';

  const nextBtn = createElement('button', 'form-next');
  nextBtn.type = 'button';
  nextBtn.textContent = 'Next';

  const submitField = fields.find((f) => f.type === 'submit');
  const submitBtn = createElement('sp-button', 'form-submit');
  submitBtn.setAttribute('variant', 'accent');
  submitBtn.setAttribute('type', 'submit');
  submitBtn.textContent = submitField?.field || submitField?.label || 'Submit';
  submitBtn.hidden = true;
  submitBtn.toggleAttribute('hidden', true);

  const saveShareBtn = createElement('button', 'form-save-share');
  saveShareBtn.type = 'button';
  saveShareBtn.textContent = 'Save & Share';

  footer.append(prevBtn, nextBtn, saveShareBtn, submitBtn);

  const completeInput = createElement('input');
  completeInput.type = 'hidden';
  completeInput.name = 'formComplete';
  completeInput.value = '';
  completeInput.disabled = true;
  form.append(completeInput);

  form.append(footer);

  if (submit) {
    form.dataset.action = submit;
    form.dataset.shareRestore = submit;
  } else {
    saveShareBtn.hidden = true;
  }

  const existingShare = readShareIdFromUrl();
  if (existingShare) {
    form.dataset.shareId = existingShare;
  }

  enableConditionals(form);

  activateSection(form, 0, sectionEls, navItems, stepperItems);

  const goToSection = (index) => {
    const active = activateSection(form, index, sectionEls, navItems, stepperItems);
    const title = sectionEls[active]?.querySelector('.form-section-title');
    title?.focus();
    updateSectionNavState(form, sectionEls, navItems, stepperItems);
  };

  const bindNavItem = (item) => {
    item.addEventListener('click', () => {
      goToSection(Number(item.dataset.sectionIndex));
    });
  };
  navItems.forEach(bindNavItem);
  stepperItems.forEach(bindNavItem);

  prevBtn.addEventListener('click', () => {
    goToSection(Number(form.dataset.activeSection) - 1);
  });

  nextBtn.addEventListener('click', async () => {
    const activeIndex = Number(form.dataset.activeSection);
    const sectionEl = sectionEls[activeIndex];
    if (!validateSection(sectionEl)) {
      focusFirstInvalid(sectionEl);
      updateSectionNavState(form, sectionEls, navItems, stepperItems);
      return;
    }
    if (form.dataset.action) {
      const result = await postFormData(form, buildPostBody(form, sectionEl, false));
      if (!result.ok) {
        updateSectionNavState(form, sectionEls, navItems, stepperItems);
        return;
      }
    }
    markSectionSubmitted(form, activeIndex);
    goToSection(activeIndex + 1);
  });

  const refreshNav = () => {
    updateSectionNavState(form, sectionEls, navItems, stepperItems);
  };

  saveShareBtn.addEventListener('click', () => {
    handleSaveAndShare(form, sectionEls, refreshNav);
  });

  appendDevToolButtons(form, fields, { goToSection, refreshNav });

  form.addEventListener('input', (e) => {
    refreshNav();
    if (e.target.hasAttribute('aria-invalid') && e.target.validity?.valid) {
      e.target.removeAttribute('aria-invalid');
    }
  });
  form.addEventListener('change', refreshNav);

  if (submit) {
    const confirmation = fields.find((f) => f.type === 'confirmation');
    if (confirmation) {
      form.dataset.confirmation = confirmation.field || confirmation.label || confirmation.default;
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const valid = sectionEls.every((sectionEl) => validateSection(sectionEl));
      if (valid) {
        const submitted = await handleSubmit(form);
        if (submitted) {
          markSectionSubmitted(form, sectionEls.length - 1);
          updateSectionNavState(form, sectionEls, navItems, stepperItems);
        }
        return;
      }

      const firstInvalidSection = sectionEls.findIndex((sectionEl) => !validateSection(sectionEl));
      if (firstInvalidSection >= 0) {
        goToSection(firstInvalidSection);
        focusFirstInvalid(sectionEls[firstInvalidSection]);
      }
      updateSectionNavState(form, sectionEls, navItems, stepperItems);
    });
  } else {
    enableDeferredSubmission(form);
  }

  updateSectionNavState(form, sectionEls, navItems, stepperItems);
  form.__restoreShare = () => restoreSharedForm(form, goToSection, refreshNav);
  form.__resetSession = () => resetFormSession(form, { goToSection, refreshNav });
  return form;
}

/**
 * @param {Array} fields
 * @param {string|undefined} submit
 * @returns {HTMLFormElement}
 */
function buildFlatForm(fields, submit) {
  const form = createElement('form');
  form.setAttribute('novalidate', '');

  const buttons = [];

  fields.forEach((field) => {
    if (field.type === 'submit' || field.type === 'reset') {
      buttons.push(field);
    } else if (field.type !== 'confirmation') {
      form.append(buildField(field));
    }
  });

  if (buttons.length) {
    const buttonWrapper = createElement('div', 'button-wrapper');
    buttons.forEach((button) => buttonWrapper.append(buildField(button)));
    form.append(buttonWrapper);
  }

  enableConditionals(form);
  appendDevToolButtons(form, fields);

  if (submit) {
    form.dataset.action = submit;
    form.dataset.shareRestore = submit;
    enableSubmission(form, submit, fields);
  } else {
    enableDeferredSubmission(form);
  }

  form.__restoreShare = () => restoreSharedForm(form);
  form.__resetSession = () => resetFormSession(form);
  return form;
}

/**
 * @param {Array} fields
 * @param {string|undefined} submit
 * @returns {HTMLFormElement}
 */
function buildForm(fields, submit) {
  const normalized = fields.map(normalizeField);
  if (hasSections(normalized)) {
    const sections = groupBySection(normalized);
    if (sections.length) {
      return buildMultiSectionForm(normalized, submit, sections);
    }
  }
  return buildFlatForm(normalized, submit);
}

/**
 * @param {HTMLFormElement} form
 * @param {HTMLElement} block
 * @returns {HTMLElement}
 */
function wrapInTheme(form, block) {
  initSpectrum();
  const card = createElement('div', 'form-card');
  if (form.classList.contains('form-multi')) {
    card.classList.add('form-card-multi');
  }
  const theme = createElement('sp-theme', 'form-spectrum');
  Object.entries(spectrumThemeDefaults).forEach(([key, value]) => {
    theme.setAttribute(key, value);
  });
  theme.setAttribute('color', resolveSpectrumColor(block));
  theme.append(form);
  card.append(theme);
  return card;
}

/**
 * @param {HTMLElement} block
 * @returns {{ source: string|null, submit: string|undefined, shareRestore: string|undefined }}
 */
function resolveFormEndpoints(block) {
  const links = [...block.querySelectorAll('a[href]')].map((a) => {
    try {
      return new URL(a.getAttribute('href'), window.location.origin).href;
    } catch {
      return a.href;
    }
  });

  const source = links[0] || null;
  let submit = links[1];
  let shareRestore = links[2];

  if (!submit) {
    const urlPattern = /https?:\/\/[^\s<>"']+/g;
    const urls = [...new Set(block.textContent.match(urlPattern) || [])];
    submit = urls.find((url) => {
      try {
        return !new URL(url).pathname.endsWith('.json');
      } catch {
        return !url.includes('.json');
      }
    });
  }

  if (!shareRestore) shareRestore = submit;

  return { source, submit, shareRestore };
}

/**
 * Extract the field rows from an AEM sheet response, supporting both
 * single-sheet (`{ data: [...] }`) and multi-sheet (`{ sheetName: { data: [...] } }`)
 * workbook formats.
 * @param {Object} json
 * @returns {Array|null}
 */
function extractFormData(json) {
  if (!json || typeof json !== 'object') return null;
  if (Array.isArray(json.data)) return json.data;
  const names = Array.isArray(json[':names']) ? json[':names'] : Object.keys(json);
  for (let i = 0; i < names.length; i += 1) {
    const sheet = json[names[i]];
    if (sheet && Array.isArray(sheet.data)) return sheet.data;
  }
  return null;
}

/**
 * @param {HTMLElement} block
 */
export default function init(block) {
  const { log } = getConfig();
  block.style.visibility = 'hidden';
  const { source, submit, shareRestore } = resolveFormEndpoints(block);
  if (source) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(async (entry) => {
        if (entry.isIntersecting) {
          try {
            const resp = await fetch(new URL(source, window.location.origin));
            if (!resp.ok) throw new Error(`${resp.status}: ${resp.statusText}`);
            const data = extractFormData(await resp.json());
            if (!data) throw new Error(`No form fields at ${source}`);
            activeAutofillOverrides = await loadAutofillOverrides(source);
            const form = buildForm(data, submit);
            if (shareRestore) form.dataset.shareRestore = shareRestore;
            if (readResetFromUrl()) {
              form.__resetSession?.();
            } else if (readShareIdFromUrl() && typeof form.__restoreShare === 'function') {
              await form.__restoreShare();
            }
            block.replaceChildren(wrapInTheme(form, block));
            block.removeAttribute('style');
          } catch (error) {
            log(error);
            block.parentElement?.remove();
          }
          observer.disconnect();
        }
      });
    }, { threshold: 0 });

    observer.observe(block);
  } else {
    log(new Error('Unable to create form without source'));
    block.parentElement?.remove();
  }
}
