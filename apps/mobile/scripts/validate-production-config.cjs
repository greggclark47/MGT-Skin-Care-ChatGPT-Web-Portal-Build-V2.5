const requiredPublicUrls = [
  'EXPO_PUBLIC_API_URL',
  'EXPO_PUBLIC_PORTAL_URL',
  'EXPO_PUBLIC_PRIVACY_URL',
  'EXPO_PUBLIC_TERMS_URL',
  'EXPO_PUBLIC_AI_DISCLOSURE_URL',
];

const productionPlaceholder = /(your-|change[-_]?me|example\.|localhost|127\.0\.0\.1)/i;
const publicSecretName = /(?:SECRET|TOKEN|PASSWORD|SERVICE[_-]?ROLE|PRIVATE[_-]?KEY)/i;

function isPublicHttpsUrl(value) {
  if (typeof value !== 'string' || value.length > 2048 || value !== value.trim() || productionPlaceholder.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname) && url.hostname.includes('.')
      && !url.username && !url.password && !url.port && !url.search && !url.hash;
  } catch {
    return false;
  }
}

function productionConfigurationErrors(env = process.env) {
  const invalidUrls = requiredPublicUrls.filter((name) => !isPublicHttpsUrl(env[name]));
  const unsafePublicNames = Object.keys(env)
    .filter((name) => name.startsWith('EXPO_PUBLIC_') && publicSecretName.test(name))
    .sort();
  return [
    ...invalidUrls.map((name) => `missing or unsafe ${name}`),
    ...unsafePublicNames.map((name) => `public environment variable name appears to contain a secret: ${name}`),
  ];
}

function validateProductionConfiguration(env = process.env) {
  const errors = productionConfigurationErrors(env);
  if (errors.length) throw new Error(`Android production configuration is invalid: ${errors.join('; ')}`);
}

if (require.main === module) {
  try {
    validateProductionConfiguration();
    console.log('Android production configuration is valid.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Android production configuration is invalid.');
    process.exitCode = 1;
  }
}

module.exports = { isPublicHttpsUrl, productionConfigurationErrors, requiredPublicUrls, validateProductionConfiguration };
