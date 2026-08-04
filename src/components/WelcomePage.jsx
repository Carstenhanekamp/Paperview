import React, { useEffect, useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthContext } from '../AuthContext';
import { WELCOME_STORAGE_KEY } from '../supabaseClient';

const FONT_URL =
  "https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;0,7..72,700;1,7..72,400&display=swap";

const PAGE_CSS = `
.pv-welcome-page {
  --ink: #17181A;
  --text-2: #5D616A;
  --text-4: #9095A0;
  --accent: #55697F;
  --accent-hover: #3F5063;
  --accent-tint: #E3E9EF;
  --accent-on: #2F4056;
  --page-bg: #FAFAFA;
  --ease: cubic-bezier(0.32, 0.72, 0, 1);
  min-height: 100dvh;
  box-sizing: border-box;
  padding: 32px 20px 48px;
  background:
    radial-gradient(90% 60% at 10% 0%, rgba(85, 105, 127, 0.12), transparent 55%),
    var(--page-bg);
  color: var(--ink);
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', system-ui, sans-serif;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.pv-welcome-page *, .pv-welcome-page *::before, .pv-welcome-page *::after { box-sizing: border-box; }
.pv-welcome-page .wp-brand {
  align-self: stretch;
  max-width: 520px;
  width: 100%;
  margin: 0 auto 28px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent);
}
.pv-welcome-page .wp-brand a {
  color: inherit;
  text-decoration: none;
}
.pv-welcome-page .wp-shell {
  width: min(520px, 100%);
  padding: 8px;
  border-radius: 28px;
  background: rgba(20, 22, 28, 0.04);
  box-shadow: inset 0 0 0 0.5px rgba(20, 22, 28, 0.1);
  animation: wp-in 0.7s var(--ease) both;
}
.pv-welcome-page .wp-panel {
  border-radius: 22px;
  background: #fff;
  padding: 32px 28px 26px;
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.85);
}
.pv-welcome-page .wp-eyebrow {
  display: inline-flex;
  margin: 0 0 12px;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--accent-tint);
  color: var(--accent-on);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
.pv-welcome-page .wp-title {
  margin: 0 0 10px;
  font-family: Literata, Georgia, serif;
  font-size: clamp(26px, 5vw, 32px);
  line-height: 1.2;
  font-weight: 700;
}
.pv-welcome-page .wp-copy {
  margin: 0 0 20px;
  font-size: 15px;
  line-height: 1.55;
  color: var(--text-2);
}
.pv-welcome-page .wp-tick {
  height: 6px;
  border-radius: 999px;
  background: #E6E7EA;
  overflow: hidden;
  margin: 0 0 22px;
}
.pv-welcome-page .wp-tick > span {
  display: block;
  height: 100%;
  background: var(--accent);
  border-radius: inherit;
}
.pv-welcome-page .wp-field {
  width: 100%;
  border: 0;
  border-radius: 12px;
  background: #F2F2F4;
  padding: 12px 14px;
  font: inherit;
  font-size: 14px;
  margin-bottom: 12px;
}
.pv-welcome-page .wp-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.pv-welcome-page .wp-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 0;
  border-radius: 999px;
  padding: 13px 18px;
  background: var(--accent);
  color: #fff;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  text-decoration: none;
  transition: transform 0.45s var(--ease), background 0.45s var(--ease);
}
.pv-welcome-page .wp-primary:hover { background: var(--accent-hover); }
.pv-welcome-page .wp-primary:active { transform: scale(0.98); }
.pv-welcome-page .wp-secondary {
  border: 0;
  background: transparent;
  color: var(--accent-on);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  padding: 10px;
  text-align: center;
  text-decoration: none;
}
.pv-welcome-page .wp-note {
  margin: 14px 0 0;
  font-size: 12px;
  color: var(--text-4);
  text-align: center;
}
.pv-welcome-page .wp-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 24px 8px;
  color: var(--text-2);
  font-size: 14px;
}
.pv-welcome-page .wp-spinner {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border: 2px solid #E6E7EA;
  border-top-color: var(--accent);
  animation: wp-spin 0.8s linear infinite;
}
@keyframes wp-in {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes wp-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  .pv-welcome-page .wp-shell,
  .pv-welcome-page .wp-spinner,
  .pv-welcome-page .wp-primary {
    animation: none !important;
    transition: none !important;
  }
}
`;

