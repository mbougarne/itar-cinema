import { Platform } from 'react-native';

// On tvOS, VoiceOver can read standalone paragraphs after the remote stops.
// Use this only for captions whose meaning is carried by a control.
export const captionAccessible =
  Platform.OS === 'ios' && Platform.isTV ? false : undefined;

export function tvControlLabel(label: string, description?: string) {
  return captionAccessible === false && description
    ? `${label}. ${description}`
    : label;
}
