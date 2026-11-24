import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  Image,
  Platform,
  ScrollView,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';
import {
  FocusScope,
  FocusVirtualizedRails,
  occurrenceKey,
  useFocusState,
  useScreenReaderEnabled,
} from '@bougarnem/itar/react';
import type {
  VirtualizedFocusItem,
  VirtualizedFocusRail,
} from '@bougarnem/itar/react';
import { captionAccessible } from './tv-accessibility';
import { cast, films } from './catalog';
import type { CastMember, Film } from './catalog-types';
import {
  useBrowserFocusRoute,
  useBrowserPointerDown,
} from './browser-navigation';
import { Action } from './components/Action';
import { IconAction } from './components/IconAction';
import { Backdrop } from './components/Backdrop';
import { Picture } from './components/Picture';
import { icons, filmArtwork, portraits } from './artwork';
import { cachedDetails, loadDetails } from './detail-data';
import { detailTabs as tabs } from './navigation';
import { Metadata, PlaybackBadges } from './components/Metadata';
import type { EpisodePlayback } from './playback-history';
import { demoForTitle } from './demo-stream';
import { RecommendationsPlaceholder } from './components/RecommendationsPlaceholder';
import { useCinemaLanguage } from './language';
import { useDesign } from './theme';
import { Episodes, episodeGridLayout, fixtureSeasons } from './Episodes';
import { Reviews } from './Reviews';

const emptyCast: readonly CastMember[] = [];

