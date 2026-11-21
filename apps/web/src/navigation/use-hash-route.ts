import { useCallback, useEffect, useState } from 'react';
import { parseHash, routeToHash } from './app-route.js';
import type { AppRoute } from './app-route.js';

/**
 * The current screen, read from and written to the URL hash. Every
 * navigation adds a history entry, so the browser's back button goes back
 * one screen, or one tab.
 */
export function useHashRoute(): { route: AppRoute; navigate: (next: AppRoute) => void } {
  const [route, setRoute] = useState<AppRoute>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((next: AppRoute) => {
    const hash = routeToHash(next);
    if (window.location.hash !== hash) window.location.hash = hash;
    // Set here too: hashchange fires asynchronously, the screen should not wait.
    setRoute(next);
  }, []);

  return { route, navigate };
}
