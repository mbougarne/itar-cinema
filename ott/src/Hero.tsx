import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AccessibilityInfo, Text, View } from 'react-native';
import {
  FocusScope,
  occurrenceKey,
  useFocusState,
  useScreenReaderEnabled,
} from '@bougarnem/itar/react';
import { captionAccessible, tvControlLabel } from './tv-accessibility';
import type { Film } from './catalog-types';
import { cachedDetails, loadDetails } from './detail-data';
import { Action } from './components/Action';
import { Backdrop } from './components/Backdrop';
import { Picture } from './components/Picture';
import { filmArtwork } from './artwork';
import { demoForTitle } from './demo-stream';
import { useCinemaLanguage } from './language';
import { useDesign } from './theme';
import { useBrowserFocusRoute } from './browser-navigation';
import { PreviewSession } from './components/HomePreviewCard';
import { Metadata, PlaybackBadges } from './components/Metadata';

export function heroTargets(
  id: string,
  slides: readonly Film[],
  canGuide: boolean,
) {
  if (!slides.length) return [];

  const keys = [
    {
      occurrenceKey: occurrenceKey(id, 'hero', slides[0].id),
      accessibilityLabel: 'Play demo',
    },
    {
      occurrenceKey: occurrenceKey(id, 'hero-list'),
      accessibilityLabel: 'Add to My List',
    },
    {
      occurrenceKey: occurrenceKey(id, 'hero-details'),
      accessibilityLabel: 'More info',
    },
    ...slides.map(film => ({
      occurrenceKey: occurrenceKey(id, 'hero-slide', film.id),
      accessibilityLabel: `Feature ${film.title}`,
    })),
  ];

  if (canGuide)
    keys.push({
      occurrenceKey: occurrenceKey(id, 'hero-guide'),
      accessibilityLabel: 'TV guide',
    });

  return keys;
}

