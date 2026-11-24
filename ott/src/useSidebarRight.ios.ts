import { useEffect } from 'react';
import { Platform, TVEventHandler } from 'react-native';
import { useScreenReaderEnabled } from '@bougarnem/itar/react';

// UIKit may have no focus candidate beside a menu button. Leave reader input
// to VoiceOver and accept a discrete Right or a Siri Remote swipe.
export function useSidebarRight(enabled: boolean, onRight: () => void) {
  const reader = useScreenReaderEnabled();

  useEffect(() => {
    if (!Platform.isTV || !enabled || reader !== false) return;

    const subscription = TVEventHandler.addListener(event => {
      if (
        (event.eventType === 'right' || event.eventType === 'swipeRight') &&
        event.eventKeyAction !== 0
      )
        onRight();
    });

    return () => subscription?.remove();
  }, [enabled, reader, onRight]);
}
