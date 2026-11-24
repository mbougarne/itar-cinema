import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  BackHandler,
  Platform,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  FocusScope,
  occurrenceKey,
  useFocusCommands,
  useFocusState,
  useIsFocused,
  useScreenReaderEnabled,
} from '@bougarnem/itar/react';
import {
  CinemaRails,
  type VirtualizedFocusRail,
} from './components/CinemaRails';
import { filmArtwork } from './artwork';
import { collectionsForMode } from './curated';
import type { BrowseProps } from './browse-types';
import type { Film } from './catalog-types';
import { useBrowserPointerDown } from './browser-navigation';
import { Action } from './components/Action';
import { Backdrop } from './components/Backdrop';
import { Picture } from './components/Picture';
import { PreviewSession } from './components/HomePreviewCard';
import { bigBuckBunny, kidsTitles, sampleFilm } from './demo-stream';
import { familyMovies, kidsSeries } from './family-titles';
import { useCinemaLanguage } from './language';
import { useDesign } from './theme';

export function Collections({
  id,
  onReady,
  onOpen,
  active,
  highContrast,
  mode,
  initialCollection,
  onBack,
}: Omit<BrowseProps, 'kind'> & {
  initialCollection?: string;
  onBack?: () => void;
}) {
  const { t, rtl } = useCinemaLanguage();
  const { s, u } = useDesign();
  const commands = useFocusCommands();
  const collections = collectionsForMode(mode);

  const [selected, setSelected] = useState(() => {
    const index = collections.findIndex(item => item.id === initialCollection);

    return index < 0 ? undefined : index;
  });

  const [returnTo, setReturnTo] = useState<number>();
  const [fromHomeCard, setFromHomeCard] = useState(!!initialCollection);
  const [gridWidth, setGridWidth] = useState(0);
  const lastCollection = useRef<number | undefined>(undefined);
  const collection = selected === undefined ? undefined : collections[selected];

  const { width, height } = useWindowDimensions();
  const backKey = occurrenceKey(id, 'all-collections');
  const collectionScroll = useRef<ScrollView>(null);
  const focus = useFocusState();
  const pointerDown = useBrowserPointerDown(Platform.OS === 'web' && active);
  const heroHeight = height * 0.48;

  const focusedTitle =
    collection?.titles.findIndex(
      title =>
        occurrenceKey(id, collection.id, title.id) === focus.occurrenceKey,
    ) ?? -1;

  const lowerRow = focusedTitle >= 4;

  useEffect(() => {
    if (
      active &&
      !pointerDown.current &&
      (focusedTitle >= 0 || focus.occurrenceKey === backKey)
    )
      collectionScroll.current?.scrollTo({
        y: lowerRow ? heroHeight : 0,
        animated: false,
      });
  }, [
    active,
    backKey,
    focus.occurrenceKey,
    focusedTitle,
    heroHeight,
    lowerRow,
    pointerDown,
  ]);

  const gridCardWidth = ((gridWidth || width - 240 * u) - 48 * u) / 4;

  const collectionKey = (index: number) =>
    occurrenceKey(id, 'collection', collections[index].id);

  useEffect(() => {
    if (!active) return;

    onReady?.(
      initialCollection && selected !== undefined
        ? backKey
        : occurrenceKey(id, 'collection', collections[0].id),
    );
  }, [active, backKey, collections, id, initialCollection, onReady, selected]);

  useEffect(() => {
    if (!active || (selected === undefined && !onBack)) return;

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (selected === undefined || fromHomeCard) onBack?.();
        else {
          setReturnTo(selected);
          setSelected(undefined);
        }

        return true;
      },
    );

    return () => subscription.remove();
  }, [active, fromHomeCard, onBack, selected]);

  useEffect(() => {
    if (!active || lastCollection.current === selected) return;

    lastCollection.current = selected;

    const key =
      selected !== undefined
        ? occurrenceKey(id, 'all-collections')
        : returnTo === undefined
        ? undefined
        : occurrenceKey(id, 'collection', collections[returnTo].id);

    if (!key) return;

    const request = commands.focusByKey(key);

    return () => request.cancel();
  }, [active, collections, commands, id, selected, returnTo]);

  if (collection && selected !== undefined)
    return (
      <ScrollView
        ref={collectionScroll}
        key={collection.id}
        style={s.fill}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.collectionScroll}
      >
        <View style={[s.collectionHero, { height: heroHeight }]}>
          {mode === 'proxy' && (
            <Picture
              source={filmArtwork(
                collectionsForMode('fixture')[selected].titles[0],
              )}
              style={s.collectionCover}
              fallback=""
            />
          )}
          <Backdrop film={collection.titles[0]} />
          <View style={s.collectionHeroCopy}>
            <Text style={s.seriesKicker}>{t('COLLECTION')}</Text>
            <Text accessibilityRole="header" style={s.homeHeroTitle}>
              {t(collection.name)}
            </Text>
            <Text style={s.body}>{t(collection.description)}</Text>
            <Action
              id={backKey}
              label="All collections"
              displayLabel="←  All collections"
              quiet
              style={s.collectionLink}
              onPress={() => {
                setFromHomeCard(false);
                setReturnTo(selected);
                setSelected(undefined);
              }}
            />
          </View>
        </View>
        <View
          style={[s.discoveryInset, { minHeight: height }]}
          onLayout={event => {
            if (event.nativeEvent.layout.width > 0)
              setGridWidth(event.nativeEvent.layout.width);
          }}
        >
          <Text accessibilityRole="header" style={s.heading}>
            {t('In this collection')}
          </Text>
          <FocusScope
            id="collection-results"
            layout="spatial"
            boundary="parent"
            style={s.collectionResults}
          >
            {collection.titles.map((film, order) => {
              const key = occurrenceKey(id, collection.id, film.id);

              return (
                <MediaCard
                  key={key}
                  film={film}
                  id={key}
                  order={order}
                  width={gridCardWidth}
                  height={(gridCardWidth * 9) / 16}
                  onPress={() => onOpen(film, key)}
                  highContrast={highContrast}
                />
              );
            })}
          </FocusScope>
        </View>
      </ScrollView>
    );

  return (
    <View style={[s.fill, s.discoveryIndex]}>
      <Text accessibilityRole="header" style={s.pageTitle}>
        {t('Collections')}
      </Text>
      <Text style={s.subtitle}>
        {t('Browse curated collections by mood, genre and theme.')}
      </Text>
      <FocusScope
        id="collection-tiles"
        layout="spatial"
        boundary="parent"
        style={s.collectionGrid}
      >
        {collections.map((item, index) => (
          <Action
            key={item.id}
            id={collectionKey(index)}
            order={index}
            label={`${t(item.name)}, ${item.titles.length} titles`}
            highContrast={highContrast}
            style={s.collectionCard}
            onPress={() => setSelected(index)}
          >
            <View style={s.fill}>
              <Picture
                source={filmArtwork(item.titles[0])}
                fallback="Artwork unavailable"
                style={s.collectionCover}
              />
              <View style={s.collectionCaption}>
                <Text style={s.discoveryLabel}>{t(item.name)}</Text>
                <Text style={s.muted}>
                  {item.titles.length} {rtl ? 'عناوين' : 'titles'}
                </Text>
              </View>
            </View>
          </Action>
        ))}
      </FocusScope>
    </View>
  );
}

