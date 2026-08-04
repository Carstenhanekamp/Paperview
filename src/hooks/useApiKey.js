import { useState, useCallback, useEffect } from 'react';
import { ENV_API_KEY } from '../constants';
import {
  hasRememberedApiKey,
  clearLegacyStoredApiKey,
  clearRememberedApiKey,
  rememberApiKeyEncrypted,
  unlockRememberedApiKey,
} from '../apiKeyStorage';

export function useApiKey() {
  const [apiKey, setApiKey] = useState(() => ENV_API_KEY);
  const [apiKeySource, setApiKeySource] = useState(() => (ENV_API_KEY ? "env" : "none"));
  const [rememberedApiKeyAvailable, setRememberedApiKeyAvailable] = useState(() => hasRememberedApiKey());

  const [showSettings, setShowSettings] = useState(false);
  const [settingsKey, setSettingsKey] = useState('');
  const [settingsKeyVisible, setSettingsKeyVisible] = useState(false);
  const [rememberApiKey, setRememberApiKey] = useState(false);
  const [settingsPassphrase, setSettingsPassphrase] = useState('');
  const [settingsPassphraseVisible, setSettingsPassphraseVisible] = useState(false);
  const [unlockPassphrase, setUnlockPassphrase] = useState('');
  const [unlockPassphraseVisible, setUnlockPassphraseVisible] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [settingsBusy, setSettingsBusy] = useState(false);

  useEffect(() => {
    clearLegacyStoredApiKey();
    setRememberedApiKeyAvailable(hasRememberedApiKey());
    if (!ENV_API_KEY) {
      try {
        const fromWelcome = sessionStorage.getItem('pv.welcome.apikey');
        if (fromWelcome) {
          setApiKey(fromWelcome);
          setApiKeySource('memory');
          sessionStorage.removeItem('pv.welcome.apikey');
        }
      } catch {
        /* ignore */
      }
    }
  }, []);

  const resetSettingsInputs = useCallback(() => {
    setSettingsKey("");
    setSettingsKeyVisible(false);
    setRememberApiKey(false);
    setSettingsPassphrase("");
    setSettingsPassphraseVisible(false);
    setUnlockPassphrase("");
    setUnlockPassphraseVisible(false);
    setSettingsError("");
  }, []);

  const openSettingsModal = useCallback((prefill = "") => {
    resetSettingsInputs();
    setSettingsKey(prefill);
    setShowSettings(true);
  }, [resetSettingsInputs]);

  const closeSettingsModal = useCallback(() => {
    if (settingsBusy) return;
    setShowSettings(false);
    resetSettingsInputs();
  }, [resetSettingsInputs, settingsBusy]);

  const handleRemoveApiKey = useCallback(() => {
    setApiKey("");
    setApiKeySource("none");
    clearRememberedApiKey();
    setRememberedApiKeyAvailable(false);
    resetSettingsInputs();
  }, [resetSettingsInputs]);

  const handleUnlockRememberedApiKey = useCallback(async () => {
    const passphrase = unlockPassphrase.trim();
    if (!passphrase) {
      setSettingsError("Enter the passphrase used to remember this key.");
      return;
    }
    setSettingsBusy(true);
    setSettingsError("");
    try {
      const unlocked = await unlockRememberedApiKey(passphrase);
      setApiKey(unlocked);
      setApiKeySource("remembered");
      setShowSettings(false);
      resetSettingsInputs();
    } catch {
      setSettingsError("Could not unlock the remembered key. Check the passphrase and try again.");
    } finally {
      setSettingsBusy(false);
    }
  }, [resetSettingsInputs, unlockPassphrase]);

  const handleSaveSettingsApiKey = useCallback(async () => {
    const trimmed = settingsKey.trim();
    const passphrase = settingsPassphrase.trim();
    if (!trimmed) {
      setSettingsError("Enter an OpenAI API key first.");
      return;
    }
    if (rememberApiKey && passphrase.length < 8) {
      setSettingsError("Use at least 8 characters for the encryption passphrase.");
      return;
    }
    setSettingsBusy(true);
    setSettingsError("");
    try {
      if (rememberApiKey) {
        await rememberApiKeyEncrypted(trimmed, passphrase);
        setRememberedApiKeyAvailable(true);
        setApiKeySource("remembered");
      } else {
        clearRememberedApiKey();
        setRememberedApiKeyAvailable(false);
        setApiKeySource("memory");
      }
      setApiKey(trimmed);
      setShowSettings(false);
      resetSettingsInputs();
    } catch (error) {
      setSettingsError(error?.message || "Could not save this API key securely.");
    } finally {
      setSettingsBusy(false);
    }
  }, [rememberApiKey, resetSettingsInputs, settingsKey, settingsPassphrase]);

  return {
    apiKey,
    apiKeySource,
    rememberedApiKeyAvailable,
    showSettings,
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
    openSettingsModal,
    closeSettingsModal,
    handleRemoveApiKey,
    handleUnlockRememberedApiKey,
    handleSaveSettingsApiKey,
    setRememberedApiKeyAvailable,
    setApiKey,
    setApiKeySource,
  };
}
