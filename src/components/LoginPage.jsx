import React, { useEffect, useId, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthContext } from '../AuthContext';
import { profileNeedsOnboarding, safeNextPath } from '../profileOnboarding';

const FONT_URL =
  "https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;0,7..72,700;1,7..72,400&display=swap";

const PAGE_CSS = `
.pv-login-page {
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
.pv-login-page *, .pv-login-page *::before, .pv-login-page *::after { box-sizing: border-box; }
.pv-login-page .lp-brand {
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
.pv-login-page .lp-brand a { color: inherit; text-decoration: none; }
.pv-login-page .lp-shell {
  width: min(520px, 100%);
  padding: 8px;
  border-radius: 28px;
  background: rgba(20, 22, 28, 0.04);
  box-shadow: inset 0 0 0 0.5px rgba(20, 22, 28, 0.1);
  animation: lp-in 0.7s var(--ease) both;
}
.pv-login-page .lp-panel {
  border-radius: 22px;
  background: #fff;
  padding: 32px 28px 26px;
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.85);
}
.pv-login-page .lp-eyebrow {
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
.pv-login-page .lp-title {
  margin: 0 0 10px;
  font-family: Literata, Georgia, serif;
  font-size: clamp(26px, 5vw, 32px);
  line-height: 1.2;
  font-weight: 700;
}
.pv-login-page .lp-copy {
  margin: 0 0 20px;
  font-size: 15px;
  line-height: 1.55;
  color: var(--text-2);
}
.pv-login-page .lp-field {
  width: 100%;
  border: 0;
  border-radius: 12px;
  background: #F2F2F4;
  padding: 12px 14px;
  font: inherit;
  font-size: 14px;
  margin-bottom: 12px;
}
.pv-login-page .lp-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.pv-login-page .lp-primary {
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
.pv-login-page .lp-primary:hover { background: var(--accent-hover); }
.pv-login-page .lp-primary:active { transform: scale(0.98); }
.pv-login-page .lp-primary:disabled { opacity: 0.55; cursor: not-allowed; }
.pv-login-page .lp-secondary {
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
.pv-login-page .lp-note {
  margin: 14px 0 0;
  font-size: 12px;
  color: var(--text-4);
  text-align: center;
}
.pv-login-page .lp-error {
  margin: 0 0 12px;
  font-size: 12.5px;
  color: #9b2c2c;
}
.pv-login-page .lp-sent strong {
  display: block;
  font-family: Literata, Georgia, serif;
  font-size: 22px;
  margin-bottom: 8px;
}
@keyframes lp-in {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .pv-login-page .lp-shell,
  .pv-login-page .lp-primary {
    animation: none !important;
    transition: none !important;
  }
}
`;

function ensureStyles() {
  if (typeof document === 'undefined') return;
  if (!document.querySelector('link[data-paperview-login-font]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONT_URL;
    link.setAttribute('data-paperview-login-font', '1');
    document.head.appendChild(link);
  }
  if (!document.querySelector('style[data-pv-login-page]')) {
    const style = document.createElement('style');
    style.setAttribute('data-pv-login-page', '1');
    style.textContent = PAGE_CSS;
    document.head.appendChild(style);
  }
}

/**
 * Dedicated magic-link login at /login (not founder-only).
 */
export default function LoginPage() {
  const auth = useAuthContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const titleId = useId();
  const {
    configured,
    ready,
    user,
    profile,
    authBusy,
    authError,
    setAuthError,
    sendMagicLink,
    needsOnboarding,
  } = auth;

  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState('');

  const nextPath = safeNextPath(searchParams.get('next'));

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
    if (!ready || !user || !profile) return;
    if (profileNeedsOnboarding(profile) || needsOnboarding) {
      navigate(`/welcome?next=${encodeURIComponent(nextPath)}`, { replace: true });
      return;
    }
    navigate(nextPath, { replace: true });
  }, [ready, user, profile, needsOnboarding, nextPath, navigate]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setAuthError?.('');
    const result = await sendMagicLink(email, { next: nextPath });
    if (result?.ok) setSentTo(result.email);
  };

  let body = null;

  if (!configured) {
    body = (
      <>
        <span className="lp-eyebrow">Accounts</span>
        <h1 className="lp-title" id={titleId}>Accounts aren’t configured</h1>
        <p className="lp-copy">
          This build has no Supabase keys. You can still open Paperview with your own OpenAI key.
        </p>
        <div className="lp-actions">
          <button type="button" className="lp-primary" onClick={() => navigate('/app')}>Open Paperview</button>
          <Link className="lp-secondary" to="/">Back to home</Link>
        </div>
      </>
    );
  } else if (user && profile) {
    body = (
      <>
        <span className="lp-eyebrow">Signed in</span>
        <h1 className="lp-title" id={titleId}>You’re already signed in</h1>
        <p className="lp-copy">Continuing to Paperview…</p>
      </>
    );
  } else if (sentTo) {
    body = (
      <div className="lp-sent">
        <strong>Check your email</strong>
        <p className="lp-copy">
          We sent a magic link to <span style={{ fontWeight: 600 }}>{sentTo}</span>. Open it to finish signing in.
        </p>
        <div className="lp-actions">
          <button
            type="button"
            className="lp-secondary"
            disabled={authBusy}
            onClick={async () => {
              const result = await sendMagicLink(sentTo, { next: nextPath });
              if (result?.ok) setSentTo(result.email);
            }}
          >
            {authBusy ? 'Sending…' : 'Resend link'}
          </button>
          <button type="button" className="lp-secondary" onClick={() => setSentTo('')}>
            Use a different email
          </button>
        </div>
        {authError ? <div className="lp-error">{authError}</div> : null}
      </div>
    );
  } else {
    body = (
      <>
        <span className="lp-eyebrow">Sign in</span>
        <h1 className="lp-title" id={titleId}>Log in to Paperview</h1>
        <p className="lp-copy">
          We’ll email you a magic link. Use the same address for tryout credits. Your own OpenAI key still works without an account.
        </p>
        <form onSubmit={onSubmit}>
          <input
            className="lp-field"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="you@university.edu"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setAuthError?.('');
            }}
            aria-label="Email for magic link"
            disabled={authBusy}
            required
          />
          {authError ? <div className="lp-error">{authError}</div> : null}
          <div className="lp-actions">
            <button type="submit" className="lp-primary" disabled={authBusy}>
              {authBusy ? 'Sending…' : 'Email me a link'}
            </button>
            <Link className="lp-secondary" to="/#founding">Join founding / waitlist</Link>
            <Link className="lp-secondary" to="/">Back to home</Link>
          </div>
        </form>
        <p className="lp-note">New emails create an account. Existing accounts just get a fresh link.</p>
      </>
    );
  }

  return (
    <div className="pv-login-page">
      <div className="lp-brand">
        <Link to="/">Paperview</Link>
      </div>
      <div className="lp-shell">
        <div className="lp-panel" aria-labelledby={titleId}>
          {body}
        </div>
      </div>
    </div>
  );
}
