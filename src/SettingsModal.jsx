import React from 'react';
import { IClose } from './icons';
import { PROVIDERS } from './llmProvider';

const ENV_OLLAMA_BASE_URL = import.meta.env.VITE_OLLAMA_BASE_URL || "http://localhost:11434";

// All state and handlers live in PaperviewApp.jsx and are passed as props.
// This component owns only the JSX.
export default function SettingsModal({
  // visibility
  showSettings, closeSettingsModal,
  // api key
  apiKey, apiKeySource,
  settingsKey, setSettingsKey, settingsKeyVisible, setSettingsKeyVisible,
  rememberApiKey, setRememberApiKey,
  settingsPassphrase, setSettingsPassphrase,
  settingsPassphraseVisible, setSettingsPassphraseVisible,
  unlockPassphrase, setUnlockPassphrase,
  unlockPassphraseVisible, setUnlockPassphraseVisible,
  settingsError, settingsBusy,
  rememberedApiKeyAvailable,
  handleRemoveApiKey, handleUnlockRememberedApiKey,
  handleSaveSettingsApiKey, handleForgetSavedKey,
  // provider
  provider, onProviderChange,
  ollamaBaseUrl, onOllamaBaseUrlChange,
}) {
  if (!showSettings) return null;

  const isLocal = provider === PROVIDERS.LOCAL;

  const handleProviderChange = (next) => {
    localStorage.setItem("pv-provider", next);
    onProviderChange(next);
  };

  const handleOllamaUrlBlur = (e) => {
    const url = e.target.value.trim() || ENV_OLLAMA_BASE_URL;
    localStorage.setItem("pv-ollama-url", url);
    onOllamaBaseUrlChange(url);
  };

  return (
    <div className="ov" onClick={closeSettingsModal}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="m-hd">
          <span className="m-title">Settings</span>
          <button className="m-x" onClick={closeSettingsModal}><IClose /></button>
        </div>

        {/* ── Provider selector ── */}
        <div className="settings-field">
          <label className="settings-label">AI Provider</label>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            {[
              { value: PROVIDERS.OPENAI, label: "OpenAI" },
              { value: PROVIDERS.LOCAL, label: "Local (Ollama)" },
            ].map(({ value, label }) => (
              <label
                key={value}
                className="settings-option"
                style={{
                  flex: 1,
                  justifyContent: 'center',
                  border: `1.5px solid ${provider === value ? 'var(--accent, #2563eb)' : 'var(--border, #e5e7eb)'}`,
                  borderRadius: 6,
                  padding: '6px 12px',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="pv-provider"
                  value={value}
                  checked={provider === value}
                  onChange={() => handleProviderChange(value)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* ── Ollama fields (local provider only) ── */}
        {isLocal && (
          <div className="settings-field">
            <label className="settings-label">Ollama base URL</label>
            <input
              className="settings-input"
              type="text"
              defaultValue={ollamaBaseUrl}
              onBlur={handleOllamaUrlBlur}
              placeholder="http://localhost:11434"
              spellCheck={false}
              autoComplete="off"
            />
            <p className="settings-info">
              Run Ollama natively (not in Docker) for GPU acceleration.
              Allow this page once:{" "}
              <code style={{ fontSize: '0.85em', background: 'var(--bg2, #f3f4f6)', padding: '1px 4px', borderRadius: 3 }}>
                OLLAMA_ORIGINS={window.location.origin}
              </code>
            </p>
          </div>
        )}

        {/* ── OpenAI API key (OpenAI provider only) ── */}
        {!isLocal && (
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
                      <input type="checkbox" checked={rememberApiKey} onChange={(e) => { setRememberApiKey(e.target.checked); }} />
                      <span>Remember this key on this device with passphrase encryption.</span>
                    </label>
                    {rememberApiKey && (
                      <div className="settings-subfield">
                        <label className="settings-label">Encryption passphrase</label>
                        <div className="settings-input-wrap">
                          <input className="settings-input" type={settingsPassphraseVisible ? "text" : "password"} value={settingsPassphrase} onChange={(e) => setSettingsPassphrase(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" />
                          <button className="settings-toggle-vis" onClick={() => setSettingsPassphraseVisible((v) => !v)} type="button">{settingsPassphraseVisible ? "Hide" : "Show"}</button>
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
                      <input className="settings-input" type={unlockPassphraseVisible ? "text" : "password"} value={unlockPassphrase} onChange={(e) => setUnlockPassphrase(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleUnlockRememberedApiKey(); }} placeholder="Passphrase" autoComplete="current-password" />
                      <button className="settings-toggle-vis" onClick={() => setUnlockPassphraseVisible((v) => !v)} type="button">{unlockPassphraseVisible ? "Hide" : "Show"}</button>
                    </div>
                    <div className="settings-inline-actions">
                      <button className="btn-sec" type="button" onClick={handleUnlockRememberedApiKey} disabled={settingsBusy}>{settingsBusy ? "Unlocking..." : "Unlock"}</button>
                      <button className="btn-sec" type="button" onClick={handleForgetSavedKey} disabled={settingsBusy}>Forget saved key</button>
                    </div>
                  </div>
                )}
                <div className="settings-input-wrap">
                  <input className="settings-input" type={settingsKeyVisible ? "text" : "password"} value={settingsKey} onChange={(e) => setSettingsKey(e.target.value)} placeholder="sk-..." autoComplete="off" spellCheck={false} />
                  <button className="settings-toggle-vis" onClick={() => setSettingsKeyVisible((v) => !v)} type="button">{settingsKeyVisible ? "Hide" : "Show"}</button>
                </div>
                <label className="settings-option">
                  <input type="checkbox" checked={rememberApiKey} onChange={(e) => { setRememberApiKey(e.target.checked); }} />
                  <span>Remember this key on this device with passphrase encryption.</span>
                </label>
                {rememberApiKey && (
                  <div className="settings-subfield">
                    <label className="settings-label">Encryption passphrase</label>
                    <div className="settings-input-wrap">
                      <input className="settings-input" type={settingsPassphraseVisible ? "text" : "password"} value={settingsPassphrase} onChange={(e) => setSettingsPassphrase(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" />
                      <button className="settings-toggle-vis" onClick={() => setSettingsPassphraseVisible((v) => !v)} type="button">{settingsPassphraseVisible ? "Hide" : "Show"}</button>
                    </div>
                    <p className="settings-info">The passphrase is not stored. You will need it to unlock this key after reloading Paperview.</p>
                  </div>
                )}
              </>
            )}

            <p className="settings-info">
              To use AI features, add your own OpenAI API key. By default it is kept in memory only. If you choose to remember it, Paperview stores an encrypted copy in this browser and you should only use that on trusted devices. We recommend setting a{" "}
              <a href="https://platform.openai.com/settings/organization/limits" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>spending limit</a> on your key.
            </p>
            {settingsError && <div className="settings-error">{settingsError}</div>}
          </div>
        )}

        <div className="m-acts">
          <button className="btn-sec" onClick={closeSettingsModal} disabled={settingsBusy}>Cancel</button>
          {!isLocal && !apiKey && (
            <button className="btn-pri" onClick={handleSaveSettingsApiKey} disabled={settingsBusy}>
              {settingsBusy ? "Saving..." : "Save"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
