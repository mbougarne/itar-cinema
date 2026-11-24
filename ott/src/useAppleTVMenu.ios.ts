import { useLayoutEffect } from 'react';
import { Platform, TVEventControl } from 'react-native';

export function useAppleTVMenu(hasBackRoute: boolean) {
  useLayoutEffect(() => {
    if (!Platform.isTV || !hasBackRoute) return;

    TVEventControl.enableTVMenuKey();

    return () => TVEventControl.disableTVMenuKey();
  }, [hasBackRoute]);
}
