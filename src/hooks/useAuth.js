import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSupabase, getSupabaseAsync, isSupabaseConfigured, FOUNDING_CAP } from '../supabaseClient';
import {
  buildWelcomeRedirectUrl,
  profileNeedsOnboarding,
  sanitizeProfileName,
} from '../profileOnboarding';

async function fetchProfile(supabase, userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, email, founding, founder_number, launch_grant_status, slot_resolved, display_name, library_name, created_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function claimFoundingSlotRpc(supabase) {
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
  const [profileBusy, setProfileBusy] = useState(false);

  // Claiming a founding slot is a once-per-user write. Without this the RPC
  // could re-fire from double-clicks / remounts while a claim is in flight.
  const claimedForUserRef = useRef(null);
  const claimInFlightRef = useRef(null);

  const user = session?.user ?? null;
  const configured = isSupabaseConfigured;
  const needsOnboarding = useMemo(
    () => Boolean(user && profile && profileNeedsOnboarding(profile)),
    [user, profile],
  );

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

  /** Load profile only — never claims a founding slot. */
  const loadProfile = useCallback(async (supabase, uid) => {
    if (!supabase || !uid) return null;
    try {
      const next = await fetchProfile(supabase, uid);
      setProfile(next);
      setAuthError('');
      return next;
    } catch (err) {
      setAuthError(err?.message || 'Could not load account.');
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async (activeSession = session) => {
    const supabase = await getSupabaseAsync();
    const uid = activeSession?.user?.id;
    if (!supabase || !uid) {
      setProfile(null);
      return null;
    }
    return loadProfile(supabase, uid);
  }, [session, loadProfile]);

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
      // and loading here as well would do all of it twice on every page load.
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
          void loadProfile(supabase, nextSession.user.id).finally(() => {
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
  }, [loadProfile]);

  const sendMagicLink = useCallback(async (email, options = {}) => {
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
      const redirectTo = buildWelcomeRedirectUrl(window.location.origin, {
        intent: options.intent,
        next: options.next || '/app',
      });
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

  const claimFoundingSlot = useCallback(async () => {
    const supabase = await getSupabaseAsync();
    const uid = session?.user?.id;
    if (!supabase || !uid) {
      setAuthError('Sign in to claim a founding spot.');
      return { ok: false };
    }
    if (claimedForUserRef.current === uid && profile?.slot_resolved) {
      return {
        ok: true,
        already_claimed: true,
        founding: profile.founding,
        founder_number: profile.founder_number,
      };
    }
    // This callback is re-created whenever `profile` changes, and the effect
    // that drives it depends on that identity — so a profile update landing
    // mid-claim used to fire a second RPC before the ref below was set. Share
    // the in-flight promise instead of starting a new request.
    if (claimInFlightRef.current?.uid === uid) return claimInFlightRef.current.promise;

    const run = (async () => {
      setClaimBusy(true);
      setAuthError('');
      try {
        const data = await claimFoundingSlotRpc(supabase);
        claimedForUserRef.current = uid;
        const next = await fetchProfile(supabase, uid);
        setProfile(next);
        await refreshSpots();
        return { ok: true, ...(data && typeof data === 'object' ? data : {}) };
      } catch (err) {
        try {
          const next = await fetchProfile(supabase, uid);
          setProfile(next);
        } catch {
          /* ignore secondary failure */
        }
        setAuthError(err?.message || 'Could not claim founding spot.');
        return { ok: false };
      } finally {
        setClaimBusy(false);
        claimInFlightRef.current = null;
      }
    })();

    claimInFlightRef.current = { uid, promise: run };
    return run;
  }, [session, profile, refreshSpots]);

  const updateProfile = useCallback(async ({ displayName, libraryName } = {}) => {
    const supabase = await getSupabaseAsync();
    const uid = session?.user?.id;
    if (!supabase || !uid) {
      const message = 'Sign in to update your profile.';
      setAuthError(message);
      return { ok: false, error: message };
    }
    const display = sanitizeProfileName(displayName);
    const library = sanitizeProfileName(libraryName);
    if (!display.ok || !library.ok) {
      const message = 'Enter a name and library label (max 80 characters).';
      setAuthError(message);
      return { ok: false, error: message };
    }
    setProfileBusy(true);
    setAuthError('');
    try {
      const { data, error } = await supabase.rpc('update_own_profile', {
        p_display_name: display.value,
        p_library_name: library.value,
      });
      if (error) throw error;
      // RPC returns a row (or array depending on client); normalize.
      const row = Array.isArray(data) ? data[0] : data;
      if (row) {
        setProfile(row);
      } else {
        await loadProfile(supabase, uid);
      }
      return { ok: true };
    } catch (err) {
      // Returned as well as pushed to state: callers that read `authError`
      // straight after awaiting this would see the previous render's value.
      const message = err?.message || 'Could not save profile.';
      setAuthError(message);
      return { ok: false, error: message };
    } finally {
      setProfileBusy(false);
    }
  }, [session, loadProfile]);

  const signOut = useCallback(async () => {
    const supabase = getSupabase() || (await getSupabaseAsync());
    if (!supabase) return;
    setAuthBusy(true);
    setAuthError('');
    try {
      await supabase.auth.signOut();
      setSession(null);
      setProfile(null);
      claimedForUserRef.current = null;
      claimInFlightRef.current = null;
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
    profileBusy,
    needsOnboarding,
    sendMagicLink,
    claimFoundingSlot,
    updateProfile,
    signOut,
    refreshProfile,
    refreshSpots,
  };
}
