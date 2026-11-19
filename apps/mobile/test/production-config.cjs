const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  isPublicHttpsUrl,
  productionConfigurationErrors,
  requiredPublicUrls,
  validateProductionConfiguration,
} = require('../scripts/validate-production-config.cjs');

const valid = {
  EXPO_PUBLIC_API_URL: 'https://team47studio.com',
  EXPO_PUBLIC_PORTAL_URL: 'https://team47studio.com',
  EXPO_PUBLIC_PRIVACY_URL: 'https://team47studio.com/privacy',
  EXPO_PUBLIC_TERMS_URL: 'https://team47studio.com/terms',
  EXPO_PUBLIC_AI_DISCLOSURE_URL: 'https://team47studio.com/ai-disclosure',
};

test('Android production configuration accepts the complete public URL set', () => {
  assert.deepEqual(requiredPublicUrls, Object.keys(valid));
  assert.deepEqual(productionConfigurationErrors(valid), []);
  assert.doesNotThrow(() => validateProductionConfiguration(valid));
});

test('Android production configuration rejects incomplete or unsafe public URLs', () => {
  for (const [name, value] of [
    ['EXPO_PUBLIC_API_URL', 'http://api.mgtskincare.test/v1'],
    ['EXPO_PUBLIC_PORTAL_URL', 'https://user:password@portal.mgtskincare.test/account'],
    ['EXPO_PUBLIC_PRIVACY_URL', 'https://policies.mgtskincare.test/privacy?preview=true'],
    ['EXPO_PUBLIC_TERMS_URL', 'https://policies.mgtskincare.test:8443/terms'],
    ['EXPO_PUBLIC_AI_DISCLOSURE_URL', 'https://example.com/ai-disclosure'],
  ]) {
    const errors = productionConfigurationErrors({ ...valid, [name]: value });
    assert.ok(errors.includes(`missing or unsafe ${name}`));
  }
  assert.throws(() => validateProductionConfiguration({ ...valid, EXPO_PUBLIC_API_URL: '' }), /EXPO_PUBLIC_API_URL/);
});

test('Android production configuration rejects secret-shaped public variable names without echoing values', () => {
  const errors = productionConfigurationErrors({ ...valid, EXPO_PUBLIC_API_TOKEN: 'not-printed' });
  assert.deepEqual(errors, ['public environment variable name appears to contain a secret: EXPO_PUBLIC_API_TOKEN']);
});
