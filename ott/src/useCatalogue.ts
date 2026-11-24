import type { CinemaLanguage } from './language';
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { CatalogueSort, Category, Kind } from './catalog-types';
import { fetchPage } from './catalog';
import { fetchProxyPage } from './tmdb';
import type { ProviderMode } from './catalog-types';
import { CatalogueSession } from './session';

export function useCatalogue(
  kind: Kind,
  query: string,
  delay: number,
  failNext: () => boolean,
  mode: ProviderMode = 'fixture',
  limit = 160,
  category: Category = 'All',
  sort: CatalogueSort = 'popular',
  language: CinemaLanguage = 'en-US',
) {
  const options = useRef({ delay, failNext });

  options.current = { delay, failNext };

  const normalized = query.trim().toLocaleLowerCase('en-US');

  const session = useMemo(
    () =>
      new CatalogueSession(
        kind,
        normalized,
        () => ({
          delay: options.current.delay,
          fail: options.current.failNext(),
          category,
          sort,
          language,
        }),
        mode === 'proxy' ? fetchProxyPage : fetchPage,
        limit,
      ),
    [kind, normalized, mode, limit, category, sort, language],
  );

  const state = useSyncExternalStore(
    session.subscribe,
    session.snapshot,
    session.snapshot,
  );

  useEffect(() => {
    session.start();

    return session.dispose;
  }, [session]);

  return {
    state,
    loadMore: session.loadMore,
    reload: session.start,
    nextWindow: session.nextWindow,
  };
}
