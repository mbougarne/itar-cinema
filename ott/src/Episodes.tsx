import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import {
  FocusScope,
  occurrenceKey,
  useFocusState,
} from '@bougarnem/itar/react';
import { CinemaRails } from './components/CinemaRails';
import { art, filmArtwork } from './artwork';
import { demoForTitle } from './demo-stream';
import type { Episode, Film, Season } from './catalog-types';
import { Action } from './components/Action';
import { Picture } from './components/Picture';
import { cachedSeason, loadSeason } from './detail-data';
import type { EpisodePlayback, VideoChoice } from './playback-history';
import { useCinemaLanguage } from './language';
import { useDesign } from './theme';

export const fixtureSeasons: readonly Season[] = [
  { number: 0, name: 'Specials' },
  { number: 1, name: 'Season 1' },
  { number: 2, name: 'Season 2' },
];

export const fixtureEpisodes: readonly Episode[] = [
  'A New Signal',
  'After Dark',
  'The Long Return',
  'First Light',
].map((name, index) => ({
  number: index + 1,
  name,
  synopsis: 'A fictional episode for testing the Cinema catalogue offline.',
  stillUrl: null,
  runtime: index === 1 ? null : 44 + index,
  airDate: index === 1 ? null : '2026-02-02',
}));

export function episodeVideoChoices(
  film: Film,
  season: number,
  episodes: readonly Episode[],
): readonly VideoChoice[] {
  return episodes.map(episode => ({
    key: occurrenceKey(
      'details',
      film.id,
      'episode',
      String(season),
      String(episode.number),
    ),
    title: `S${season} E${episode.number} · ${episode.name}`,
    artwork: episode.stillUrl ? { uri: episode.stillUrl } : filmArtwork(film),
  }));
}

export function episodeGridLayout(width: number, u: number) {
  const gap = 40 * u;
  const columns = 4;
  const cardWidth = Math.max(0, (width - gap * columns) / columns);
  const stillHeight = (cardWidth * 9) / 16;
  const captionHeight = 138 * u;
  const cardHeight = stillHeight + captionHeight;
  const rowExtent = cardHeight + 36 * u;
  const seasonRowHeight = 58 * u;

  return {
    gap,
    columns,
    cardWidth,
    stillHeight,
    captionHeight,
    cardHeight,
    rowExtent,
    seasonRowHeight,
  };
}

