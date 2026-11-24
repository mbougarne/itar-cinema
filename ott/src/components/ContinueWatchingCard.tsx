import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { filmArtwork } from '../artwork';
import type { WatchingEntry } from '../profile-library';
import { useDesign } from '../theme';
import { Picture } from './Picture';

export function ContinueWatchingCard({
  entry,
  width,
  height,
}: {
  entry: WatchingEntry;
  width: number;
  height: number;
}) {
  const { u } = useDesign();
  const { film, position, duration } = entry;
  const [failedLogo, setFailedLogo] = useState<string>();
  const logo = film.titleLogoUrl;

  const progress =
    duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0;

  return (
    <View style={[styles.frame, { width, height, borderRadius: 8 * u }]}>
      <Picture
        source={filmArtwork(film)}
        style={{ width, height }}
        fallback="Artwork unavailable"
      />
      <View
        style={[
          styles.caption,
          { paddingHorizontal: 16 * u, paddingVertical: 8 * u },
        ]}
      >
        {logo && logo !== failedLogo ? (
          <Image
            accessible={false}
            source={{ uri: logo }}
            resizeMode="contain"
            style={{ width: width * 0.55, height: 34 * u }}
            onError={() => setFailedLogo(logo)}
          />
        ) : (
          <Text numberOfLines={1} style={[styles.title, { fontSize: 24 * u }]}>
            {film.title}
          </Text>
        )}
        <View style={[styles.track, { height: 5 * u, marginTop: 7 * u }]}>
          <View style={[styles.progress, { width: `${progress * 100}%` }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  caption: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(6,13,20,0.82)',
  },
  title: { color: 'white', fontWeight: '700' },
  track: { backgroundColor: '#52616C', overflow: 'hidden' },
  progress: { height: '100%', backgroundColor: '#26D9F2' },
});
