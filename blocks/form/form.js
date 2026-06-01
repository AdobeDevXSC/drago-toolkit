import { getConfig } from '../../scripts/ak.js';
import { toCamelCase, toClassName } from '../../scripts/utils/string.js';
import {
  initSpectrum,
  resolveSpectrumColor,
  spectrumThemeDefaults,
} from '../../scripts/utils/spectrum-theme.js';

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
  input.required = required === 'true';
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
  textarea.required = required === 'true';
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
  input.required = required === 'true';

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
  fieldset.append(buildLabel(label, 'legend', null, required === 'true'));

  options.split(',').forEach((o) => {
    const option = o.trim();
    const input = buildOptionInput(field, option);
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
  wrapper.append(buildLabel(label, 'label', generateId(fieldName), required === 'true'));

  const select = createElement('select');
  select.id = generateId(fieldName);
  select.name = select.id;
  select.required = required === 'true';
  wrapper.append(select);

  if (placeholder) {
    const placeholderOption = createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = placeholder;
    placeholderOption.disabled = true;
    placeholderOption.selected = true;
    select.append(placeholderOption);
  }

  options.split(',').forEach((o) => {
    const option = o.trim();
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
  const labelEl = buildLabel(label, 'label', input.id, required === 'true');
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

/**
 * @param {HTMLFormElement} form
 * @returns {Object}
 */
function generatePayload(form) {
  const payload = {};
  [...form.elements].forEach((field) => {
    if (field.name && !field.disabled) {
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
  });
  return payload;
}

/**
 * @param {HTMLFormElement} form
 * @returns {Promise<void>}
 */
async function handleSubmit(form) {
  const { log } = getConfig();
  try {
    const payload = generatePayload(form);
    toggleForm(form);
    const response = await fetch(form.dataset.action, {
      method: 'POST',
      body: JSON.stringify({ data: payload }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (response.ok) {
      if (form.dataset.confirmation) {
        window.location.href = form.dataset.confirmation;
      }
    } else {
      throw new Error(`${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    log(error);
  } finally {
    toggleForm(form, false);
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
    form.dataset.confirmation = confirmation.label || confirmation.default;
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

  if (type === 'radio' || type === 'checkbox') {
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
  wrapper.append(buildLabel(label, 'label', inputId, field.required === 'true'));

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
 * @param {Array} fields
 * @param {string|undefined} submit
 * @returns {HTMLFormElement}
 */
function buildForm(fields, submit) {
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

  if (submit) {
    enableSubmission(form, submit, fields);
  } else {
    enableDeferredSubmission(form);
  }

  return form;
}

/**
 * @param {HTMLFormElement} form
 * @param {HTMLElement} block
 * @returns {HTMLElement}
 */
function wrapInTheme(form, block) {
  initSpectrum();
  const theme = createElement('sp-theme', 'form-spectrum');
  Object.entries(spectrumThemeDefaults).forEach(([key, value]) => {
    theme.setAttribute(key, value);
  });
  theme.setAttribute('color', resolveSpectrumColor(block));
  theme.append(form);
  return theme;
}

/**
 * @param {HTMLElement} block
 */
export default function init(block) {
  const { log } = getConfig();
  block.style.visibility = 'hidden';
  const [source, submit] = [...block.querySelectorAll('a[href]')].map((a) => a.href);
  if (source) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(async (entry) => {
        if (entry.isIntersecting) {
          try {
            const resp = await fetch(new URL(source, window.location.origin));
            if (!resp.ok) throw new Error(`${resp.status}: ${resp.statusText}`);
            const { data } = await resp.json();
            if (!data) throw new Error(`No form fields at ${source}`);
            const form = buildForm(data, submit);
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
