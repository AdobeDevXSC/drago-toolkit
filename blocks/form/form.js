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
 * @param {HTMLElement} el
 * @returns {boolean}
 */
function isFieldHidden(el) {
  const field = el.closest('.form-field');
  return field?.getAttribute('aria-hidden') === 'true';
}

/**
 * @param {HTMLElement} sectionEl
 * @returns {HTMLElement[]}
 */
function getVisibleSectionControls(sectionEl) {
  return [...sectionEl.querySelectorAll('input, textarea, select')].filter((el) => {
    if (el.type === 'submit' || el.disabled) return false;
    return !isFieldHidden(el);
  });
}

/**
 * @param {HTMLElement} sectionEl
 * @returns {boolean}
 */
function validateMultiselectGroups(sectionEl) {
  let valid = true;
  sectionEl.querySelectorAll('.multiselect-field[data-required="true"]').forEach((fieldset) => {
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
function validateSection(sectionEl) {
  const controls = getVisibleSectionControls(sectionEl);
  let valid = controls.every((el) => el.checkValidity());
  if (!validateMultiselectGroups(sectionEl)) valid = false;
  return valid;
}

/**
 * @param {HTMLElement} sectionEl
 * @returns {boolean}
 */
function isSectionComplete(sectionEl) {
  return validateSection(sectionEl);
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

  const inputType = type === 'multiselect' ? 'checkbox' : type;
  if (type === 'multiselect') {
    fieldset.classList.remove(`${type}-field`);
    fieldset.classList.add('multiselect-field', 'checkbox-field');
    if (required === 'true') fieldset.dataset.required = 'true';
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
    const complete = isSectionComplete(sectionEl);
    navItems[i]?.classList.toggle('complete', complete);
    stepperItems[i]?.classList.toggle('complete', complete);
  });

  const submitBtn = form.querySelector('.form-submit');
  if (submitBtn) {
    const allValid = sectionEls.every((sectionEl) => isSectionComplete(sectionEl));
    submitBtn.hidden = !allValid;
    submitBtn.toggleAttribute('disabled', !allValid);
  }

  const activeIndex = Number(form.dataset.activeSection || 0);
  const prevBtn = form.querySelector('.form-prev');
  const nextBtn = form.querySelector('.form-next');
  if (prevBtn) prevBtn.disabled = activeIndex === 0;
  if (nextBtn) nextBtn.hidden = activeIndex >= sectionEls.length - 1;
}

/**
 * @param {HTMLFormElement} form
 * @param {Array} fields
 * @param {string|undefined} submit
 * @param {Array} sections
 * @returns {HTMLFormElement}
 */
function buildMultiSectionForm(fields, submit, sections) {
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

    const navIndex = createElement('span', 'form-section-nav-index');
    navIndex.textContent = String(index + 1);
    const navLabel = createElement('span', 'form-section-nav-label');
    navLabel.textContent = section.label;
    const navCheck = createElement('span', 'form-section-nav-check');
    navCheck.setAttribute('aria-hidden', 'true');
    navCheck.textContent = '✓';

    navItem.append(navIndex, navLabel, navCheck);
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

  footer.append(prevBtn, nextBtn, submitBtn);
  form.append(footer);

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

  nextBtn.addEventListener('click', () => {
    const activeIndex = Number(form.dataset.activeSection);
    const sectionEl = sectionEls[activeIndex];
    if (!validateSection(sectionEl)) {
      focusFirstInvalid(sectionEl);
      updateSectionNavState(form, sectionEls, navItems, stepperItems);
      return;
    }
    goToSection(activeIndex + 1);
  });

  const refreshNav = () => {
    updateSectionNavState(form, sectionEls, navItems, stepperItems);
  };

  form.addEventListener('input', (e) => {
    refreshNav();
    if (e.target.hasAttribute('aria-invalid') && e.target.validity?.valid) {
      e.target.removeAttribute('aria-invalid');
    }
  });
  form.addEventListener('change', refreshNav);

  if (submit) {
    form.dataset.action = submit;
    const confirmation = fields.find((f) => f.type === 'confirmation');
    if (confirmation) {
      form.dataset.confirmation = confirmation.field || confirmation.label || confirmation.default;
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const valid = sectionEls.every((sectionEl) => validateSection(sectionEl));
      if (valid) {
        handleSubmit(form);
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

  if (submit) {
    enableSubmission(form, submit, fields);
  } else {
    enableDeferredSubmission(form);
  }

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
