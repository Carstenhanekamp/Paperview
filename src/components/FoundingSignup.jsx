import React, { useEffect, useState } from 'react';

const FOUNDING_CSS = `
.pv-founding-signup {
  --pv-ease: cubic-bezier(0.32, 0.72, 0, 1);
}
.pv-founding-signup .fs-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 10px;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--accent-tint, #E3E9EF);
  color: var(--accent-on, #2F4056);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
.pv-founding-signup .fs-bezel {
  padding: 6px;
  border-radius: 18px;
  background: rgba(20, 22, 28, 0.04);
  box-shadow: inset 0 0 0 0.5px rgba(20, 22, 28, 0.1);
}
.pv-founding-signup .fs-inner {
  display: flex;
  gap: 8px;
  align-items: stretch;
  padding: 6px;
  border-radius: 14px;
  background: #fff;
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.7);
}
.pv-founding-signup .fs-inner input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: none;
  background: transparent;
  font: inherit;
  font-size: 14px;
  color: var(--ink, #17181A);
  padding: 10px 12px;
}
.pv-founding-signup .fs-inner input::placeholder { color: var(--text-4, #9095A0); }
.pv-founding-signup .fs-cta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 0;
  cursor: pointer;
  border-radius: 999px;
  padding: 8px 10px 8px 16px;
  background: var(--accent, #55697F);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  transition: transform 0.45s var(--pv-ease), background 0.45s var(--pv-ease);
}
.pv-founding-signup .fs-cta:hover { background: var(--accent-hover, #3F5063); }
.pv-founding-signup .fs-cta:active { transform: scale(0.98); }
.pv-founding-signup .fs-cta:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.pv-founding-signup .fs-cta-icon {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.16);
  transition: transform 0.45s var(--pv-ease);
}
.pv-founding-signup .fs-cta:hover .fs-cta-icon {
  transform: translate(1px, -1px) scale(1.05);
}
.pv-founding-signup .fs-sent,
.pv-founding-signup .fs-signed {
  padding: 14px 16px;
  border-radius: 14px;
  background: #fff;
  box-shadow: inset 0 0 0 0.5px rgba(20, 22, 28, 0.08);
  animation: fs-fade-up 0.55s var(--pv-ease) both;
}
.pv-founding-signup .fs-sent strong,
.pv-founding-signup .fs-signed strong {
  display: block;
  font-family: var(--display, Literata, Georgia, serif);
  font-size: 17px;
  margin-bottom: 4px;
  color: var(--ink, #17181A);
}
.pv-founding-signup .fs-sent p,
.pv-founding-signup .fs-signed p {
  margin: 0;
  font-size: 13px;
  color: var(--text-2, #5D616A);
  line-height: 1.45;
}
.pv-founding-signup .fs-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  flex-wrap: wrap;
}
.pv-founding-signup .fs-linkish {
  border: 0;
  background: transparent;
  color: var(--accent-on, #2F4056);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.pv-founding-signup .fs-error {
  margin-top: 8px;
  font-size: 12.5px;
  color: #9b2c2c;
}

/* Hero variant — sits inside the landing hero’s double-bezel island */
.pv-founding-signup.is-hero .fs-eyebrow {
  margin-bottom: 8px;
  background: rgba(85, 105, 127, 0.12);
}
.pv-founding-signup.is-hero .fs-bezel {
  padding: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}
.pv-founding-signup.is-hero .fs-inner {
  gap: 6px;
  padding: 5px;
  border-radius: 999px;
  background: #F2F2F4;
  box-shadow: inset 0 0 0 0.5px rgba(20, 22, 28, 0.08);
}
.pv-founding-signup.is-hero .fs-inner input {
  padding: 9px 14px;
  font-size: 13.5px;
}
.pv-founding-signup.is-hero .fs-cta {
  padding: 7px 8px 7px 14px;
  font-size: 12.5px;
}
.pv-founding-signup.is-hero .fs-cta-icon {
  width: 26px;
  height: 26px;
}
.pv-founding-signup.is-hero .fs-sent,
.pv-founding-signup.is-hero .fs-signed {
  margin: 0;
  padding: 10px 4px 2px;
  background: transparent;
  box-shadow: none;
  animation: fs-fade-up 0.55s cubic-bezier(0.32, 0.72, 0, 1) both;
}

@keyframes fs-fade-up {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .pv-founding-signup .fs-cta,
  .pv-founding-signup .fs-cta-icon,
  .pv-founding-signup .fs-sent,
  .pv-founding-signup .fs-signed {
    transition: none !important;
    animation: none !important;
  }
}
@media (max-width: 640px) {
  .pv-founding-signup .fs-inner { flex-direction: column; border-radius: 14px; }
  .pv-founding-signup .fs-cta { justify-content: center; }
  .pv-founding-signup.is-hero .fs-inner { border-radius: 14px; }
}
`;

function ensureStyles() {
  if (typeof document === 'undefined') return;
  let style = document.querySelector('style[data-pv-founding-signup]');
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('data-pv-founding-signup', '1');
    document.head.appendChild(style);
  }
  style.textContent = FOUNDING_CSS;
}

