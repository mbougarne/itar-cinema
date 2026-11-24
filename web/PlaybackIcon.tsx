import React from 'react';

export default function PlaybackIcon({
  name,
}: {
  name: 'play' | 'pause' | 'rewind' | 'forward' | 'mute' | 'unmute';
}) {
  const paths = {
    play: 'M8 5v14l11-7z',
    pause: 'M8 5v14M16 5v14',
    rewind: 'M11 5 3 12l8 7V5Zm10 0-8 7 8 7V5Z',
    forward: 'm3 5 8 7-8 7V5Zm10 0 8 7-8 7V5Z',
    mute: 'M11 4 6 8H2v8h4l5 4V4Zm4 5 6 6m0-6-6 6',
    unmute: 'M11 4 6 8H2v8h4l5 4V4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
  };

  return (
    <svg
      viewBox="0 0 24 24"
      width="28"
      height="28"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={paths[name]}
        fill={name === 'play' ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={name === 'pause' ? 4 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
