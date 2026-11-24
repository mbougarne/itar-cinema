import React, {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform, Text, View, useWindowDimensions } from 'react-native';
import {
  occurrenceKey,
  useIsFocused,
  useScreenReaderEnabled,
  useFocusCommands,
} from '@bougarnem/itar/react';
import {
  CinemaRails,
  type VirtualizedFocusRail,
} from './components/CinemaRails';
import type { VirtualizedFocusItem } from '@bougarnem/itar/react';
import { tvControlLabel } from './tv-accessibility';
import { films, hero } from './catalog';
import { useCatalogue } from './useCatalogue';
import { Picture } from './components/Picture';
import { filmArtwork } from './artwork';
import Hero, { heroTargets } from './Hero';
import { BrowserNavigation } from './browser-navigation';
import { sampleFilm, openFilmTitles, bigBuckBunny } from './demo-stream';
import { OpenFilms } from './OpenFilms';
import { WeekendMovies } from './WeekendMovies';
import { collectionsForMode } from './curated';
import { familyMovies, kidsSeries } from './family-titles';
import { liveChannels } from './live-source';
import { Action } from './components/Action';
import { chartRows, homeCharts, layoutRows } from './browse-layout';
import { useCinemaLanguage } from './language';
import { useDesign } from './theme';

import { CatalogueFeedback } from './components/CatalogueFeedback';
import { HomeGuideSelection, useHomeGuide } from './components/GuidePreview';
import { EndObserver } from './components/EndObserver';
import { ContentBelowCue } from './components/ContentBelowCue';
import { ContinueWatchingCard } from './components/ContinueWatchingCard';
import {
  HomePreviewProvider,
  HomePreviewCard,
} from './components/HomePreviewCard';
import type { BrowseProps, BrowseVisual } from './browse-types';
import type { Film, Rail } from './catalog-types';