export default function Hero({
  film,
  slides = [film],
  slide = 0,
  setSlide,
  active = true,
  height,
  previewsEnabled = false,
  id,
  onOpen,
  onPlay,
  onSave,
  saved = false,
  saveReady = true,
  highContrast,
  onGuide,
}: {
  film: Film;
  slides?: readonly Film[];
  slide?: number;
  setSlide?: (index: number) => void;
  active?: boolean;
  height?: number;
  previewsEnabled?: boolean;
  id: string;
  onOpen: (film: Film, openerKey: string) => void;
  onPlay?: (film: Film, openerKey: string) => void;
  onSave?: (film: Film) => void;
  onGuide?: (openerKey: string) => void;
  saved?: boolean;
  saveReady?: boolean;
  highContrast: boolean;
}) {
  const { t, rtl } = useCinemaLanguage();
  const { s, u } = useDesign();
  const [metadata, setMetadata] = useState(() => cachedDetails(film)?.film);
  const details = metadata?.id === film.id ? metadata : film;
  const [reducedMotion, setReducedMotion] = useState(false);
  const reader = useScreenReaderEnabled();
  const focus = useFocusState();
  const keys = heroTargets(id, slides, !!onGuide);

  const focusedKey = focus.kind === 'managed' ? focus.occurrenceKey : undefined;

  const thumbnail = slides.findIndex(
    title => occurrenceKey(id, 'hero-slide', title.id) === focusedKey,
  );

  const ctaFocused = focusedKey === keys[0]?.occurrenceKey;
  const demo = demoForTitle(details);
  const [previewedTitle, setPreviewedTitle] = useState<Film>();
  const markPreviewed = useCallback(() => setPreviewedTitle(film), [film]);
  const canPlay = !!onPlay && previewedTitle === film;

  useEffect(() => setPreviewedTitle(undefined), [active, film]);

  const preview =
    active &&
    previewsEnabled &&
    !reader &&
    !reducedMotion &&
    (ctaFocused || thumbnail === slide) &&
    !!demo.preview;

  useEffect(() => {
    if (active && thumbnail >= 0 && thumbnail !== slide) setSlide?.(thumbnail);
  }, [active, setSlide, slide, thumbnail]);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled?.().then(value => {
      if (mounted) setReducedMotion(value);
    });

    const listener = AccessibilityInfo.addEventListener?.(
      'reduceMotionChanged',
      setReducedMotion,
    );

    return () => {
      mounted = false;
      listener?.remove();
    };
  }, []);

  useEffect(() => {
    if (!film.source || !active) return;

    const request = new AbortController();

    loadDetails(film, request.signal).then(
      result => {
        if (!request.signal.aborted) setMetadata(result.film);
      },
      () => {},
    );

    return () => request.abort();
  }, [film, active]);

  useEffect(() => {
    if (
      !active ||
      thumbnail >= 0 ||
      reader ||
      reducedMotion ||
      slides.length < 2 ||
      !setSlide
    )
      return;

    const timer = setTimeout(
      () => setSlide((slide + 1) % slides.length),
      preview ? 13_750 : 6500,
    );

    return () => clearTimeout(timer);
  }, [
    active,
    preview,
    reader,
    reducedMotion,
    slides.length,
    slide,
    setSlide,
    thumbnail,
  ]);

  const playKey = keys[0].occurrenceKey;
  const infoKey = keys[2].occurrenceKey;
  const guideKey = occurrenceKey(id, 'hero-guide');

  const thumbnailKey =
    slides.length > 1 && slides[slide]
      ? occurrenceKey(id, 'hero-slide', slides[slide].id)
      : undefined;

  const saveKey = keys[1].occurrenceKey;

  const actions = useMemo(
    () => [
      playKey,
      ...(onSave && saveReady ? [saveKey] : []),
      infoKey,
      ...(onGuide ? [guideKey] : []),
    ],
    [playKey, onSave, saveReady, saveKey, infoKey, onGuide, guideKey],
  );

  const lastAction = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (active && focusedKey && actions.includes(focusedKey)) {
      lastAction.current = focusedKey;
    }
  }, [active, actions, focusedKey]);

  const actionEntry =
    lastAction.current && actions.includes(lastAction.current)
      ? lastAction.current
      : playKey;

  useBrowserFocusRoute(active, (key, direction) => {
    const index = actions.indexOf(key);
    const horizontal = direction === 'ArrowRight' || direction === 'ArrowLeft';
    const step = (direction === 'ArrowRight') !== rtl ? 1 : -1;

    if (index >= 0) {
      if (horizontal) {
        // The leading edge of the CTA row still opens the sidebar.
        return (
          actions[index + step] ??
          (step > 0 ? false : rtl ? occurrenceKey('nav', 'Home') : undefined)
        );
      }

      if (direction === 'ArrowDown') {
        lastAction.current = key;

        return thumbnailKey;
      }

      return false;
    }

    const thumbnailIndex =
      slides.length > 1
        ? slides.findIndex(
            title => occurrenceKey(id, 'hero-slide', title.id) === key,
          )
        : -1;

    if (thumbnailIndex < 0) return;

    if (direction === 'ArrowUp')
      return actions.find(action => action === lastAction.current) ?? playKey;

    if (horizontal) {
      const next = slides[thumbnailIndex + step];

      return next ? occurrenceKey(id, 'hero-slide', next.id) : false;
    }
  });

  return (
    <View style={[s.homeHero, height !== undefined && { height }]}>
      <Backdrop
        film={details}
        catalogueFilm={film}
        preview={
          preview ? (
            <PreviewSession
              key={`${film.id}:${focusedKey}`}
              dwellMs={3000}
              media={demo}
              onPlaying={markPreviewed}
            />
          ) : undefined
        }
      />
      <FocusScope id="hero" layout="column" boundary="parent" style={s.fill}>
        <View style={s.homeHeroStage}>
          <View style={s.homeHeroCopy}>
            <Text accessible={captionAccessible} style={s.seriesKicker}>
              {t('Featured title')}
            </Text>
            <Text
              accessibilityRole="header"
              accessible={captionAccessible}
              numberOfLines={2}
              style={s.homeHeroTitle}
            >
              {details.title}
            </Text>
            <Metadata film={details} />
            <Text
              accessible={captionAccessible}
              numberOfLines={3}
              style={[s.body, s.homeHeroSynopsis]}
            >
              {details.synopsis}
            </Text>
            <PlaybackBadges
              demo={demo}
              rating={details.certification}
              region={details.certificationRegion}
            />
            <FocusScope
              id="hero-actions"
              layout="row"
              boundary="parent"
              restoreOnEntry
              preferredKey={actionEntry}
              style={s.homeHeroActions}
            >
              <Action
                id={playKey}
                label={canPlay ? 'Play demo' : 'Open title details'}
                tvDescription={tvControlLabel(
                  details.title,
                  `${demo.name} demo`,
                )}
                displayLabel="▶  Play"
                primary
                style={s.heroPlay}
                highContrast={highContrast}
                onPress={() => (canPlay ? onPlay : onOpen)?.(details, playKey)}
              />
              {onSave && (
                <Action
                  order={1}
                  id={keys[1].occurrenceKey}
                  label={saved ? 'Remove from My List' : 'Add to My List'}
                  displayLabel={saved ? '✓  In My List' : '＋  Add to My List'}
                  enabled={saveReady}
                  style={s.heroListAction}
                  highContrast={highContrast}
                  onPress={() => onSave(details)}
                />
              )}
              <Action
                order={2}
                id={infoKey}
                label={t('More info for {title}', { title: details.title })}
                displayLabel="ⓘ"
                style={s.heroRoundAction}
                highContrast={highContrast}
                onPress={() => onOpen(details, infoKey)}
              />
              {onGuide && (
                <Action
                  order={3}
                  id={guideKey}
                  label="TV guide"
                  style={s.heroGuideAction}
                  highContrast={highContrast}
                  onPress={() => onGuide(guideKey)}
                />
              )}
            </FocusScope>
          </View>
          {slides.length > 1 && (
            <View style={s.heroThumbnails}>
              <View style={s.heroThumbnailHeading}>
                <Text accessible={false} style={s.homeHeroLabel}>
                  {t('In the spotlight')}
                </Text>
                <Text accessible={false} style={s.homeHeroLabel}>
                  {slide + 1} / {slides.length}
                </Text>
              </View>
              <FocusScope
                id="hero-thumbnails"
                layout="row"
                boundary="parent"
                restoreOnEntry
                preferredKey={thumbnailKey}
                style={s.heroThumbnailRow}
              >
                {slides.map((title, index) => (
                  <Action
                    key={title.id}
                    order={index}
                    id={keys[index + 3].occurrenceKey}
                    label={t(
                      slide === index
                        ? 'Feature {title}, selected'
                        : 'Feature {title}',
                      { title: title.title },
                    )}
                    highContrast={highContrast}
                    style={[
                      s.heroThumbnail,
                      slide === index && s.heroThumbnailSelected,
                    ]}
                    onPress={() => setSlide?.(index)}
                  >
                    <Picture
                      source={filmArtwork(title)}
                      fallback="Artwork unavailable"
                      style={{
                        width: 118 * u,
                        height: 66 * u,
                        borderRadius: 5 * u,
                      }}
                    />
                  </Action>
                ))}
              </FocusScope>
            </View>
          )}
        </View>
      </FocusScope>
    </View>
  );
}
