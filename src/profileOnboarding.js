/**
 * Pure helpers for magic-link redirect + onboarding completeness.
 */

const PROFILE_NAME_MAX = 80;

export function buildWelcomeRedirectUrl(origin, { intent, next } = {}) {
  const base = String(origin || '').replace(/\/$/, '');
  const url = new URL(`${base}/welcome`);
  if (intent === 'founding') url.searchParams.set('intent', 'founding');
  if (next && typeof next === 'string' && next.startsWith('/') && !next.startsWith('//')) {
    url.searchParams.set('next', next);
  }
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
