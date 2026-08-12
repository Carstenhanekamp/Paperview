import React from 'react';
import { Link } from 'react-router-dom';
import { displayNameForUi } from '../profileOnboarding';

/**
 * Compact sidebar footer account row: Log in, or display name → Settings.
 */
export default function AccountMenu({
  auth,
  onOpenSettings,
}) {
  if (!auth?.configured) return null;

  const { user, profile, authBusy } = auth;
  const name = displayNameForUi(profile, user);

  if (!user) {
    return (
      <div className="sb-account">
        <Link className="sb-account-link" to="/login" title="Log in for tryout credits">
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="sb-account">
      <button
        type="button"
        className="sb-user"
        onClick={() => onOpenSettings?.()}
        title="Account & settings"
        disabled={authBusy}
      >
        <span className="sb-username">{name || user.email || 'Account'}</span>
        {profile?.founding && profile?.founder_number ? (
          <span className="sb-account-badge">#{profile.founder_number}</span>
        ) : null}
      </button>
    </div>
  );
}
