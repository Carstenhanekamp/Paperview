import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { getSupabaseAsync } from "../supabaseClient";
import { parseDesktopAuthCallback } from "../platform/deepLinks";
import { isTauri } from "../platform/runtime";

export default function DesktopDeepLinkBridge() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isTauri()) return undefined;
    let cancelled = false;
    let unlisten;

    const handleUrls = async (urls = []) => {
      for (const rawUrl of urls) {
        const callback = parseDesktopAuthCallback(rawUrl);
        if (!callback) continue;
        const supabase = await getSupabaseAsync();
        if (!supabase) return;
        const { error } = await supabase.auth.exchangeCodeForSession(callback.code);
        if (error || cancelled) return;
        const params = new URLSearchParams();
        if (callback.intent) params.set("intent", callback.intent);
        if (callback.next) params.set("next", callback.next);
        navigate(`/welcome${params.size ? `?${params}` : ""}`, { replace: true });
        break;
      }
    };

    getCurrent().then((urls) => handleUrls(urls || [])).catch(() => {});
    onOpenUrl(handleUrls).then((stop) => {
      if (cancelled) stop();
      else unlisten = stop;
    }).catch(() => {});

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [navigate]);

  return null;
}
