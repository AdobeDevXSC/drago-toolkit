/**
 * DA-embedded queue tool: lists form shares via Fusion webhook.
 *
 * List/delete endpoint: DA repo config → fusion sheet → key `endpoint`
 * (see config/repo-config.example.json).
 *   POST list:   { share: "all" }
 *   POST delete: { delete: "<key>" }
 *
 * Status endpoint (STATUS_ENDPOINT below) — persists reviewer actions:
 *   POST review: { key: "<key>", reviewed: <boolean> }
 *   POST engage: { key: "<key>", engaged: <boolean> }
 *
 * Fusion list response: array of { json: "<stringified form record>" } wrappers.
 * Each record includes `key` and the status fields `reviewed`, `engaged`, and
 * `date-submitted`. `reviewed`/`engaged` are persisted back through Fusion so the
 * state is shared across all reviewers (not browser-local).
 */
import DA_SDK from 'https://da.live/nx/utils/sdk.js';
import { LitElement, html, nothing } from '../../deps/lit/dist/index.js';
import { loadFusionEndpointFromConfig } from '../shared/da-config.js';
import { initSpectrum } from '../shared/spectrum-theme.js';

/* global getBlockDetails */

const EL_NAME = 'ema-queue';

/** Fusion webhook that persists reviewer actions (reviewed / engaged). */
const STATUS_ENDPOINT = 'https://hook.fusion.adobe.com/dp0w3vskkydd6g9z4hnra9hp45qf6qi4';

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
 * Persist the reviewed flag for a share back through Fusion.
 * @param {string} endpoint
 * @param {string} shareId
 * @param {boolean} reviewed
 * @returns {Promise<unknown>}
 */
function postShareReview(endpoint, shareId, reviewed) {
  return postFusion(endpoint, { key: shareId, reviewed });
}

/**
 * Persist the engaged flag for a share back through Fusion.
 * @param {string} endpoint
 * @param {string} shareId
 * @param {boolean} engaged
 * @returns {Promise<unknown>}
 */
