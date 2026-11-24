import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { useIsFocused, useScreenReaderEnabled } from '@bougarnem/itar/react';
import type { Film } from '../catalog-types';
import type { DemoMedia } from '../demo-stream';
import { filmArtwork } from '../artwork';
import { useDesign } from '../theme';
import { usePreviewAudio } from '../preview-audio';
import { Picture } from './Picture';
import { PreviewVideo } from './PreviewVideo';

const HomePreviewActivity = createContext(false);

export function HomePreviewProvider({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  const reader = useScreenReaderEnabled();

  return (
    <HomePreviewActivity.Provider value={active && reader !== true}>
      {children}
    </HomePreviewActivity.Provider>
  );
}

export function PreviewSession({
  poster,
  media,
  onPlaying,
  dwellMs = 700,
}: {
  poster?: React.ReactElement;
  media?: DemoMedia;
  onPlaying?: () => void;
  dwellMs?: number;
}) {
  const { u } = useDesign();
  const { enabled: audioEnabled } = usePreviewAudio();

  const [stage, setStage] = useState<
    'waiting' | 'loading' | 'playing' | 'finished'
  >('waiting');

  const finish = useCallback(() => setStage('finished'), []);

  useEffect(() => {
    if (stage === 'playing') onPlaying?.();
  }, [stage, onPlaying]);

  const ready = useCallback(
    () => setStage(previous => (previous === 'loading' ? 'playing' : previous)),
    [],
  );

  useEffect(() => {
    if (AppState.currentState !== 'active') return;

    const delay = setTimeout(() => setStage('loading'), dwellMs);

    const state = AppState.addEventListener('change', value => {
      if (value !== 'active') {
        clearTimeout(delay);
        finish();
      }
    });

    return () => {
      clearTimeout(delay);
      state.remove();
    };
  }, [dwellMs, finish]);

  useEffect(() => {
    if (stage !== 'loading' && stage !== 'playing') return;

    // A failed or stalled stream must release its decoder and reveal the still.
    const timer = setTimeout(finish, stage === 'loading' ? 8_000 : 10_000);

    return () => clearTimeout(timer);
  }, [stage, finish]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {(stage === 'loading' || stage === 'playing') && (
        <PreviewVideo
          key={audioEnabled ? 'audio' : 'muted'}
          clip={media?.preview}
          audioEnabled={audioEnabled}
          onFinish={finish}
          onReady={ready}
        />
      )}
      {/* Keep the native surface laid out at full opacity from its first frame. */}
      {stage === 'playing' ? (
        <Text
          numberOfLines={1}
          style={[
            styles.credit,
            { bottom: 9 * u, right: 10 * u, fontSize: 16 * u },
          ]}
        >
          {media
            ? `${media.name} · ${media.credit}`
            : 'Big Buck Bunny · Blender Foundation · CC BY 3.0'}
        </Text>
      ) : (
        poster
      )}
    </View>
  );
}

export function HomePreviewCard({
  film,
  occurrence,
  width,
  height,
  media,
}: {
  film: Film;
  occurrence: string;
  width: number;
  height: number;
  media?: DemoMedia;
}) {
  const active = useContext(HomePreviewActivity);
  const focused = useIsFocused(occurrence);
  const { u } = useDesign();
  // The collection has a fixed stride. Expand the image inside its reserved
  // slot so the target retains its identity and its neighbors keep their order.
  const stableArtwork = Platform.OS === 'ios' && Platform.isTV && !active;
  const cardWidth = focused || stableArtwork ? width : width * 0.87;

  const poster = (
    <Picture
      source={filmArtwork(film)}
      style={{ width: cardWidth, height }}
      fallback="Artwork unavailable"
    />
  );

  return (
    <View
      style={[styles.frame, { width: cardWidth, height, borderRadius: 8 * u }]}
    >
      {active && focused ? (
        <PreviewSession poster={poster} media={media} />
      ) : (
        poster
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  credit: {
    position: 'absolute',
    color: 'white',
    backgroundColor: 'rgba(6,13,20,0.82)',
    paddingHorizontal: 4,
  },
});
