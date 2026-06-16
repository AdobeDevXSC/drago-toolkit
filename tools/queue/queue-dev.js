/**
 * Local dev harness for the queue tool, folded into queue.html behind `?dev`.
 *
 * Renders <ema-queue> with sample data and an in-memory stub of the Fusion
 * webhooks, so the UI (filters, CSV, details modal, reviewed/engaged toggles)
 * can be exercised on plain localhost without DA sign-in. Gated to non-prod
 * environments by queue.html. Sample data is fictional.
 */
import './queue.js';

const STUB_ENDPOINT = 'https://hook.fusion.adobe.com/local-dev-stub';

/** Fictional submissions covering every status combination. */
const SAMPLE_RECORDS = [
  {
    key: 'dev-northwind',
    'account-name': 'Northwind Traders',
    'submitter-name': 'Dana Pierce',
    'dr-number': 'DR1000001',
    'migration-type': '1:1 Migration',
    'is-xsc-engaged': 'Yes',
    'eds-awareness-level': 'Aware',
    'xsc-eds-da-demo': 'Within a Year',
    'account-director-name': 'Robin Hale',
    submitted: 'true',
    reviewed: false,
    engaged: false,
    'date-submitted': '2026-06-09',
  },
  {
    key: 'dev-globex',
    'account-name': 'Globex Corporation',
    'submitter-name': 'Avery Lin',
    'dr-number': 'DR1000002',
    'migration-type': '1:1 Migration',
    'is-xsc-engaged': 'Yes',
    'eds-awareness-level': 'Actively evaluating(ed)',
    'xsc-eds-da-demo': 'Recently (within 4-8 wks)',
    'account-director-name': 'Sky Monroe',
    submitted: 'true',
    reviewed: true,
    engaged: false,
    'date-submitted': '2026-06-12T15:30:00Z',
  },
  {
    key: 'dev-initech',
    'account-name': 'Initech',
    'submitter-name': 'Sam Carter',
    'dr-number': 'DR1000003',
    'migration-type': '1:1 Migration',
    'is-xsc-engaged': 'Yes',
    'eds-awareness-level': 'Actively evaluating(ed)',
    'xsc-eds-da-demo': 'At Summit',
    'account-director-name': 'Lee Okafor',
    submitted: 'true',
    reviewed: false,
    engaged: true,
    'date-submitted': '2026-05-27',
  },
  {
    key: 'dev-soylent',
    'account-name': 'Soylent Industries',
    'submitter-name': 'Morgan Reyes',
    'dr-number': 'DR1000004',
    'migration-type': '1:1 Migration',
    'is-xsc-engaged': 'Yes',
    'eds-awareness-level': 'Aware',
    'xsc-eds-da-demo': 'Within a Year',
    'account-director-name': 'Quinn Adler',
    submitted: 'true',
    reviewed: true,
    engaged: true,
    'date-submitted': '2026-05-31',
  },
  {
    key: 'dev-umbra',
    'account-name': 'Umbra Logistics',
    'submitter-name': 'Jordan Fox',
    'dr-number': 'DR1000005',
    'migration-type': '1:1 Migration',
    'is-xsc-engaged': 'No',
    'eds-awareness-level': 'Aware',
    'xsc-eds-da-demo': 'Not yet',
    'account-director-name': 'Drew Bell',
    submitted: 'true',
    reviewed: false,
    engaged: false,
    'date-submitted': '2026-06-02',
  },
  {
    key: 'dev-vandelay',
    'account-name': 'Vandelay Industries',
    'submitter-name': 'Pat Quinn',
    'account-director-name': 'Alex Stone',
    'priority-justification': 'Existing on-prem customer mid-RFP to move to the cloud.\nStrong renewal-timing pressure and an executive sponsor make this a high-priority pilot candidate.',
    submitted: 'false',
    reviewed: false,
    engaged: false,
  },
  {
    key: 'dev-stark',
    'account-name': 'Stark Manufacturing',
    'submitter-name': 'Riley Chen',
    'dr-number': 'DR1000007',
    'migration-type': '1:1 Migration',
    'is-xsc-engaged': 'Yes',
    'eds-awareness-level': 'Aware',
    'xsc-eds-da-demo': 'Recently (within 4-8 wks)',
    'account-director-name': 'Sage Turner',
    'priority-justification': 'Renewal in Q3 creates a compelling event.\nMarketing wants faster time-to-market; current publishing requires developer involvement, a major bottleneck.',
    submitted: 'true',
    reviewed: false,
    engaged: false,
    'date-submitted': '2026-06-05',
  },
  {
    key: 'dev-wayne',
    'account-name': 'Wayne Enterprises',
    'submitter-name': 'Casey Brooks',
    'dr-number': 'DR1000008',
    'migration-type': '1:1 Migration',
    'is-xsc-engaged': 'Yes',
    'eds-awareness-level': 'Already piloting(ed)',
    'xsc-eds-da-demo': 'Recently (within 4-8 wks)',
    'account-director-name': 'Noor Vance',
    submitted: 'true',
    reviewed: false,
    engaged: false,
    'date-submitted': '2026-06-14',
  },
];

/**
 * @param {Record<string, unknown>[]} records mutable in-memory store
 * @returns {(url: string, opts?: RequestInit) => Promise<Response>}
 */
function makeStubFetch(records) {
  const realFetch = window.fetch.bind(window);
  const findByKey = (key) => records.find((r) => String(r.key) === String(key));
  const asWrappers = () => records.map((r) => ({ json: JSON.stringify(r) }));
  const ok = (payload) => new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  return async (url, opts = {}) => {
    if (url !== STUB_ENDPOINT) return realFetch(url, opts);
    const body = JSON.parse(opts.body || '{}');
    if (body.share === 'all') return ok(asWrappers());
    if ('delete' in body) {
      const i = records.findIndex((r) => String(r.key) === String(body.delete));
      if (i >= 0) records.splice(i, 1);
      return ok({ ok: true });
    }
    if ('reviewed' in body) {
      const rec = findByKey(body.key);
      if (rec) rec.reviewed = Boolean(body.reviewed);
      return ok({ ok: true });
    }
    if ('engaged' in body) {
      const rec = findByKey(body.key);
      if (rec) rec.engaged = Boolean(body.engaged);
      return ok({ ok: true });
    }
    return ok({ ok: true });
  };
}

/**
 * Mount the queue in dev mode with stubbed Fusion webhooks and sample data.
 * @param {HTMLElement} root
 */
export default function mountDevQueue(root) {
  const records = SAMPLE_RECORDS.map((r) => ({ ...r }));
  window.fetch = makeStubFetch(records);

  const banner = document.createElement('p');
  banner.className = 'ema-queue__dev-banner';
  banner.textContent = 'Dev mode — Fusion webhooks are stubbed in-memory with sample data. '
    + 'Filters, CSV, the details modal, and the Reviewed/Engaged toggles all work; '
    + 'changes persist until you reload.';

  // Setting the endpoints lets the component's normal firstUpdated() →
  // loadShares() flow fetch the sample data through the stub above.
  const cmp = document.createElement('ema-queue');
  cmp.fusionEndpoint = STUB_ENDPOINT;
  cmp.statusEndpoint = STUB_ENDPOINT;
  cmp.adminOrigin = 'https://admin.da.live';

  root.replaceChildren(banner, cmp);
}