function postShareEngage(endpoint, shareId, engaged) {
  return postFusion(endpoint, { key: shareId, engaged });
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isTruthyFlag(value) {
  if (value === true) return true;
  if (typeof value === 'string') {
    const s = value.trim().toLowerCase();
    return s === 'true' || s === 'yes';
  }
  return false;
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
 * Reviewed is a human action persisted on the Fusion record as `reviewed`.
 * @param {QueueCardRecord} record
 * @returns {boolean}
 */
function isReviewed(record) {
  return isTruthyFlag(record.reviewed);
}

/**
 * Engaged is a human action persisted on the Fusion record as `engaged`.
 * Distinct from the `is-xsc-engaged` form answer, which stays a card chip.
 * @param {QueueCardRecord} record
 * @returns {boolean}
 */
function isEngaged(record) {
  return isTruthyFlag(record.engaged);
}

/**
 * Format the persisted `date-submitted` value for display. Returns '' when absent
 * or unparseable so the date line can be omitted.
 * @param {QueueCardRecord} record
 * @returns {string}
 */
function submittedDate(record) {
  const raw = record['date-submitted'] ?? record.dateSubmitted;
  if (!isPresent(raw)) return '';
  const str = String(raw).trim();
  let date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    // Date-only: build in local time so it doesn't shift a day across time zones.
    const [y, m, d] = str.split('-').map(Number);
    date = new Date(y, m - 1, d);
  } else {
    const ms = typeof raw === 'number' ? raw : Date.parse(str);
    if (Number.isNaN(ms)) return str;
    date = new Date(ms);
  }
  return date.toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

/**
 * "Complete" is the unprocessed bucket: submitted, but not yet reviewed or engaged.
 * Reviewed and Engaged are the further-along states and own their cards instead.
 * @param {QueueCardRecord} record
 * @returns {boolean}
 */
function isCompleteSubmission(record) {
  return !isIncompleteSubmission(record) && !isReviewed(record) && !isEngaged(record);
}

/**
 * Queue filters. `status` filters (Incomplete/Complete) combine as OR within the
 * group; `flag` filters (Reviewed/Engaged) each add an AND constraint.
 * @typedef {(record: QueueCardRecord) => boolean} FilterTest
 * @type {{ key: string, label: string, group: 'status' | 'flag', test: FilterTest }[]}
 */
const FILTER_DEFS = [
  { key: 'incomplete', label: 'Incomplete', group: 'status', test: isIncompleteSubmission },
  { key: 'complete', label: 'Complete', group: 'status', test: isCompleteSubmission },
  { key: 'reviewed', label: 'Reviewed', group: 'flag', test: isReviewed },
  { key: 'engaged', label: 'Engaged', group: 'flag', test: isEngaged },
];

const FILTER_KEYS = new Set(FILTER_DEFS.map((f) => f.key));

/**
 * @param {QueueCardRecord} record
 * @param {string[]} activeKeys
 * @returns {boolean}
 */
function matchesFilters(record, activeKeys) {
  if (!activeKeys.length) return true;
  const active = FILTER_DEFS.filter((f) => activeKeys.includes(f.key));
  const statusActive = active.filter((f) => f.group === 'status');
  const flagActive = active.filter((f) => f.group === 'flag');
  if (statusActive.length && !statusActive.some((f) => f.test(record))) return false;
  if (flagActive.length && !flagActive.every((f) => f.test(record))) return false;
  return true;
}

/**
 * Read active filter keys from the URL `?filter=` param.
 * @returns {string[]}
 */
function readFiltersFromUrl() {
  try {
    const raw = new URL(window.location.href).searchParams.get('filter') || '';
    return raw.split(',').map((s) => s.trim()).filter((k) => FILTER_KEYS.has(k));
  } catch {
    return [];
  }
}

/**
 * Reflect active filter keys into the URL for shareable views.
 * @param {string[]} keys
 */
function writeFiltersToUrl(keys) {
  try {
    const url = new URL(window.location.href);
    if (keys.length) url.searchParams.set('filter', keys.join(','));
    else url.searchParams.delete('filter');
    window.history.replaceState(null, '', url);
  } catch {
    /* history not available */
  }
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
 *   reviewed?: boolean | string;
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
 * Status flags shown as badges/toggles rather than as raw field rows.
 * Hidden from the card field count and the details modal (still exported to CSV).
 */
const DISPLAY_HIDDEN_KEYS = new Set(['reviewed', 'engaged', 'submitted']);

/**
 * @param {QueueCardRecord} record
 * @returns {{ key: string, label: string, value: string }[]}
 */
function getPopulatedFields(record) {
  return Object.entries(record)
    .filter(([key]) => !META_FIELD_KEYS.has(key) && !DISPLAY_HIDDEN_KEYS.has(key))
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
    statusEndpoint: { attribute: false },
    details: { attribute: false },
    context: { attribute: false },
    adminOrigin: { attribute: false },
    _loading: { state: true },
    _error: { state: true },
    _data: { state: true },
    _detailsCardId: { state: true },
    _bootstrapped: { state: true },
    _deletingShareId: { state: true },
    _pendingDelete: { state: true },
    _reviewingShareId: { state: true },
    _engagingShareId: { state: true },
    _activeFilters: { state: true },
  };

  constructor() {
    super();
    this.fusionEndpoint = null;
    this.statusEndpoint = STATUS_ENDPOINT;
    this.details = {};
    this.context = null;
    this.adminOrigin = 'https://admin.da.live';
    this._loading = false;
    this._error = null;
    this._data = null;
    this._detailsCardId = null;
    this._bootstrapped = false;
    this._deletingShareId = null;
    this._pendingDelete = null;
    this._reviewingShareId = null;
    this._engagingShareId = null;
    this._activeFilters = readFiltersFromUrl();
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
    return this._loading || Boolean(this._pendingDelete) || Boolean(this._detailsCardId);
  }

  updated(changed) {
    super.updated(changed);
    if (changed.has('_loading') || changed.has('_pendingDelete')
      || changed.has('_detailsCardId')) {
      document.body.classList.toggle('ema-queue-loading', this._modalOpen);
    }
  }

  get _cards() {
    return normalizeFusionQueue(this._data);
  }

  get _visibleCards() {
    return this._cards.filter((record) => matchesFilters(record, this._activeFilters));
  }

  /** True while any delete/review/engage mutation is in flight or pending. */
  get _busy() {
    return this._loading || Boolean(this._deletingShareId) || Boolean(this._pendingDelete)
      || Boolean(this._reviewingShareId) || Boolean(this._engagingShareId);
  }

  /** Count of all loaded cards matching each filter, for the pill badges. */
  get _filterCounts() {
    const cards = this._cards;
    return FILTER_DEFS.reduce((acc, f) => {
      acc[f.key] = cards.filter(f.test).length;
      return acc;
    }, /** @type {Record<string, number>} */ ({}));
  }

  /**
   * @param {string} key
   */
  _toggleFilter(key) {
    const next = new Set(this._activeFilters);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    this._activeFilters = FILTER_DEFS.map((f) => f.key).filter((k) => next.has(k));
    writeFiltersToUrl(this._activeFilters);
  }

  _clearFilters() {
    if (!this._activeFilters.length) return;
    this._activeFilters = [];
    writeFiltersToUrl(this._activeFilters);
  }

  /** Record whose details modal is open, resolved from the current card list. */
  get _detailsRecord() {
    if (!this._detailsCardId) return null;
    return this._cards.find((c) => c.cardId === this._detailsCardId) || null;
  }

  /**
   * @param {QueueCardRecord} record
   */
  _openDetails(record) {
    this._detailsCardId = record.cardId;
  }

  _closeDetails() {
    this._detailsCardId = null;
  }

  async loadShares() {
    const endpoint = this.fusionEndpoint;
    if (!endpoint) {
      this._error = 'Fusion endpoint not configured. Add fusion.endpoint in repo DA config.';
      return;
    }
    this._loading = true;
    this._error = null;
    this.requestUpdate();
    try {
      this._data = await postShareAll(endpoint);
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
    if (this._busy) return;
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

  /**
   * Toggle the reviewed flag and persist it through Fusion.
   * @param {QueueCardRecord} record
   */
  async _onToggleReviewed(record) {
    const { shareId } = record;
    if (this._busy) return;
    if (!shareId) {
      this._error = 'Cannot mark reviewed: no share key on this row.';
      this.requestUpdate();
      return;
    }
    const endpoint = this.statusEndpoint;
    if (!endpoint) {
      this._error = 'Status endpoint not configured.';
      this.requestUpdate();
      return;
    }
    const nextReviewed = !isReviewed(record);
    this._reviewingShareId = shareId;
    this._error = null;
    this.requestUpdate();
    try {
      await postShareReview(endpoint, shareId, nextReviewed);
      await this.loadShares();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not update reviewed state';
      this._error = msg;
    } finally {
      this._reviewingShareId = null;
      this.requestUpdate();
    }
  }

  /**
   * Toggle the engaged flag and persist it through Fusion.
   * @param {QueueCardRecord} record
   */
  async _onToggleEngaged(record) {
    const { shareId } = record;
    if (this._busy) return;
    if (!shareId) {
      this._error = 'Cannot mark engaged: no share key on this row.';
      this.requestUpdate();
      return;
    }
    const endpoint = this.statusEndpoint;
    if (!endpoint) {
      this._error = 'Status endpoint not configured.';
      this.requestUpdate();
      return;
    }
    const nextEngaged = !isEngaged(record);
    this._engagingShareId = shareId;
    this._error = null;
    this.requestUpdate();
    try {
      await postShareEngage(endpoint, shareId, nextEngaged);
      await this.loadShares();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not update engaged state';
      this._error = msg;
    } finally {
      this._engagingShareId = null;
      this.requestUpdate();
    }
  }

  /**
   * Shared renderer for the reviewed / engaged status toggles.
   * @param {QueueCardRecord} record
   * @param {{ on: boolean, busy: boolean, modifier: string, icon: string,
   *   onLabel: string, offLabel: string, busyLabel: string, missingLabel: string,
   *   onText: string, offText: string, click: () => void }} cfg
   */
  _renderStatusToggle(record, cfg) {
    const { shareId } = record;
    const disabled = this._busy || !shareId;
    let label = cfg.on ? cfg.onLabel : cfg.offLabel;
    if (cfg.busy) label = cfg.busyLabel;
    if (!shareId) label = cfg.missingLabel;

    return html`
      <button
        type="button"
        class="ema-queue__toggle ema-queue__toggle--${cfg.modifier} ${cfg.on ? 'is-on' : ''}"
        aria-label=${label}
        aria-pressed=${cfg.on}
        title=${label}
        ?disabled=${disabled}
        @click=${cfg.click}
      >
        <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
          <path fill="currentColor" d=${cfg.icon} />
        </svg>
        <span>${cfg.on ? cfg.onText : cfg.offText}</span>
      </button>
    `;
  }

  _renderReviewedButton(record) {
    const reviewed = isReviewed(record);
    return this._renderStatusToggle(record, {
      on: reviewed,
      busy: this._reviewingShareId === record.shareId,
      modifier: 'reviewed',
      icon: 'M6.7 13.3 2.9 9.5l1.2-1.2 2.6 2.6 7-7L15 4.1l-8.3 9.2Z',
      onLabel: 'Reviewed — click to unmark',
      offLabel: 'Mark as reviewed',
      busyLabel: 'Updating reviewed state',
      missingLabel: 'Review unavailable (no share key)',
      onText: 'Reviewed',
      offText: 'Mark reviewed',
      click: () => this._onToggleReviewed(record),
    });
  }

  _renderEngagedButton(record) {
    const engaged = isEngaged(record);
    return this._renderStatusToggle(record, {
      on: engaged,
      busy: this._engagingShareId === record.shareId,
      modifier: 'engaged',
      icon: 'M9 1.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15Zm3.3 5.6-3.9 3.9a.6.6 0 0 1-.85 0L5.7 9.05l.85-.85 1.6 1.6 3.5-3.5.85.8Z',
      onLabel: 'Engaged — click to unmark',
      offLabel: 'Mark as engaged',
      busyLabel: 'Updating engaged state',
      missingLabel: 'Engage unavailable (no share key)',
      onText: 'Engaged',
      offText: 'Mark engaged',
      click: () => this._onToggleEngaged(record),
    });
  }

  _renderDeleteButton(record) {
    const { shareId } = record;
    const busy = this._deletingShareId === shareId;
    const disabled = this._busy;
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
    const cards = this._visibleCards;
    if (!cards.length) return;
    const csv = recordsToCsv(cards);
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(csv, `pilot-applications-${date}.csv`);
  }

  get _canExport() {
    return !this._loading && this._visibleCards.length > 0;
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

  _renderDetailsModal() {
    const record = this._detailsRecord;
    if (!record) return nothing;

    const title = pickField(record, TITLE_KEYS) || 'Submission';
    const subtitle = pickField(record, SUBTITLE_KEYS);
    const fields = getPopulatedFields(record);

    return html`
      <div
        class="ema-queue__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ema-queue-details-title"
        @click=${(e) => { if (e.target === e.currentTarget) this._closeDetails(); }}
        @keydown=${(e) => { if (e.key === 'Escape') this._closeDetails(); }}
      >
        <div class="ema-queue__modal-dialog ema-queue__modal-dialog--details">
          <header class="ema-queue__details-header">
            <div class="ema-queue__details-heading">
              <h2 id="ema-queue-details-title" class="ema-queue__details-title">${title}</h2>
              ${subtitle
                ? html`<p class="ema-queue__details-subtitle">${subtitle}</p>`
                : nothing}
            </div>
            <button
              type="button"
              class="ema-queue__details-close"
              aria-label="Close details"
              @click=${this._closeDetails}
              autofocus
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
                <path
                  fill="currentColor"
                  d="M14.5 4.6 13.4 3.5 9 7.9 4.6 3.5 3.5 4.6 7.9 9l-4.4 4.4 1.1 1.1L9 10.1l4.4 4.4 1.1-1.1L10.1 9z"
                />
              </svg>
            </button>
          </header>
          <dl class="ema-queue__details-list">
            ${fields.map((field) => html`
              <div class="ema-queue__detail-row">
                <dt class="ema-queue__detail-label">${field.label}</dt>
                <dd class="ema-queue__detail-value ema-queue__detail-value--modal">${field.value}</dd>
              </div>
            `)}
          </dl>
        </div>
      </div>
    `;
  }

  _renderFilters() {
    if (this._loading || this._error || this._data == null) return nothing;
    if (!this._cards.length) return nothing;

    const counts = this._filterCounts;
    const hasActive = this._activeFilters.length > 0;

    return html`
      <div class="ema-queue__filters" role="group" aria-label="Filter submissions">
        <span class="ema-queue__filters-label">Filter</span>
        ${FILTER_DEFS.map((f) => {
          const active = this._activeFilters.includes(f.key);
          return html`
            <button
              type="button"
              class="ema-queue__filter ema-queue__filter--${f.key} ${active ? 'is-selected' : ''}"
              aria-pressed=${active}
              @click=${() => this._toggleFilter(f.key)}
            >
              ${f.label}
              <span class="ema-queue__filter-count">${counts[f.key] ?? 0}</span>
            </button>
          `;
        })}
        ${hasActive
          ? html`
            <button type="button" class="ema-queue__filter-clear" @click=${this._clearFilters}>
              Clear
            </button>
          `
          : nothing}
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
    const fieldCount = getPopulatedFields(record).length;
    const incomplete = isIncompleteSubmission(record);
    const complete = isCompleteSubmission(record);
    const reviewed = isReviewed(record);
    const engaged = isEngaged(record);
    const subDate = submittedDate(record);

    return html`
      <article
        class="ema-queue__card ${incomplete ? 'ema-queue__card--incomplete' : ''}"
        aria-labelledby="ema-queue-card-${cardId}"
      >
        <header class="ema-queue__card-header">
          <div class="ema-queue__card-heading">
            <div class="ema-queue__card-meta">
              <p class="ema-queue__card-index">#${displayIndex + 1}</p>
              ${incomplete
                ? html`<span class="ema-queue__badge ema-queue__badge--incomplete">Incomplete</span>`
                : nothing}
              ${complete
                ? html`<span class="ema-queue__badge ema-queue__badge--complete">Complete</span>`
                : nothing}
              ${reviewed
                ? html`<span class="ema-queue__badge ema-queue__badge--reviewed">Reviewed</span>`
                : nothing}
              ${engaged
                ? html`<span class="ema-queue__badge ema-queue__badge--engaged">Engaged</span>`
                : nothing}
            </div>
            <h2 class="ema-queue__card-title" id="ema-queue-card-${cardId}">${title}</h2>
            ${subtitle
              ? html`<p class="ema-queue__card-subtitle">${subtitle}</p>`
              : nothing}
            ${subDate
              ? html`
                <p class="ema-queue__card-date">
                  <span class="ema-queue__card-date-label">Submitted</span> ${subDate}
                </p>`
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

        ${fieldCount > 0
          ? html`
            <button
              type="button"
              class="ema-queue__view-details"
              @click=${() => this._openDetails(record)}
            >
              View all ${fieldCount} field${fieldCount === 1 ? '' : 's'}
            </button>
          `
          : nothing}

        <div class="ema-queue__card-actions">
          ${this._renderReviewedButton(record)}
          ${this._renderEngagedButton(record)}
        </div>
      </article>
    `;
  }

  _renderResults() {
    if (this._loading || this._error || this._data == null) return nothing;

    const total = this._cards.length;
    if (!total) {
      return html`<p class="ema-queue__empty">No submissions returned.</p>`;
    }

    const cards = this._visibleCards;
    const filtered = this._activeFilters.length > 0;
    const count = filtered
      ? html`${cards.length} of ${total} submission${total === 1 ? '' : 's'}`
      : html`${total} submission${total === 1 ? '' : 's'}`;

    if (!cards.length) {
      return html`
        <p class="ema-queue__count">${count}</p>
        <p class="ema-queue__empty">No submissions match these filters.</p>
      `;
    }

    let formatted;
    try {
      formatted = JSON.stringify(this._data, null, 2);
    } catch {
      formatted = String(this._data);
    }

    return html`
      <p class="ema-queue__count">${count}</p>
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
        ${this._renderFilters()}
        ${this._renderStatus()}
        ${this._renderResults()}
        ${this._renderDetailsModal()}
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
