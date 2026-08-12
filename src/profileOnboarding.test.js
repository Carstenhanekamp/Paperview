import { describe, it, expect } from 'vitest';
import {
  buildWelcomeRedirectUrl,
  profileNeedsOnboarding,
  sanitizeProfileName,
  libraryChromeLabel,
  displayNameForUi,
  documentTitleForUi,
  safeNextPath,
} from './profileOnboarding.js';

describe('safeNextPath', () => {
  it('keeps ordinary in-app paths', () => {
    expect(safeNextPath('/app')).toBe('/app');
    expect(safeNextPath('/app/library?tab=all')).toBe('/app/library?tab=all');
  });

  it('falls back for absolute and protocol-relative targets', () => {
    expect(safeNextPath('https://evil.test')).toBe('/app');
    expect(safeNextPath('//evil.test')).toBe('/app');
    expect(safeNextPath('/%2Fevil.test')).toBe('/app');
  });

  it('rejects backslashes, which the URL parser folds into slashes', () => {
    // '/\evil.test' resolves to https://evil.test — the leading-'//' check
    // alone lets this through (GHSA-wrjc-x8rr-h8h6).
    expect(safeNextPath('/\\evil.test')).toBe('/app');
    expect(safeNextPath('/\\\\evil.test')).toBe('/app');
    expect(safeNextPath('/%5Cevil.test')).toBe('/app');
  });

  it('rejects control characters and malformed escapes', () => {
    expect(safeNextPath('/\tevil.test')).toBe('/app');
    expect(safeNextPath('/%09evil.test')).toBe('/app');
    expect(safeNextPath('/%ZZ')).toBe('/app');
  });

  it('honours an explicit fallback', () => {
    expect(safeNextPath('', '')).toBe('');
    expect(safeNextPath('//evil.test', '/')).toBe('/');
  });
});

describe('buildWelcomeRedirectUrl', () => {
  it('builds /welcome with founding intent and safe next', () => {
    expect(buildWelcomeRedirectUrl('https://getpaperview.com', { intent: 'founding', next: '/app' }))
      .toBe('https://getpaperview.com/welcome?intent=founding&next=%2Fapp');
  });

  it('rejects protocol-relative next', () => {
    expect(buildWelcomeRedirectUrl('http://localhost:5173', { next: '//evil.test' }))
      .toBe('http://localhost:5173/welcome');
  });

  it('rejects backslash-smuggled next', () => {
    expect(buildWelcomeRedirectUrl('http://localhost:5173', { next: '/\\evil.test' }))
      .toBe('http://localhost:5173/welcome');
  });
});

describe('profileNeedsOnboarding', () => {
  it('is false without a profile', () => {
    expect(profileNeedsOnboarding(null)).toBe(false);
  });

  it('is true when either name is missing', () => {
    expect(profileNeedsOnboarding({ display_name: 'Ada', library_name: '' })).toBe(true);
    expect(profileNeedsOnboarding({ display_name: '', library_name: 'Thesis' })).toBe(true);
  });

  it('is false when both are set', () => {
    expect(profileNeedsOnboarding({ display_name: 'Ada', library_name: 'Thesis' })).toBe(false);
  });
});

describe('sanitizeProfileName', () => {
  it('trims and enforces length', () => {
    expect(sanitizeProfileName('  Ada  ')).toEqual({ ok: true, value: 'Ada' });
    expect(sanitizeProfileName('')).toEqual({ ok: false, error: 'required' });
    expect(sanitizeProfileName('x'.repeat(81))).toEqual({ ok: false, error: 'too_long' });
  });
});

describe('libraryChromeLabel / displayNameForUi', () => {
  it('falls back through profile, folder, default', () => {
    expect(libraryChromeLabel({ library_name: 'Mine' }, 'Folder')).toBe('Mine');
    expect(libraryChromeLabel({}, 'Folder')).toBe('Folder');
    expect(libraryChromeLabel({}, '')).toBe('Thesis library');
  });

  it('prefers display_name over email local-part', () => {
    expect(displayNameForUi({ display_name: 'Ada' }, { email: 'a@b.com' })).toBe('Ada');
    expect(displayNameForUi({}, { email: 'ada@b.com' })).toBe('ada');
  });
});

describe('documentTitleForUi', () => {
  it('uses the named library on /app so Safari does not show Untitled', () => {
    expect(documentTitleForUi({ library_name: 'paperview' }, '/app')).toBe('paperview');
    expect(documentTitleForUi({ library_name: '  paperview  ' }, '/app/library')).toBe('paperview');
  });

  it('falls back to Paperview on marketing routes and when unnamed', () => {
    expect(documentTitleForUi({ library_name: 'paperview' }, '/')).toBe('Paperview');
    expect(documentTitleForUi({ library_name: 'paperview' }, '/login')).toBe('Paperview');
    expect(documentTitleForUi({}, '/app')).toBe('Paperview');
    expect(documentTitleForUi(null, '/app')).toBe('Paperview');
  });
});
