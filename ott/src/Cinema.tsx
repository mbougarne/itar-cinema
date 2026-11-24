import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Platform,
  Text,
  TVFocusGuideView,
  View,
} from 'react-native';
import {
  FocusScope,
  occurrenceKey,
  useFocusCommands,
  useFocusReady,
  useFocusState,
  useScreenReaderEnabled,
  type FocusState,
} from '@bougarnem/itar/react';
import Auth from './Auth';
import Epg from './Epg';
import Browse from './Browse';
import Catalogue from './Catalogue';
import Search from './Search';
import { Sports } from './Sports';
import { Live } from './Live';
import { filmArtwork } from './artwork';
import { liveChannels, pickLiveChannel, type LiveChannel } from './live-source';
import { Collections, Kids } from './Discovery';
import { hasDeviceProxy } from './tmdb';
import Details from './Details';
import { PersonDetails } from './PersonDetails';
import Player from './Player';
import type { EpisodePlayback } from './playback-history';
import { usePlaybackChoices } from './usePlaybackChoices';
import { demoForTitle, sampleFilm } from './demo-stream';
import MyList from './MyList';
import { libraryId } from './profile-library';
import { useProfileLibrary } from './useProfileLibrary';
import { Profiles } from './Profiles';
import { useCinemaProfiles } from './cinema-profiles';
import { Settings } from './Settings';
import { Sidebar } from './Sidebar';
import {
  detailControlKeys,
  screens,
  subtitles,
  type Screen,
} from './navigation';
import { androidVerticalBoundary } from './android-focus-boundary';
import { useCinemaLanguage } from './language';
import { useDesign } from './theme';
import { useAppleTVMenu } from './useAppleTVMenu';
import { useSidebarRight } from './useSidebarRight';
import type { CastMember, ProviderMode, Film } from './catalog-types';
import { BrowserNavigation } from './browser-navigation';
import { readBrowserSession, saveBrowserSession } from './browser-session';

type DetailsVisit = { film: Film; openerKey: string; person?: CastMember };

type ReturnRail = 'episode' | 'cast';

const HomeBrowse = memo(Browse);
const appleTV = Platform.OS === 'ios' && Platform.isTV;

const ContentPane = appleTV ? TVFocusGuideView : View;

const webContentOrder = Platform.OS === 'web' ? { order: 1 } : {};

function CinemaShell(props: React.ComponentProps<typeof View>) {
  if (Platform.OS !== 'web') return <View {...props} />;

  // Overscan can put mounted cards behind the sidebar. The two regions keep
  // their left-to-right order regardless of either rail's scroll offset.
  return (
    <View {...props}>
      <FocusScope id="shell" layout="row" style={props.style}>
        {props.children}
      </FocusScope>
    </View>
  );
}

const sidebarKeys = new Set(
  [...screens, 'profile-switcher', 'signout'].map(name =>
    occurrenceKey('nav', name),
  ),
);

type CinemaProps = { onOpenProbes?: () => void };

type HomeArrival = { key: string; onFocus: () => void };

// Watch host input focus here. The route tree only needs the sidebar boundary,
// and a new managed observation dismisses any outstanding navigation notice.
export default function Cinema(props: CinemaProps) {
  const focus = useFocusState();
  const observedFocus = useRef(focus);
  const homeArrival = useRef<HomeArrival | null>(null);

  useLayoutEffect(() => {
    observedFocus.current = focus;

    const arrival = homeArrival.current;

    if (
      arrival &&
      focus.kind === 'managed' &&
      focus.occurrenceKey === arrival.key
    ) {
      homeArrival.current = null;
      arrival.onFocus();
    }
  }, [focus]);

  const [notice, setNotice] = useState('');

  const expanded =
    focus.kind === 'managed' &&
    focus.occurrenceKey !== null &&
    sidebarKeys.has(focus.occurrenceKey);

  useEffect(() => {
    if (focus.kind === 'managed') setNotice('');
  }, [focus]);

  return (
    <CinemaRoutes
      {...props}
      expanded={expanded}
      observedFocus={observedFocus}
      homeArrival={homeArrival}
      notice={notice}
      setNotice={setNotice}
    />
  );
}

