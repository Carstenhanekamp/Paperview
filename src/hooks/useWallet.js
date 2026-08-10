import { useCallback, useEffect, useState } from 'react';
import { getSupabaseAsync, isSupabaseConfigured } from '../supabaseClient';
import { formatMicrocentsAsEur, microcentsToEur } from '../walletCredits';

/**
 * Hosted tryout wallet balance for the signed-in Supabase user.
 */
export function useWallet({ userId = null, enabled = true } = {}) {
  const [balanceMicrocents, setBalanceMicrocents] = useState(null);
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletError, setWalletError] = useState('');
  const [lastClaim, setLastClaim] = useState(null);

  const configured = isSupabaseConfigured;
  const hasCredit =
    typeof balanceMicrocents === 'number' && balanceMicrocents > 0;

  const refreshBalance = useCallback(async () => {
    if (!configured || !enabled || !userId) {
      setBalanceMicrocents(null);
      return null;
    }
    const supabase = await getSupabaseAsync();
    if (!supabase) {
      setBalanceMicrocents(null);
      return null;
    }
    try {
      const { data, error } = await supabase.rpc('get_wallet_balance');
      if (error) throw error;
      const next = Number(data?.balance_microcents);
      const value = Number.isFinite(next) ? next : 0;
      setBalanceMicrocents(value);
      setWalletError('');
      return value;
    } catch (err) {
      setWalletError(err?.message || 'Could not load wallet.');
      return null;
    }
  }, [configured, enabled, userId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!configured || !enabled || !userId) {
        setBalanceMicrocents(null);
        return;
      }
      const value = await refreshBalance();
      if (cancelled) return;
      if (value == null) setBalanceMicrocents(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [configured, enabled, userId, refreshBalance]);

  const claimTryoutGrant = useCallback(async () => {
    if (!configured || !userId) {
      return { ok: false, reason: 'not_configured' };
    }
    const supabase = await getSupabaseAsync();
    if (!supabase) return { ok: false, reason: 'not_configured' };
    setWalletBusy(true);
    setWalletError('');
    try {
      const { data, error } = await supabase.rpc('claim_tryout_grant');
      if (error) throw error;
      setLastClaim(data);
      if (typeof data?.balance_microcents === 'number') {
        setBalanceMicrocents(data.balance_microcents);
      } else {
        await refreshBalance();
      }
      return { ok: true, ...data };
    } catch (err) {
      const message = err?.message || 'Could not claim tryout credit.';
      setWalletError(message);
      return { ok: false, reason: 'error', message };
    } finally {
      setWalletBusy(false);
    }
  }, [configured, userId, refreshBalance]);

  const redeemInviteCode = useCallback(async (code) => {
    if (!configured || !userId) {
      return { ok: false, reason: 'not_configured' };
    }
    const trimmed = String(code || '').trim();
    if (!trimmed) {
      setWalletError('Enter an invite code.');
      return { ok: false, reason: 'invalid_code' };
    }
    const supabase = await getSupabaseAsync();
    if (!supabase) return { ok: false, reason: 'not_configured' };
    setWalletBusy(true);
    setWalletError('');
    try {
      const { data, error } = await supabase.rpc('redeem_invite_code', {
        p_code: trimmed,
      });
      if (error) throw error;
      setLastClaim(data);
      if (typeof data?.balance_microcents === 'number') {
        setBalanceMicrocents(data.balance_microcents);
      } else {
        await refreshBalance();
      }
      return { ok: true, ...data };
    } catch (err) {
      const raw = err?.message || 'Could not redeem invite code.';
      let message = raw;
      if (/invalid_code/i.test(raw)) message = 'That invite code is not valid.';
      else if (/code_exhausted/i.test(raw)) message = 'That invite code has no redemptions left.';
      else if (/already_redeemed/i.test(raw)) message = 'You already redeemed that code.';
      else if (/already_granted/i.test(raw)) message = 'You already have tryout credit.';
      setWalletError(message);
      return { ok: false, reason: 'error', message };
    } finally {
      setWalletBusy(false);
    }
  }, [configured, userId, refreshBalance]);

  return {
    configured,
    balanceMicrocents,
    balanceEur: balanceMicrocents == null ? null : microcentsToEur(balanceMicrocents),
    balanceLabel: balanceMicrocents == null ? null : formatMicrocentsAsEur(balanceMicrocents),
    hasCredit,
    walletBusy,
    walletError,
    setWalletError,
    lastClaim,
    refreshBalance,
    claimTryoutGrant,
    redeemInviteCode,
  };
}
