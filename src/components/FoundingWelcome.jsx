import React, { useEffect, useId, useRef, useState } from 'react';
import { FOUNDING_CAP, WELCOME_STORAGE_KEY } from '../supabaseClient';
import { useIsDesktopViewport } from '../hooks/useIsDesktopViewport';

const WELCOME_CSS = `
.pv-welcome-overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(16, 20, 26, 0.52);
  backdrop-filter: blur(18px) saturate(140%);
  -webkit-backdrop-filter: blur(18px) saturate(140%);
  --pv-ease: cubic-bezier(0.32, 0.72, 0, 1);
}
.pv-welcome-shell {
  width: min(440px, 100%);
  padding: 8px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.1);
  box-shadow: inset 0 0 0 0.5px rgba(255, 255, 255, 0.22);
  animation: pv-welcome-in 0.7s var(--pv-ease) both;
}
.pv-welcome-panel {
  border-radius: 22px;
  background: #FAFAFA;
  padding: 28px 26px 22px;
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.8), 0 24px 60px -28px rgba(12, 16, 28, 0.45);
  color: #17181A;
}
.pv-welcome-eyebrow {
  display: inline-flex;
  margin-bottom: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  background: #E3E9EF;
  color: #2F4056;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  animation: pv-welcome-stagger 0.55s var(--pv-ease) both;
  animation-delay: 80ms;
}
.pv-welcome-title {
  margin: 0 0 8px;
  font-family: Literata, Georgia, serif;
  font-size: 28px;
  line-height: 1.2;
  font-weight: 700;
  animation: pv-welcome-stagger 0.55s var(--pv-ease) both;
  animation-delay: 120ms;
}
.pv-welcome-copy {
  margin: 0 0 18px;
  font-size: 14.5px;
  line-height: 1.5;
  color: #5D616A;
  animation: pv-welcome-stagger 0.55s var(--pv-ease) both;
  animation-delay: 160ms;
}
.pv-welcome-tick {
  height: 6px;
  border-radius: 999px;
  background: #E6E7EA;
  overflow: hidden;
  margin-bottom: 18px;
  animation: pv-welcome-stagger 0.55s var(--pv-ease) both;
  animation-delay: 180ms;
}
.pv-welcome-tick > span {
  display: block;
  height: 100%;
  background: #55697F;
  border-radius: inherit;
}
.pv-welcome-field {
  width: 100%;
  box-sizing: border-box;
  border: 0;
  border-radius: 12px;
  background: #F2F2F4;
  padding: 12px 14px;
  font: inherit;
  font-size: 14px;
  margin-bottom: 12px;
}
.pv-welcome-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  animation: pv-welcome-stagger 0.55s var(--pv-ease) both;
  animation-delay: 220ms;
}
.pv-welcome-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 0;
  border-radius: 999px;
  padding: 12px 18px;
  background: #55697F;
  color: #fff;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: transform 0.45s var(--pv-ease), background 0.45s var(--pv-ease);
}
.pv-welcome-primary:hover { background: #3F5063; }
.pv-welcome-primary:active { transform: scale(0.98); }
.pv-welcome-secondary {
  border: 0;
  background: transparent;
  color: #2F4056;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  padding: 8px;
}
.pv-welcome-note {
  margin: 10px 0 0;
  font-size: 12px;
  color: #9095A0;
  text-align: center;
}
@keyframes pv-welcome-in {
  from { opacity: 0; transform: translateY(18px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes pv-welcome-stagger {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .pv-welcome-shell,
  .pv-welcome-eyebrow,
  .pv-welcome-title,
  .pv-welcome-copy,
  .pv-welcome-tick,
  .pv-welcome-actions {
    animation: none !important;
  }
}
`;

function ensureStyles() {
  if (typeof document === 'undefined') return;
  if (document.querySelector('style[data-pv-founding-welcome]')) return;
  const style = document.createElement('style');
  style.setAttribute('data-pv-founding-welcome', '1');
  style.textContent = WELCOME_CSS;
  document.head.appendChild(style);
}

function shouldShowWelcome(user) {
  if (!user) return false;
  try {
    const raw = localStorage.getItem(WELCOME_STORAGE_KEY);
    if (!raw) return true;
    const parsed = JSON.parse(raw);
    return parsed?.userId !== user.id;
  } catch {
    return true;
  }
}

