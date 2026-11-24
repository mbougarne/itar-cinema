import React, { useEffect, useRef } from 'react';

const source: {
  uri: string;
} = require('../../assets/cinematic/previews/bunny.mp4');

const videoStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  pointerEvents: 'none',
};

export function PreviewVideo({
  clip,
  audioEnabled = false,
  onReady,
  onFinish,
}: {
  clip?: number | { uri: string };
  audioEnabled?: boolean;
  onReady: () => void;
  onFinish: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const media = video.current;

    if (!media) return;

    let mounted = true;

    media.muted = !audioEnabled;

    media.play()?.catch(error => {
      if (!mounted) return;

      if (!media.muted && error?.name === 'NotAllowedError') {
        media.muted = true;

        media.play()?.catch(() => {
          if (mounted) onFinish();
        });
      } else {
        onFinish();
      }
    });

    return () => {
      mounted = false;
      media.pause();
      media.removeAttribute('src');
      media.load();
    };
  }, [clip, audioEnabled, onFinish]);

  return (
    <video
      ref={video}
      src={typeof clip === 'object' ? clip.uri : source.uri}
      muted={!audioEnabled}
      playsInline
      aria-hidden
      tabIndex={-1}
      onPlaying={onReady}
      onEnded={onFinish}
      onError={onFinish}
      onTimeUpdate={event => {
        if (event.currentTarget.currentTime >= 10) onFinish();
      }}
      style={videoStyle}
    />
  );
}
