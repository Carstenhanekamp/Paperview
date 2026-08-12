import { useEffect, useState } from 'react';

const DESKTOP_QUERY = '(min-width: 900px)';

/**
 * Live desktop-viewport flag. Reading matchMedia during render alone leaves the
 * hint stale after a resize or rotation, so subscribe to the query too.
 */
export function useIsDesktopViewport() {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia(DESKTOP_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mql = window.matchMedia(DESKTOP_QUERY);
    const onChange = (e) => setIsDesktop(e.matches);
    setIsDesktop(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isDesktop;
}
