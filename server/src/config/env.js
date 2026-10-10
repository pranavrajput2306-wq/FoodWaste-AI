/**
 * Centralized Environment & Security Configuration Validator
 * Validates critical environment variables across development and production environments.
 * Prevents insecure defaults, missing secrets, or misconfigurations in production.
 */

function validateEnv() {
  const isProduction = process.env.NODE_ENV === 'production';
  const errors = [];
  const warnings = [];

  const jwtSecret = process.env.JWT_SECRET;
  const clientOrigin = process.env.CLIENT_ORIGIN || process.env.FRONTEND_URL || process.env.CORS_ORIGIN;

  const weakOrExampleSecrets = [
    'your_super_secret_jwt_key_change_in_production',
    'secret',
    'jwtsecret',
    'password',
    'changeme',
    '12345678',
    'development',
    'test',
  ];

  if (!jwtSecret || jwtSecret.trim() === '') {
    if (isProduction) {
      errors.push('JWT_SECRET is missing or empty. A strong secret is strictly required in production.');
    } else {
      warnings.push('JWT_SECRET is missing in development; using temporary dev fallback.');
    }
  } else if (isProduction) {
    const trimmedSecret = jwtSecret.trim();
    if (trimmedSecret.length < 32) {
      errors.push(`JWT_SECRET is too short (${trimmedSecret.length} chars). Production requires at least 32 characters.`);
    }
    if (weakOrExampleSecrets.includes(trimmedSecret.toLowerCase())) {
      errors.push('JWT_SECRET is set to an insecure default/placeholder value.');
    }
  }

  if (isProduction) {
    if (!clientOrigin || clientOrigin.trim() === '') {
      errors.push('CLIENT_ORIGIN (or FRONTEND_URL/CORS_ORIGIN) is required in production for CORS restriction.');
    } else if (clientOrigin.trim() === '*') {
      errors.push('CLIENT_ORIGIN cannot be wildcard "*" in production.');
    }

    if (!process.env.DB_HOST) {
      errors.push('DB_HOST is missing in production environment.');
    }
    if (!process.env.DB_NAME) {
      errors.push('DB_NAME is missing in production environment.');
    }
    if (!process.env.DB_USER) {
      errors.push('DB_USER is missing in production environment.');
    }
  }

  if (errors.length > 0) {
    const msg = `\n❌ FATAL PRODUCTION CONFIGURATION ERROR:\n${errors.map((e) => `  - ${e}`).join('\n')}\n`;
    console.error(msg);
    throw new Error(msg);
  }

  if (warnings.length > 0 && process.env.NODE_ENV !== 'test') {
    warnings.forEach((w) => console.warn(`⚠️  [CONFIG WARNING] ${w}`));
  }

  return {
    isProduction,
    jwtSecret: jwtSecret || 'dev_insecure_fallback_secret_not_for_prod',
    clientOrigin: clientOrigin || 'http://localhost:5173',
  };
}

module.exports = { validateEnv };