function markWelcomeSeen(userId) {
  try {
    localStorage.setItem(WELCOME_STORAGE_KEY, JSON.stringify({ userId, at: Date.now() }));
  } catch {
    /* ignore */
  }
}

/**
 * One-time post-auth welcome sheet (founder vs waitlist) + optional soft BYOK.
 */
export default function FoundingWelcome({
  auth,
  apiKey = '',
  onSaveApiKey,
  onOpenSettings,
  onOpenApp,
}) {
  const { user, profile, ready, claimBusy } = auth;
  const titleId = useId();
  const isDesktop = useIsDesktopViewport();
  const panelRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState('status'); // status | byok
  const [draftKey, setDraftKey] = useState('');

  useEffect(() => {
    ensureStyles();
  }, []);

  useEffect(() => {
    if (!ready || claimBusy) return;
    if (!user || !profile) return;
    const params = new URLSearchParams(window.location.search);
    const force = params.get('welcome') === '1';
    if (force || shouldShowWelcome(user)) {
      setOpen(true);
      setStep('status');
    }
  }, [ready, claimBusy, user, profile]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKey);
    panelRef.current?.querySelector('button, input')?.focus?.();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, step]);

  if (!open || !user || !profile) return null;

  const founding = Boolean(profile.founding);
  const progress = founding && profile.founder_number
    ? Math.min(100, (Number(profile.founder_number) / FOUNDING_CAP) * 100)
    : 100;

  const dismiss = () => {
    markWelcomeSeen(user.id);
    setOpen(false);
    const url = new URL(window.location.href);
    if (url.searchParams.has('welcome')) {
      url.searchParams.delete('welcome');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    }
  };

  const continuePrimary = () => {
    if (!apiKey && step === 'status') {
      setStep('byok');
      return;
    }
    dismiss();
    onOpenApp?.();
  };

  return (
    <div className="pv-welcome-overlay" role="presentation" onClick={dismiss}>
      <div
        className="pv-welcome-shell"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pv-welcome-panel">
          {step === 'status' ? (
            <>
              <div className="pv-welcome-eyebrow">
                {founding ? `Founder #${profile.founder_number}` : 'Waitlist'}
              </div>
              <h2 className="pv-welcome-title" id={titleId}>
                {founding
                  ? `You’re founding member #${profile.founder_number}`
                  : 'You’re on the list'}
              </h2>
              <p className="pv-welcome-copy">
                {founding
                  ? '€2 of credits are reserved for when pay-per-use launches. Until then, open Paperview with your own OpenAI key — free forever.'
                  : 'Founding spots are full. We’ll email you when credits launch. You can still use Paperview today with your own key.'}
              </p>
              {founding ? (
                <div className="pv-welcome-tick" aria-hidden="true">
                  <span style={{ width: `${progress}%` }} />
                </div>
              ) : null}
              {!isDesktop ? (
                <p className="pv-welcome-note">
                  The reader is desktop-oriented — continue on a larger screen when you’re ready to open a library.
                </p>
              ) : null}
              <div className="pv-welcome-actions">
                <button type="button" className="pv-welcome-primary" onClick={continuePrimary}>
                  {apiKey ? 'Open your library' : 'Continue'}
                </button>
                {onOpenSettings ? (
                  <button
                    type="button"
                    className="pv-welcome-secondary"
                    onClick={() => {
                      dismiss();
                      onOpenSettings();
                    }}
                  >
                    Account &amp; settings
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <div className="pv-welcome-eyebrow">Optional</div>
              <h2 className="pv-welcome-title" id={titleId}>
                Try Paperview now
              </h2>
              <p className="pv-welcome-copy">
                Paste an OpenAI key to ask questions today — or skip and wait for credits. The key stays in this browser unless you choose to remember it in Settings.
              </p>
              <input
                className="pv-welcome-field"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="sk-..."
                value={draftKey}
                onChange={(e) => setDraftKey(e.target.value)}
                aria-label="OpenAI API key"
              />
              <div className="pv-welcome-actions">
                <button
                  type="button"
                  className="pv-welcome-primary"
                  onClick={() => {
                    const trimmed = draftKey.trim();
                    if (trimmed && onSaveApiKey) onSaveApiKey(trimmed);
                    dismiss();
                    onOpenApp?.();
                  }}
                >
                  {draftKey.trim() ? 'Save key & open' : 'Skip for now'}
                </button>
                <button type="button" className="pv-welcome-secondary" onClick={() => setStep('status')}>
                  Back
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
