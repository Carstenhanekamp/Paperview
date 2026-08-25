import { useState, useCallback, useEffect } from 'react';
import { ENV_API_KEY } from '../constants';
import { takePendingApiKey } from '../pendingApiKey';
import {
  hasRememberedApiKey,
  clearLegacyStoredApiKey,
  clearRememberedApiKey,
  rememberApiKeyEncrypted,
  unlockRememberedApiKey,
} from '../apiKeyStorage';
import {
  deleteNativeApiKey,
  loadNativeApiKey,
  saveNativeApiKey,
  usesNativeKeychain,
} from '../platform/secrets';

export function useApiKey() {
  const nativeKeychain = usesNativeKeychain();
  const [apiKey, setApiKey] = useState(() => ENV_API_KEY);
  const [apiKeySource, setApiKeySource] = useState(() => (ENV_API_KEY ? "env" : "none"));
  const [rememberedApiKeyAvailable, setRememberedApiKeyAvailable] = useState(
    () => !nativeKeychain && hasRememberedApiKey()
  );

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
    const fromWelcome = !ENV_API_KEY ? takePendingApiKey() : null;
    if (nativeKeychain) {
      loadNativeApiKey()
        .then((remembered) => {
          setRememberedApiKeyAvailable(Boolean(remembered));
          if (remembered && !ENV_API_KEY && !fromWelcome) {
            setApiKey(remembered);
            setApiKeySource("remembered");
          }
        })
        .catch(() => setRememberedApiKeyAvailable(false));
    } else {
      setRememberedApiKeyAvailable(hasRememberedApiKey());
    }
    if (fromWelcome) {
      setApiKey(fromWelcome);
      setApiKeySource('memory');
    }
  }, [nativeKeychain]);

  /**
   * Adopt a key for this session only (no storage). Keeps apiKey and
   * apiKeySource in step so callers cannot desync them.
   */
  const applyInMemoryApiKey = useCallback((key) => {
    const trimmed = String(key || '').trim();
    if (!trimmed) return;
    setApiKey(trimmed);
    setApiKeySource('memory');
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

  const handleRemoveApiKey = useCallback(async () => {
    setApiKey("");
    setApiKeySource("none");
    if (nativeKeychain) await deleteNativeApiKey().catch(() => {});
    else clearRememberedApiKey();
    setRememberedApiKeyAvailable(false);
    resetSettingsInputs();
  }, [nativeKeychain, resetSettingsInputs]);

  const handleUnlockRememberedApiKey = useCallback(async () => {
    if (nativeKeychain) {
      setSettingsBusy(true);
      setSettingsError("");
      try {
        const remembered = await loadNativeApiKey();
        if (!remembered) throw new Error("No saved key was found.");
        setApiKey(remembered);
        setApiKeySource("remembered");
        setShowSettings(false);
        resetSettingsInputs();
      } catch (error) {
        setSettingsError(error?.message || "Could not read the key from macOS Keychain.");
      } finally {
        setSettingsBusy(false);
      }
      return;
    }
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
  }, [nativeKeychain, resetSettingsInputs, unlockPassphrase]);

  const handleSaveSettingsApiKey = useCallback(async () => {
    const trimmed = settingsKey.trim();
    const passphrase = settingsPassphrase.trim();
    if (!trimmed) {
      setSettingsError("Enter an OpenAI API key first.");
      return;
    }
    if (rememberApiKey && !nativeKeychain && passphrase.length < 8) {
      setSettingsError("Use at least 8 characters for the encryption passphrase.");
      return;
    }
    setSettingsBusy(true);
    setSettingsError("");
    try {
      if (rememberApiKey) {
        if (nativeKeychain) await saveNativeApiKey(trimmed);
        else await rememberApiKeyEncrypted(trimmed, passphrase);
        setRememberedApiKeyAvailable(true);
        setApiKeySource("remembered");
      } else {
        if (nativeKeychain) await deleteNativeApiKey().catch(() => {});
        else clearRememberedApiKey();
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
  }, [nativeKeychain, rememberApiKey, resetSettingsInputs, settingsKey, settingsPassphrase]);

  const handleForgetRememberedApiKey = useCallback(async () => {
    if (nativeKeychain) await deleteNativeApiKey().catch(() => {});
    else clearRememberedApiKey();
    setRememberedApiKeyAvailable(false);
    setUnlockPassphrase("");
    setSettingsError("");
  }, [nativeKeychain]);

  return {
    apiKey,
    apiKeySource,
    nativeKeychain,
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
    handleForgetRememberedApiKey,
    setRememberedApiKeyAvailable,
    applyInMemoryApiKey,
  };
}
