import React from 'react';
import { Platform, Text, View } from 'react-native';
import { captionAccessible } from '../tv-accessibility';
import type { DemoMedia } from '../demo-stream';
import type { Film } from '../catalog-types';
import { useCinemaLanguage } from '../language';
import { useDesign } from '../theme';

export function Metadata({ film }: { film: Film }) {
  const { t } = useCinemaLanguage();
  const { s } = useDesign();

  const values = [
    film.year || '',
    t(film.kind === 'series' ? 'Series' : 'Movie'),
    film.runtime ? `${film.runtime} ${t('min')}` : '',
    film.rating !== undefined && film.votes
      ? `★ ${film.rating.toFixed(1)} / 10`
      : '',
  ];

  return (
    <View style={s.badges}>
      {values.filter(Boolean).map(value => (
        <Text accessible={captionAccessible} key={value} style={s.badge}>
          {value}
        </Text>
      ))}
    </View>
  );
}

// Playback features describe the selected sample rather than the catalogue title.
export function PlaybackBadges({
  demo,
  rating,
  region,
}: {
  demo: DemoMedia;
  rating?: string;
  region?: string;
}) {
  const { t } = useCinemaLanguage();
  const { s } = useDesign();

  return (
    <View style={s.badges}>
      {!!rating && (
        <Text
          accessible
          style={s.technicalBadge}
          accessibilityLabel={t('Age rating {rating}', {
            rating: rating + (region ? `, ${region}` : ''),
          })}
        >
          {rating}
        </Text>
      )}
      {Platform.OS === 'web' && demo.web4K && (
        <Text
          accessible
          style={s.technicalBadge}
          accessibilityLabel={t('4K Ultra HD sample')}
        >
          4K
        </Text>
      )}
      <Text
        accessible
        style={[s.technicalBadge, s.unavailableBadge]}
        accessibilityLabel={t('Audio description unavailable for this sample')}
      >
        AD
      </Text>
    </View>
  );
}
