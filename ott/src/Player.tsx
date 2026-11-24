import React from 'react';
import { FocusProvider } from '@bougarnem/itar/react';
import Playback from './Playback';
import type { PlayerProps } from './playback-history';
import { useDesign } from './theme';

export default function Player(props: PlayerProps) {
  const { s } = useDesign();

  return (
    <FocusProvider style={s.fill}>
      <Playback {...props} />
    </FocusProvider>
  );
}
