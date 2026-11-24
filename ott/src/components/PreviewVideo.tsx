import React from 'react';
import { StyleSheet } from 'react-native';
import Video, { ViewType } from 'react-native-video';

const source = {
  uri: require('../../assets/cinematic/previews/bunny.mp4'),
};

export type PreviewVideoProps = {
  clip?: number | { uri: string };
  audioEnabled?: boolean;
  onReady: () => void;
  onFinish: () => void;
};

export function PreviewVideo({
  clip,
  audioEnabled = false,
  onReady,
  onFinish,
}: PreviewVideoProps) {
  return (
    <Video
      source={clip ? ({ uri: clip } as typeof source) : source}
      style={StyleSheet.absoluteFill}
      resizeMode="cover"
      controls={false}
      focusable={false}
      disableFocus={!audioEnabled}
      muted={!audioEnabled}
      viewType={ViewType.TEXTURE}
      preventsDisplaySleepDuringVideoPlayback={false}
      onReadyForDisplay={onReady}
      onError={onFinish}
      onEnd={onFinish}
      onProgress={event => {
        if (event.currentTime >= 10) onFinish();
      }}
    />
  );
}
