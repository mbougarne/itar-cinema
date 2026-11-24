import { Platform, type FocusGuideProps } from 'react-native';

// Native vertical containment preserves horizontal exits and reader ownership.
export const androidVerticalBoundary =
  Platform.OS === 'android'
    ? ({
        collapsable: false,
        trapFocusUp: true,
        trapFocusDown: true,
      } satisfies Pick<
        FocusGuideProps,
        'collapsable' | 'trapFocusUp' | 'trapFocusDown'
      >)
    : {};
