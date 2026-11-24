import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ScrollView, Text, View } from 'react-native';
import {
  FocusVirtualizedRails,
  occurrenceKey,
  useScreenReaderEnabled,
} from '@bougarnem/itar/react';
import type { CastMember, Film, Person } from './catalog-types';
import { filmArtwork, portraits } from './artwork';
import { films } from './catalog';
import { cachedPerson, loadPerson } from './detail-data';
import { Action } from './components/Action';
import { Picture } from './components/Picture';
import { useCinemaLanguage } from './language';
import { useDesign } from './theme';
import { captionAccessible } from './tv-accessibility';

export function PersonDetails({
  film,
  member,
  restoreCredit,
  highContrast,
  onReady,
  onOpen,
}: {
  film: Film;
  member: CastMember;
  restoreCredit: boolean;
  highContrast: boolean;
  onReady: (key?: string) => void;
  onOpen: (film: Film, opener: string) => void;
}) {
  const { t } = useCinemaLanguage();
  const { s, u, colors } = useDesign();
  const reader = useScreenReaderEnabled();
  const [width, setWidth] = useState(0);
  const biographyView = useRef<ScrollView>(null);
  const offset = useRef(0);
  const maximum = useRef(0);
  const visibleHeight = useRef(0);
  const contentHeight = useRef(0);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState(false);

  const [person, setPerson] = useState<Person | undefined>(() =>
    film.source
      ? cachedPerson(film, member)
      : {
          biography: member.bio || 'No biography available.',
          portraitUrl: null,
          credits: films.filter(value => value.id !== film.id).slice(0, 5),
        },
  );

  const bioKey = occurrenceKey('person', member.id, 'biography');

  useEffect(() => {
    if (person) return;

    const request = new AbortController();

    loadPerson(film, member, request.signal).then(
      value => {
        if (!request.signal.aborted) setPerson(value);
      },
      () => {
        if (!request.signal.aborted) setError(true);
      },
    );

    return () => request.abort();
  }, [film, member, attempt, person]);

  useEffect(() => {
    if (!restoreCredit && width > 0) onReady(bioKey);
  }, [bioKey, restoreCredit, onReady, width]);

  const facts = [
    person?.department && ['Known for', person.department],
    person?.creditCount !== undefined && [
      'Credited titles',
      String(person.creditCount),
    ],
    person?.birthday && ['Born', person.birthday],
    person?.deathday && ['Died', person.deathday],
    person?.birthplace && ['Place of birth', person.birthplace],
    person?.aliases?.length
      ? ['Also known as', person.aliases.join(', ')]
      : undefined,
  ].filter((value): value is string[] => Array.isArray(value));

  const portrait = person?.portraitUrl ?? member.portraitUrl;

  const biography =
    person?.biography ??
    (error ? 'Could not load person details.' : 'Loading biography…');

  const measureBiography = () => {
    maximum.current = Math.max(
      0,
      contentHeight.current - visibleHeight.current,
    );
  };

  const gap = 22 * u;
  const cardWidth = Math.min(385 * u, (width - 4 * gap) / 4);
  const stillHeight = (cardWidth * 9) / 16;
  const height = stillHeight + 52 * u;

  const credits = new Map(
    (person?.credits ?? [])
      .filter(value => value.id !== film.id)
      .map(value => [
        occurrenceKey('person', member.id, 'credit', value.id),
        value,
      ]),
  );

  return (
    <View
      style={s.detailContent}
      onLayout={event => setWidth(event.nativeEvent.layout.width - 80 * u)}
    >
      <View style={s.personHero}>
        <Picture
          source={portrait ? { uri: portrait } : portraits[member.id]}
          fallback="Portrait unavailable"
          style={{ width: 270 * u, height: 336 * u, borderRadius: 12 * u }}
        />
        <View style={[s.fill, s.seriesCopy]}>
          <Text
            accessibilityRole="header"
            accessible={captionAccessible}
            numberOfLines={2}
            style={s.heroTitle}
          >
            {member.name}
          </Text>
          <Text accessible={captionAccessible} style={s.muted}>
            {member.role}
          </Text>
          {!!facts.length && (
            <View style={s.badges}>
              {facts.map(([label, value]) => (
                <Text key={label} style={s.badge}>
                  {t(label)} · {value}
                </Text>
              ))}
            </View>
          )}
          <Text accessibilityRole="header" style={s.virtualHeading}>
            {t('Biography')}
          </Text>
          <ScrollView
            ref={biographyView}
            showsVerticalScrollIndicator={false}
            style={s.personBiography}
            onContentSizeChange={(_, measuredHeight) => {
              contentHeight.current = measuredHeight;
              measureBiography();
            }}
            onLayout={event => {
              visibleHeight.current = event.nativeEvent.layout.height;
              measureBiography();
            }}
            onScroll={event => {
              offset.current = event.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={32}
          >
            <Text accessible={captionAccessible} style={s.biographyText}>
              {t(biography)}
            </Text>
          </ScrollView>
          <Action
            id={bioKey}
            label={error ? 'Retry person details' : 'Scroll biography'}
            tvDescription={`${member.name}. ${member.role}. ${facts
              .map(([label, value]) => `${t(label)}: ${value}`)
              .join('. ')}`}
            highContrast={highContrast}
            primary
            style={s.primaryCta}
            onPress={() => {
              if (error) {
                setError(false);
                setAttempt(value => value + 1);

                return;
              }

              const next =
                offset.current >= maximum.current - 1
                  ? 0
                  : Math.min(
                      maximum.current,
                      offset.current + visibleHeight.current * 0.85,
                    );

              biographyView.current?.scrollTo({ y: next, animated: false });

              if (reader && captionAccessible === false)
                AccessibilityInfo.announceForAccessibility(biography);
            }}
          />
        </View>
      </View>
      <View style={s.personCredits}>
        <Text accessibilityRole="header" style={s.heading}>
          {t('Known for')}
        </Text>
        {width > 0 && credits.size > 0 ? (
          <FocusVirtualizedRails
            id="person-credits"
            viewportRows={1}
            horizontalAlignment="pinned"
            viewportExtent={width}
            rowExtent={height}
            itemExtent={cardWidth + gap}
            onReady={restoreCredit ? onReady : undefined}
            rails={[
              {
                id: 'credits',
                itemStyle: {
                  width: cardWidth,
                  height,
                  marginEnd: gap,
                  backgroundColor: 'transparent',
                },
                items: [...credits].map(([key, value]) => ({
                  occurrenceKey: key,
                  accessibilityLabel: `${value.title}, ${
                    value.kind === 'movie' ? 'Movie' : 'Series'
                  }`,
                  displayLabel: '',
                  outlineInsetBottom: 52 * u,
                  focusStyle: {
                    accentColor: highContrast ? '#FFFFFF' : colors.accent,
                  },
                  onPress: () => onOpen(value, key),
                })),
              },
            ]}
            renderItem={item => {
              const credit = credits.get(item.occurrenceKey);

              if (!credit) return null;

              return (
                <View accessible={false}>
                  <Picture
                    source={filmArtwork(credit)}
                    fallback="Artwork unavailable"
                    style={{
                      width: cardWidth,
                      height: stillHeight,
                      borderRadius: 8 * u,
                    }}
                  />
                  <Text
                    accessible={false}
                    numberOfLines={1}
                    style={s.detailCardCaption}
                  >
                    {credit.title}
                  </Text>
                </View>
              );
            }}
          />
        ) : (
          person && (
            <Text style={s.muted}>{t('No film or TV credits available.')}</Text>
          )
        )}
      </View>
    </View>
  );
}
