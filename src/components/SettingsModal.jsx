import React from 'react';
import { IClose } from '../icons';
import { clearRememberedApiKey } from '../apiKeyStorage';

export default function SettingsModal({
  apiKey,
  apiKeySource,
  rememberedApiKeyAvailable,
  settingsKey,
  setSettingsKey,
  settingsKeyVisible,
  setSettingsKeyVisible,
  rememberApiKey,
  setRememberApiKey,
  settingsPassphrase,
  setSettingsPassphrase,
  settingsPassphraseVisible,
  setSettingsPassphraseVisible,
  unlockPassphrase,
  setUnlockPassphrase,
  unlockPassphraseVisible,
  setUnlockPassphraseVisible,
  settingsError,
  setSettingsError,
  settingsBusy,
  closeSettingsModal,
  handleRemoveApiKey,
  handleUnlockRememberedApiKey,
  handleSaveSettingsApiKey,
  setRememberedApiKeyAvailable,
  auth = null,
}) {
  const profile = auth?.profile;
  const userEmail = auth?.user?.email || profile?.email || '';

  return (
    <div className="ov" onClick={closeSettingsModal}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="m-hd">
          <span className="m-title">Settings</span>
          <button className="m-x" onClick={closeSettingsModal}><IClose /></button>
        </div>

        {auth?.configured ? (
          <div className="settings-field" style={{ marginBottom: 18 }}>
            <label className="settings-label">Account</label>
            {auth.user ? (
              <>
                <p className="settings-info" style={{ marginBottom: 8 }}>
                  Signed in as <strong>{userEmail || 'your email'}</strong>
                </p>
                <p className="settings-info" style={{ marginBottom: 8 }}>
                  {profile?.founding
                    ? `Founding member #${profile.founder_number} · Credits: coming — grant ${profile.launch_grant_status === 'pending' ? 'pending (€2 at launch)' : profile.launch_grant_status}`
                    : 'On the credits waitlist · BYOK stays free forever'}
                </p>
                <button
                  className="btn-sec"
                  type="button"
                  disabled={auth.authBusy}
                  onClick={() => auth.signOut()}
                >
                  {auth.authBusy ? 'Signing out…' : 'Sign out'}
                </button>
              </>
            ) : (
              <p className="settings-info">
                No account in this browser. Claim a founding spot or join the waitlist from the homepage pricing section.
              </p>
            )}
          </div>
        ) : null}

        <div className="settings-field">
          <label className="settings-label">OpenAI API Key</label>
          {apiKey ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="settings-input" style={{ flex: 1, display: 'flex', alignItems: 'center', background: '#fff', cursor: 'default', color: 'var(--text2)' }}>
                  {'•'.repeat(Math.min(apiKey.length, 20))}{'…' + apiKey.slice(-4)}
                </span>
                <button className="btn-sec" style={{ whiteSpace: 'nowrap', flexShrink: 0 }} onClick={handleRemoveApiKey} disabled={settingsBusy}>Remove</button>
              </div>
              <p className="settings-info">
                {apiKeySource === "remembered"
                  ? "This key was unlocked from encrypted browser storage for the current session."
                  : "This key is available in memory for the current browser session."}
              </p>
              {apiKeySource !== "remembered" && (
                <div className="settings-panel">
                  <label className="settings-option">
                    <input
                      type="checkbox"
                      checked={rememberApiKey}
                      onChange={(e) => {
                        setRememberApiKey(e.target.checked);
                        setSettingsError("");
                      }}
                    />
                    <span>Remember this key on this device with passphrase encryption.</span>
                  </label>
                  {rememberApiKey && (
                    <div className="settings-subfield">
                      <label className="settings-label">Encryption passphrase</label>
                      <div className="settings-input-wrap">
                        <input
                          className="settings-input"
                          type={settingsPassphraseVisible ? "text" : "password"}
                          value={settingsPassphrase}
                          onChange={(e) => setSettingsPassphrase(e.target.value)}
                          placeholder="At least 8 characters"
                          autoComplete="new-password"
                        />
                        <button className="settings-toggle-vis" onClick={() => setSettingsPassphraseVisible((v) => !v)} type="button">
                          {settingsPassphraseVisible ? "Hide" : "Show"}
                        </button>
                      </div>
                      <p className="settings-info">The passphrase is not stored. You will need it to unlock this key after reloading Paperview.</p>
                    </div>
                  )}
                  <button className="btn-sec" type="button" disabled={!rememberApiKey || settingsBusy} onClick={handleSaveSettingsApiKey}>
                    {settingsBusy ? "Saving..." : "Remember key"}
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              {rememberedApiKeyAvailable && (
                <div className="settings-panel">
                  <div className="settings-panel-title">Encrypted key saved on this device</div>
                  <p className="settings-info">Enter the passphrase you used when saving it. The passphrase is not stored and cannot be recovered.</p>
                  <div className="settings-input-wrap">
                    <input
                      className="settings-input"
                      type={unlockPassphraseVisible ? "text" : "password"}
                      value={unlockPassphrase}
                      onChange={(e) => setUnlockPassphrase(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleUnlockRememberedApiKey();
                      }}
                      placeholder="Passphrase"
                      autoComplete="current-password"
                    />
                    <button className="settings-toggle-vis" onClick={() => setUnlockPassphraseVisible((v) => !v)} type="button">
                      {unlockPassphraseVisible ? "Hide" : "Show"}
                    </button>
                  </div>
                  <div className="settings-inline-actions">
                    <button className="btn-sec" type="button" onClick={handleUnlockRememberedApiKey} disabled={settingsBusy}>
                      {settingsBusy ? "Unlocking..." : "Unlock"}
                    </button>
                    <button className="btn-sec" type="button" onClick={() => {
                      clearRememberedApiKey();
                      setRememberedApiKeyAvailable(false);
                      setUnlockPassphrase("");
                      setSettingsError("");
                    }} disabled={settingsBusy}>Forget saved key</button>
                  </div>
                </div>
              )}
              <div className="settings-input-wrap">
                <input
                  className="settings-input"
                  type={settingsKeyVisible ? "text" : "password"}
                  value={settingsKey}
                  onChange={(e) => setSettingsKey(e.target.value)}
                  placeholder="sk-..."
                  autoComplete="off"
                  spellCheck={false}
                />
                <button className="settings-toggle-vis" onClick={() => setSettingsKeyVisible((v) => !v)} type="button">
                  {settingsKeyVisible ? "Hide" : "Show"}
                </button>
              </div>
              <label className="settings-option">
                <input
                  type="checkbox"
                  checked={rememberApiKey}
                  onChange={(e) => {
                    setRememberApiKey(e.target.checked);
                    setSettingsError("");
                  }}
                />
                <span>Remember this key on this device with passphrase encryption.</span>
              </label>
              {rememberApiKey && (
                <div className="settings-subfield">
                  <label className="settings-label">Encryption passphrase</label>
                  <div className="settings-input-wrap">
                    <input
                      className="settings-input"
                      type={settingsPassphraseVisible ? "text" : "password"}
                      value={settingsPassphrase}
                      onChange={(e) => setSettingsPassphrase(e.target.value)}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                    />
                    <button className="settings-toggle-vis" onClick={() => setSettingsPassphraseVisible((v) => !v)} type="button">
                      {settingsPassphraseVisible ? "Hide" : "Show"}
                    </button>
                  </div>
                  <p className="settings-info">The passphrase is not stored. You will need it to unlock this key after reloading Paperview.</p>
                </div>
              )}
            </>
          )}
          <p className="settings-info">To use AI features, add your own OpenAI API key. By default it is kept in memory only. If you choose to remember it, Paperview stores an encrypted copy in this browser and you should only use that on trusted devices. We recommend setting a <a href="https://platform.openai.com/settings/organization/limits" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>spending limit</a> on your key.</p>
          {settingsError && <div className="settings-error">{settingsError}</div>}
        </div>

        <div className="m-acts">
          <button className="btn-sec" onClick={closeSettingsModal} disabled={settingsBusy}>Cancel</button>
          {!apiKey && <button className="btn-pri" onClick={handleSaveSettingsApiKey} disabled={settingsBusy}>
            {settingsBusy ? "Saving..." : "Save"}
          </button>}
        </div>
      </div>
    </div>
  );
}
