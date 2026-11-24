import React from 'react';
import { DesignTheme } from './src/theme';
import { CinemaLanguageProvider } from './src/language';
import Launch from './src/Launch';
import { PreviewAudioProvider } from './src/preview-audio';

export default function OttApp({
  onOpenProbes,
}: {
  onOpenProbes?: () => void;
}) {
  return (
    <DesignTheme>
      <CinemaLanguageProvider>
        <PreviewAudioProvider>
          <Launch onOpenProbes={onOpenProbes} />
        </PreviewAudioProvider>
      </CinemaLanguageProvider>
    </DesignTheme>
  );
}
