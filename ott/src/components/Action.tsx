import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Focusable, useIsFocused } from '@bougarnem/itar/react';
import { tvControlLabel } from '../tv-accessibility';
import { useCinemaLanguage } from '../language';
import { useDesign } from '../theme';

export function Action({
  id,
  label,
  onPress,
  enabled = true,
  highContrast = false,
  contentId,
  style,
  order = 0,
  displayLabel,
  tvDescription,
  quiet = false,
  primary = false,
  checked,
  children,
}: {
  displayLabel?: string;
  tvDescription?: string;
  children?: React.ReactNode;
  order?: number;
  id: string;
  label: string;
  onPress: () => void;
  enabled?: boolean;
  highContrast?: boolean;
  contentId?: string;
  style?: StyleProp<ViewStyle>;
  quiet?: boolean;
  primary?: boolean;
  checked?: boolean;
}) {
  const { t } = useCinemaLanguage();
  const { s, u, colors } = useDesign();
  const focused = useIsFocused(id);
  const accentColor = primary || highContrast ? '#FFFFFF' : colors.actionRing;

  const labelColor = primary ? colors.primaryText : colors.muted;

  const focusBackground =
    (primary ? colors.primaryFocus : undefined) ??
    (highContrast ? colors.track : colors.focusFill);

  return (
    <Focusable
      displayLabel={t(displayLabel ?? label)}
      labelSize={24 * u}
      order={order}
      occurrenceKey={id}
      contentId={contentId}
      accessibilityLabel={tvControlLabel(
        t(label),
        tvDescription && t(tvDescription),
      )}
      enabled={enabled}
      accessibilityRole={checked === undefined ? undefined : 'switch'}
      accessibilityState={checked === undefined ? undefined : { checked }}
      onPress={onPress}
      baseAccentColor={focused ? '#FFFFFF' : labelColor}
      focusStyle={
        quiet
          ? { accentColor }
          : {
              accentColor,
              backgroundColor: focusBackground,
            }
      }
      style={[s.action, quiet && s.quietAction, style]}
    >
      {children}
    </Focusable>
  );
}
