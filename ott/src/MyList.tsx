import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Text, View } from 'react-native';
import {
  FocusVirtualizedRails,
  useFocusCommands,
  occurrenceKey,
  type VirtualizedFocusItem,
} from '@bougarnem/itar/react';
import { captionAccessible } from './tv-accessibility';
import { libraryId } from './profile-library';
import type { Film } from './catalog-types';
import { filmArtwork } from './artwork';
import { Action } from './components/Action';
import { Picture } from './components/Picture';
import { useCinemaLanguage } from './language';
import { useDesign } from './theme';

const pageSize = 75;

export function savedCardKey(id: string, film: Film) {
  return occurrenceKey(id, 'saved', libraryId(film));
}

export default function MyList({
  id,
  saved,
  ready,
  error,
  active,
  onOpen,
  onReady,
  onBrowse,
  onRetry,
  highContrast,
}: {
  id: string;
  saved: readonly Film[];
  ready: boolean;
  error: string;
  active: boolean;
  onOpen: (film: Film, key: string) => void;
  onReady: (key: string) => void;
  onBrowse: () => void;
  onRetry: () => void;
  highContrast: boolean;
}) {
  const { t } = useCinemaLanguage();
  const { s, u, colors } = useDesign();
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [requestedPage, setPage] = useState(0);

  const page = Math.min(
    requestedPage,
    Math.max(0, Math.ceil(saved.length / pageSize) - 1),
  );

  const width = Math.max(1, (viewport.width - 24 * u * 4) / 5);
  const extent = (width * 9) / 16 + 62 * u;
  const commands = useFocusCommands();
  const enteringPage = useRef(false);

  const changePage = useCallback((next: number) => {
    enteringPage.current = true;
    setPage(next);
  }, []);

  const group = useMemo(() => {
    const portion = saved.slice(page * pageSize, (page + 1) * pageSize);
    const cards = new Map<string, Film>();

    const rails = Array.from(
      { length: Math.ceil(portion.length / 5) },
      (_, row) => ({
        id: `saved-row-${page}-${row}`,
        itemExtent: width + 24 * u,
        itemStyle: {
          width,
          height: extent - 14 * u,
          marginEnd: 24 * u,
          backgroundColor: 'transparent',
          borderRadius: 8 * u,
        },
        items: portion.slice(row * 5, row * 5 + 5).map(film => {
          const key = savedCardKey(id, film);

          cards.set(key, film);

          return {
            occurrenceKey: key,
            contentId: film.id,
            accessibilityLabel: film.title,
            displayLabel: '',
            focusStyle: {
              accentColor: highContrast ? '#FFFFFF' : colors.focus,
            },
            onPress: () => onOpen(film, key),
          };
        }),
      }),
    );

    return { rails, cards, first: portion[0] };
  }, [saved, id, page, width, extent, u, highContrast, colors.focus, onOpen]);

  const emptyKey = occurrenceKey(id, error ? 'retry' : 'browse');

  useEffect(() => {
    if (active && !saved.length && (ready || error)) onReady(emptyKey);
  }, [active, ready, error, saved.length, onReady, emptyKey]);

  const reportReady = useCallback(() => {
    if (active && group.first) {
      const key = savedCardKey(id, group.first);

      if (enteringPage.current) {
        enteringPage.current = false;
        commands.focusByKey(key);
      } else {
        onReady(key);
      }
    }
  }, [active, group.first, id, onReady, commands]);

  const renderItem = useCallback(
    (item: VirtualizedFocusItem) => {
      const film = group.cards.get(item.occurrenceKey);

      if (!film) return null;

      return (
        <View>
          <Picture
            source={filmArtwork(film)}
            style={{ width, height: (width * 9) / 16 }}
            fallback="Artwork unavailable"
          />
          <Text
            accessible={captionAccessible}
            numberOfLines={1}
            style={s.detailCardCaption}
          >
            {film.title}
          </Text>
        </View>
      );
    },
    [group.cards, width, s.detailCardCaption],
  );

  return (
    <View style={s.fill}>
      {!!error && (
        <Text
          accessible={captionAccessible}
          accessibilityLiveRegion="polite"
          style={s.muted}
        >
          {error}
        </Text>
      )}
      {error && (
        <Action
          id={occurrenceKey(id, 'retry')}
          label="Retry local library"
          tvDescription={error}
          onPress={onRetry}
        />
      )}
      {!ready && !error && <Text style={s.muted}>{t('Loading My List…')}</Text>}
      {ready && !saved.length && (
        <>
          <Text accessible={captionAccessible} style={s.body}>
            {t('Save a title from its details to watch it later.')}
          </Text>
          <Action
            id={occurrenceKey(id, 'browse')}
            label="Browse titles"
            tvDescription="My List is empty. Save a title from its details to watch it later."
            onPress={onBrowse}
          />
        </>
      )}
      {saved.length > pageSize && (
        <View style={s.row}>
          {page > 0 && (
            <Action
              id={occurrenceKey(id, 'previous')}
              label="Previous page"
              onPress={() => changePage(page - 1)}
            />
          )}
          {saved.length > (page + 1) * pageSize && (
            <Action
              id={occurrenceKey(id, 'next')}
              label="Next page"
              onPress={() => changePage(page + 1)}
            />
          )}
        </View>
      )}
      <View
        style={s.fill}
        onLayout={event => {
          const { width: w, height: h } = event.nativeEvent.layout;

          if (w > 0 && h > 0) setViewport({ width: w, height: h });
        }}
      >
        {group.first && viewport.width > 0 && (
          <FocusVirtualizedRails
            id="saved-titles"
            active={active}
            rails={group.rails}
            rowExtent={extent}
            itemExtent={width + 24 * u}
            viewportHeight={viewport.height}
            viewportExtent={viewport.width}
            rowEntry="nearest"
            horizontalAlignment="nearest"
            renderItem={renderItem}
            onReady={reportReady}
          />
        )}
      </View>
    </View>
  );
}
