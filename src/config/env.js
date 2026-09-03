const WEAK_JWT_SECRETS = new Set([
  'change-this-to-a-long-random-string',
  'secret',
  'jwt_secret',
  'your-secret-here',
]);

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function validateUrl(name, value, { required }) {
  if (!value) {
    if (required) return `${name} is required`;
    return null;
  }
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return `${name} must use http or https`;
    }
    return null;
  } catch {
    return `${name} must be a valid URL`;
  }
}

/**
 * Validate required environment variables before the server starts.
 * Throws with a clear message if configuration is unsafe or incomplete.
 */
export function validateEnv() {
  const errors = [];
  const warnings = [];

  if (!process.env.MONGODB_URI?.trim()) {
    errors.push('MONGODB_URI is required');
  }

  const jwtSecret = process.env.JWT_SECRET?.trim();
  if (!jwtSecret) {
    errors.push('JWT_SECRET is required');
  } else {
    const weak = WEAK_JWT_SECRETS.has(jwtSecret.toLowerCase());
    const minLength = isProduction() ? 32 : 16;

    if (weak) {
      const message = 'JWT_SECRET must not use the example placeholder';
      if (isProduction()) errors.push(message);
      else warnings.push(message);
    }
    if (jwtSecret.length < minLength) {
      const message = `JWT_SECRET must be at least ${minLength} characters`;
      if (isProduction()) errors.push(message);
      else warnings.push(message);
    }
  }

  const originError = validateUrl('CLIENT_ORIGIN', process.env.CLIENT_ORIGIN?.trim(), {
    required: isProduction(),
  });
  if (originError) errors.push(originError);

  if (isProduction() && process.env.ADMIN_PASSWORD === 'choiradmin') {
    warnings.push('ADMIN_PASSWORD is still the default — change it after running seed');
  }

  for (const warning of warnings) {
    console.warn(`[env] ${warning}`);
  }

  if (errors.length) {
    throw new Error(`Invalid environment:\n- ${errors.join('\n- ')}`);
  }
}