export default function Details({
  film,
  active,
  onPlay,
  slow,
  waitForEpisode,
  waitForCast,
  saved,
  listReady,
  listError,
  onToggleSaved,
  resumeAvailable,
  onOpen,
  onPerson,
  highContrast,
  onReady,
  waitForRecommendations = false,
}: {
  film: Film;
  active: boolean;
  onPlay: (film: Film, episode?: EpisodePlayback) => void;
  slow: boolean;
  waitForEpisode: boolean;
  waitForCast: boolean;
  saved: boolean;
  listReady: boolean;
  listError: string;
  onToggleSaved: (film: Film) => void;
  resumeAvailable: boolean;
  onOpen: (film: Film, openerKey: string) => void;
  onPerson: (person: CastMember, openerKey: string) => void;
  highContrast: boolean;
  onReady?: () => void;
  waitForRecommendations?: boolean;
}) {
  const { t } = useCinemaLanguage();
  const { s, u, colors } = useDesign();
  const reader = useScreenReaderEnabled();
  const focus = useFocusState();
  const pointerDown = useBrowserPointerDown(Platform.OS === 'web' && active);
  const scroll = useRef<ScrollView>(null);
  const [screenHeight, setScreenHeight] = useState(0);
  const [heroHeight, setHeroHeight] = useState(0);
  const [tabsHeight, setTabsHeight] = useState(0);
  const [episodeFocused, setEpisodeFocused] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<number>();
  const [focusedSeason, setFocusedSeason] = useState<number>();
  const visibleOffset = useRef<number>(0);
  const focusedKey = focus.occurrenceKey;

  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [data, setData] = useState(() => cachedDetails(film));
  const info = data?.film ?? film;
  const demo = demoForTitle(info);
  const series = film.kind === 'series';
  const seasons = film.source ? data?.seasons : fixtureSeasons;
  const availableTabs = series ? (['Episodes', ...tabs] as const) : tabs;

  const people: readonly CastMember[] =
    data?.cast ?? (film.source ? emptyCast : cast);

  const related = useMemo(
    () =>
      data?.related ??
      (film.source
        ? []
        : films.filter(value => value.id !== film.id).slice(0, 8)),
    [data, film],
  );

  const [selectedTab, setSelectedTab] = useState<
    (typeof availableTabs)[number]
  >(
    waitForCast
      ? 'Cast & crew'
      : series && !waitForRecommendations
      ? 'Episodes'
      : 'More like this',
  );

  const focusedTab =
    active && focus.kind === 'managed'
      ? availableTabs.find(
          name => focusedKey === occurrenceKey('details', 'tab', name),
        )
      : undefined;

  const tab = focusedTab ?? selectedTab;

  useLayoutEffect(() => {
    if (focusedTab) setSelectedTab(focusedTab);
  }, [focusedTab]);

  const [error, setError] = useState('');
  const loading = !!film.source && !data && !error;
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!film.source) {
      return;
    }

    const request = new AbortController();

    loadDetails(film, request.signal).then(
      result => {
        if (!request.signal.aborted) {
          setData(result);
        }
      },
      reason => {
        if (!request.signal.aborted) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'Details could not load.',
          );
        }
      },
    );

    return () => request.abort();
  }, [film, attempt]);

  // Static controls become eligible on layout. Restoring a card waits for its rail.
  const waitForRail = waitForRecommendations || waitForCast;
  const laidOut = viewport.width > 0 && viewport.height > 0;

  useEffect(() => {
    if (active && laidOut && !waitForRail && !waitForEpisode) onReady?.();
  }, [active, laidOut, waitForRail, waitForEpisode, onReady]);

  const castTab = tab === 'Cast & crew';

  const loadingRecommendations =
    tab === 'More like this' && loading && related.length === 0;

  const cardGap = 24 * u;

  const landscapeWidth = Math.max(160 * u, (viewport.width - 3 * cardGap) / 4);
  const portraitWidth = 180 * u;
  const landscapeHeight = (landscapeWidth * 9) / 16;
  const cardWidth = castTab ? portraitWidth : landscapeWidth;
  const imageHeight = castTab ? portraitWidth : landscapeHeight;
  const captionHeight = 48 * u;
  const cardHeight = imageHeight + captionHeight;

  const heroActions = ['play', 'list', 'like'].map(name =>
    occurrenceKey('details', name),
  );

  const onHero = !!focusedKey && heroActions.includes(focusedKey);

  const tabKey = occurrenceKey('details', 'tab', tab);

  const reviewKeys =
    occurrenceKey('details', film.id, 'review').slice(0, -1) + ',';

  const episodeReveal = tab === 'Episodes' && !focusedTab && episodeFocused;

  const scrollTo = useCallback((y: number) => {
    if (visibleOffset.current === y) return;

    visibleOffset.current = y;
    scroll.current?.scrollTo({ y, animated: false });
  }, []);

  const episodeGrid = episodeGridLayout(viewport.width, u);

  const panelHeight = Math.max(
    landscapeHeight + captionHeight,
    330 * u,
    series ? episodeGrid.seasonRowHeight + 18 * u + episodeGrid.cardHeight : 0,
  );

  // Every tab uses the same preview height so the tabs stay at the same y.
  // Leave some artwork visible even when the episode grid needs more room.
  const availableScroll = heroHeight - tabsHeight - screenHeight * 0.12;
  const previewScroll = heroHeight + panelHeight + 46 * u - screenHeight;

  const revealOffset = Math.round(
    Math.max(0, Math.min(availableScroll, previewScroll)),
  );

  const episodeOffset = Math.round(
    Math.max(0, Math.min(availableScroll, previewScroll + screenHeight * 0.15)),
  );

  const offset = onHero ? 0 : episodeReveal ? episodeOffset : revealOffset;

  const episodeViewportHeight =
    screenHeight && heroHeight
      ? screenHeight + episodeOffset - heroHeight - s.detailSections.paddingTop
      : viewport.height;

  useEffect(() => {
    if (
      !active ||
      !heroHeight ||
      !screenHeight ||
      !focusedKey ||
      focus.kind !== 'managed' ||
      pointerDown.current
    )
      return;

    scrollTo(offset);
  }, [
    active,
    focus.kind,
    focusedKey,
    heroHeight,
    offset,
    pointerDown,
    screenHeight,
    scrollTo,
  ]);

  const model = useMemo(() => {
    const visuals = new Map<
      string,
      { title: string; source?: ImageSourcePropType }
    >();

    const make = (
      key: string,
      label: string,
      onPress: () => void,
    ): VirtualizedFocusItem => ({
      occurrenceKey: key,
      accessibilityLabel: label,
      displayLabel: '',
      outlineInsetBottom: captionHeight,
      baseAccentColor: '#F4EEE4',
      focusStyle: { accentColor: highContrast ? '#FFFFFF' : colors.focus },
      onPress,
    });

    const items = castTab
      ? people.map(member => {
          const key = occurrenceKey('details', film.id, 'cast', member.id);

          visuals.set(key, {
            title: member.name,
            source: member.portraitUrl
              ? { uri: member.portraitUrl }
              : film.source
              ? undefined
              : portraits[member.id],
          });

          return make(key, `${member.name}, ${member.role}`, () =>
            onPerson(member, key),
          );
        })
      : related.map(value => {
          const key = occurrenceKey('details', film.id, 'related', value.id);

          visuals.set(key, { title: value.title, source: filmArtwork(value) });

          return make(key, value.title, () => onOpen(value, key));
        });

    const rails: VirtualizedFocusRail[] = [
      {
        id: tab,
        itemExtent: cardWidth + cardGap,
        itemStyle: {
          width: cardWidth,
          height: cardHeight,
          marginEnd: cardGap,
          borderRadius: 8 * u,
          backgroundColor: 'transparent',
        },
        items,
      },
    ];

    return { rails, visuals };
  }, [
    tab,
    castTab,
    onPerson,
    people,
    related,
    film.id,
    film.source,
    cardWidth,
    cardGap,
    cardHeight,
    captionHeight,
    onOpen,
    colors.focus,
    highContrast,
    u,
  ]);

  useBrowserFocusRoute(active, (key, direction) => {
    if (direction === 'ArrowDown' && heroActions.includes(key)) return tabKey;

    if (
      direction === 'ArrowUp' &&
      (key.startsWith(reviewKeys) ||
        key === occurrenceKey('details', 'retry-reviews') ||
        key === occurrenceKey('details', 'retry') ||
        model.rails.some(rail =>
          rail.items.some(item => item.occurrenceKey === key),
        ))
    )
      return tabKey;
  });

  const renderItem = useCallback(
    (item: VirtualizedFocusItem) => {
      const visual = model.visuals.get(item.occurrenceKey);

      if (!visual) return null;

      return (
        <View>
          <Picture
            source={visual.source}
            style={{
              width: cardWidth,
              height: imageHeight,
              borderRadius: 8 * u,
            }}
            fallback={castTab ? 'Portrait unavailable' : 'Artwork unavailable'}
          />
          <Text
            accessible={captionAccessible}
            numberOfLines={1}
            style={[s.detailCardCaption, s.detailText]}
          >
            {visual.title}
          </Text>
        </View>
      );
    },
    [
      model.visuals,
      castTab,
      u,
      cardWidth,
      imageHeight,
      s.detailCardCaption,
      s.detailText,
    ],
  );

  const information = [
    t(info.status || 'Status unavailable') +
      (info.seasons
        ? ` · ${t('{seasons} seasons · {episodes} episodes', {
            seasons: info.seasons,
            episodes: info.episodes ?? '—',
          })}`
        : ''),
    t('Languages: {languages} · Countries: {countries}', {
      languages: info.languages || t('Not provided'),
      countries: info.countries || t('Not provided'),
    }),
    t('Studios: {studios}', { studios: info.studios || t('Not provided') }),
    t('TMDB rating: {rating}', {
      rating: info.votes
        ? t('{rating} / 10 from {votes} votes', {
            rating: info.rating?.toFixed(1) ?? '—',
            votes: info.votes.toLocaleString(),
          })
        : t('Not yet rated'),
    }),
    t(
      'Subtitles: availability not provided · Audio description: availability not provided',
    ),
    t('Sample video: {asset}. {credit}.', {
      asset: demo.name,
      credit: demo.credit,
    }),
  ].filter(Boolean);

  const playAction = (
    <Action
      id={occurrenceKey('details', 'play')}
      label={resumeAvailable ? 'Resume demo' : 'Play demo'}
      tvDescription={`${info.title}. ${t('{asset} demo playback', {
        asset: demo.name,
      })}.`}
      displayLabel={resumeAvailable ? '▶  Resume demo' : '▶  Play demo'}
      onPress={() => onPlay(info)}
      highContrast={highContrast}
      primary
      style={s.primaryCta}
    />
  );

  return (
    <ScrollView
      ref={scroll}
      style={s.detailScroll}
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
      onLayout={event => {
        if (event.nativeEvent.layout.height > 0)
          setScreenHeight(event.nativeEvent.layout.height);
      }}
    >
      <View
        style={[s.detailTop, { minHeight: screenHeight || 625 * u }]}
        onLayout={event => setHeroHeight(event.nativeEvent.layout.height)}
      >
        <Backdrop
          film={info}
          catalogueFilm={film}
          details={!series}
          highContrast={highContrast}
        />
        <View style={[s.heroCopy, series && s.seriesCopy]}>
          {series && (
            <Text accessible={false} style={s.seriesKicker}>
              {t('Series')}
            </Text>
          )}
          <Text
            accessible={captionAccessible}
            accessibilityRole="header"
            numberOfLines={2}
            style={[s.heroTitle, s.detailText, series && s.seriesTitle]}
          >
            {info.title}
          </Text>
          {series ? (
            <Text style={s.muted}>
              {[
                info.year,
                info.category,
                info.seasons &&
                  `${info.seasons} ${
                    info.seasons === 1 ? 'season' : 'seasons'
                  }`,
                info.rating !== undefined &&
                  info.votes &&
                  `★ ${info.rating.toFixed(1)}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          ) : (
            <Metadata film={info} />
          )}
          {series && data?.networks.some(network => network.logoUrl) && (
            <View style={s.networks}>
              {data.networks.map(
                network =>
                  network.logoUrl && (
                    <Image
                      key={network.id}
                      accessible
                      accessibilityLabel={network.name}
                      source={{ uri: network.logoUrl }}
                      resizeMode="contain"
                      style={s.networkLogo}
                    />
                  ),
              )}
            </View>
          )}
          <PlaybackBadges
            demo={demo}
            rating={info.certification}
            region={info.certificationRegion}
          />
          {!series && (
            <Text accessible={captionAccessible} style={s.muted}>
              {t(info.category)}
              {info.tagline ? ` · ${info.tagline}` : ''}
            </Text>
          )}
          <Text
            accessible={captionAccessible}
            numberOfLines={3}
            style={[s.body, s.detailText]}
          >
            {info.synopsis}
          </Text>
          <FocusScope
            id="detail-actions"
            layout="row"
            boundary="parent"
            style={s.heroActions}
          >
            {playAction}
            <Action
              order={1}
              id={occurrenceKey('details', 'list')}
              label={saved ? 'Remove from My List' : 'Add to My List'}
              displayLabel={saved ? '✓  In My List' : '＋  My List'}
              tvDescription={t(listError)}
              enabled={listReady}
              onPress={() => onToggleSaved(info)}
              highContrast={highContrast}
              primary
              style={s.primaryCta}
            />
            {!series && (
              <IconAction
                order={2}
                id={occurrenceKey('details', 'like')}
                label="Like"
                tvDescription="Focus-only demo control."
                icon={icons.like}
                onPress={() => {}}
                highContrast={highContrast}
              />
            )}
          </FocusScope>
          <Text accessible={captionAccessible} style={s.footer}>
            {t('{asset} demo playback', { asset: demo.name })}
            {!series && ` · ${t('Like is a focus-only control')}`}
          </Text>
          {!!listError && (
            <Text
              accessible={captionAccessible}
              accessibilityLiveRegion="polite"
              style={s.muted}
            >
              {t(listError)}
            </Text>
          )}
        </View>
        <View
          style={s.detailTabBar}
          onLayout={event => setTabsHeight(event.nativeEvent.layout.height)}
        >
          <FocusScope
            id="detail-tabs"
            layout="row"
            boundary="parent"
            restoreOnEntry
            preferredKey={tabKey}
            style={[s.tabs, s.seriesTabs]}
          >
            {availableTabs.map((name, index) => (
              <Action
                key={name}
                order={index}
                id={occurrenceKey('details', 'tab', name)}
                label={`${name}${tab === name ? ', selected' : ''}`}
                tvDescription={
                  name === 'Information'
                    ? 'Select to read the synopsis and title information.'
                    : tab === name &&
                      (name === 'More like this' || name === 'Cast & crew')
                    ? loading
                      ? 'Loading title information'
                      : !model.rails[0].items.length
                      ? t(
                          name === 'More like this'
                            ? 'No recommendations for this title.'
                            : 'No cast information for this title.',
                        )
                      : undefined
                    : undefined
                }
                displayLabel={name}
                onPress={() => {
                  if (
                    name === 'Information' &&
                    captionAccessible === false &&
                    reader
                  ) {
                    AccessibilityInfo.announceForAccessibility(
                      [
                        info.title,
                        info.year,
                        info.kind,
                        info.category,
                        info.tagline,
                        info.runtime && `${info.runtime} minutes`,
                        info.certification || 'Age rating unavailable',
                        info.synopsis,
                        ...information,
                      ]
                        .filter(Boolean)
                        .join('. '),
                    );
                  }

                  setSelectedTab(name);

                  if (heroHeight && screenHeight) scrollTo(revealOffset);
                }}
                quiet
                highContrast={highContrast}
                style={[s.tab, s.seriesTab, tab === name && s.seriesSelected]}
              />
            ))}
          </FocusScope>
        </View>
      </View>
      <View style={[s.detailSections, { minHeight: screenHeight }]}>
        <Image
          source={require('../assets/cinematic/detail-gradient.png')}
          style={s.detailGradient}
          resizeMode="stretch"
          accessible={false}
        />
        {error ? (
          <View style={s.row}>
            <Text accessible={captionAccessible} style={s.muted}>
              {t(error)}
            </Text>
            <Action
              id={occurrenceKey('details', 'retry')}
              label="Retry details"
              tvDescription={t(error)}
              onPress={() => {
                setError('');
                setAttempt(value => value + 1);
              }}
            />
          </View>
        ) : (
          loading &&
          !loadingRecommendations && (
            <Text accessible={captionAccessible} style={s.muted}>
              {t('Loading title information…')}
            </Text>
          )
        )}
        <View
          style={[
            s.fill,
            { minHeight: Math.max(260 * u, screenHeight - 144 * u) },
          ]}
          onLayout={event => {
            const { width, height } = event.nativeEvent.layout;

            if (width > 0 && height > 0) setViewport({ width, height });
          }}
        >
          {tab === 'Episodes' ? (
            seasons?.length ? (
              <Episodes
                film={film}
                seasons={seasons}
                selectedSeason={selectedSeason}
                focusedSeason={focusedSeason}
                onSelectSeason={setSelectedSeason}
                onFocusSeason={setFocusedSeason}
                width={viewport.width}
                height={episodeViewportHeight}
                active={active}
                highContrast={highContrast}
                slow={slow}
                onReady={waitForEpisode ? onReady : undefined}
                onEpisodeFocus={setEpisodeFocused}
                onPlay={episode => onPlay(info, episode)}
              />
            ) : (
              !loading &&
              !error && (
                <Text style={s.muted}>
                  {t('No seasons available for this series.')}
                </Text>
              )
            )
          ) : tab === 'Reviews' ? (
            <Reviews
              film={film}
              active={active}
              slow={slow}
              width={viewport.width}
              height={viewport.height}
              highContrast={highContrast}
            />
          ) : tab === 'Information' ? (
            <View style={s.information}>
              {information.map((line, index) => (
                <Text
                  accessible={captionAccessible}
                  key={line}
                  style={
                    index === 0
                      ? s.body
                      : index === information.length - 1
                      ? s.footer
                      : s.muted
                  }
                >
                  {line}
                </Text>
              ))}
            </View>
          ) : (
            <FocusScope
              id="detail-card-entry"
              boundary="parent"
              restoreOnEntry={!castTab}
              preferredKey={
                castTab ? undefined : model.rails[0].items[0]?.occurrenceKey
              }
            >
              {viewport.width > 0 && viewport.height > 0 && (
                <FocusVirtualizedRails
                  id="title-content"
                  active={active}
                  rails={model.rails}
                  horizontalAlignment={castTab ? 'nearest' : 'pinned'}
                  onReady={waitForRail && !loading ? onReady : undefined}
                  rowExtent={cardHeight}
                  itemExtent={cardWidth + cardGap}
                  viewportExtent={viewport.width}
                  viewportHeight={Math.min(viewport.height, cardHeight)}
                  renderItem={renderItem}
                />
              )}
              {loadingRecommendations && <RecommendationsPlaceholder />}
              {!loading && !error && !model.rails[0].items.length && (
                <Text accessible={captionAccessible} style={s.muted}>
                  {t(
                    castTab
                      ? 'No cast information for this title.'
                      : 'No recommendations for this title.',
                  )}
                </Text>
              )}
            </FocusScope>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
