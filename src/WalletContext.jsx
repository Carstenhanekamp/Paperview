import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { useAuthContext } from './AuthContext';
import { useWallet } from './hooks/useWallet';
import { ACTION_PRICE_EUR, formatEur } from './walletCredits';

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const auth = useAuthContext();
  const userId = auth?.user?.id || null;
  const wallet = useWallet({ userId, enabled: Boolean(auth?.configured && userId) });

  const { hasCredit, refreshBalance } = wallet;

  const getRequestOptions = useCallback((overrides = {}) => {
    const preferWallet = overrides.preferWallet ?? Boolean(hasCredit);
    const userOnBilling = overrides.onBilling;
    return {
      ...overrides,
      preferWallet,
      action: overrides.action || 'chat',
      onBilling: (info) => {
        if (typeof info?.balanceMicrocents === 'number' && Number.isFinite(info.balanceMicrocents)) {
          refreshBalance();
        }
        userOnBilling?.(info);
      },
    };
  }, [hasCredit, refreshBalance]);

  const value = useMemo(
    () => ({
      ...wallet,
      actionPriceChatLabel: formatEur(ACTION_PRICE_EUR.chat),
      actionPriceAgentLabel: formatEur(ACTION_PRICE_EUR.agent),
      getRequestOptions,
    }),
    [wallet, getRequestOptions],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWalletContext() {
  const value = useContext(WalletContext);
  if (!value) {
    throw new Error('useWalletContext must be used within WalletProvider');
  }
  return value;
}
