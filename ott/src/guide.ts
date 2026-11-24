import { useEffect, useMemo, useState } from 'react';
import type { ProviderMode } from './catalog-types';
import { fixtureGuide, parseGuide } from './guide-data';
import type { Guide } from './guide-types';

export { guideTime } from './guide-data';

let cache: { at: number; data: unknown } | undefined;

export function useGuide(enabled: boolean, mode: ProviderMode = 'proxy') {
  const offline = mode === 'fixture';

  const sample = useMemo(
    () => (offline ? fixtureGuide(Date.now() / 1000) : null),
    [offline],
  );

  const [guide, setGuide] = useState<Guide | null>(null);
  const [error, setError] = useState('');
  const [attempt, retry] = useState(0);

  useEffect(() => {
    if (!enabled || offline) {
      return;
    }

    const timer = setInterval(() => retry(value => value + 1), 30 * 60 * 1000);

    return () => clearInterval(timer);
  }, [enabled, offline]);

  useEffect(() => {
    if (!enabled || offline) {
      return;
    }

    const request = new AbortController();
    let live = true;

    setError('');

    const timer = setTimeout(() => request.abort(), 12000);

    async function load() {
      try {
        let data =
          cache && Date.now() - cache.at < 30 * 60 * 1000
            ? cache.data
            : undefined;

        const cached = !!data;

        if (!cached) {
          const response = await fetch(
            'https://epgtalk.com/api/now/uslocal.json',
            { signal: request.signal },
          );

          if (!response.ok) {
            throw new Error('Guide unavailable');
          }

          const body = await response.text();

          if (body.length > 5 * 1024 * 1024) {
            throw new Error('Guide exceeded size limit');
          }

          data = JSON.parse(body);
        }

        const parsed = parseGuide(data);

        if (live) {
          if (!cached) {
            cache = { at: Date.now(), data };
          }

          setGuide(parsed);
        }
      } catch {
        if (live) {
          setError('The EPGTalk schedule could not load. Try again.');
        }
      } finally {
        clearTimeout(timer);
      }
    }

    load();

    return () => {
      live = false;
      request.abort();
      clearTimeout(timer);
    };
  }, [enabled, offline, attempt]);

  return {
    guide: offline ? sample : guide,
    error: offline ? '' : error,
    retry: () => retry(value => value + 1),
  };
}