function MediaCard({
  film,
  id,
  order,
  width,
  height,
  onPress,
  highContrast,
}: {
  film: Film;
  id: string;
  order: number;
  width: number;
  height: number;
  onPress: () => void;
  highContrast: boolean;
}) {
  const { s, u } = useDesign();

  return (
    <Action
      id={id}
      order={order}
      label={film.title}
      onPress={onPress}
      highContrast={highContrast}
      quiet
      style={[s.mediaCard, { width, height: height + 74 * u }]}
    >
      <Picture
        source={filmArtwork(film)}
        style={[s.discoveryImage, { height }]}
        fallback="Artwork unavailable"
      />
      <Text numberOfLines={1} style={s.discoveryLabel}>
        {film.title}
      </Text>
      <Text numberOfLines={1} style={s.muted}>
        {film.category.split(' / ')[0]} · {film.year}
      </Text>
    </Action>
  );
}

const ageGroups = ['All ages', 'Little explorers', 'Big adventures'] as const;

type AgeGroup = (typeof ageGroups)[number];

const littleSeries = new Set(['tmdb:series:82728', 'tmdb:series:65733']);

const littleFilms = new Set(
  [862, 10193, 508943, 109445, 136799].map(id => `tmdb:movie:${id}`),
);

function KidsTile({
  film,
  id,
  height,
  poster,
  preview,
  previewEnabled,
}: {
  film: Film;
  id: string;
  height: number;
  poster: boolean;
  preview: boolean;
  previewEnabled: boolean;
}) {
  const { s } = useDesign();
  const focused = useIsFocused(id);
  const reader = useScreenReaderEnabled();
  const sample = preview ? undefined : sampleFilm(film.id);

  return (
    <View>
      <View style={[s.previewFrame, { height }]}>
        <Picture
          source={sample?.artwork ?? filmArtwork(film, poster)}
          style={[s.discoveryImage, { height }]}
          fallback="Artwork unavailable"
        />
        {preview && focused && previewEnabled && !reader && (
          <PreviewSession media={bigBuckBunny} />
        )}
        {preview && (
          <Text accessible={false} style={s.kidsPreviewIcon}>
            ▶
          </Text>
        )}
      </View>
      {!poster && (
        <Text numberOfLines={1} style={s.discoveryLabel}>
          {film.title}
        </Text>
      )}
    </View>
  );
}