export function Episodes({
  film,
  seasons,
  width,
  height,
  active,
  highContrast,
  slow,
  onReady,
  onEpisodeFocus,
  onPlay,
}: {
  film: Film;
  seasons: readonly Season[];
  width: number;
  height?: number;
  active: boolean;
  highContrast: boolean;
  slow: boolean;
  onReady?: () => void;
  onEpisodeFocus: (focused: boolean) => void;
  onPlay: (episode: EpisodePlayback) => void;
}) {
  const { t } = useCinemaLanguage();
  const { s, u, colors } = useDesign();
  const focus = useFocusState();
  const [selected, setSelected] = useState<number>();

  const season =
    seasons.find(item => item.number === selected) ??
    seasons.find(item => item.number > 0) ??
    seasons[0];

  const number = season?.number;

  const [result, setResult] = useState<{
    number: number;
    episodes?: readonly Episode[];
    error?: string;
  }>();

  const [retry, setRetry] = useState(0);
  const current = result?.number === number ? result : undefined;

  const episodes =
    current?.episodes ??
    (number === undefined ? undefined : cachedSeason(film, number));

  useEffect(() => {
    if (number === undefined) return;

    const request = new AbortController();

    const timer = setTimeout(
      () => {
        const pending = film.source
          ? loadSeason(film, number, request.signal)
          : Promise.resolve(number === 0 ? [] : fixtureEpisodes);

        pending.then(
          values => {
            if (!request.signal.aborted)
              setResult({ number, episodes: values });
          },
          () => {
            if (!request.signal.aborted)
              setResult({ number, error: 'Episodes could not load.' });
          },
        );
      },
      slow ? 650 : 0,
    );

    return () => {
      clearTimeout(timer);
      request.abort();
    };
  }, [film, number, slow, retry]);

  const {
    gap,
    columns,
    cardWidth,
    stillHeight,
    captionHeight,
    cardHeight,
    rowExtent,
    seasonRowHeight,
  } = episodeGridLayout(width, u);

  const seasonExtent = 132 * u;
  const focusStyle = { accentColor: highContrast ? '#FFFFFF' : colors.accent };

  const queue = episodeVideoChoices(film, number ?? 0, episodes ?? []);

  const episodeFocused =
    active && queue.some(item => item.key === focus.occurrenceKey);

  useEffect(() => {
    onEpisodeFocus(episodeFocused);
  }, [episodeFocused, onEpisodeFocus]);

  useEffect(() => () => onEpisodeFocus(false), [onEpisodeFocus]);

  if (!season || width <= 0) return null;

  const cards = new Map(
    (episodes ?? []).map((episode, index) => [queue[index].key, episode]),
  );

  const facts = (episode: Episode) =>
    [episode.runtime && `${episode.runtime} ${t('min')}`, episode.airDate]
      .filter(Boolean)
      .join(' · ');

  const gridItems = Array.from(cards).map(([key, episode]) => ({
    occurrenceKey: key,
    accessibilityLabel: [
      t(season.name),
      `${t('Episode')} ${episode.number}`,
      episode.name,
      facts(episode),
      episode.synopsis,
      t('{asset} demo', { asset: demoForTitle(film).name }),
    ]
      .filter(Boolean)
      .join('. '),
    displayLabel: '',
    outlineInsetBottom: captionHeight,
    focusStyle,
    onPress: () =>
      onPlay({
        label: `S${season.number} E${episode.number} · ${episode.name}`,
        opener: key,
        seasonNumber: season.number,
        queue,
      }),
  }));

  const rowCount = Math.ceil(gridItems.length / columns);

  return (
    <FocusScope id="episodes" boundary="parent" style={s.fill}>
      <View style={s.seasonHeader}>
        {Platform.OS !== 'web' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <FocusScope
              id="seasons"
              layout="row"
              boundary="parent"
              style={s.row}
            >
              {seasons.map((value, index) => (
                <Action
                  key={value.number}
                  id={occurrenceKey(
                    'details',
                    film.id,
                    'season',
                    String(value.number),
                  )}
                  order={index}
                  label={`${value.name}${
                    value.number === season.number ? ', selected' : ''
                  }`}
                  displayLabel={value.name}
                  quiet
                  style={[s.seasonPill, { minWidth: seasonExtent - 12 * u }]}
                  highContrast={highContrast}
                  onPress={() => setSelected(value.number)}
                />
              ))}
            </FocusScope>
          </ScrollView>
        )}
        {Platform.OS === 'web' && (
          <CinemaRails
            id="season-picker"
            active={active}
            viewportRows={1}
            viewportExtent={Math.min(
              seasons.length * seasonExtent,
              width - 186 * u,
            )}
            rowExtent={seasonRowHeight}
            itemExtent={seasonExtent}
            rails={[
              {
                id: 'seasons',
                itemStyle: s.seasonPill,
                items: seasons.map(value => ({
                  occurrenceKey: occurrenceKey(
                    'details',
                    film.id,
                    'season',
                    String(value.number),
                  ),
                  accessibilityLabel: `${t(value.name)}${
                    value.number === season.number ? ', selected' : ''
                  }`,
                  displayLabel: t(value.name),
                  labelSize: 20 * u,
                  focusStyle,
                  baseAccentColor:
                    value.number === season.number ? colors.accent : '#DCE5ED',
                  onPress: () => setSelected(value.number),
                })),
              },
            ]}
          />
        )}
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          style={[s.virtualHeading, s.seasonHeading]}
        >
          {t(season.name)}
        </Text>
      </View>
      {cards.size > 0 ? (
        <CinemaRails
          id="episode-cards"
          active={active}
          onReady={onReady}
          viewportRows={1}
          revealFullRow
          viewportExtent={width}
          rowExtent={rowExtent}
          itemExtent={cardWidth + gap}
          viewportHeight={
            height == null
              ? cardHeight
              : Math.max(
                  1,
                  height - seasonRowHeight - s.seasonHeader.marginBottom,
                )
          }
          rails={Array.from({ length: rowCount }, (_, row) => ({
            id: row === 0 ? 'episodes' : `episodes-${row}`,
            rowExtent: row === rowCount - 1 ? rowExtent + 36 * u : undefined,
            itemStyle: {
              width: cardWidth,
              height: cardHeight,
              marginEnd: gap,
              borderRadius: 12 * u,
              backgroundColor: 'transparent',
            },
            items: gridItems.slice(row * columns, (row + 1) * columns),
          }))}
          renderItem={item => {
            const episode = cards.get(item.occurrenceKey);

            if (!episode) return null;

            const source = episode.stillUrl
              ? { uri: episode.stillUrl }
              : !film.source && episode.number !== 2
              ? art[
                  (film.art + season.number + episode.number - 2) % art.length
                ]
              : undefined;

            return (
              <View accessible={false}>
                <Picture
                  source={source}
                  fallback="Still unavailable"
                  style={{
                    width: cardWidth,
                    height: stillHeight,
                    borderRadius: 12 * u,
                  }}
                />
                <View style={s.episodeCardCopy}>
                  <Text
                    accessible={false}
                    numberOfLines={1}
                    style={s.detailCardCaption}
                  >
                    {episode.number}. {episode.name}
                  </Text>
                  {facts(episode) !== '' && (
                    <Text accessible={false} style={s.episodeCaption}>
                      {facts(episode)}
                    </Text>
                  )}
                  <Text
                    accessible={false}
                    numberOfLines={2}
                    style={s.episodeCaption}
                  >
                    {episode.synopsis}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      ) : current?.error ? (
        <Action
          id={occurrenceKey('details', 'episode-retry')}
          label="Retry episodes"
          onPress={() => {
            setResult(undefined);
            setRetry(value => value + 1);
          }}
        />
      ) : (
        <Text accessibilityLiveRegion="polite" style={s.muted}>
          {t(
            episodes
              ? 'No episodes available for this season.'
              : 'Loading episodes…',
          )}
        </Text>
      )}
    </FocusScope>
  );
}
