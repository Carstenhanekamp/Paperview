import { describe, it, expect } from 'vitest';
import {
  buildWelcomeRedirectUrl,
  profileNeedsOnboarding,
  sanitizeProfileName,
  libraryChromeLabel,
  displayNameForUi,
} from './profileOnboarding.js';

describe('buildWelcomeRedirectUrl', () => {
  it('builds /welcome with founding intent and safe next', () => {
    expect(buildWelcomeRedirectUrl('https://getpaperview.com', { intent: 'founding', next: '/app' }))
      .toBe('https://getpaperview.com/welcome?intent=founding&next=%2Fapp');
  });

  it('rejects protocol-relative next', () => {
    expect(buildWelcomeRedirectUrl('http://localhost:5173', { next: '//evil.test' }))
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