export function Kids({
  active,
  previewsEnabled,
  highContrast,
  onReady,
  onPlay,
  onOpen,
}: {
  active: boolean;
  previewsEnabled: boolean;
  highContrast: boolean;
  onReady: (key: string) => void;
  onPlay: (film: Film, key: string) => void;
  onOpen: (film: Film, key: string) => void;
}) {
  const { t } = useCinemaLanguage();
  const { s, u, colors } = useDesign();
  const screen = useWindowDimensions();
  const [group, setGroup] = useState<AgeGroup>('All ages');
  const [size, setSize] = useState({ width: 0, height: 0 });
  const width = size.width || screen.width - 112 * u;
  const height = size.height || screen.height;
  const firstKey = occurrenceKey('kids', 'hero', 'play');
  const infoKey = occurrenceKey('kids', 'hero', 'info');
  const featured = group === 'Big adventures' ? familyMovies[1] : kidsSeries[0];
  const reportReady = useCallback(() => onReady(firstKey), [firstKey, onReady]);

  const rails = useMemo((): VirtualizedFocusRail[] => {
    const young = group === 'Little explorers';
    const all = group === 'All ages';

    const series = kidsSeries.filter(
      film => all || littleSeries.has(film.id) === young,
    );

    const movies = familyMovies.filter(
      film => all || littleFilms.has(film.id) === young,
    );

    const clips = kidsTitles.filter(
      film =>
        !film.id.startsWith('fixture:') &&
        (all || /fox|panda|space/.test(film.id) === young),
    );

    const filters = ageGroups.map(name => ({
      occurrenceKey: occurrenceKey('kids', 'filter', name),
      accessibilityLabel: name + (name === group ? ', selected' : ''),
      displayLabel: name,
      onPress: () => setGroup(name),
    }));

    const shelves = [
      { id: 'previews', titles: series, type: 'preview' },
      { id: 'adventures', titles: movies, type: 'poster' },
      { id: 'shorts', titles: clips.slice().reverse(), type: 'wide' },
      { id: 'characters', titles: series, type: 'square' },
    ] as const;

    return [
      {
        id: 'kids-filter',
        headerExtent: 0,
        rowExtent: 158 * u,
        items: filters,
        renderBody: () => (
          <View style={s.discoveryInset}>
            <Text accessibilityRole="header" style={s.heading}>
              {t('Explore Itar Kids')}
            </Text>
            <View style={s.catalogueFilters}>
              {filters.map((filter, index) => (
                <Action
                  key={filter.occurrenceKey}
                  id={filter.occurrenceKey}
                  order={index}
                  label={filter.accessibilityLabel}
                  displayLabel={filter.displayLabel}
                  style={[
                    s.ageFilter,
                    ageGroups[index] === group && s.selectedTab,
                  ]}
                  onPress={filter.onPress}
                />
              ))}
            </View>
          </View>
        ),
      },
      ...shelves
        .filter(shelf => shelf.titles.length)
        .map(shelf => {
          const poster = shelf.type === 'poster';
          const preview = shelf.type === 'preview';
          const gap = 18 * u;

          const cardWidth = poster
            ? 191 * u
            : shelf.type === 'square'
            ? 208 * u
            : (width - 128 * u - 4 * gap) / 5;

          const cardHeight = poster
            ? cardWidth * 1.5
            : shelf.type === 'square'
            ? cardWidth
            : (cardWidth * 9) / 16;

          const itemHeight = cardHeight + (poster ? 0 : 42 * u);

          return {
            id: shelf.id,
            rowExtent: 50 * u + itemHeight + 28 * u,
            itemExtent: cardWidth + gap,
            itemStyle: [
              s.kidsTile,
              { width: cardWidth, height: itemHeight, marginStart: 64 * u },
            ],
            items: shelf.titles.map(film => {
              const id = occurrenceKey('kids', shelf.id, film.id);

              return {
                occurrenceKey: id,
                accessibilityLabel: preview
                  ? `Preview ${film.title}`
                  : film.title,
                contentId: film.id,
                displayLabel: '',
                focusStyle: {
                  accentColor: highContrast ? '#FFFFFF' : colors.accent,
                },
                onPress: () => (film.source ? onOpen : onPlay)(film, id),
                children: (
                  <KidsTile
                    film={film}
                    id={id}
                    height={cardHeight}
                    poster={poster}
                    preview={preview}
                    previewEnabled={active && previewsEnabled}
                  />
                ),
              };
            }),
          };
        }),
    ];
  }, [
    active,
    colors.accent,
    group,
    highContrast,
    onOpen,
    onPlay,
    previewsEnabled,
    t,
    s,
    u,
    width,
  ]);

  const headings = {
    previews: 'Watch a preview',
    adventures: 'Big adventures',
    shorts: 'Short stories',
    characters: 'Meet the characters',
  };

  const hero = (
    <View style={s.kidsHero}>
      <Backdrop film={featured} />
      <View style={s.collectionHeroCopy}>
        <Text style={s.seriesKicker}>{t('ITAR KIDS')}</Text>
        <Text
          accessibilityRole="header"
          numberOfLines={2}
          style={s.homeHeroTitle}
        >
          {featured.title}
        </Text>
        <Text numberOfLines={2} style={[s.body, s.discoverySynopsis]}>
          {featured.synopsis}
        </Text>
        <FocusScope
          id="kids-hero"
          layout="row"
          boundary="parent"
          style={s.homeHeroActions}
        >
          <Action
            id={firstKey}
            label="Play demo"
            displayLabel="▶  Play demo"
            style={s.kidsInfo}
            onPress={() => onPlay(featured, firstKey)}
          />
          <Action
            id={infoKey}
            order={1}
            label="More information"
            style={s.kidsInfo}
            onPress={() => onOpen(featured, infoKey)}
          />
        </FocusScope>
      </View>
    </View>
  );

  return (
    <View
      style={s.fill}
      onLayout={event => {
        const layout = event.nativeEvent.layout;

        if (layout.width > 0 && layout.height > 0)
          setSize(previous =>
            previous.width === layout.width && previous.height === layout.height
              ? previous
              : { width: layout.width, height: layout.height },
          );
      }}
    >
      <CinemaRails
        id="kids-content"
        active={active}
        rails={rails}
        onReady={reportReady}
        rowExtent={260 * u}
        headerExtent={50 * u}
        viewportExtent={width}
        viewportHeight={height}
        itemExtent={220 * u}
        horizontalAlignment="nearest"
        revealFullRow
        listHeader={hero}
        listHeaderExtent={500 * u}
        listHeaderScope="kids-hero"
        listHeaderItems={[
          { occurrenceKey: firstKey, accessibilityLabel: 'Play demo' },
          { occurrenceKey: infoKey, accessibilityLabel: 'More information' },
        ]}
        renderRailHeader={rail => (
          <Text
            accessibilityRole="header"
            style={[s.virtualHeading, s.discoveryInset]}
          >
            {t(headings[rail.id as keyof typeof headings])}
          </Text>
        )}
      />
    </View>
  );
}
