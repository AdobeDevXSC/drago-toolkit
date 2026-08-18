import { expect } from '@esm-bundle/chai';
import { buildFormShareUrl } from '../../tools/queue/form-share-url.js';

const CONTEXT = { org: 'adobedevxsc', repo: 'drago-toolkit' };

describe('buildFormShareUrl', () => {
  it('builds the intake form URL for a valid context and share id', () => {
    expect(buildFormShareUrl(CONTEXT, 'a3aec53b1ff9')).to.equal(
      'https://main--drago-toolkit--adobedevxsc.aem.page/intake/form?share=a3aec53b1ff9',
    );
  });

  it('accepts hyphenated share ids', () => {
    expect(buildFormShareUrl(CONTEXT, 'DR-123456-abcd')).to.equal(
      'https://main--drago-toolkit--adobedevxsc.aem.page/intake/form?share=DR-123456-abcd',
    );
  });

  it('trims surrounding whitespace on org, repo, and share id', () => {
    const padded = { org: '  adobedevxsc  ', repo: '  drago-toolkit  ' };
    expect(buildFormShareUrl(padded, '  a3aec53b1ff9  ')).to.equal(
      'https://main--drago-toolkit--adobedevxsc.aem.page/intake/form?share=a3aec53b1ff9',
    );
  });

  it('returns null when the share id is missing or empty', () => {
    expect(buildFormShareUrl(CONTEXT, '')).to.equal(null);
    expect(buildFormShareUrl(CONTEXT, '   ')).to.equal(null);
    expect(buildFormShareUrl(CONTEXT, null)).to.equal(null);
    expect(buildFormShareUrl(CONTEXT, undefined)).to.equal(null);
  });

  it('returns null when the share id is malformed', () => {
    expect(buildFormShareUrl(CONTEXT, 'ab')).to.equal(null); // too short
    expect(buildFormShareUrl(CONTEXT, 'has space')).to.equal(null);
    expect(buildFormShareUrl(CONTEXT, 'bad/slash')).to.equal(null);
    expect(buildFormShareUrl(CONTEXT, 'bad?q=1')).to.equal(null);
  });

  it('returns null when org or repo is missing', () => {
    expect(buildFormShareUrl({ repo: 'drago-toolkit' }, 'a3aec53b1ff9')).to.equal(null);
    expect(buildFormShareUrl({ org: 'adobedevxsc' }, 'a3aec53b1ff9')).to.equal(null);
    expect(buildFormShareUrl({ org: '  ', repo: '  ' }, 'a3aec53b1ff9')).to.equal(null);
    expect(buildFormShareUrl(null, 'a3aec53b1ff9')).to.equal(null);
    expect(buildFormShareUrl(undefined, 'a3aec53b1ff9')).to.equal(null);
  });
});
