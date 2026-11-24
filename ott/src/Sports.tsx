import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import {
  FocusScope,
  FocusVirtualizedRails,
  occurrenceKey,
} from '@bougarnem/itar/react';
import type { Film } from './catalog-types';
import { Action } from './components/Action';
import { Picture } from './components/Picture';
import { sampleFilm, sportsClip } from './demo-stream';
import { useCinemaLanguage } from './language';
import { useDesign } from './theme';

type Match = Readonly<{
  kickoff: string;
  round: string;
  home: string;
  away: string;
  venue: string;
  score?: string;
  penalties?: string;
}>;

const matches: readonly Match[] = require('../assets/sports/worldcup-2026.json');
const filters = ['All', 'Finished', 'Upcoming'] as const;
const label = (match: Match) => `${match.home} vs ${match.away}`;

const kickoff = (match: Match) =>
  `${match.kickoff.slice(0, 10)} · ${match.kickoff.slice(11, 16)} UTC`;

const result = (match: Match) =>
  match.penalties
    ? `${match.score} · ${match.penalties} on penalties`
    : match.score;

function matchStatus(match: Match) {
  if (match.score) return 'Finished';

  return Date.parse(match.kickoff) > Date.now()
    ? 'Upcoming'
    : 'Result unavailable';
}

export function Sports({
  active,
  highContrast,
  onReady,
  onPlay,
}: {
  active: boolean;
  highContrast: boolean;
  onReady: (key?: string) => void;
  onPlay: (film: Film, opener: string) => void;
}) {
  const { t } = useCinemaLanguage();
  const { s, u, colors } = useDesign();
  const [width, setWidth] = useState(0);
  const [filter, setFilter] = useState<(typeof filters)[number]>('All');
  const [selected, setSelected] = useState<Match>(matches[0]);
  const clipKey = occurrenceKey('sports', 'triple-jump');

  useEffect(() => {
    if (active && width > 0) onReady(clipKey);
  }, [active, clipKey, onReady, width]);

  const visible = matches.filter(
    match => filter === 'All' || matchStatus(match) === filter,
  );

  const cards = new Map(
    visible.map(match => [
      occurrenceKey('sports', match.kickoff, match.home, match.away),
      match,
    ]),
  );

  const gap = 20 * u;
  const cardWidth = Math.min(355 * u, width - gap);
  const cardHeight = 168 * u;

  return (
    <View
      style={s.fill}
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
    >
      <View style={s.sportsSpotlight}>
        <Picture
          source={sampleFilm(sportsClip.id)?.artwork}
          fallback="Artwork unavailable"
          style={{ width: 500 * u, height: 270 * u, borderRadius: 12 * u }}
        />
        <View style={[s.fill, s.seriesCopy]}>
          <Text style={s.seriesKicker}>{t('ATHLETICS REPLAY')}</Text>
          <Text accessibilityRole="header" style={s.virtualHeading}>
            {t('Men’s triple jump')}
          </Text>
          <Text style={s.muted}>{t('Gwangju 2015 · Final')}</Text>
          <Action
            id={clipKey}
            label="Play men’s triple jump"
            highContrast={highContrast}
            primary
            style={s.primaryCta}
            onPress={() => onPlay(sportsClip, clipKey)}
          />
        </View>
      </View>
      <Text accessibilityRole="header" style={s.virtualHeading}>
        {t('World Cup 2026')}
      </Text>
      <FocusScope
        id="sports-filters"
        layout="row"
        boundary="parent"
        style={s.filters}
      >
        {filters.map((value, order) => (
          <Action
            key={value}
            order={order}
            id={occurrenceKey('sports', 'filter', value)}
            label={`${value}${filter === value ? ', selected' : ''}`}
            displayLabel={value}
            highContrast={highContrast}
            style={[s.filter, filter === value && s.selectedTab]}
            onPress={() => setFilter(value)}
          />
        ))}
      </FocusScope>
      {cards.size > 0 && width > 0 ? (
        <FocusVirtualizedRails
          id="world-cup"
          active={active}
          viewportRows={1}
          viewportExtent={width}
          rowExtent={cardHeight}
          itemExtent={cardWidth + gap}
          rails={[
            {
              id: filter,
              itemStyle: {
                width: cardWidth,
                height: cardHeight,
                marginEnd: gap,
                borderRadius: 12 * u,
                backgroundColor: '#192632',
              },
              items: [...cards].map(([key, match]) => ({
                occurrenceKey: key,
                displayLabel: '',
                accessibilityLabel: [
                  label(match),
                  matchStatus(match),
                  result(match),
                  kickoff(match),
                  match.venue,
                ]
                  .filter(Boolean)
                  .join('. '),
                focusStyle: {
                  accentColor: highContrast ? '#FFFFFF' : colors.accent,
                },
                onPress: () => setSelected(match),
              })),
            },
          ]}
          renderItem={item => {
            const match = cards.get(item.occurrenceKey);

            return (
              match && (
                <View accessible={false} style={s.sportsCard}>
                  <Text accessible={false} style={s.episodeCaption}>
                    {match.round} · {matchStatus(match)}
                  </Text>
                  <Text
                    accessible={false}
                    numberOfLines={2}
                    style={s.detailCardCaption}
                  >
                    {label(match)}
                  </Text>
                  <Text accessible={false} style={s.muted}>
                    {result(match) || kickoff(match)}
                  </Text>
                </View>
              )
            );
          }}
        />
      ) : (
        <Text accessibilityLiveRegion="polite" style={s.muted}>
          {filter === 'Upcoming'
            ? 'No upcoming World Cup 2026 fixtures.'
            : 'No matches available.'}
        </Text>
      )}
      {visible.includes(selected) && (
        <Text accessibilityLiveRegion="polite" style={s.muted}>
          {label(selected)} · {selected.venue} · {kickoff(selected)}
        </Text>
      )}
      <Text style={s.footer}>
        {t('World Cup 2026')} {t('match archive · OpenFootball · CC0 1.0')}
      </Text>
    </View>
  );
}