const CinemaRoutes = memo(function RouteTree({
  onOpenProbes,
  expanded,
  observedFocus,
  homeArrival,
  notice,
  setNotice,
}: CinemaProps & {
  expanded: boolean;
  observedFocus: React.RefObject<FocusState>;
  homeArrival: React.RefObject<HomeArrival | null>;
  notice: string;
  setNotice: (value: string) => void;
}) {
  const { language, t } = useCinemaLanguage();
  const { s } = useDesign();
  const reader = useScreenReaderEnabled();
  const readerLayout = appleTV && reader === true;
  const systemBackAtRoot = useContext(BrowserNavigation)?.systemBackAtRoot;
  const [savedSession] = useState(readBrowserSession);
  const [authenticated, setAuthenticated] = useState(!!savedSession);
  const [guideOpener, setGuideOpener] = useState<string>();

  const [liveVisit, setLiveVisit] = useState<{
    channel: LiveChannel;
    opener: string;
  }>();

  const modalOpen = !!guideOpener || !!liveVisit;

  const [mode, setMode] = useState<ProviderMode>(
    savedSession?.mode ??
      (Platform.OS === 'web' && !hasDeviceProxy ? 'fixture' : 'proxy'),
  );

  const [screen, setScreen] = useState<Screen>(
    savedSession ? 'Home' : 'Profile',
  );

  const [collectionEntry, setCollectionEntry] = useState<{
    id?: string;
    opener: string;
  }>();

  const [detailsHistory, setDetailsHistory] = useState<DetailsVisit[]>([]);
  const visit = detailsHistory[detailsHistory.length - 1];
  const film = visit?.film;
  const person = visit?.person;

  const [playback, setPlayback] = useState<{
    film: Film;
    opener?: string;
    episode?: EpisodePlayback;
    returnToEpisode?: boolean;
  }>();

  const [startedPlayback, setStartedPlayback] = useState<typeof playback>();

  const onPlaybackStarted = useCallback(
    () => setStartedPlayback(playback),
    [playback],
  );

  const playingFilm = playback?.film;
  const activeMedia = playingFilm && demoForTitle(playingFilm);
  const playing = !!playback;
  const [profile, setProfile] = useState(savedSession?.profile ?? 'Explorer');
  const roster = useCinemaProfiles();
  const selectedProfile = roster.profiles.find(value => value.id === profile);
  const { library, store } = useProfileLibrary(profile);

  const savedIds = useMemo(
    () => library.saved.map(entry => entry.id),
    [library.saved],
  );

  const [contrast, setContrast] = useState(false);
  const [previews, setPreviews] = useState(true);
  const [slow, setSlow] = useState(false);
  const [entryVersion, setEntryVersion] = useState(0);
  const [entering, setEntering] = useState(true);
  const [loadingHome, setLoadingHome] = useState(false);
  const [homeEntryKey, setHomeEntryKey] = useState<string>();
  const [pendingEntry, setPendingEntry] = useState<(() => void) | null>(null);
  const exitPrompt = useRef(false);
  const fail = useRef(false);
  const [failureArmed, setFailureArmed] = useState(false);

  useEffect(() => {
    saveBrowserSession(authenticated ? { mode, profile } : null);
  }, [authenticated, mode, profile]);

  const takeFailure = useCallback(() => {
    const next = fail.current;

    fail.current = false;
    setFailureArmed(false);

    return next;
  }, []);

  const commands = useFocusCommands();
  const ready = useFocusReady();
  const [returnKey, setReturnKey] = useState<string>();
  const [readerLanding, setReaderLanding] = useState<string>();
  const [returnRail, setReturnRail] = useState<ReturnRail>();
  const [readerMenuEntry, setReaderMenuEntry] = useState(false);

  useEffect(() => {
    if (expanded || !readerLayout) setReaderMenuEntry(false);
  }, [expanded, readerLayout]);

  const entered = useRef('');
  const focusBeforeEntry = useRef(observedFocus.current);

  const entryRequest = useRef<ReturnType<typeof commands.focusByKey> | null>(
    null,
  );

  const homeLoadingStarted = useCallback(() => {
    homeArrival.current = null;
    setHomeEntryKey(undefined);
    setLoadingHome(true);
    // A retry replaces the failed Home entry with a new set of targets.
    entered.current = '';
    setEntering(true);
  }, [homeArrival]);

  const beginEntry = useCallback(
    (change: () => void, openerKey?: string, rail?: ReturnRail) => {
      // Keep Android's temporary fallback focus out of sidebar history while
      // the previous content unmounts and the next target becomes ready.
      entryRequest.current?.cancel();
      entryRequest.current = null;
      homeArrival.current = null;
      entered.current = '';
      setEntering(true);
      setReturnKey(openerKey);
      setReturnRail(rail);
      setNotice('');
      setReaderLanding(undefined);
      setReaderMenuEntry(false);
      setPendingEntry(() => change);
      setHomeEntryKey(undefined);
    },
    [homeArrival, setNotice],
  );

  useEffect(() => {
    // Commit the sidebar and page entry guards before removing focused content.
    if (pendingEntry) {
      focusBeforeEntry.current = observedFocus.current;
      pendingEntry();
      setPendingEntry(null);
    }
  }, [pendingEntry, observedFocus]);

  const page = `${profile}:${mode}:${screen}`;

  const openPlayer = useCallback(
    (value: Film, episode?: EpisodePlayback) =>
      beginEntry(() =>
        setPlayback({
          film: value,
          episode,
          opener: episode?.opener,
          returnToEpisode: !!episode,
        }),
      ),
    [beginEntry],
  );

  const openSample = useCallback(
    (value: Film, opener: string) => {
      beginEntry(() => setPlayback({ film: value, opener }));
    },
    [beginEntry],
  );

  const switchPlayback = useCallback(
    (value: Film, episode?: EpisodePlayback) => {
      setPlayback(previous =>
        previous ? { ...previous, film: value, episode } : previous,
      );
    },
    [],
  );

  const choices = usePlaybackChoices(
    playback === startedPlayback ? playingFilm : undefined,
    playback?.episode,
    switchPlayback,
  );

  const closeFilm = useCallback(() => {
    if (visit) {
      let opener: string | undefined = visit.openerKey;

      if (detailsHistory.length === 1) {
        const id = libraryId(visit.film);

        const watchingKey = occurrenceKey(
          page,
          'continue-watching',
          visit.film.source ?? 'fixture',
          visit.film.id,
        );

        // An unpinned title or a finished demo may have removed its own opener.
        if (
          (screen === 'My List' &&
            !library.saved.some(saved => libraryId(saved) === id)) ||
          (screen === 'Home' &&
            opener === watchingKey &&
            !library.watching.some(entry => libraryId(entry.film) === id))
        ) {
          opener = undefined;
        }
      }

      beginEntry(
        () => setDetailsHistory(history => history.slice(0, -1)),
        opener,
        visit.person ? 'cast' : undefined,
      );
    }
  }, [
    beginEntry,
    visit,
    detailsHistory.length,
    library.saved,
    library.watching,
    screen,
    page,
  ]);

  const closePlayer = useCallback(() => {
    beginEntry(
      () => setPlayback(undefined),
      playback?.opener,
      playback?.returnToEpisode ? 'episode' : undefined,
    );
  }, [beginEntry, playback]);

  const recordPlayback = useCallback(
    (position: number, duration: number, finished: boolean) => {
      if (playingFilm)
        store.progress(playingFilm, position, duration, finished);
    },
    [playingFilm, store],
  );

  const openFilm = useCallback(
    (value: Film, openerKey: string) => {
      beginEntry(() =>
        setDetailsHistory(history => [
          ...history,
          { film: value.source ? { ...value, language } : value, openerKey },
        ]),
      );
    },
    [beginEntry, language],
  );

  const openPerson = useCallback(
    (member: CastMember, openerKey: string) => {
      if (film)
        beginEntry(() =>
          setDetailsHistory(history => [
            ...history,
            { film, person: member, openerKey },
          ]),
        );
    },
    [beginEntry, film],
  );

  const restoreNavigation = useCallback(() => {
    commands
      .restoreScope(
        Platform.OS === 'web' ? ['shell', 'navigation'] : ['navigation'],
      )
      .result.then(result => {
        if (result.status !== 'applied' && result.status !== 'cancelled') {
          setNotice('Navigation focus could not be restored.');
        }
      });
  }, [commands, setNotice]);

  const returnToPage = useCallback(() => {
    const focus = observedFocus.current;

    if (
      focus.kind === 'managed' &&
      focus.occurrenceKey &&
      sidebarKeys.has(focus.occurrenceKey)
    ) {
      commands.restoreScope(['page']);
    }
  }, [observedFocus, commands]);

  useSidebarRight(
    expanded &&
      authenticated &&
      !film &&
      screen === 'Home' &&
      !entering &&
      !playing &&
      !modalOpen,
    returnToPage,
  );

  // At the top-level sidebar the Siri Remote's Menu button belongs to tvOS.
  // The sign-in form manages its own Menu lifetime before authentication.
  const hasBackRoute =
    authenticated &&
    (modalOpen ||
      playing ||
      !!film ||
      screen === 'Profile' ||
      (!appleTV && screen === 'Settings') ||
      !expanded);

  useAppleTVMenu(hasBackRoute);

  useLayoutEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!authenticated || modalOpen) {
        return false;
      }

      if (playing) {
        closePlayer();

        return true;
      }

      if (film) {
        closeFilm();

        return true;
      }

      if (appleTV && expanded && screen !== 'Profile') return false;

      if (screen === 'Profile' || screen === 'Settings') {
        beginEntry(() => setScreen('Home'));

        return true;
      }

      if (!expanded) {
        entryRequest.current?.cancel();
        entryRequest.current = null;
        entered.current = `${page}:${entryVersion}`;
        setEntering(false);
        setLoadingHome(false);

        if (readerLayout) setReaderMenuEntry(true);
        else restoreNavigation();

        return true;
      }

      if (systemBackAtRoot || (Platform.OS === 'ios' && Platform.isTV))
        return false;

      if (!exitPrompt.current) {
        exitPrompt.current = true;

        const cancelExit = () => {
          exitPrompt.current = false;
          restoreNavigation();
        };

        Alert.alert(
          'Exit Itar?',
          Platform.OS === 'android'
            ? 'Would you like to exit the application?'
            : 'Use the Home button on your remote to leave Itar.',
          Platform.OS === 'android'
            ? [
                { text: 'Cancel', style: 'cancel', onPress: cancelExit },
                { text: 'Exit', onPress: () => BackHandler.exitApp() },
              ]
            : [{ text: 'Cancel', onPress: cancelExit }],
          {
            cancelable: true,
            onDismiss: cancelExit,
          },
        );
      }

      return true;
    });

    return () => handler.remove();
  }, [authenticated, modalOpen, film, playing, screen, expanded, closeFilm, closePlayer, restoreNavigation, beginEntry, page, entryVersion, systemBackAtRoot, readerLayout]);

  useEffect(() => {
    if (
      !ready ||
      !authenticated ||
      readerLayout ||
      modalOpen ||
      film ||
      playing ||
      screen !== 'Profile'
    ) {
      return;
    }

    const request = commands.focusByKey(occurrenceKey('profiles', profile));

    return () => request.cancel();
  }, [commands, ready, authenticated, readerLayout, modalOpen, film, playing, screen, profile, page]);

  const collectionReady = useCallback(
    (initialKey?: string) => {
      if (playing || modalOpen || pendingEntry) {
        return;
      }

      const route = person
        ? `person:${person.id}`
        : film
        ? `details:${film.id}`
        : `${page}:${entryVersion}`;

      if (entered.current === route) {
        return;
      }

      const key =
        returnKey ??
        initialKey ??
        (film ? occurrenceKey('details', 'play') : undefined);

      if (!key) {
        return;
      }

      entered.current = route;

      if (readerLayout) {
        setReaderLanding(key);

        setReturnKey(undefined);
        setEntering(false);

        return;
      }

      // The snapshot changes when the host observes a different key or mount.
      // Keep an early move on this screen, even across two Details visits.
      const focus = observedFocus.current;

      if (
        film &&
        !person &&
        !returnKey &&
        focus !== focusBeforeEntry.current &&
        focus.kind === 'managed' &&
        focus.occurrenceKey &&
        detailControlKeys.has(focus.occurrenceKey)
      ) {
        setEntering(false);

        return;
      }

      const request =
        Platform.OS === 'android' && returnKey
          ? commands.restoreFocusByKey(key)
          : commands.focusByKey(key);

      entryRequest.current = request;

      if (
        Platform.OS === 'ios' &&
        Platform.isTV &&
        screen === 'Home' &&
        !film &&
        !returnKey &&
        key !== occurrenceKey(page, 'load-more')
      ) {
        // Only a fresh input observation of this hero may open the sidebar
        // before its command receipt. UIKit still owns the initial landing.
        homeArrival.current = {
          key,
          onFocus: () => {
            if (entryRequest.current === request) setEntering(false);
          },
        };
      }

      request.result.then(result => {
        if (entryRequest.current !== request) {
          return;
        }

        homeArrival.current = null;
        setReturnKey(undefined);

        entryRequest.current = null;
        setEntering(false);

        if (result.status !== 'applied' && result.status !== 'cancelled') {
          setNotice('Continue with your remote.');
        }
      });
    },
    [
      commands,
      homeArrival,
      readerLayout,
      observedFocus,
      setNotice,
      film,
      person,
      page,
      screen,
      playing,
      modalOpen,
      entryVersion,
      pendingEntry,
      returnKey,
    ],
  );

  const navigate = (name: Screen) => {
    beginEntry(() => {
      setEntryVersion(value => value + 1);
      setDetailsHistory([]);
      setCollectionEntry(undefined);
      setScreen(name);
    });
  };

  const openCollections = useCallback(
    (opener: string, id?: string) => {
      beginEntry(() => {
        setEntryVersion(value => value + 1);
        setCollectionEntry({ id, opener });
        setScreen('Collections');
      });
    },
    [beginEntry],
  );

  const openCollection = useCallback(
    (id: string, opener: string) => {
      openCollections(opener, id);
    },
    [openCollections],
  );

  const leaveCollections = useCallback(() => {
    beginEntry(() => {
      setCollectionEntry(undefined);
      setScreen('Home');
    }, collectionEntry?.opener);
  }, [beginEntry, collectionEntry]);

  const homeReady = useCallback(
    (key?: string) => {
      if (loadingHome) {
        if (!key) return;

        setHomeEntryKey(key);
        setLoadingHome(false);

        return;
      }

      if (!homeEntryKey) collectionReady(key);
    },
    [loadingHome, homeEntryKey, collectionReady],
  );

  useEffect(() => {
    // Dispatch after the loader and the scope preference have committed together.
    if (!loadingHome && homeEntryKey && !film && screen === 'Home') {
      collectionReady(homeEntryKey);
    }
  }, [loadingHome, homeEntryKey, film, screen, collectionReady]);

  const closeGuide = useCallback(() => {
    beginEntry(() => setGuideOpener(undefined), guideOpener);
  }, [beginEntry, guideOpener]);

  const closeLive = useCallback(() => {
    beginEntry(
      () => setLiveVisit(undefined),
      guideOpener ? undefined : liveVisit?.opener,
    );
  }, [beginEntry, guideOpener, liveVisit]);

  const openLive = useCallback(
    (channel: LiveChannel, opener: string) => {
      beginEntry(() => setLiveVisit({ channel, opener }));
    },
    [beginEntry],
  );

  const liveChoices = useMemo(
    () =>
      liveVisit
        ? liveChannels.map(channel => ({
            key: channel.id,
            title: channel.title,
            artwork: channel.artwork,
            note: channel.category,
            current: channel.id === liveVisit.channel.id,
            play: () => {
              setLiveVisit(current =>
                current ? { ...current, channel } : undefined,
              );
            },
          }))
        : undefined,
    [liveVisit],
  );

  const openRandomLive = useCallback(
    (opener: string, channelId?: string) =>
      openLive(
        liveChannels.find(channel => channel.id === channelId) ??
          pickLiveChannel(),
        opener,
      ),
    [openLive],
  );

  const openGuide = useCallback(
    (openerKey: string) => beginEntry(() => setGuideOpener(openerKey)),
    [beginEntry],
  );

  if (!authenticated) {
    return (
      <Auth
        onSignIn={() => {
          setAuthenticated(true);
          setScreen('Profile');
        }}
      />
    );
  }

  const options = {
    mode,
    id: page,
    active: !film && !playing && !modalOpen,
    delay: slow ? 650 : 180,
    failNext: takeFailure,
    highContrast: contrast,
    onOpen: openFilm,
    onReady: collectionReady,
  };

  if (screen === 'Profile' && !film) {
    return (
      <FocusScope
        id="profile-chooser"
        layout="spatial"
        style={s.fill}
        accessibilityPaneTitle={readerLayout ? 'Who’s exploring?' : undefined}
        preferredKey={
          readerLayout ? occurrenceKey('profiles', profile) : undefined
        }
      >
        <Profiles
          id="profiles"
          profile={profile}
          profiles={roster.profiles}
          onSave={roster.ready ? roster.save : undefined}
          onBack={() => navigate('Home')}
          highContrast={contrast}
          onSelect={name => {
            beginEntry(() => {
              setProfile(name);
              setScreen('Home');
            });
          }}
        />
      </FocusScope>
    );
  }

  const signOut = () => {
    saveBrowserSession(null);
    setReturnKey(undefined);
    entered.current = '';
    setDetailsHistory([]);
    setPlayback(undefined);
    setScreen('Profile');
    setAuthenticated(false);
  };

  const showHomeLoader =
    loadingHome && screen === 'Home' && !film && !playing && !modalOpen;

  const homeLoader = showHomeLoader && (
    <View style={[s.hiddenPlayer, s.splash]}>
      <ActivityIndicator accessible={false} color="#26D9F2" size="large" />
      <Text accessibilityLiveRegion="polite" style={s.body}>
        {t('Loading Home…')}
      </Text>
    </View>
  );

  return (
    <View style={s.fill}>
      <CinemaShell
        {...(Platform.OS === 'web' && showHomeLoader
          ? { inert: true, 'aria-hidden': true }
          : {})}
        accessibilityElementsHidden={
          playing || modalOpen || (showHomeLoader && !readerLayout)
        }
        importantForAccessibility={
          showHomeLoader ? 'no-hide-descendants' : 'auto'
        }
        style={[s.shell, (playing || modalOpen) && s.hidden]}
      >
        {!film && screen !== 'Settings' && (
          <Sidebar
            readerEntry={readerLayout && readerMenuEntry}
            reserveWidth={readerLayout}
            active={!playing && !modalOpen && !entering && !showHomeLoader}
            expanded={expanded || readerLayout}
            profile={selectedProfile?.name ?? 'Explorer'}
            avatar={selectedProfile?.avatar}
            contrast={contrast}
            mode={mode}
            screen={screen}
            onNavigate={navigate}
            onSignOut={signOut}
          />
        )}
        <ContentPane
          {...(appleTV
            ? { autoFocus: readerLayout && !film, accessible: false }
            : {})}
          // Use the TV fork's native View flags without adding a focus owner.
          {...androidVerticalBoundary}
          style={[
            s.content,
            ['Home', 'Settings', 'Collections', 'Kids'].includes(screen) &&
              !film &&
              s.homeContent,
          ]}
        >
          <FocusScope
            id="page"
            {...webContentOrder}
            restoreOnEntry={screen === 'Home'}
            accessibilityPaneTitle={
              !film &&
              !playing &&
              !modalOpen &&
              !entering &&
              (Platform.OS === 'android' || (readerLayout && readerLanding))
                ? screen
                : undefined
            }
            active={!film && !playing && !modalOpen}
            // During Home entry or a return, only the intended target may
            // receive Android's automatic fallback until the request settles.
            entryReady={
              !showHomeLoader &&
              (!entering ||
                (Platform.OS === 'android' && !returnKey && !homeEntryKey))
            }
            preferredKey={
              readerLayout && !entering
                ? readerLanding
                : Platform.OS === 'android' && entering
                ? returnKey ?? homeEntryKey
                : undefined
            }
            boundary="parent"
            style={[
              s.fill,
              film && s.hidden,
              readerLayout && showHomeLoader && s.loadingContent,
            ]}
          >
            <FocusScope
              key={page}
              id={page}
              layout="spatial"
              boundary="parent"
              style={s.fill}
            >
              {screen !== 'Home' &&
                screen !== 'Kids' &&
                screen !== 'Collections' &&
                screen !== 'Settings' && (
                  <>
                    <Text
                      accessible={appleTV ? false : undefined}
                      accessibilityRole="header"
                      style={s.pageTitle}
                    >
                      {t(screen)}
                    </Text>
                    <Text
                      accessible={appleTV ? false : undefined}
                      style={s.subtitle}
                    >
                      {t(subtitles[screen])}
                    </Text>
                  </>
                )}
              {screen === 'Home' && (
                <HomeBrowse
                  {...options}
                  kind="all"
                  featured
                  continueWatching={library.watching}
                  onGuide={openGuide}
                  onCollection={openCollection}
                  onCollections={openCollections}
                  onLive={openRandomLive}
                  onPlaySample={openSample}
                  savedIds={savedIds}
                  onSave={store.toggle}
                  saveReady={library.ready}
                  previewsEnabled={previews}
                  onHomeLoading={homeLoadingStarted}
                  onReady={homeReady}
                />
              )}
              {screen === 'Movies' && <Catalogue {...options} kind="movie" />}
              {screen === 'Series' && <Catalogue {...options} kind="series" />}
              {screen === 'Live TV' && (
                <Live
                  active={options.active}
                  onReady={collectionReady}
                  onGuide={openGuide}
                  onWatch={openLive}
                />
              )}
              {screen === 'Sports' && (
                <Sports
                  active={options.active}
                  highContrast={contrast}
                  onReady={collectionReady}
                  onPlay={openSample}
                />
              )}
              {screen === 'Search' && <Search {...options} />}
              {screen === 'Collections' && (
                <Collections
                  {...options}
                  initialCollection={collectionEntry?.id}
                  onBack={collectionEntry ? leaveCollections : undefined}
                />
              )}
              {screen === 'Kids' && (
                <Kids
                  active={options.active}
                  previewsEnabled={previews}
                  highContrast={contrast}
                  onReady={collectionReady}
                  onPlay={openSample}
                  onOpen={openFilm}
                />
              )}
              {screen === 'My List' && (
                <MyList
                  {...options}
                  saved={library.saved}
                  error={library.error}
                  ready={library.ready}
                  onBrowse={() => navigate('Home')}
                  onRetry={store.retry}
                />
              )}
              {screen === 'Settings' && (
                <Settings
                  onBack={() => navigate('Home')}
                  onSignOut={signOut}
                  onReady={collectionReady}
                  mode={mode}
                  onMode={() => {
                    beginEntry(() =>
                      setMode(value =>
                        value === 'proxy' ? 'fixture' : 'proxy',
                      ),
                    );
                  }}
                  id={page}
                  contrast={contrast}
                  onContrast={() => setContrast(value => !value)}
                  previews={previews}
                  onPreviews={() => setPreviews(value => !value)}
                  onProfiles={() => navigate('Profile')}
                  slow={slow}
                  onSlow={() => setSlow(value => !value)}
                  armed={failureArmed}
                  onArm={() => {
                    fail.current = !fail.current;
                    setFailureArmed(fail.current);
                  }}
                  onOpenProbes={onOpenProbes}
                />
              )}
            </FocusScope>
          </FocusScope>
          <FocusScope
            id="details"
            {...webContentOrder}
            restoreOnEntry={appleTV}
            accessibilityPaneTitle={
              !entering &&
              (Platform.OS === 'android' || (readerLayout && readerLanding))
                ? person?.name ?? film?.title
                : undefined
            }
            boundary="parent"
            active={!!film && !playing}
            entryReady={!entering || (Platform.OS === 'android' && !returnKey)}
            preferredKey={
              readerLayout && !entering
                ? readerLanding
                : Platform.OS === 'android' && entering
                ? returnKey
                : undefined
            }
            style={[s.detailLayer, !film && s.hidden]}
          >
            {film &&
              (person ? (
                <PersonDetails
                  key={person.id}
                  film={film}
                  member={person}
                  restoreCredit={!!returnKey}
                  onReady={collectionReady}
                  onOpen={openFilm}
                  highContrast={contrast}
                />
              ) : (
                <Details
                  active={!playing}
                  onReady={collectionReady}
                  waitForRecommendations={!!returnKey && !returnRail}
                  waitForEpisode={!!returnKey && returnRail === 'episode'}
                  waitForCast={!!returnKey && returnRail === 'cast'}
                  slow={slow}
                  key={film.id}
                  film={film}
                  onOpen={openFilm}
                  onPerson={openPerson}
                  onPlay={openPlayer}
                  saved={library.saved.some(
                    item => libraryId(item) === libraryId(film),
                  )}
                  listReady={library.ready}
                  listError={library.error}
                  onToggleSaved={store.toggle}
                  resumeAvailable={library.watching.some(
                    item => libraryId(item.film) === libraryId(film),
                  )}
                  highContrast={contrast}
                />
              ))}
          </FocusScope>
          {!!notice && (
            <Text pointerEvents="none" style={[s.footer, s.navigationNotice]}>
              {notice}
            </Text>
          )}
          {readerLayout && homeLoader}
        </ContentPane>
      </CinemaShell>
      {!readerLayout && homeLoader}
      {guideOpener && (
        <View style={s.hiddenPlayer}>
          <Epg
            onClose={closeGuide}
            onTune={openRandomLive}
            active={!liveVisit}
            mode={mode}
          />
        </View>
      )}
      {liveVisit && (
        <View style={s.hiddenPlayer}>
          <Player
            key={liveVisit.channel.id}
            artwork={liveVisit.channel.artwork}
            media={liveVisit.channel.media}
            channels={liveChoices}
            languages={selectedProfile}
            title={liveVisit.channel.title}
            onClose={closeLive}
          />
        </View>
      )}
      {playingFilm && (
        <View style={s.hiddenPlayer}>
          <Player
            key={playback?.episode?.opener ?? playingFilm.id}
            media={activeMedia}
            artwork={
              sampleFilm(playingFilm.id)?.artwork ?? filmArtwork(playingFilm)
            }
            choices={choices}
            onPlaybackStarted={onPlaybackStarted}
            autoNext={selectedProfile?.autoNext}
            languages={selectedProfile}
            title={
              playback?.episode
                ? `${playingFilm.title} · ${t(playback.episode.label)}`
                : playingFilm.title
            }
            onClose={closePlayer}
            onCheckpoint={
              playback?.episode || sampleFilm(playingFilm.id)
                ? undefined
                : recordPlayback
            }
            startPosition={
              playback?.episode || sampleFilm(playingFilm.id)
                ? undefined
                : library.watching.find(
                    item =>
                      libraryId(item.film) === libraryId(playingFilm) &&
                      (activeMedia?.duration === undefined ||
                        Math.abs(item.duration - activeMedia.duration) < 2),
                  )?.position
            }
          />
        </View>
      )}
    </View>
  );
});
