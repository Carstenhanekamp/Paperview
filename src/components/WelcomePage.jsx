import React, { useEffect, useId, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthContext } from '../AuthContext';
import { useWalletContext } from '../WalletContext';
import { FOUNDING_CAP, WELCOME_STORAGE_KEY } from '../supabaseClient';
import { useIsDesktopViewport } from '../hooks/useIsDesktopViewport';
import { setPendingApiKey } from '../pendingApiKey';
import { formatMicrocentsAsEur, TRYOUT_GRANT_MICROCENT } from '../walletCredits';
import { profileNeedsOnboarding, safeNextPath } from '../profileOnboarding';
import OnboardingProfileForm from './OnboardingProfileForm';

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
.pv-welcome-page .wp-field-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
  margin: 0 0 6px;
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
.pv-welcome-page .wp-field-hint {
  margin: -4px 0 14px;
  font-size: 12px;
  color: var(--text-4);
  line-height: 1.4;
}
.pv-welcome-page .wp-error {
  margin: 0 0 12px;
  font-size: 12.5px;
  color: #9b2c2c;
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
.pv-welcome-page .wp-primary:disabled { opacity: 0.55; cursor: not-allowed; }
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

const SESSION_WAIT_MS = 12000;

/**
 * Post-magic-link thank-you / onboarding at /welcome.
 */
export default function WelcomePage() {
  const auth = useAuthContext();
  const wallet = useWalletContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const titleId = useId();
  const isDesktop = useIsDesktopViewport();
  const {
    user,
    profile,
    ready,
    claimBusy,
    profileBusy,
    configured,
    authError,
    setAuthError,
    refreshProfile,
    claimFoundingSlot,
    updateProfile,
  } = auth;

  const intentFounding = searchParams.get('intent') === 'founding';
  const nextPath = safeNextPath(searchParams.get('next'));

  const [step, setStep] = useState('status'); // profile | status | byok
  const [timedOut, setTimedOut] = useState(false);
  const [tryoutClaim, setTryoutClaim] = useState(null);
  const [tryoutBusy, setTryoutBusy] = useState(false);
  const [draftKey, setDraftKey] = useState('');
  const [foundingClaimed, setFoundingClaimed] = useState(false);
  const [routedInitial, setRoutedInitial] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user || !profile || !wallet?.claimTryoutGrant) return;
      setTryoutBusy(true);
      const result = await wallet.claimTryoutGrant();
      if (cancelled) return;
      setTryoutClaim(result);
      setTryoutBusy(false);
      if (result?.granted) {
        await refreshProfile?.();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, profile?.user_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Explicit founding claim only when arriving with intent=founding.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!intentFounding || !user || !profile || foundingClaimed) return;
      if (profile.slot_resolved) {
        setFoundingClaimed(true);
        return;
      }
      const result = await claimFoundingSlot();
      if (cancelled) return;
      if (result?.ok) setFoundingClaimed(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [intentFounding, user?.id, profile?.user_id, profile?.slot_resolved, foundingClaimed, claimFoundingSlot]);

  // Choose initial step once profile is known (only once per mount).
  useEffect(() => {
    if (!user || !profile || routedInitial) return;
    if (profileNeedsOnboarding(profile)) {
      setStep('profile');
      setRoutedInitial(true);
      return;
    }
    // Returning users with a complete profile skip straight to the app unless
    // this visit is a founding thank-you (intent=founding).
    if (!intentFounding) {
      navigate(nextPath, { replace: true });
      return;
    }
    setStep('status');
    setRoutedInitial(true);
  }, [user, profile, intentFounding, nextPath, navigate, routedInitial]);

  const loading = configured && !timedOut && (
    !ready
    || claimBusy
    || tryoutBusy
    || (user && !profile)
    || (!user && !timedOut)
    || (intentFounding && user && profile && !profile.slot_resolved && !foundingClaimed && !authError)
  );

  const openApp = () => navigate(nextPath);
  const goHome = () => navigate('/');
  const goLogin = () => navigate('/login');

  const grantedTryout = Boolean(tryoutClaim?.granted || tryoutClaim?.already_granted || profile?.launch_grant_status === 'granted');
  const grantAmountLabel = formatMicrocentsAsEur(
    typeof tryoutClaim?.grant_microcents === 'number' && tryoutClaim.grant_microcents > 0
      ? tryoutClaim.grant_microcents
      : TRYOUT_GRANT_MICROCENT,
  );
  const balanceLabel = wallet?.balanceLabel || formatMicrocentsAsEur(tryoutClaim?.balance_microcents);

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
          This link may have expired or already been used. Request a new magic link from Log in.
        </p>
        <div className="wp-actions">
          <button type="button" className="wp-primary" onClick={goLogin}>Log in</button>
          <Link className="wp-secondary" to="/">Home</Link>
        </div>
      </>
    );
  } else if (step === 'profile') {
    body = (
      <>
        <span className="wp-eyebrow">Almost there</span>
        <h1 className="wp-title" id={titleId}>Name your library</h1>
        <p className="wp-copy">
          We’ll show your name while you work, and this library label in the sidebar. Folders stay on this device.
        </p>
        <OnboardingProfileForm
          initialDisplayName={profile.display_name || ''}
          initialLibraryName={profile.library_name || ''}
          busy={profileBusy}
          error={authError}
          submitLabel="Save & continue"
          onSubmit={async ({ displayName, libraryName }) => {
            setAuthError?.('');
            const result = await updateProfile({ displayName, libraryName });
            if (!result?.ok) return;
            if (intentFounding || grantedTryout) {
              setStep('status');
              return;
            }
            setStep('byok');
          }}
        />
      </>
    );
  } else if (step === 'byok') {
    body = (
      <>
        <span className="wp-eyebrow">Optional</span>
        <h1 className="wp-title" id={titleId}>Add your own key (fallback)</h1>
        <p className="wp-copy">
          {grantedTryout
            ? 'Tryout credit is used first. Optionally paste your own OpenAI key as a fallback when credit runs out. The key stays in this browser unless you remember it later in Settings.'
            : 'Paste an OpenAI key to ask questions today — or skip for now. The key stays in this browser unless you remember it later in Settings.'}
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
              if (trimmed) setPendingApiKey(trimmed);
              setDraftKey('');
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
      ? Math.min(100, (Number(profile.founder_number) / FOUNDING_CAP) * 100)
      : 100;
    body = (
      <>
        <span className="wp-eyebrow">
          {founding ? `Founder #${profile.founder_number}` : intentFounding ? 'Waitlist' : 'Welcome'}
        </span>
        <h1 className="wp-title" id={titleId}>
          {grantedTryout
            ? `${grantAmountLabel} ready to try`
            : founding
              ? `Thank you — you’re founding member #${profile.founder_number}`
              : intentFounding
                ? 'Thank you — you’re on the list'
                : `Welcome${profile.display_name ? `, ${profile.display_name}` : ''}`}
        </h1>
        <p className="wp-copy">
          {grantedTryout
            ? `Your tryout wallet has ${balanceLabel || grantAmountLabel} (~100 questions at €0.02 each). Open Paperview to start — or add your own OpenAI key as a fallback.`
            : founding
              ? 'You’re on the founding list. If you’re invited for tryout credit, it appears here automatically after sign-in. Until then, open Paperview with your own OpenAI key — free forever.'
              : intentFounding
                ? 'Founding spots are full. We’ll email you when credits launch. You can still use Paperview today with your own key.'
                : 'You’re signed in. Open Paperview to keep reading — credits need this account; your own key does not.'}
        </p>
        {founding ? (
          <div className="wp-tick" aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
          </div>
        ) : null}
        {!isDesktop ? (
          <p className="wp-note">
            The reader works best on desktop — confirm on a larger screen when you’re ready to open a library.
          </p>
        ) : null}
        <div className="wp-actions">
          <button
            type="button"
            className="wp-primary"
            onClick={() => {
              if (grantedTryout) {
                openApp();
                return;
              }
              setStep('byok');
            }}
          >
            {grantedTryout ? 'Open Paperview' : 'Continue'}
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
