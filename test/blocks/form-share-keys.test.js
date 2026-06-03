import { expect } from '@esm-bundle/chai';
import { toCamelCase } from '../../scripts/utils/string.js';

const SHARE_DATA_META_KEYS = new Set([
  'key', 'submitted', 'shareId', 'id', 'share_id', 'shared', 'complete',
  'activeSection', 'sectionId', 'savedAt', 'formPath',
]);

function normalizeShareDataKey(key) {
  return key.includes('-') ? toCamelCase(key) : key;
}

function normalizeShareDataKeys(data) {
  return Object.fromEntries(
    Object.entries(data)
      .filter(([key]) => !SHARE_DATA_META_KEYS.has(key))
      .map(([key, value]) => [normalizeShareDataKey(key), value]),
  );
}

function unwrapShareRecord(payload) {
  if (Array.isArray(payload)) {
    if (!payload.length) return null;
    return payload[0];
  }
  if (payload && typeof payload === 'object') return payload;
  return null;
}

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

const fusionKebabPayload = [{
  key: null,
  'xsc-name': 'test',
  'dr-number': 'DR-123456',
  submitted: 'false',
  'account-name': 'Nissan North America',
  'is-xsc-engaged': 'Yes',
  'migration-type': '1:1 Migration',
  'fy26-aem-sites-license-gnarr-estimated': '$250,000',
}];

const saveShareCamelPayload = {
  shared: true,
  complete: false,
  activeSection: 2,
  data: {
    accountName: 'Nissan North America',
    drNumber: 'DR-123456',
    xscName: 'test',
  },
};

describe('share payload key normalization', () => {
  it('maps kebab-case Fusion fields to camelCase form names', () => {
    const result = normalizeSharePayload(fusionKebabPayload);
    expect(result).to.not.be.null;
    expect(result.data).to.deep.equal({
      xscName: 'test',
      drNumber: 'DR-123456',
      accountName: 'Nissan North America',
      isXscEngaged: 'Yes',
      migrationType: '1:1 Migration',
      fy26AemSitesLicenseGnarrEstimated: '$250,000',
    });
  });

  it('excludes metadata keys from restored data', () => {
    const result = normalizeSharePayload(fusionKebabPayload);
    expect(result.data).to.not.have.any.keys('key', 'submitted');
  });

  it('passes through camelCase Save & Share data unchanged', () => {
    const result = normalizeSharePayload(saveShareCamelPayload);
    expect(result.data).to.deep.equal(saveShareCamelPayload.data);
    expect(result.activeSection).to.equal(2);
  });

  it('normalizes kebab-case keys inside nested data wrapper', () => {
    const result = normalizeSharePayload({
      data: {
        'account-name': 'Acme',
        'dr-number': 'DR-1',
      },
      activeSection: 1,
    });
    expect(result.data).to.deep.equal({
      accountName: 'Acme',
      drNumber: 'DR-1',
    });
    expect(result.activeSection).to.equal(1);
  });
});
