/**
 * DA-embedded queue tool: lists form shares via Fusion webhook.
 *
 * POST list: { share: "all" }
 * POST delete: { delete: "<key>" }
 * Endpoint: DA repo config → fusion sheet → key `endpoint` (see config/repo-config.example.json).
 *
 * Fusion list response: array of { json: "<stringified form record>" } wrappers.
 * Each record includes `key` — sent as `delete` when removing a share.
 */
import DA_SDK from 'https://da.live/nx/utils/sdk.js';
import { LitElement, html, nothing } from '../../deps/lit/dist/index.js';
import { loadFusionEndpointFromConfig } from '../shared/da-config.js';
import { initSpectrum } from '../shared/spectrum-theme.js';

/* global getBlockDetails */

const EL_NAME = 'ema-queue';

const TITLE_KEYS = ['account-name', 'accountName'];
const SUBTITLE_KEYS = ['submitter-name', 'submitterName'];

/** Fusion share id fields (list row or inner `json`), aligned with form share restore. */
const SHARE_ID_FIELDS = ['key', 'shareId', 'id', 'share_id'];

/** Short fields surfaced as chips on the card (title/subtitle excluded). */
const CHIP_FIELD_KEYS = [
  'dr-number',
  'migration-type',
  'csc-in-scope',
  'is-xsc-engaged',
  'eds-awareness-level',
  'personalization-in-scope',
  'xsc-eds-da-demo',
  'commerce-platform',
];

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isPresent(value) {
  if (value == null) return false;
  if (typeof value === 'string' && !value.trim()) return false;
  return true;
}

/**
 * @param {string} key
 * @returns {string}
 */
