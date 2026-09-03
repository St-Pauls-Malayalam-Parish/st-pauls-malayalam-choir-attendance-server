export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;

export function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

export function validateUsername(username) {
  const normalized = normalizeUsername(username);
  if (!USERNAME_PATTERN.test(normalized)) {
    return 'Username must be 3–32 characters: lowercase letters, numbers, dots, underscores, or hyphens';
  }
  return null;
}

export function validateEmail(email) {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Please enter a valid email address';
  }
  return null;
}
