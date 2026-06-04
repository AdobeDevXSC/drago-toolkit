import { expect } from '@esm-bundle/chai';
import {
  FUSION_CONFIG_KEY,
  parseFusionEndpoint,
  validateFusionEndpointUrl,
} from '../../tools/shared/da-config.js';

const VALID_ENDPOINT = 'https://hook.fusion.adobe.com/0kcbtq67fawhez2i2dirnpffmby1hhil';

describe('da-config', () => {
  describe('validateFusionEndpointUrl', () => {
    it('accepts https hook.fusion.adobe.com URLs', () => {
      expect(validateFusionEndpointUrl(VALID_ENDPOINT)).to.equal(VALID_ENDPOINT);
    });

    it('rejects http', () => {
      expect(validateFusionEndpointUrl('http://hook.fusion.adobe.com/x')).to.equal(null);
    });

    it('rejects other hosts', () => {
      expect(validateFusionEndpointUrl('https://evil.example/hook')).to.equal(null);
    });

    it('rejects empty', () => {
      expect(validateFusionEndpointUrl('')).to.equal(null);
    });
  });

  describe('parseFusionEndpoint', () => {
    it('reads endpoint from fusion sheet', () => {
      const config = {
        ':names': ['fusion'],
        ':type': 'multi-sheet',
        fusion: {
          total: 1,
          data: [{ key: FUSION_CONFIG_KEY, value: VALID_ENDPOINT }],
        },
      };
      expect(parseFusionEndpoint(config)).to.equal(VALID_ENDPOINT);
    });

    it('returns null when sheet missing', () => {
      expect(parseFusionEndpoint({ ':names': [], ':type': 'multi-sheet' })).to.equal(null);
    });

    it('returns null for wrong key', () => {
      const config = {
        fusion: { total: 1, data: [{ key: 'other', value: VALID_ENDPOINT }] },
      };
      expect(parseFusionEndpoint(config)).to.equal(null);
    });

    it('returns null for invalid URL value', () => {
      const config = {
        fusion: { total: 1, data: [{ key: FUSION_CONFIG_KEY, value: 'not-a-url' }] },
      };
      expect(parseFusionEndpoint(config)).to.equal(null);
    });

    it('returns null for null config', () => {
      expect(parseFusionEndpoint(null)).to.equal(null);
    });
  });
});