function humanizeFieldKey(key) {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * @param {Record<string, unknown>} record
 * @param {string[]} keys
 * @returns {string}
 */
function pickField(record, keys) {
  for (const key of keys) {
    const value = record[key];
    if (isPresent(value)) return String(value);
  }
  return '';
}

/**
 * @param {string} endpoint
 * @param {Object} body
 * @returns {Promise<unknown>}
 */
async function postFusion(endpoint, body) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * @param {string} endpoint
 * @returns {Promise<unknown>}
 */
function postShareAll(endpoint) {
  return postFusion(endpoint, { share: 'all' });
}

/**
 * @param {string} endpoint
 * @param {string} shareId
 * @returns {Promise<unknown>}
 */
function postShareDelete(endpoint, shareId) {
  return postFusion(endpoint, { delete: shareId });
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isDeletableShareId(value) {
  if (value == null) return false;
  const s = String(value).trim();
  return s.length > 0 && s !== 'all';
}

/**
 * @param {QueueCardRecord} record
 * @returns {boolean}
 */
function isIncompleteSubmission(record) {
  const { submitted } = record;
  if (submitted === false) return true;
  if (typeof submitted === 'string' && submitted.trim().toLowerCase() === 'false') {
    return true;
  }
  return false;
}

/**
 * @param {Record<string, unknown>} [record]
 * @returns {string}
 */
function pickShareId(record) {
  if (!record || typeof record !== 'object') return '';
  for (const field of SHARE_ID_FIELDS) {
    const value = record[field];
    if (isDeletableShareId(value)) return String(value).trim();
  }
  return '';
}

/**
 * @param {Record<string, unknown>} inner parsed `json` object
 * @param {Record<string, unknown>} wrapper Fusion list row
 * @returns {string}
 */
function resolveShareId(inner, wrapper) {
  return pickShareId(inner) || pickShareId(wrapper);
}

/**
 * @param {unknown} payload
 * @returns {unknown[]}
 */
function normalizeShareWrappers(payload) {
  if (payload == null) return [];
  if (Array.isArray(payload)) return payload;
  if (typeof payload === 'object' && payload !== null) {
    const record = /** @type {Record<string, unknown>} */ (payload);
    if (Array.isArray(record.items)) return record.items;
    if (Array.isArray(record.shares)) return record.shares;
    if (Array.isArray(record.data)) return record.data;
    return [payload];
  }
  return [{ value: payload }];
}

const META_FIELD_KEYS = new Set([
  'cardId',
  'queueIndex',
  'recordIndex',
  'parseError',
  'shareId',
  'key',
]);

/**
 * @typedef {Record<string, unknown> & {
 *   cardId: string;
 *   shareId?: string;
 *   queueIndex?: number;
 *   recordIndex?: number;
 *   parseError?: boolean;
 * }} QueueCardRecord
 */

/**
 * Unwrap Fusion { json: "..." } wrappers into flat submission records.
 * @param {unknown} payload
 * @returns {QueueCardRecord[]}
 */
function normalizeFusionQueue(payload) {
  const wrappers = normalizeShareWrappers(payload);
  /** @type {QueueCardRecord[]} */
  const records = [];

  wrappers.forEach((wrapper, index) => {
    if (wrapper == null || typeof wrapper !== 'object') return;
    const row = /** @type {Record<string, unknown>} */ (wrapper);

    if (typeof row.json === 'string') {
      try {
        const parsed = JSON.parse(row.json);
        const items = Array.isArray(parsed) ? parsed : [parsed];
        items.forEach((item, recordIndex) => {
          if (item && typeof item === 'object') {
            const data = /** @type {Record<string, unknown>} */ (item);
            records.push({
              ...data,
              cardId: `${index}-${recordIndex}`,
              shareId: resolveShareId(data, row),
              queueIndex: index,
              recordIndex,
            });
          }
        });
      } catch {
        records.push({
          cardId: `${index}-err`,
          shareId: '',
          queueIndex: index,
          parseError: true,
        });
      }
      return;
    }

    records.push({
      ...row,
      cardId: String(index),
      shareId: resolveShareId(row, row),
      queueIndex: index,
    });
  });

  return records;
}

/**
 * @param {QueueCardRecord} record
 * @returns {{ key: string, label: string, value: string }[]}
 */
function getPopulatedFields(record) {
  return Object.entries(record)
    .filter(([key]) => !META_FIELD_KEYS.has(key))
    .filter(([, value]) => isPresent(value))
    .map(([key, value]) => ({
      key,
      label: humanizeFieldKey(key),
      value: String(value),
    }));
}

/**
 * @param {QueueCardRecord} record
 * @returns {{ key: string, label: string, value: string }[]}
 */
function getChipFields(record) {
  return CHIP_FIELD_KEYS
    .filter((key) => isPresent(record[key]))
    .map((key) => ({
      key,
      label: humanizeFieldKey(key),
      value: String(record[key]),
    }));
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeCsvCell(value) {
  const str = value == null ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * @param {QueueCardRecord[]} records
 * @returns {string[]}
 */
function getExportFieldKeys(records) {
  const keys = new Set();
  records.forEach((record) => {
    Object.keys(record).forEach((key) => {
      if (!META_FIELD_KEYS.has(key)) keys.add(key);
    });
  });
  return [...keys].sort();
}

/**
 * @param {QueueCardRecord[]} records
 * @returns {string}
 */
function recordsToCsv(records) {
  const fieldKeys = getExportFieldKeys(records);
  const headerLabels = ['Submission', ...fieldKeys.map((key) => humanizeFieldKey(key))];
  const headerLine = headerLabels.map(escapeCsvCell).join(',');
  const dataLines = records.map((record, index) => {
    const cells = [
      String(index + 1),
      ...fieldKeys.map((key) => {
        if (record.parseError) return '';
        const value = record[key];
        return isPresent(value) ? String(value) : '';
      }),
    ];
    return cells.map(escapeCsvCell).join(',');
  });
  return [headerLine, ...dataLines].join('\r\n');
}

/**
 * @param {string} csv
 * @param {string} filename
 */
function downloadCsv(csv, filename) {
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

class EmaQueue extends LitElement {
  static properties = {
    fusionEndpoint: { attribute: false },
    details: { attribute: false },
    context: { attribute: false },
    adminOrigin: { attribute: false },
    _loading: { state: true },
    _error: { state: true },
    _data: { state: true },
    _expandedKeys: { state: true },
    _bootstrapped: { state: true },
    _deletingShareId: { state: true },
    _pendingDelete: { state: true },
  };

  constructor() {
    super();
    this.fusionEndpoint = null;
    this.details = {};
    this.context = null;
    this.adminOrigin = 'https://admin.da.live';
    this._loading = false;
    this._error = null;
    this._data = null;
    this._expandedKeys = [];
    this._bootstrapped = false;
    this._deletingShareId = null;
    this._pendingDelete = null;
  }

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    initSpectrum();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.body.classList.remove('ema-queue-loading');
  }

  firstUpdated() {
    if (this._bootstrapped) return;
    this._bootstrapped = true;
    if (!this.fusionEndpoint) {
      if (!this._error) {
        this._error = 'Fusion endpoint not configured. Add fusion.endpoint in repo DA config.';
      }
      this.requestUpdate();
      return;
    }
    this.loadShares();
  }

  get _modalOpen() {
    return this._loading || Boolean(this._pendingDelete);
  }

  updated(changed) {
    super.updated(changed);
    if (changed.has('_loading') || changed.has('_pendingDelete')) {
      document.body.classList.toggle('ema-queue-loading', this._modalOpen);
    }
  }

  get _cards() {
    return normalizeFusionQueue(this._data);
  }

  _isExpanded(cardId) {
    return this._expandedKeys.includes(cardId);
  }

  /**
   * @param {string} cardId
   */
  _toggleExpand(cardId) {
    const keys = new Set(this._expandedKeys);
    if (keys.has(cardId)) keys.delete(cardId);
    else keys.add(cardId);
    this._expandedKeys = [...keys];
  }

  async loadShares() {
    const endpoint = this.fusionEndpoint;
    if (!endpoint) {
      this._error = 'Fusion endpoint not configured. Add fusion.endpoint in repo DA config.';
      return;
    }
    const preserveExpanded = this._expandedKeys;
    this._loading = true;
    this._error = null;
    this.requestUpdate();
    try {
      this._data = await postShareAll(endpoint);
      this._expandedKeys = preserveExpanded;
    } catch (err) {
      this._data = null;
      const msg = err instanceof Error ? err.message : 'Request failed';
      this._error = msg;
    } finally {
      this._loading = false;
      this.requestUpdate();
    }
  }

  _onRefreshClick() {
    this.loadShares();
  }

  /**
   * @param {QueueCardRecord} record
   */
  _onDeleteClick(record) {
    const { shareId } = record;
    if (this._loading || this._deletingShareId || this._pendingDelete) return;
    if (!shareId) {
      this._error = 'Cannot delete: no share key on this row. Fusion must return key, shareId, id, or share_id.';
      this.requestUpdate();
      return;
    }
    this._pendingDelete = record;
  }

  _cancelDelete() {
    this._pendingDelete = null;
  }

  /**
   * Set initial error before first render (e.g. from init when config load fails).
   * @param {string} message
   */
  primeError(message) {
    this._error = message;
  }

  async _confirmDelete() {
    const record = this._pendingDelete;
    if (!record?.shareId) {
      this._pendingDelete = null;
      return;
    }

    const { shareId } = record;
    const endpoint = this.fusionEndpoint;
    if (!endpoint) {
      this._error = 'Fusion endpoint not configured. Add fusion.endpoint in repo DA config.';
      this._pendingDelete = null;
      return;
    }
    this._pendingDelete = null;
    this._deletingShareId = shareId;
    this._error = null;
    this.requestUpdate();
    try {
      await postShareDelete(endpoint, shareId);
      await this.loadShares();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      this._error = msg;
    } finally {
      this._deletingShareId = null;
      this.requestUpdate();
    }
  }

  _renderDeleteButton(record) {
    const { shareId } = record;
    const busy = this._deletingShareId === shareId;
    const disabled = this._loading || Boolean(this._deletingShareId)
      || Boolean(this._pendingDelete);
    const missingKey = !shareId;
    let label = 'Delete submission';
    if (busy) label = 'Deleting submission';
    else if (missingKey) label = 'Delete unavailable (no share key)';

    return html`
      <button
        type="button"
        class="ema-queue__delete ${missingKey ? 'ema-queue__delete--no-key' : ''}"
        aria-label=${label}
        title=${missingKey ? 'No share key on this submission — cannot delete yet' : label}
        ?disabled=${disabled}
        @click=${() => this._onDeleteClick(record)}
      >
        <svg
          class="ema-queue__delete-icon"
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 18 18"
          aria-hidden="true"
          focusable="false"
        >
          <path
            fill="currentColor"
            d="M6.75 2.25h4.5a.75.75 0 0 1 .75.75v.75H6v-.75a.75.75 0 0 1 .75-.75ZM4.5 4.5h9l-.6 10.2a1.5 1.5 0 0 1-1.5 1.3H6.6a1.5 1.5 0 0 1-1.5-1.3L4.5 4.5Zm2.85 2.1a.6.6 0 0 0-.6.63l.3 7.14a.6.6 0 0 0 1.2-.03l-.3-7.14a.6.6 0 0 0-.6-.6Zm3.3 0a.6.6 0 0 0-.6.6l-.3 7.14a.6.6 0 0 0 1.2.03l.3-7.14a.6.6 0 0 0-.6-.63Z"
          />
        </svg>
      </button>
    `;
  }

  _onExportCsvClick() {
    const cards = this._cards;
    if (!cards.length) return;
    const csv = recordsToCsv(cards);
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(csv, `pilot-applications-${date}.csv`);
  }

  get _canExport() {
    return !this._loading && this._cards.length > 0;
  }

  _renderLoadingModal() {
    if (!this._loading) return nothing;

    return html`
      <div
        class="ema-queue__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ema-queue-loading-msg"
        aria-busy="true"
      >
        <div class="ema-queue__modal-dialog">
          <div class="ema-queue__modal-spinner" aria-hidden="true"></div>
          <p id="ema-queue-loading-msg" class="ema-queue__modal-message">
            Fetching submissions…
          </p>
        </div>
      </div>
    `;
  }

  _renderConfirmModal() {
    const record = this._pendingDelete;
    if (!record) return nothing;

    const title = pickField(record, TITLE_KEYS) || 'this submission';

    return html`
      <div
        class="ema-queue__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ema-queue-confirm-title"
        aria-describedby="ema-queue-confirm-message"
      >
        <div class="ema-queue__modal-dialog ema-queue__modal-dialog--confirm">
          <h2 id="ema-queue-confirm-title" class="ema-queue__confirm-title">
            Delete submission?
          </h2>
          <p id="ema-queue-confirm-message" class="ema-queue__confirm-message">
            Delete ${title}? This cannot be undone.
          </p>
          <div class="ema-queue__confirm-actions">
            <sp-button variant="secondary" @click=${this._cancelDelete}>No</sp-button>
            <sp-button variant="accent" @click=${this._confirmDelete}>Yes</sp-button>
          </div>
        </div>
      </div>
    `;
  }

  _renderStatus() {
    if (this._error) {
      return html`
        <p class="ema-queue__status ema-queue__status--error" role="alert">
          Could not load shares: ${this._error}
        </p>
      `;
    }
    return nothing;
  }

  /**
   * @param {QueueCardRecord} record
   * @param {number} displayIndex
   */
  _renderCard(record, displayIndex) {
    const { cardId, parseError } = record;

    if (parseError) {
      return html`
        <article class="ema-queue__card ema-queue__card--error" aria-labelledby="ema-queue-card-${cardId}">
          <header class="ema-queue__card-header">
            <div class="ema-queue__card-heading">
              <p class="ema-queue__card-index">#${displayIndex + 1}</p>
              <h2 class="ema-queue__card-title" id="ema-queue-card-${cardId}">
                Submission ${displayIndex + 1}
              </h2>
              <p class="ema-queue__card-error">Could not parse submission data.</p>
            </div>
            ${this._renderDeleteButton(record)}
          </header>
        </article>
      `;
    }

    const title = pickField(record, TITLE_KEYS) || '(No account)';
    const subtitle = pickField(record, SUBTITLE_KEYS);
    const chips = getChipFields(record);
    const chipKeys = new Set(chips.map((c) => c.key));
    const titleKeys = new Set([...TITLE_KEYS, ...SUBTITLE_KEYS]);
    const populated = getPopulatedFields(record);
    const incomplete = isIncompleteSubmission(record);
    const detailFields = populated.filter(
      (f) => !titleKeys.has(f.key) && !chipKeys.has(f.key)
        && !(incomplete && f.key === 'submitted'),
    );
    const expanded = this._isExpanded(cardId);
    const moreCount = detailFields.length;

    return html`
      <article
        class="ema-queue__card ${expanded ? 'ema-queue__card--expanded' : ''} ${incomplete ? 'ema-queue__card--incomplete' : ''}"
        aria-labelledby="ema-queue-card-${cardId}"
      >
        <header class="ema-queue__card-header">
          <div class="ema-queue__card-heading">
            <div class="ema-queue__card-meta">
              <p class="ema-queue__card-index">#${displayIndex + 1}</p>
              ${incomplete
                ? html`<span class="ema-queue__badge ema-queue__badge--incomplete">Incomplete</span>`
                : nothing}
            </div>
            <h2 class="ema-queue__card-title" id="ema-queue-card-${cardId}">${title}</h2>
            ${subtitle
              ? html`<p class="ema-queue__card-subtitle">${subtitle}</p>`
              : nothing}
          </div>
          ${this._renderDeleteButton(record)}
        </header>

        ${chips.length
          ? html`
            <ul class="ema-queue__chips" aria-label="Summary">
              ${chips.map((chip) => html`
                <li class="ema-queue__chip">
                  <span class="ema-queue__chip-label">${chip.label}</span>
                  <span class="ema-queue__chip-value">${chip.value}</span>
                </li>
              `)}
            </ul>
          `
          : nothing}

        ${moreCount > 0
          ? html`
            <button
              type="button"
              class="ema-queue__expand"
              aria-expanded=${expanded}
              aria-controls="ema-queue-detail-${cardId}"
              @click=${() => this._toggleExpand(cardId)}
            >
              ${expanded ? 'Hide' : 'Show'} ${moreCount} more field${moreCount === 1 ? '' : 's'}
            </button>
          `
          : nothing}

        ${expanded && moreCount > 0
          ? html`
            <dl class="ema-queue__detail" id="ema-queue-detail-${cardId}">
              ${detailFields.map((field) => html`
                <div class="ema-queue__detail-row">
                  <dt class="ema-queue__detail-label">${field.label}</dt>
                  <dd class="ema-queue__detail-value">${field.value}</dd>
                </div>
              `)}
            </dl>
          `
          : nothing}
      </article>
    `;
  }

  _renderResults() {
    if (this._loading || this._error || this._data == null) return nothing;

    const cards = this._cards;
    if (!cards.length) {
      return html`<p class="ema-queue__empty">No submissions returned.</p>`;
    }

    let formatted;
    try {
      formatted = JSON.stringify(this._data, null, 2);
    } catch {
      formatted = String(this._data);
    }

    return html`
      <p class="ema-queue__count">${cards.length} submission${cards.length === 1 ? '' : 's'}</p>
      <div class="ema-queue__cards" role="list">
        ${cards.map((record, index) => html`
          <div class="ema-queue__cards-item" role="listitem">
            ${this._renderCard(record, index)}
          </div>
        `)}
      </div>
      <details class="ema-queue__raw">
        <summary>Raw response</summary>
        <pre class="ema-queue__pre">${formatted}</pre>
      </details>
    `;
  }

  render() {
    return html`
      <div class="ema-queue__shell">
        <header class="ema-queue__header">
          <h1 class="ema-queue__title">Pilot Applications</h1>
          <p class="ema-queue__lead">Load all submissions.</p>
        </header>
        <div class="ema-queue__actions">
          <sp-button
            variant="accent"
            ?disabled=${this._loading}
            @click=${this._onRefreshClick}
          >
            Refresh queue
          </sp-button>
          <sp-button
            variant="secondary"
            ?disabled=${!this._canExport}
            @click=${this._onExportCsvClick}
          >
            Export CSV
          </sp-button>
        </div>
        ${this._renderStatus()}
        ${this._renderResults()}
        ${this._renderConfirmModal()}
        ${this._renderLoadingModal()}
      </div>
    `;
  }
}

customElements.define(EL_NAME, EmaQueue);

export default async function init(el) {
  let token = null;
  let context = null;
  let adminOrigin = 'https://admin.da.live';
  try {
    const sdk = await DA_SDK;
    token = sdk.token ?? null;
    context = sdk.context ?? null;
  } catch {
    /* DA parent not available */
  }
  try {
    const mod = await import('https://da.live/nx/public/utils/constants.js');
    if (mod.DA_ORIGIN) adminOrigin = mod.DA_ORIGIN;
  } catch {
    /* default adminOrigin */
  }

  const cmp = document.createElement(EL_NAME);
  cmp.details = typeof getBlockDetails === 'function' ? getBlockDetails(el) : {};
  cmp.context = context && Object.keys(context).length ? { ...context } : null;
  cmp.adminOrigin = adminOrigin;

  const org = context?.org?.trim();
  const repo = context?.repo?.trim();

  if (!token) {
    cmp.primeError('Sign in to Document Authoring to load the queue.');
  } else if (!org || !repo) {
    cmp.primeError('Open the queue from Document Authoring (org and repo context required).');
  } else {
    try {
      const endpoint = await loadFusionEndpointFromConfig({
        token,
        adminOrigin,
        org,
        repo,
      });
      if (endpoint) {
        cmp.fusionEndpoint = endpoint;
      } else {
        cmp.primeError('Add a fusion sheet with key "endpoint" in repo config (path: config).');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load DA config';
      cmp.primeError(msg);
    }
  }

  el.replaceChildren();
  el.append(cmp);
}
