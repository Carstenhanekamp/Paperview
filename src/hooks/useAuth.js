import { useCallback, useEffect, useRef, useState } from 'react';
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
  // null signals "unknown" — never invent a full complement of spots.
  return typeof data === 'number' ? data : null;
}

/**
 * Magic-link auth + founding profile for waitlist.
 * Lazy: no-op when VITE_SUPABASE_* is unset (BYOK-only OSS).
 */
export function useAuth() {
  const [ready, setReady] = useState(!isSupabaseConfigured);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  // null = not known yet / lookup failed. Callers must not render a count.
  const [spotsRemaining, setSpotsRemaining] = useState(null);
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [claimBusy, setClaimBusy] = useState(false);

  // Claiming a founding slot is a once-per-user write. onAuthStateChange also
  // fires on TOKEN_REFRESHED and on tab refocus, so without this the RPC ran
  // on every token refresh for the lifetime of the session.
  const claimedForUserRef = useRef(null);

  const user = session?.user ?? null;
  const configured = isSupabaseConfigured;

  const refreshSpots = useCallback(async () => {
    const supabase = await getSupabaseAsync();
    if (!supabase) return null;
    try {
      const remaining = await fetchSpotsRemaining(supabase);
      setSpotsRemaining(remaining);
      return remaining;
    } catch {
      setSpotsRemaining(null);
      return null;
    }
  }, []);

  /** Claim once per user, then load the profile. Safe to call repeatedly. */
  const claimAndLoadProfile = useCallback(async (supabase, uid) => {
    if (!supabase || !uid) return null;
    try {
      setClaimBusy(true);
      if (claimedForUserRef.current !== uid) {
        await claimFoundingSlot(supabase);
        claimedForUserRef.current = uid;
      }
      const next = await fetchProfile(supabase, uid);
      setProfile(next);
      setAuthError('');
      await refreshSpots();
      return next;
    } catch (err) {
      // The claim can fail while the profile is perfectly readable (e.g. the
      // trigger has not landed yet). Only surface an error if both fail.
      try {
        const next = await fetchProfile(supabase, uid);
        setProfile(next);
        setAuthError('');
        return next;
      } catch {
        setAuthError(err?.message || 'Could not load account.');
        return null;
      }
    } finally {
      setClaimBusy(false);
    }
  }, [refreshSpots]);

  const refreshProfile = useCallback(async (activeSession = session) => {
    const supabase = await getSupabaseAsync();
    const uid = activeSession?.user?.id;
    if (!supabase || !uid) {
      setProfile(null);
      return null;
    }
    return claimAndLoadProfile(supabase, uid);
  }, [session, claimAndLoadProfile]);

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
        /* leave as unknown */
      }

      // supabase-js emits INITIAL_SESSION as soon as the listener registers, so
      // the handler below covers the existing session too — calling getSession()
      // and claiming here as well would do all of it twice on every page load.
      const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        setSession(nextSession ?? null);

        if (!nextSession) {
          claimedForUserRef.current = null;
          setProfile(null);
          if (!cancelled) setReady(true);
          return;
        }

        // Never await Supabase calls inside this callback: it runs while the
        // auth lock is held, and re-entering the client from here can deadlock
        // it. Defer the work to a fresh task instead.
        setTimeout(() => {
          if (cancelled) return;
          void claimAndLoadProfile(supabase, nextSession.user.id).finally(() => {
            if (!cancelled) setReady(true);
          });
        }, 0);
      });
      unsubscribe = () => sub?.subscription?.unsubscribe?.();

      // If there is no session at all, INITIAL_SESSION still fires, but guard
      // against a listener that never delivers so the UI cannot hang on a spinner.
      if (!cancelled) {
        const { data } = await supabase.auth.getSession();
        if (!cancelled && !data?.session) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [claimAndLoadProfile]);

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
