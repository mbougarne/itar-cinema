import React from 'react';
import { Image, Text, View } from 'react-native';
import {
  useFocusState,
  type VirtualizedFocusItem,
} from '@bougarnem/itar/react';
import type { Film } from './catalog-types';
import { filmArtwork } from './artwork';
import { Action } from './components/Action';
import { Picture } from './components/Picture';
import { useDesign } from './theme';

export function WeekendMovies({
  films,
  cards,
  height,
  posterWidth,
  highContrast,
  onOpen,
}: {
  films: readonly Film[];
  cards: readonly VirtualizedFocusItem[];
  height: number;
  posterWidth: number;
  highContrast: boolean;
  onOpen: (film: Film, opener: string) => void;
}) {
  const { s } = useDesign();
  const focus = useFocusState();

  const expanded = Math.max(
    0,
    cards.findIndex(card => card.occurrenceKey === focus.occurrenceKey),
  );

  return (
    <View style={s.openFilmsStrip}>
      {cards.map((card, index) => {
        const film = films[index];
        const featured = index === expanded;

        return (
          <Action
            key={card.occurrenceKey}
            id={card.occurrenceKey}
            order={index}
            label={card.accessibilityLabel}
            contentId={film.id}
            quiet
            highContrast={highContrast}
            onPress={() => onOpen(film, card.occurrenceKey)}
            style={[
              s.weekendCard,
              { width: posterWidth, height },
              featured && s.weekendExpanded,
            ]}
          >
            <View style={s.weekendContent}>
              <View style={{ width: posterWidth, height }}>
                <Picture
                  source={filmArtwork(film, true)}
                  style={{ width: posterWidth, height }}
                  fallback="Poster unavailable"
                />
                {featured && (
                  <Image
                    accessible={false}
                    source={require('../assets/cinematic/weekend-fade.png')}
                    resizeMode="stretch"
                    style={s.weekendFade}
                  />
                )}
              </View>
              {featured && (
                <View style={s.weekendCopy}>
                  <Text numberOfLines={2} style={s.virtualHeading}>
                    {film.title}
                  </Text>
                  <Text numberOfLines={1} style={s.muted}>
                    {film.category.split(' / ')[0]} · {film.year}
                  </Text>
                  <Text numberOfLines={5} style={s.weekendSynopsis}>
                    {film.synopsis}
                  </Text>
                </View>
              )}
            </View>
          </Action>
        );
      })}
    </View>
  );
}