export default function FoundingSignup({ auth, variant = 'default' }) {
  const {
    configured,
    user,
    profile,
    spotsRemaining,
    foundingCap,
    authBusy,
    claimBusy,
    authError,
    setAuthError,
    sendMagicLink,
    claimFoundingSlot,
    signOut,
  } = auth;

  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState('');

  useEffect(() => {
    ensureStyles();
    // useAuth already fetches the count on mount; refetching here just doubled
    // the RPC on every landing-page load.
  }, []);

  const rootClass =
    variant === 'hero' ? 'pv-founding-signup is-hero' : 'pv-founding-signup';

  if (!configured) {
    return (
      <div className={rootClass}>
        <p className="fs-error" style={{ margin: 0 }}>
          Founding signup is not configured in this build. BYOK still works in the app.
        </p>
      </div>
    );
  }

  // spotsRemaining is null until the count is known, and stays null if the
  // lookup fails — render neither "N left" nor "full" on a number we don't have.
  const spotsKnown = Number.isFinite(Number(spotsRemaining)) && spotsRemaining !== null;
  const spotsLeft = spotsKnown ? Math.max(0, Number(spotsRemaining)) : null;
  const spotsOpen = spotsKnown ? spotsLeft > 0 : true;
  const ctaLabel = !spotsKnown
    ? 'Join the founding list'
    : spotsOpen
      ? 'Claim founding spot'
      : 'Join waitlist';

  const onSubmit = async (e) => {
    e.preventDefault();
    setAuthError?.('');
    const result = await sendMagicLink(email, { intent: 'founding', next: '/app' });
    if (result?.ok) setSentTo(result.email);
  };

  if (user && profile) {
    if (!profile.slot_resolved) {
      return (
        <div className={rootClass}>
          <div className="fs-signed">
            <strong>You’re signed in as {profile.email || user.email}</strong>
            <p>
              {spotsOpen
                ? 'Claim a founding spot with this account — no second email needed.'
                : 'Founding spots are full. Join the credits waitlist with this account.'}
            </p>
            <div className="fs-actions">
              <button
                type="button"
                className="fs-linkish"
                disabled={claimBusy || authBusy}
                onClick={async () => {
                  setAuthError?.('');
                  await claimFoundingSlot();
                }}
              >
                {claimBusy ? 'Claiming…' : ctaLabel}
              </button>
              <button type="button" className="fs-linkish" onClick={() => signOut()}>
                Sign out
              </button>
            </div>
            {authError ? <div className="fs-error">{authError}</div> : null}
          </div>
        </div>
      );
    }

    return (
      <div className={rootClass}>
        <div className="fs-signed">
          <strong>
            {profile.founding
              ? `You’re founding member #${profile.founder_number}`
              : 'You’re on the credits waitlist'}
          </strong>
          <p>
            {profile.founding
              ? '€2 credits are reserved for when pay-per-use launches. BYOK stays free forever.'
              : 'We’ll email you when credits launch. Founding spots are full — BYOK stays free forever.'}
          </p>
          <div className="fs-actions">
            <button type="button" className="fs-linkish" onClick={() => signOut()}>
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (sentTo) {
    return (
      <div className={rootClass}>
        <div className="fs-sent">
          <strong>Check your email</strong>
          <p>
            We sent a magic link to <span style={{ fontWeight: 600 }}>{sentTo}</span>. Open it to
            land on your thank-you page and confirm founding status.
          </p>
          <div className="fs-actions">
            <button
              type="button"
              className="fs-linkish"
              disabled={authBusy}
              onClick={async () => {
                const result = await sendMagicLink(sentTo, { intent: 'founding', next: '/app' });
                if (result?.ok) setSentTo(result.email);
              }}
            >
              {authBusy ? 'Sending…' : 'Resend link'}
            </button>
            <button type="button" className="fs-linkish" onClick={() => setSentTo('')}>
              Use a different email
            </button>
          </div>
        </div>
        {authError ? <div className="fs-error">{authError}</div> : null}
      </div>
    );
  }

  return (
    <div className={rootClass}>
      <div className="fs-eyebrow">
        {!spotsKnown
          ? 'Founding launch · limited spots'
          : spotsOpen
            ? `${spotsLeft} of ${foundingCap} founding spots left`
            : 'Founding spots filled · waitlist open'}
      </div>
      <form className="fs-bezel" onSubmit={onSubmit}>
        <div className="fs-inner">
          <input
            type="email"
            name="email"
            autoComplete="email"
            placeholder="you@university.edu"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setAuthError?.('');
            }}
            aria-label="Email for founding membership"
            disabled={authBusy}
            required
          />
          <button className="fs-cta" type="submit" disabled={authBusy}>
            <span>{authBusy ? 'Sending…' : ctaLabel}</span>
            <span className="fs-cta-icon" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M7 17 17 7M9 7h8v8" />
              </svg>
            </span>
          </button>
        </div>
      </form>
      {authError ? <div className="fs-error">{authError}</div> : null}
    </div>
  );
}
