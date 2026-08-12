import React, { useState } from 'react';
import { PROFILE_NAME_MAX } from '../profileOnboarding';

/**
 * Shared first-run / settings form for display name + library label.
 */
export default function OnboardingProfileForm({
  initialDisplayName = '',
  initialLibraryName = '',
  busy = false,
  error = '',
  submitLabel = 'Continue',
  onSubmit,
}) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [libraryName, setLibraryName] = useState(initialLibraryName);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onSubmit?.({ displayName, libraryName });
  };

  return (
    <form onSubmit={handleSubmit}>
      <label className="wp-field-label" htmlFor="pv-display-name">Your name</label>
      <input
        id="pv-display-name"
        className="wp-field"
        type="text"
        autoComplete="name"
        maxLength={PROFILE_NAME_MAX}
        placeholder="Ada Lovelace"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        disabled={busy}
        required
      />
      <label className="wp-field-label" htmlFor="pv-library-name">Library name</label>
      <input
        id="pv-library-name"
        className="wp-field"
        type="text"
        autoComplete="off"
        maxLength={PROFILE_NAME_MAX}
        placeholder="Ada’s papers"
        value={libraryName}
        onChange={(e) => setLibraryName(e.target.value)}
        disabled={busy}
        required
      />
      <p className="wp-field-hint">
        This labels your library in the sidebar. Folders stay on this device.
      </p>
      {error ? <div className="wp-error">{error}</div> : null}
      <div className="wp-actions">
        <button type="submit" className="wp-primary" disabled={busy}>
          {busy ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
