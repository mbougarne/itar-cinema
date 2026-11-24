import React from 'react';
import { Image, Text, View } from 'react-native';
import { useFocusState } from '@bougarnem/itar/react';
import type { VirtualizedFocusItem } from '@bougarnem/itar/react';
import type { Film } from './catalog-types';
import { openFilmTitles, sampleFilm } from './demo-stream';
import { Action } from './components/Action';
import { PreviewSession } from './components/HomePreviewCard';
import { useDesign } from './theme';

export function OpenFilms({
  cards,
  height,
  preview,
  highContrast,
  onPlay,
}: {
  cards: readonly VirtualizedFocusItem[];
  height: number;
  preview: boolean;
  highContrast: boolean;
  onPlay: (film: Film, key: string) => void;
}) {
  const { s, u } = useDesign();
  const focus = useFocusState();

  const selected = cards.findIndex(
    card => card.occurrenceKey === focus.occurrenceKey,
  );

  return (
    <View style={s.openFilmsStrip}>
      {cards.map((card, index) => {
        const film = openFilmTitles[index];
        const sample = sampleFilm(film.id);
        const focused = index === selected;

        return (
          <Action
            key={card.occurrenceKey}
            order={index}
            id={card.occurrenceKey}
            label={film.title}
            contentId={film.id}
            highContrast={highContrast}
            onPress={() => onPlay(film, card.occurrenceKey)}
            style={[s.openFilmSlice, { height }, focused && s.openFilmExpanded]}
          >
            <View style={s.fill}>
              <Image
                accessible={false}
                source={sample?.artwork}
                resizeMode="cover"
                style={s.openFilmArtwork}
              />
              {preview && focused && <PreviewSession media={sample?.media} />}
              <Text
                numberOfLines={focused ? 1 : 2}
                style={[s.openFilmName, { fontSize: (focused ? 32 : 22) * u }]}
              >
                {film.title}
              </Text>
            </View>
          </Action>
        );
      })}
    </View>
  );
}
