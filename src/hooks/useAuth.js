import { useCallback, useEffect, useState } from 'react';
import { getSupabase, getSupabaseAsync, isSupabaseConfigured, FOUNDING_CAP } from '../supabaseClient';

async function fetchProfile(supabase, userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, email, founding, founder_number, launch_grant_status, created_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function claimFoundingSlot(supabase) {
  const { data, error } = await supabase.rpc('claim_founding_slot');
  if (error) throw error;
  return data;
}

async function fetchSpotsRemaining(supabase) {
  const { data, error } = await supabase.rpc('founding_spots_remaining');
  if (error) throw error;
  return typeof data === 'number' ? data : FOUNDING_CAP;
}

/**
 * Magic-link auth + founding profile for waitlist.
 * Lazy: no-op when VITE_SUPABASE_* is unset (BYOK-only OSS).
 */
export function useAuth() {
  const [ready, setReady] = useState(!isSupabaseConfigured);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [spotsRemaining, setSpotsRemaining] = useState(FOUNDING_CAP);
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [claimBusy, setClaimBusy] = useState(false);

  const user = session?.user ?? null;
  const configured = isSupabaseConfigured;

  const refreshSpots = useCallback(async () => {
    const supabase = await getSupabaseAsync();
    if (!supabase) return FOUNDING_CAP;
    try {
      const remaining = await fetchSpotsRemaining(supabase);
      setSpotsRemaining(remaining);
      return remaining;
    } catch {
      return FOUNDING_CAP;
    }
  }, []);

  const refreshProfile = useCallback(async (activeSession = session) => {
    const supabase = await getSupabaseAsync();
    const uid = activeSession?.user?.id;
    if (!supabase || !uid) {
      setProfile(null);
      return null;
    }
    try {
      setClaimBusy(true);
      await claimFoundingSlot(supabase);
      const next = await fetchProfile(supabase, uid);
      setProfile(next);
      await refreshSpots();
      return next;
    } catch (err) {
      setAuthError(err?.message || 'Could not load account.');
      try {
        const next = await fetchProfile(supabase, uid);
        setProfile(next);
        return next;
      } catch {
        return null;
      }
    } finally {
      setClaimBusy(false);
    }
  }, [session, refreshSpots]);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = null;

    (async () => {
      const supabase = await getSupabaseAsync();
      if (!supabase) {
        setReady(true);
        return;
      }

      try {
        const remaining = await fetchSpotsRemaining(supabase);
        if (!cancelled) setSpotsRemaining(remaining);
      } catch {
        /* ignore */
      }

      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setSession(data.session ?? null);
      if (data.session) {
        try {
          setClaimBusy(true);
          await claimFoundingSlot(supabase);
          const next = await fetchProfile(supabase, data.session.user.id);
          if (!cancelled) setProfile(next);
        } catch {
          /* profile may lag trigger */
        } finally {
          if (!cancelled) setClaimBusy(false);
        }
      }
      if (!cancelled) setReady(true);

      const { data: sub } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
        setSession(nextSession);
        if (!nextSession) {
          setProfile(null);
          return;
        }
        try {
          setClaimBusy(true);
          await claimFoundingSlot(supabase);
          const next = await fetchProfile(supabase, nextSession.user.id);
          setProfile(next);
          await refreshSpots();
        } catch (err) {
          setAuthError(err?.message || 'Could not claim founding status.');
        } finally {
          setClaimBusy(false);
        }
      });
      unsubscribe = () => sub?.subscription?.unsubscribe?.();
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [refreshSpots]);

  const sendMagicLink = useCallback(async (email) => {
    const supabase = await getSupabaseAsync();
    if (!supabase) {
      setAuthError('Accounts are not configured in this build.');
      return { ok: false };
    }
    const trimmed = String(email || '').trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      setAuthError('Enter a valid email address.');
      return { ok: false };
    }
    setAuthBusy(true);
    setAuthError('');
    try {
      const redirectTo = `${window.location.origin}/welcome`;
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          emailRedirectTo: redirectTo,
          shouldCreateUser: true,
        },
      });
      if (error) throw error;
      return { ok: true, email: trimmed };
    } catch (err) {
      setAuthError(err?.message || 'Could not send magic link.');
      return { ok: false };
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabase() || (await getSupabaseAsync());
    if (!supabase) return;
    setAuthBusy(true);
    setAuthError('');
    try {
      await supabase.auth.signOut();
      setSession(null);
      setProfile(null);
    } catch (err) {
      setAuthError(err?.message || 'Could not sign out.');
    } finally {
      setAuthBusy(false);
    }
  }, []);

  return {
    configured,
    ready,
    session,
    user,
    profile,
    spotsRemaining,
    foundingCap: FOUNDING_CAP,
    authError,
    setAuthError,
    authBusy,
    claimBusy,
    sendMagicLink,
    signOut,
    refreshProfile,
    refreshSpots,
  };
}
