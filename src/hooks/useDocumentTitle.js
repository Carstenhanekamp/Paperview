import { useEffect } from 'react';
import { DEFAULT_DOCUMENT_TITLE } from '../profileOnboarding';

/**
 * Keep document.title on the value we want. Safari will otherwise replace it
 * with an empty/PDF title and show the localized "Untitled" ("Naamloos").
 */
export function useDocumentTitle(title) {
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const next = String(title || '').trim() || DEFAULT_DOCUMENT_TITLE;

    const apply = () => {
      if (document.title !== next) document.title = next;
    };

    apply();

    const titleEl = document.querySelector('title');
    let observer;
    if (typeof MutationObserver !== 'undefined' && titleEl) {
      observer = new MutationObserver(apply);
      observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
    }

    const interval = window.setInterval(apply, 1000);
    return () => {
      observer?.disconnect();
      window.clearInterval(interval);
    };
  }, [title]);
}
