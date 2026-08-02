import { useEffect } from 'react';

/** Inject a CSS string into document.head once per id (survives Vite stripping JSX style tags). */
export function useScopedStyles(id, css) {
  useEffect(() => {
    if (!id || !css) return undefined;
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('style');
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = css;
    return undefined;
  }, [id, css]);
}