export default function Browse({
  id,
  kind,
  query = '',
  active,
  delay,
  failNext,
  onOpen,
  highContrast,
  featured = false,
  continueWatching,
  searchResults = false,
  mode,
  onReady,
  onHomeLoading,
  viewportWidth,
  onGuide,
  onCollection,
  onCollections,
  onLive,
  onPlaySample,
  savedIds,
  onSave,
  saveReady,
  previewsEnabled = true,
  grid = false,
  sort,
  category = 'All',
}: BrowseProps) {
  const { language, t } = useCinemaLanguage();
  const { s, u, colors } = useDesign();
  const { width } = useWindowDimensions();
  const [measuredWidth, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [homePresented, setHomePresented] = useState(false);
  const [slide, setSlide] = useState(0);

  const { state, loadMore, reload, nextWindow } = useCatalogue(
    kind,
    query,
    delay,
    failNext,
    mode,
    featured ? 80 : 160,
    category,
    sort,
    language,
  );

  // Home shows four rails of up to fifteen distinct titles. Publish the first
  // catalogue once so successive pages cannot recycle the hero during entry.
  const needsHomePage =
    featured &&
    !state.ended &&
    !state.error &&
    new Set(state.rows.flatMap(row => row.entries.map(film => film.id))).size <
      60;

  useEffect(() => {
    if (active && needsHomePage && !state.loading) {
      loadMore();
    }
  }, [active, needsHomePage, state.loading, state.rows, loadMore]);

  const initial = state.rows.length === 0;
  const pending = state.loading || (initial && !state.error && !state.ended);

  const loadingHome =
    (featured && initial && pending) || (!homePresented && needsHomePage);

  const featuredFilms = useMemo(() => {
    if (!featured || initial) return [];

    if (mode === 'fixture')
      return [
        hero,
        ...films
          .filter(value => value.kind === 'series' && value.art === 3)
          .slice(0, 1),
        ...films
          .filter(value => value.kind === 'movie' && value.art === 2)
          .slice(0, 1),
      ];

    return Array.from(
      new Map(
        state.rows.flatMap(row => row.entries).map(film => [film.id, film]),
      ).values(),
    ).slice(0, 3);
  }, [featured, initial, mode, state.rows]);

  const firstFeatured = featuredFilms[0];
  const featuredFilm = featuredFilms[slide] ?? firstFeatured;

  const featuredKeys = useMemo(
    () => heroTargets(id, featuredFilms, !!onGuide),
    [id, featuredFilms, onGuide],
  );

  useLayoutEffect(() => {
    if (active && loadingHome) onHomeLoading?.();
  }, [active, loadingHome, onHomeLoading]);

  const retryInitial = useRef(false);
  const commands = useFocusCommands();
  const retryFocused = useIsFocused(occurrenceKey(id, 'load-more'));

  const retry = useCallback(() => {
    retryInitial.current =
      !featured && Platform.OS === 'web' && initial && retryFocused;

    loadMore();
  }, [featured, initial, retryFocused, loadMore]);

  const viewport = Math.max(
    200 * u,
    viewportWidth || measuredWidth || width - 192 * u,
  );

  const fiveColumns = grid || searchResults;
  // Give the row name to its first card so VoiceOver cannot land on a
  // neighboring row's visual heading while the remote is idle.
  const nameHomeRows = featured && Platform.OS === 'ios' && Platform.isTV;
  const reader = useScreenReaderEnabled();

  const appleGrid =
    Platform.OS === 'ios' && Platform.isTV && fiveColumns && reader === false;

  const browserNavigation = useContext(BrowserNavigation);

  const autoPageGrid =
    appleGrid ||
    (Platform.OS === 'web' &&
      fiveColumns &&
      browserNavigation?.enabled === true);

  const columns = fiveColumns || featured ? 5 : 4;
  const cardGap = (featured ? 32 : 24) * u;
  // Each grid cell owns its gutter. Two half gutters leave the grid flush
  // with its viewport instead of giving a fixed row horizontal scroll range.
  const cardInset = fiveColumns ? cardGap / 2 : featured ? 52 * u : 0;

  const landscapeWidth =
    (viewport - 2 * cardInset - (columns - 1) * cardGap) / columns;

  const landscapeRowExtent = (landscapeWidth * 9) / 16 + 32 * u;

  // Search feedback takes 116 units above its 56-unit pagination button.
  const openFilmHeight = 471 * u;

  const rowExtent = searchResults
    ? Math.max(landscapeRowExtent, 172 * u)
    : grid
    ? landscapeRowExtent
    : featured
    ? landscapeRowExtent + 68 * u
    : 420 * u;

  const headerExtent = grid || searchResults ? 0 : (featured ? 54 : 58) * u;
  const posterWidth = (featured ? 160 : 220) * u;
  const posterHeight = (featured ? 240 : 330) * u;

  const previewWidth = Math.min(landscapeWidth * 2, viewport - cardInset * 2);

  const previewHeight = Math.min(
    (previewWidth * 9) / 16,
    rowExtent - headerExtent - 16 * u,
  );

  const { rails: guideRails, selected: guideSelection } = useHomeGuide(
    id,
    featured && !!onGuide,
    active,
    mode,
    viewport,
    onLive,
  );

  const curatedWidth = (viewport - 2 * cardInset - 3 * cardGap) / 4;

  const displayedRows = useMemo(() => {
    if (!featured) return grid ? layoutRows(state.rows, 'grid') : state.rows;

    const home = layoutRows(state.rows, 'home');

    if (!home.length) return home;

    const rows: Rail[] = [];
    const collections = collectionsForMode(mode);

    if (continueWatching?.length) {
      rows.push({
        id: 'continue-watching',
        title: 'Continue watching',
        format: 'landscape',
        entries: continueWatching.slice(0, 15).map(entry => entry.film),
      });
    }

    const liveEntries = liveChannels.map(
      (channel): Film => ({
        id: channel.id,
        title: channel.title,
        category: channel.category,
        art: 0,
        kind: 'movie',
        year: 0,
        synopsis: '',
      }),
    );

    rows.push(...home, {
      id: 'new-on-itar',
      title: 'New on Itar',
      format: 'landscape',
      entries: home
        .flatMap(row => row.entries)
        .filter(film => film.year > 0)
        .sort((a, b) => b.year - a.year)
        .slice(0, 8),
    });

    if (onLive)
      rows.push(
        {
          id: 'live-sports',
          title: 'Live sports',
          format: 'landscape',
          entries: liveEntries.filter(film => film.category === 'Sports'),
        },
        {
          id: 'coming-up-sports',
          title: 'Coming up in sports',
          format: 'landscape',
          entries: [],
        },
      );

    if (onGuide)
      rows.push({
        id: 'tv-guide',
        title: 'TV guide',
        format: 'landscape',
        entries: [],
      });

    rows.push(...chartRows(state.rows));

    if (onPlaySample)
      rows.push({
        id: 'open-films',
        title: 'Open films',
        format: 'landscape',
        entries: openFilmTitles,
      });

    rows.push({
      id: 'home-previews',
      title: 'Preview picks',
      format: 'landscape',
      entries: home[0].entries.slice(0, 6),
    });

    rows.push({
      id: 'home-recommendations',
      title: 'More recommendations',
      format: 'landscape',
      entries: Array.from(
        new Map(
          [
            ...collections[2].titles.slice(0, 3),
            ...collections[7].titles.slice(0, 3),
          ].map(title => [title.id, title]),
        ).values(),
      ),
    });

    if (onCollection && onCollections) {
      rows.push({
        id: 'curated-road',
        title: collections[0].name,
        format: 'poster',
        entries: collections.slice(0, 4).map(collection => ({
          ...collection.titles[0],
          id: collection.id,
          title: collection.name,
        })),
      });
    }

    rows.push({
      id: 'after-dark',
      title: 'After dark',
      format: 'landscape',
      entries: collections[1].titles,
    });

    if (onPlaySample && onLive) {
      rows.push(
        {
          id: 'kids-previews',
          title: 'Kids previews',
          format: 'landscape',
          entries: kidsSeries,
        },
        {
          id: 'family-favourites',
          title: 'Family favourites',
          format: 'poster',
          entries: familyMovies,
        },
        {
          id: 'kids-characters',
          title: 'Meet the characters',
          format: 'landscape',
          entries: kidsSeries,
        },
        {
          id: 'weekend-movies',
          title: 'Weekend movies',
          format: 'poster',
          entries: familyMovies.slice(0, 5),
        },
        {
          id: 'live-channels',
          title: 'Live channels',
          format: 'landscape',
          entries: liveEntries,
        },
      );
    }

    return rows;
  }, [
    state.rows,
    featured,
    grid,
    continueWatching,
    onPlaySample,
    onLive,
    onCollection,
    onCollections,
    onGuide,
    mode,
  ]);

  const last = displayedRows[displayedRows.length - 1];

  const endKeys =
    last?.entries
      .slice(autoPageGrid ? 0 : -2)
      .map(film => occurrenceKey(id, last.id, film.id)) ?? [];

  const model = useMemo(() => {
    const visuals = new Map<string, BrowseVisual>();
    const accent = { accentColor: highContrast ? '#FFFFFF' : colors.focus };

    const make = (
      key: string,
      label: string,
      onPress: () => void,
      contentId?: string,
    ): VirtualizedFocusItem => ({
      occurrenceKey: key,
      contentId,
      accessibilityLabel: t(label),
      labelSize: 24 * u,
      baseAccentColor: '#F4EEE4',
      focusStyle: accent,
      onPress,
    });

    const rails: VirtualizedFocusRail[] = [];
    const titles = new Map<string, string>();

    for (const rail of displayedRows) {
      const preview = featured && rail.id === 'home-previews';
      const kidsPreview = rail.id === 'kids-previews';
      const openFilms = rail.id === 'open-films';
      const weekend = rail.id === 'weekend-movies';
      const curated = rail.id === 'curated-road';

      const groupEnd =
        rail.id === 'live-sports' ||
        rail.id === homeCharts[1] ||
        rail.id === 'after-dark' ||
        rail.id === 'weekend-movies';

      const shelfGap = groupEnd ? 42 : 32;
      const live = rail.id === 'live-channels' || rail.id === 'live-sports';

      if (rail.id === 'tv-guide') {
        rails.push(...guideRails);

        continue;
      }

      if (!rail.entries.length) {
        titles.set(rail.id, t(rail.title));

        rails.push({
          id: rail.id,
          rowExtent: headerExtent + 54 * u + shelfGap,
          items: [],
          renderBody: () => (
            <Text style={[s.muted, s.homeInset]}>
              {rail.id === 'live-sports'
                ? t('No live sports feeds are available.')
                : t('No upcoming fixtures in the current schedule.')}
            </Text>
          ),
        });

        continue;
      }

      const chart = rail.id === homeCharts[0] || rail.id === homeCharts[1];
      const poster = !grid && !searchResults && rail.format === 'poster';

      const cardWidth = weekend
        ? Math.min(
            posterWidth * 1.5,
            (viewport - 2 * cardInset - 4 * 16 * u) / 6,
          )
        : curated
        ? curatedWidth
        : chart
        ? 296 * u
        : preview
        ? previewWidth
        : poster
        ? posterWidth
        : landscapeWidth;

      const imageHeight = weekend
        ? posterHeight * 1.5
        : curated
        ? 338 * u
        : chart
        ? 295 * u
        : preview
        ? previewHeight
        : poster
        ? posterHeight
        : (cardWidth * 9) / 16;

      const hasCaption =
        !poster &&
        !preview &&
        !kidsPreview &&
        !openFilms &&
        !chart &&
        rail.id !== 'continue-watching';

      titles.set(rail.id, t(rail.title));

      const items = rail.entries.map((film, index) => {
        const watching =
          rail.id === 'continue-watching'
            ? continueWatching?.[index]
            : undefined;

        const key = watching
          ? occurrenceKey(id, rail.id, film.source ?? 'fixture', film.id)
          : occurrenceKey(id, rail.id, film.id);

        const rank = chart ? index + 1 : undefined;

        visuals.set(key, {
          film,
          poster,
          preview,
          kidsPreview,
          watching,
          rank,
          live,
        });

        const label =
          (rank ? `Number ${rank}, ` : '') +
          `${film.title}, ${film.kind === 'movie' ? 'Movie' : 'Series'}` +
          (watching && watching.duration > 0
            ? `, ${Math.round(
                (watching.position / watching.duration) * 100,
              )}% watched`
            : '');

        let section: string | undefined;

        if (nameHomeRows && index === 0) section = rail.title;

        if (searchResults && rail === displayedRows[0] && index === 0) {
          section = query.trim()
            ? `${t('Results for')} ${query}`
            : t('Suggested titles');
        }

        return {
          ...make(
            key,
            tvControlLabel(label, section),
            () =>
              live && onLive
                ? onLive(key, rail.id === 'live-sports' ? film.id : undefined)
                : curated && onCollection
                ? onCollection(film.id, key)
                : onOpen(film, key),
            film.id,
          ),
          displayLabel: '',
          ...(rank
            ? {
                focusStyle: { accentColor: 'transparent' },
                baseAccentColor: 'transparent',
              }
            : {}),
        };
      });

      if (curated && onCollections) {
        const key = occurrenceKey(id, rail.id, 'all');

        items.push({
          ...make(key, 'All collections', () => onCollections(key)),
          displayLabel: '',
        });
      }

      rails.push({
        id: rail.id,
        horizontalAlignment:
          chart || openFilms || weekend || curated ? 'nearest' : undefined,
        leadingExtent: chart ? 285 * u : undefined,
        interactiveHeader: curated,
        headerExtent: chart ? 0 : undefined,
        rowExtent: featured
          ? (chart ? 0 : headerExtent) +
            (openFilms ? openFilmHeight : imageHeight) +
            (hasCaption ? 42 * u : 0) +
            shelfGap
          : undefined,
        itemExtent: cardWidth + cardGap,
        itemStyle: {
          marginStart: cardInset,
          width: cardWidth,
          height: imageHeight,
          borderRadius: 8 * u,
          backgroundColor: 'transparent',
        },
        items,
        renderBody:
          openFilms && onPlaySample
            ? () => (
                <OpenFilms
                  cards={items}
                  onPlay={onPlaySample}
                  height={openFilmHeight}
                  preview={active && previewsEnabled && !reader}
                  highContrast={highContrast}
                />
              )
            : weekend
            ? () => (
                <WeekendMovies
                  films={rail.entries}
                  cards={items}
                  height={imageHeight}
                  posterWidth={cardWidth}
                  highContrast={highContrast}
                  onOpen={onOpen}
                />
              )
            : curated
            ? () => (
                <View style={[s.homeInset, s.curatedRow, { gap: cardGap }]}>
                  {rail.entries.map((film, index) => {
                    const item = items[index];

                    return (
                      <Action
                        key={item.occurrenceKey}
                        id={item.occurrenceKey}
                        order={index}
                        label={film.title}
                        onPress={() =>
                          onCollection?.(film.id, item.occurrenceKey)
                        }
                        style={[s.curatedCover, { width: curatedWidth }]}
                      >
                        <Picture
                          source={filmArtwork(film, true)}
                          style={s.collectionCover}
                          fallback="Artwork unavailable"
                        />
                        <Text style={s.curatedCoverTitle} numberOfLines={2}>
                          {film.title}
                        </Text>
                      </Action>
                    );
                  })}
                </View>
              )
            : undefined,
      });
    }

    // In an automatically paged grid, a focused footer moves down with every
    // append. Keep navigation on the cards until the footer has a user action.
    const needsFooter =
      !autoPageGrid || initial || state.error || state.ended || retryFocused;

    if ((!featured || initial || state.error) && needsFooter) {
      const key = occurrenceKey(id, 'load-more');

      visuals.set(key, { feedback: true });

      const action = make(
        key,
        state.error
          ? 'Retry fetch'
          : pending
          ? 'Fetching stories…'
          : state.limitReached
          ? 'Continue to next titles'
          : state.ended
          ? 'Reload catalogue'
          : 'Load more stories',
        state.error
          ? retry
          : state.limitReached
          ? nextWindow
          : state.ended
          ? reload
          : loadMore,
      );

      rails.push({
        id: 'pagination',
        itemExtent: viewport,
        itemStyle: [s.pill, featured && s.homeInset],
        items: [
          {
            ...action,
            displayLabel: action.accessibilityLabel,
            accessibilityLabel: tvControlLabel(
              action.accessibilityLabel,
              state.error ||
                (initial && state.ended
                  ? 'No matching stories. Try a different title or genre.'
                  : undefined),
            ),
            // Keep a filter focused during the first fetch. A focused retry
            // stays mounted and eligible until its result is ready.
            enabled:
              !(grid || autoPageGrid) || !initial || !pending || retryFocused,
          },
        ],
      });
    }

    return { rails, visuals, titles };
  }, [
    displayedRows,
    colors.focus,
    t,
    active,
    previewsEnabled,
    reader,
    curatedWidth,
    openFilmHeight,
    s.curatedRow,
    s.curatedCover,
    s.curatedCoverTitle,
    s.collectionCover,
    onCollection,
    onCollections,
    nameHomeRows,
    autoPageGrid,
    grid,
    cardGap,
    cardInset,
    guideRails,
    headerExtent,
    onLive,
    s.muted,
    initial,
    id,
    highContrast,
    featured,
    viewport,
    u,
    s.pill,
    s.homeInset,
    landscapeWidth,
    previewWidth,
    posterHeight,
    posterWidth,
    previewHeight,
    continueWatching,
    state.error,
    state.ended,
    state.limitReached,
    pending,
    reload,
    nextWindow,
    loadMore,
    retry,
    retryFocused,
    searchResults,
    query,
    onOpen,
    onPlaySample,
  ]);

  const decoration = useCallback(
    (item: VirtualizedFocusItem) => {
      const visual = model.visuals.get(item.occurrenceKey);

      if (visual?.feedback) {
        return (
          <View style={featured && s.homeInset}>
            <CatalogueFeedback
              searchResults={searchResults}
              landscapeWidth={landscapeWidth}
              error={state.error}
              ended={state.ended}
              limitReached={state.limitReached}
              initial={initial}
              pending={pending}
            />
          </View>
        );
      }

      return null;
    },
    [
      model.visuals,
      landscapeWidth,
      state.error,
      state.limitReached,
      state.ended,
      initial,
      pending,
      searchResults,
      featured,
      s.homeInset,
    ],
  );

  const renderItem = useCallback(
    (item: VirtualizedFocusItem) => {
      const visual = model.visuals.get(item.occurrenceKey);

      if (!visual?.film) {
        return null;
      }

      if (visual.preview || visual.kidsPreview) {
        return (
          <HomePreviewCard
            film={visual.film}
            occurrence={item.occurrenceKey}
            width={visual.kidsPreview ? landscapeWidth : previewWidth}
            height={
              visual.kidsPreview ? (landscapeWidth * 9) / 16 : previewHeight
            }
            media={visual.kidsPreview ? bigBuckBunny : undefined}
          />
        );
      }

      if (visual.watching) {
        return (
          <ContinueWatchingCard
            entry={visual.watching}
            width={landscapeWidth}
            height={(landscapeWidth * 9) / 16}
          />
        );
      }

      if (visual.rank) {
        return (
          <ChartCard
            film={visual.film}
            rank={visual.rank}
            occurrence={item.occurrenceKey}
          />
        );
      }

      const sample = sampleFilm(visual.film.id);

      const cardWidth = visual.poster ? posterWidth : landscapeWidth;

      const artwork = (
        <Picture
          source={
            liveChannels.find(channel => channel.id === visual.film?.id)
              ?.artwork ??
            sample?.artwork ??
            filmArtwork(visual.film, visual.poster)
          }
          style={{
            width: cardWidth,
            height: visual.poster ? posterHeight : (cardWidth * 9) / 16,
            borderRadius: 8 * u,
          }}
          fallback="Artwork unavailable"
        />
      );

      return featured ? (
        <View accessible={false}>
          {artwork}
          {visual.live && <Text style={s.liveBadge}>● {t('LIVE')}</Text>}
          {(!visual.poster || !visual.film.posterUrl) && (
            <Text
              accessible={false}
              numberOfLines={visual.poster ? 2 : 1}
              style={visual.poster ? s.curatedCoverTitle : s.detailCardCaption}
            >
              {visual.film.title}
            </Text>
          )}
        </View>
      ) : (
        artwork
      );
    },
    [
      model.visuals,
      t,
      u,
      landscapeWidth,
      previewWidth,
      posterHeight,
      posterWidth,
      previewHeight,
      s,
      featured,
    ],
  );

  const railHeader = useCallback(
    (rail: VirtualizedFocusRail) => {
      const title = model.titles.get(rail.id);

      if (rail.leadingExtent && title)
        return (
          <Text
            accessible={nameHomeRows ? false : undefined}
            accessibilityRole="header"
            style={[s.chartLabel, s.homeInset]}
          >
            {title.replace('10 ', '10\n')}
          </Text>
        );

      if (rail.id === 'curated-road' && onCollections) {
        const key = occurrenceKey(id, rail.id, 'all');

        return (
          <View style={[s.homeInset, s.curatedHeader]}>
            <Text accessibilityRole="header" style={s.virtualHeading}>
              {title}
            </Text>
            <Action
              id={key}
              order={rail.items.length - 1}
              label="All collections"
              displayLabel="All collections  →"
              style={s.collectionLink}
              onPress={() => onCollections(key)}
              quiet
            />
          </View>
        );
      }

      return title ? (
        <Text
          accessible={nameHomeRows ? false : undefined}
          accessibilityRole="header"
          style={[s.virtualHeading, featured && s.homeInset]}
        >
          {title}
        </Text>
      ) : null;
    },
    [
      model.titles,
      onCollections,
      id,
      s.curatedHeader,
      s.collectionLink,
      s.virtualHeading,
      s.chartLabel,
      featured,
      s.homeInset,
      nameHomeRows,
    ],
  );

  const reportReady = useCallback(() => {
    if (featured && !initial) setHomePresented(true);

    if (retryInitial.current && !pending) {
      retryInitial.current = false;

      const row = displayedRows.find(value => value.entries.length > 0);
      const first = row?.entries[0];

      if (active && retryFocused && !state.error && row && first) {
        commands.focusByKey(occurrenceKey(id, row.id, first.id));
      }
    }

    onReady?.(
      featured && firstFeatured
        ? occurrenceKey(id, 'hero', firstFeatured.id)
        : occurrenceKey(id, 'load-more'),
    );
  }, [
    featured,
    initial,
    firstFeatured,
    onReady,
    id,
    pending,
    displayedRows,
    active,
    retryFocused,
    state.error,
    commands,
  ]);

  const content = (
    <View style={s.fill}>
      {Platform.OS === 'web' && !!state.error && (
        <View accessibilityRole="alert">
          <Text style={s.heading}>
            {initial
              ? 'Couldn’t load stories'
              : t('Couldn’t load more stories')}
          </Text>
          <Text style={s.muted}>{t(state.error)}</Text>
        </View>
      )}
      <View
        style={s.fill}
        onLayout={event => {
          const layout = event.nativeEvent.layout;

          // Keep the scroll window mounted while a hidden page has no size.
          if (layout.width > 0 && layout.height > 0) {
            setHeight(layout.height);
            setWidth(layout.width);
          }
        }}
      >
        {!featured && (
          <EndObserver
            keys={endKeys}
            active={active}
            blocked={!!state.error}
            onEnd={loadMore}
          />
        )}
        {height > 0 && !loadingHome && (
          <CinemaRails
            active={active}
            onEndReached={
              !featured &&
              !appleGrid &&
              !state.error &&
              !(autoPageGrid && retryFocused)
                ? loadMore
                : undefined
            }
            onReady={reportReady}
            id="catalogue"
            rails={model.rails}
            revealFullRow={featured}
            rowEntry={featured ? 'remembered' : 'nearest'}
            horizontalAlignment={featured ? 'pinned' : 'nearest'}
            rowExtent={rowExtent}
            itemExtent={landscapeWidth + cardGap}
            viewportExtent={viewport}
            viewportRows={1}
            viewportHeight={height}
            listHeader={
              featured && featuredFilm ? (
                <Hero
                  height={height}
                  previewsEnabled={previewsEnabled}
                  onGuide={onGuide}
                  film={featuredFilm}
                  slides={featuredFilms}
                  slide={slide}
                  setSlide={setSlide}
                  active={active}
                  id={id}
                  onOpen={onOpen}
                  onPlay={onPlaySample}
                  onSave={onSave}
                  saved={savedIds?.includes(featuredFilm.id)}
                  saveReady={saveReady}
                  highContrast={highContrast}
                />
              ) : undefined
            }
            listHeaderExtent={featured && featuredFilm ? height : 0}
            listHeaderScope={
              featured && featuredFilm ? 'hero-actions' : undefined
            }
            listHeaderItems={
              featuredFilm
                ? featuredKeys.filter(
                    item =>
                      (onSave ||
                        item.occurrenceKey !==
                          occurrenceKey(id, 'hero-list')) &&
                      (featuredFilms.length > 1 ||
                        item.occurrenceKey !==
                          occurrenceKey(id, 'hero-slide', featuredFilm.id)),
                  )
                : undefined
            }
            headerExtent={headerExtent}
            renderRailHeader={headerExtent > 0 ? railHeader : undefined}
            renderDecoration={decoration}
            renderItem={renderItem}
          />
        )}
        {height > 0 &&
          !loadingHome &&
          !initial &&
          (model.rails.reduce(
            (sum, rail) => sum + (rail.rowExtent ?? rowExtent),
            0,
          ) > height ||
            featured ||
            !state.ended ||
            state.limitReached) && (
            <ContentBelowCue
              rails={model.rails}
              active={active}
              hasNextPage={
                !featured &&
                !state.error &&
                (!state.ended || state.limitReached)
              }
              heroKey={
                featured && firstFeatured
                  ? occurrenceKey(id, 'hero', firstFeatured.id)
                  : undefined
              }
              guideKey={
                featured && onGuide
                  ? occurrenceKey(id, 'hero-guide')
                  : undefined
              }
            />
          )}
      </View>
    </View>
  );

  return featured ? (
    <HomePreviewProvider active={active && previewsEnabled}>
      <HomeGuideSelection value={guideSelection}>{content}</HomeGuideSelection>
    </HomePreviewProvider>
  ) : (
    content
  );
}

function ChartCard({
  film,
  rank,
  occurrence,
}: {
  film: Film;
  rank: number;
  occurrence: string;
}) {
  const { s } = useDesign();
  const focused = useIsFocused(occurrence);

  return (
    <View accessible={false} style={s.chartCard}>
      <Text
        accessible={false}
        style={[
          s.chartNumber,
          rank === 10 && s.chartTenth,
          focused && s.chartFirst,
        ]}
      >
        {rank}
      </Text>
      <View style={[s.chartFrame, focused && s.chartFrameFocused]}>
        <Picture
          source={filmArtwork(film, true)}
          style={s.chartPoster}
          fallback="Artwork unavailable"
        />
      </View>
    </View>
  );
}
