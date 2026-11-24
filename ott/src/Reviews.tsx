import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Text, View } from 'react-native';
import {
  FocusVirtualizedRails,
  occurrenceKey,
  useScreenReaderEnabled,
} from '@bougarnem/itar/react';
import type { Film, Review } from './catalog-types';
import { cachedReviews, loadReviews } from './detail-data';
import { Action } from './components/Action';
import { textPages } from './text-pages';
import { useCinemaLanguage } from './language';
import { useDesign } from './theme';
import { captionAccessible } from './tv-accessibility';

const sample: Review = {
  id: 'fixture-review',
  author: 'Cinema fixture viewer',
  date: '2026-01-12',
  rating: 8,
  content:
    'The opening gives the characters room to settle into their routines, so the first change in tone has real weight. I especially liked how the empty spaces in each scene put the conversations in focus. The ending circles back to a detail that seemed incidental at first, and the second viewing makes that choice feel more deliberate.',
};

function offlineReviews(film: Film): readonly Review[] {
  const count = film.art % 3;

  return [
    sample,
    {
      ...sample,
      id: 'fixture-second',
      author: 'Another fixture viewer',
      rating: null,
      content:
        'The second half moved quickly and made me want to revisit the opening.',
    },
  ].slice(0, count);
}

export function Reviews({
  film,
  active,
  width,
  height,
  slow,
  highContrast,
}: {
  film: Film;
  active: boolean;
  width: number;
  height: number;
  slow: boolean;
  highContrast: boolean;
}) {
  const { t } = useCinemaLanguage();
  const { s, u, colors } = useDesign();
  const reader = useScreenReaderEnabled();
  const [reviews, setReviews] = useState(() => cachedReviews(film));
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [reading, setReading] = useState<{ id: string; page: number }>();

  useEffect(() => {
    if (reviews) return;

    const request = new AbortController();

    const timer = setTimeout(
      () => {
        const result = film.source
          ? loadReviews(film, request.signal)
          : Promise.resolve(offlineReviews(film));

        result.then(
          items => {
            if (!request.signal.aborted) setReviews(items);
          },
          () => {
            if (!request.signal.aborted) setError(true);
          },
        );
      },
      slow ? 650 : 0,
    );

    return () => {
      clearTimeout(timer);
      request.abort();
    };
  }, [film, retry, reviews, slow]);

  if (error)
    return (
      <Action
        id={occurrenceKey('details', 'retry-reviews')}
        label="Retry reviews"
        tvDescription="Reviews could not load."
        onPress={() => {
          setError(false);
          setRetry(value => value + 1);
        }}
      />
    );

  if (!reviews?.length)
    return (
      <Text accessibilityLiveRegion="polite" style={s.muted}>
        {t(reviews ? 'No reviews for this title.' : 'Loading reviews…')}
      </Text>
    );

  if (width <= 0 || height <= 0) return null;

  const gap = 24 * u;
  const cardWidth = Math.min(780 * u, (width - gap * 2) / 2);
  const cardHeight = Math.min(height, 330 * u);

  const pageSize = Math.max(
    80,
    Math.floor(cardWidth / (12 * u)) *
      Math.max(2, Math.floor((cardHeight - 136 * u) / (28 * u))),
  );

  const visuals = new Map(
    reviews.map(review => {
      const key = occurrenceKey('details', film.id, 'review', review.id);
      const pages = textPages(review.content, pageSize);
      const page = reading?.id === review.id ? reading.page : undefined;
      const excerpt = review.content.replace(/\s+/g, ' ').trim();

      const summary = [
        review.date,
        review.rating !== null && `★ ${review.rating} / 10`,
      ]
        .filter(Boolean)
        .join(' · ');

      const body = page === undefined ? excerpt : pages[page] ?? excerpt;

      const action =
        page === undefined
          ? 'Read review'
          : page + 1 < pages.length
          ? 'Next section'
          : 'Close review';

      return [key, { review, pages, page, summary, body, action }] as const;
    }),
  );

  return (
    <FocusVirtualizedRails
      id="reviews"
      active={active}
      viewportRows={1}
      horizontalAlignment="pinned"
      rowExtent={cardHeight}
      viewportExtent={width}
      itemExtent={cardWidth + gap}
      rails={[
        {
          id: 'reviews',
          itemStyle: {
            width: cardWidth,
            height: cardHeight,
            marginEnd: gap,
            borderRadius: 12 * u,
            backgroundColor: '#192632',
          },
          items: [...visuals].map(([key, visual]) => ({
            occurrenceKey: key,
            displayLabel: '',
            accessibilityLabel: [
              visual.review.author,
              visual.summary,
              visual.action,
              visual.page === undefined
                ? visual.body.slice(0, 180)
                : visual.body,
            ]
              .filter(Boolean)
              .join('. '),
            focusStyle: {
              accentColor: highContrast ? '#FFFFFF' : colors.accent,
            },
            onPress: () => {
              const next = visual.page === undefined ? 0 : visual.page + 1;

              if (next >= visual.pages.length) {
                setReading(undefined);

                return;
              }

              setReading({ id: visual.review.id, page: next });

              if (reader && captionAccessible === false)
                AccessibilityInfo.announceForAccessibility(visual.pages[next]);
            },
          })),
        },
      ]}
      renderItem={item => {
        const visual = visuals.get(item.occurrenceKey);

        if (!visual) return null;

        return (
          <View
            accessible={false}
            style={[s.fill, { gap: 10 * u, padding: 20 * u }]}
          >
            <Text accessible={false} numberOfLines={1} style={s.virtualHeading}>
              {visual.review.author}
            </Text>
            {!!visual.summary && (
              <Text accessible={false} style={s.episodeCaption}>
                {visual.summary}
              </Text>
            )}
            <Text
              accessible={false}
              numberOfLines={visual.page === undefined ? 3 : undefined}
              style={[s.muted, s.fill]}
            >
              {visual.body}
            </Text>
            <Text accessible={false} style={s.muted}>
              {visual.action}
              {visual.page !== undefined &&
                ` · ${visual.page + 1} / ${visual.pages.length}`}
            </Text>
          </View>
        );
      }}
    />
  );
}
