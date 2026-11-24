import { useEffect, useState } from 'react';
import type { Film } from './catalog-types';
import { films } from './catalog';
import { loadDetails, loadSeason } from './detail-data';
import {
  episodeVideoChoices,
  fixtureEpisodes,
  fixtureSeasons,
} from './Episodes';
import { filmArtwork } from './artwork';
import { sampleFilm } from './demo-stream';
import type {
  EpisodePlayback,
  PlaybackChoice,
  PlaybackChoices,
  VideoChoice,
} from './playback-history';

type SeasonQueue = {
  number: number;
  items: readonly VideoChoice[];
};

export function usePlaybackChoices(
  film: Film | undefined,
  episode: EpisodePlayback | undefined,
  play: (film: Film, episode?: EpisodePlayback) => void,
): PlaybackChoices | undefined {
  const [response, setResponse] = useState<{
    film: Film;
    opener?: string;
    season?: SeasonQueue;
    nextSeason?: SeasonQueue;
    related?: readonly Film[];
  }>();

  useEffect(() => {
    if (!film || sampleFilm(film.id)) return;

    const request = new AbortController();
    const { signal } = request;

    async function loadQueue(title: Film, number: number) {
      const items = title.source
        ? await loadSeason(title, number, signal)
        : fixtureEpisodes;

      return { number, items: episodeVideoChoices(title, number, items) };
    }

    async function load(title: Film) {
      if (title.kind === 'movie') {
        const related = title.source
          ? (await loadDetails(title, signal)).related
          : films.filter(value => value.kind === 'movie');

        if (!signal.aborted) setResponse({ film: title, related });

        return;
      }

      // When the details screen supplied a queue, only the final episode needs
      // to consult the catalogue for another season.
      const queue = episode?.queue;

      if (queue && queue[queue.length - 1]?.key !== episode.opener) return;

      const seasons = title.source
        ? (await loadDetails(title, signal)).seasons
        : fixtureSeasons;

      if (signal.aborted) return;

      const regular = seasons
        .filter(season => season.number > 0)
        .sort((a, b) => a.number - b.number);

      const number =
        episode?.seasonNumber ?? regular[0]?.number ?? seasons[0]?.number;

      if (number === undefined) return;

      const season = queue
        ? { number, items: queue }
        : await loadQueue(title, number);

      if (signal.aborted) return;

      const current = { film: title, opener: episode?.opener, season };

      setResponse(current);

      const currentKey = episode?.opener ?? season.items[0]?.key;

      if (
        !currentKey ||
        season.items[season.items.length - 1]?.key !== currentKey
      )
        return;

      for (const next of regular) {
        if (next.number <= number) continue;

        const nextSeason = await loadQueue(title, next.number);

        if (signal.aborted) return;

        if (nextSeason.items.length) {
          setResponse({ ...current, nextSeason });

          return;
        }
      }
    }

    load(film).catch(() => {});

    return () => request.abort();
  }, [film, episode]);

  if (!film || sampleFilm(film.id)) return undefined;

  const currentResponse =
    response?.film === film && response?.opener === episode?.opener
      ? response
      : undefined;

  const currentSeason = episode?.queue
    ? { number: episode.seasonNumber, items: episode.queue }
    : currentResponse?.season;

  const currentKey = episode?.opener ?? currentSeason?.items[0]?.key;

  const choice = (item: VideoChoice, season: SeasonQueue): PlaybackChoice => ({
    ...item,
    play: () =>
      play(film, {
        label: item.title,
        opener: item.key,
        seasonNumber: season.number,
        queue: season.items,
      }),
  });

  const episodes = currentSeason
    ? currentSeason.items
        .filter(item => item.key !== currentKey)
        .map(item => choice(item, currentSeason))
    : [];

  const index =
    currentSeason?.items.findIndex(item => item.key === currentKey) ?? -1;

  const following = index < 0 ? undefined : currentSeason?.items[index + 1];
  const nextSeason = currentResponse?.nextSeason;
  const firstOfNextSeason = nextSeason?.items[0];

  const nextEpisode =
    following && currentSeason
      ? choice(following, currentSeason)
      : nextSeason && firstOfNextSeason
      ? choice(firstOfNextSeason, nextSeason)
      : undefined;

  const related = (currentResponse?.related ?? [])
    .filter(value => value.id !== film.id)
    .slice(0, 8)
    .map(value => ({
      key: value.id,
      title: value.title,
      artwork: filmArtwork(value),
      play: () => play(value),
    }));

  return episodes.length || related.length || nextEpisode
    ? {
        episodes,
        related,
        nextEpisode,
        startsNextSeason: !!firstOfNextSeason && !following,
      }
    : undefined;
}
