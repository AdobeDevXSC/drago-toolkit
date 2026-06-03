import { getConfig, loadStyle } from '../../scripts/ak.js';

let submitModal;
let submitModalCount = 0;
let stylesLoaded = false;

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

async function ensureStyles() {
  if (stylesLoaded) return;
  const { codeBase } = getConfig();
  await loadStyle(`${codeBase}/blocks/submit-modal/submit-modal.css`);
  stylesLoaded = true;
}

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
 * @param {HTMLElement} [root]
 * @returns {HTMLElement}
 */
function buildSubmitModalDom(root) {
  const modal = root || createElement('div', 'submit-modal');
  modal.classList.add('submit-modal');
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'submit-modal-message');
  modal.hidden = true;

  if (modal.querySelector('.submit-modal-dialog')) {
    return modal;
  }

  const dialog = createElement('div', 'submit-modal-dialog');
  const spinner = createElement('div', 'submit-modal-spinner');
  spinner.setAttribute('aria-hidden', 'true');
  const message = createElement('p', 'submit-modal-message');
  message.id = 'submit-modal-message';
  message.textContent = 'Submitting…';
  dialog.append(spinner, message);
  modal.replaceChildren(dialog);
  return modal;
}

/**
 * @returns {HTMLElement}
 */
export function getSubmitModal() {
  if (!submitModal) {
    submitModal = buildSubmitModalDom();
    document.body.append(submitModal);
  }
  return submitModal;
}

export async function showSubmitModal() {
  await ensureStyles();
  submitModalCount += 1;
  getSubmitModal().hidden = false;
  getScrollLockRoot().classList.add('submit-modal-open');
}

export async function hideSubmitModal() {
  submitModalCount = Math.max(0, submitModalCount - 1);
  if (submitModalCount > 0) return;
  if (submitModal) submitModal.hidden = true;
  document.body.classList.remove('submit-modal-open');
  document.querySelector('main.site-content')?.classList.remove('submit-modal-open');
}

/**
 * @param {HTMLElement} block
 */
export default async function init(block) {
  await ensureStyles();
  if (!submitModal) {
    submitModal = buildSubmitModalDom(block);
    if (submitModal.parentElement !== document.body) {
      document.body.append(submitModal);
    }
  }
}