function ensureStyles() {
  if (typeof document === 'undefined') return;
  if (!document.querySelector('link[data-paperview-welcome-font]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONT_URL;
    link.setAttribute('data-paperview-welcome-font', '1');
    document.head.appendChild(link);
  }
  if (!document.querySelector('style[data-pv-welcome-page]')) {
    const style = document.createElement('style');
    style.setAttribute('data-pv-welcome-page', '1');
    style.textContent = PAGE_CSS;
    document.head.appendChild(style);
  }
}

function markWelcomeSeen(userId) {
  try {
    localStorage.setItem(WELCOME_STORAGE_KEY, JSON.stringify({ userId, at: Date.now() }));
  } catch {
    /* ignore */
  }
}

function isDesktopViewport() {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(min-width: 900px)').matches;
}

const SESSION_WAIT_MS = 12000;

/**
 * Dedicated post-signup thank-you page at /welcome.
 */
export default function WelcomePage() {
  const auth = useAuthContext();
  const navigate = useNavigate();
  const titleId = useId();
  const { user, profile, ready, claimBusy, configured } = auth;
  const [step, setStep] = useState('status'); // status | byok
  const [draftKey, setDraftKey] = useState('');
  const [timedOut, setTimedOut] = useState(false);
  const [apiKeyMemory, setApiKeyMemory] = useState('');

  useEffect(() => {
    ensureStyles();
    document.body.style.overflow = 'auto';
    document.body.style.background = '#FAFAFA';
    return () => {
      document.body.style.overflow = '';
      document.body.style.background = '';
    };
  }, []);

  useEffect(() => {
    if (!configured) return undefined;
    if (user && profile) {
      setTimedOut(false);
      markWelcomeSeen(user.id);
      return undefined;
    }
    const t = window.setTimeout(() => setTimedOut(true), SESSION_WAIT_MS);
    return () => window.clearTimeout(t);
  }, [configured, user, profile]);

  const loading = configured && !timedOut && (!ready || claimBusy || (user && !profile) || (!user && !timedOut));

  const openApp = () => navigate('/app');
  const goHome = () => navigate('/');
  const goPricing = () => navigate('/#pricing');

  let body = null;

  if (!configured) {
    body = (
      <>
        <span className="wp-eyebrow">Accounts</span>
        <h1 className="wp-title" id={titleId}>Accounts aren’t configured</h1>
        <p className="wp-copy">
          This build has no Supabase keys. You can still open Paperview with your own OpenAI key.
        </p>
        <div className="wp-actions">
          <button type="button" className="wp-primary" onClick={openApp}>Open Paperview</button>
          <Link className="wp-secondary" to="/">Back to home</Link>
        </div>
      </>
    );
  } else if (loading) {
    body = (
      <div className="wp-loading" role="status" aria-live="polite">
        <div className="wp-spinner" aria-hidden="true" />
        <span>Confirming your account…</span>
      </div>
    );
  } else if (!user || !profile) {
    body = (
      <>
        <span className="wp-eyebrow">Link expired</span>
        <h1 className="wp-title" id={titleId}>We couldn’t finish sign-in</h1>
        <p className="wp-copy">
          This link may have expired or already been used. Request a new magic link from the founding card on the homepage.
        </p>
        <div className="wp-actions">
          <button type="button" className="wp-primary" onClick={goPricing}>Back to founding signup</button>
          <Link className="wp-secondary" to="/">Home</Link>
        </div>
      </>
    );
  } else if (step === 'byok') {
    body = (
      <>
        <span className="wp-eyebrow">Optional</span>
        <h1 className="wp-title" id={titleId}>Try Paperview now</h1>
        <p className="wp-copy">
          Paste an OpenAI key to ask questions today — or skip and wait for credits. The key stays in this browser unless you remember it later in Settings.
        </p>
        <input
          className="wp-field"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="sk-..."
          value={draftKey}
          onChange={(e) => setDraftKey(e.target.value)}
          aria-label="OpenAI API key"
        />
        <div className="wp-actions">
          <button
            type="button"
            className="wp-primary"
            onClick={() => {
              const trimmed = draftKey.trim();
              if (trimmed) {
                try {
                  sessionStorage.setItem('pv.welcome.apikey', trimmed);
                } catch {
                  /* ignore */
                }
                setApiKeyMemory(trimmed);
              }
              openApp();
            }}
          >
            {draftKey.trim() ? 'Save key & open' : 'Skip for now'}
          </button>
          <button type="button" className="wp-secondary" onClick={() => setStep('status')}>
            Back
          </button>
        </div>
      </>
    );
  } else {
    const founding = Boolean(profile.founding);
    const progress = founding && profile.founder_number
      ? Math.min(100, (Number(profile.founder_number) / 100) * 100)
      : 100;
    body = (
      <>
        <span className="wp-eyebrow">
          {founding ? `Founder #${profile.founder_number}` : 'Waitlist'}
        </span>
        <h1 className="wp-title" id={titleId}>
          {founding
            ? `Thank you — you’re founding member #${profile.founder_number}`
            : 'Thank you — you’re on the list'}
        </h1>
        <p className="wp-copy">
          {founding
            ? '€2 of credits are reserved for when pay-per-use launches. Until then, open Paperview with your own OpenAI key — free forever.'
            : 'Founding spots are full. We’ll email you when credits launch. You can still use Paperview today with your own key.'}
        </p>
        {founding ? (
          <div className="wp-tick" aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
          </div>
        ) : null}
        {!isDesktopViewport() ? (
          <p className="wp-note">
            The reader works best on desktop — confirm on a larger screen when you’re ready to open a library.
          </p>
        ) : null}
        <div className="wp-actions">
          <button
            type="button"
            className="wp-primary"
            onClick={() => {
              if (!apiKeyMemory) {
                setStep('byok');
                return;
              }
              openApp();
            }}
          >
            {apiKeyMemory ? 'Open Paperview' : 'Continue'}
          </button>
          <button type="button" className="wp-secondary" onClick={goHome}>
            Back to home
          </button>
        </div>
        <p className="wp-note">
          Signed in as {user.email || profile.email || 'your email'}. You can review this anytime in Settings → Account.
        </p>
      </>
    );
  }

  return (
    <div className="pv-welcome-page">
      <div className="wp-brand">
        <Link to="/">Paperview</Link>
      </div>
      <div className="wp-shell">
        <div className="wp-panel" aria-labelledby={titleId}>
          {body}
        </div>
      </div>
    </div>
  );
}
