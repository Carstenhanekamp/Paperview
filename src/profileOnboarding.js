/**
 * Pure helpers for magic-link redirect + onboarding completeness.
 */

const PROFILE_NAME_MAX = 80;

const DEFAULT_NEXT_PATH = '/app';

/**
 * The single gate for post-sign-in redirect targets. Everything that reads a
 * `next` param goes through here — /login, /welcome, and the magic-link
 * emailRedirectTo — so the rules live in one place.
 *
 * A leading-`//` check alone is not enough: the URL parser folds `\` into `/`
 * for special schemes, so `/\evil.com` resolves to https://evil.com. Fed to
 * react-router's navigate() that is a real off-site redirect on the page
 * immediately following authentication (GHSA-wrjc-x8rr-h8h6).
 */
export function safeNextPath(raw, fallback = DEFAULT_NEXT_PATH) {
  const value = String(raw || '');
  if (!value) return fallback;

  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return fallback; // malformed escapes
  }

  // Backslashes and control/whitespace characters are both authority-smuggling
  // vectors, encoded (%5C, %09) or raw.
  if (value.includes('\\') || decoded.includes('\\')) return fallback;
  // eslint-disable-next-line no-control-regex
  const UNSAFE_CHARS = /[\u0000-\u0020\u007F]/;
  if (UNSAFE_CHARS.test(value) || UNSAFE_CHARS.test(decoded)) return fallback;

  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  if (decoded.startsWith('//')) return fallback;

  return value;
}

export function buildWelcomeRedirectUrl(origin, { intent, next } = {}) {
  const base = String(origin || '').replace(/\/$/, '');
  const url = new URL(`${base}/welcome`);
  if (intent === 'founding') url.searchParams.set('intent', 'founding');
  const safe = next ? safeNextPath(next, '') : '';
  if (safe) url.searchParams.set('next', safe);
  return url.toString();
}

export function profileNeedsOnboarding(profile) {
  if (!profile) return false;
  const display = String(profile.display_name || '').trim();
  const library = String(profile.library_name || '').trim();
  return !display || !library;
}

export function sanitizeProfileName(value, { required = true } = {}) {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    if (required) return { ok: false, error: 'required' };
    return { ok: true, value: '' };
  }
  if (trimmed.length > PROFILE_NAME_MAX) {
    return { ok: false, error: 'too_long' };
  }
  return { ok: true, value: trimmed };
}

export function libraryChromeLabel(profile, activeFolderName) {
  const fromProfile = String(profile?.library_name || '').trim();
  if (fromProfile) return fromProfile;
  const fromFolder = String(activeFolderName || '').trim();
  if (fromFolder) return fromFolder;
  return 'Thesis library';
}

export function displayNameForUi(profile, user) {
  const name = String(profile?.display_name || '').trim();
  if (name) return name;
  const email = String(user?.email || profile?.email || '').trim();
  if (email) return email.split('@')[0] || email;
  return '';
}

export { PROFILE_NAME_MAX };
