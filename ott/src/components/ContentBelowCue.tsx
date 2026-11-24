import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  useFocusState,
  type VirtualizedFocusRail,
} from '@bougarnem/itar/react';
import { useCinemaLanguage } from '../language';
import { useDesign } from '../theme';

export function ContentBelowCue({
  rails,
  hasNextPage,
  heroKey,
  guideKey,
  active,
}: {
  rails: readonly VirtualizedFocusRail[];
  hasNextPage: boolean;
  heroKey?: string;
  guideKey?: string;
  active: boolean;
}) {
  const focus = useFocusState();
  const { t } = useCinemaLanguage();
  const { u } = useDesign();

  const moreBelow = useMemo(() => {
    const content = rails.filter(rail => rail.id !== 'pagination');
    const keys = new Set<string>();

    if (content.length) {
      if (heroKey) keys.add(heroKey);

      if (guideKey) keys.add(guideKey);
    }

    content.forEach((row, index) => {
      if (index < content.length - 1 || hasNextPage) {
        for (const item of row.items) keys.add(item.occurrenceKey);
      }
    });

    return keys;
  }, [rails, hasNextPage, heroKey, guideKey]);

  if (
    !active ||
    focus.kind !== 'managed' ||
    !focus.occurrenceKey ||
    !moreBelow.has(focus.occurrenceKey)
  )
    return null;

  return (
    <View
      pointerEvents="none"
      accessible={false}
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.cue,
        {
          right: 24 * u,
          bottom: 8 * u,
          borderRadius: 16 * u,
          paddingHorizontal: 12 * u,
          paddingVertical: 3 * u,
        },
      ]}
    >
      <Text style={[styles.label, { fontSize: 19 * u }]}>
        {t('↓ More below')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: 'white' },
  cue: { position: 'absolute', backgroundColor: 'rgba(6,13,20,0.9)' },
});
