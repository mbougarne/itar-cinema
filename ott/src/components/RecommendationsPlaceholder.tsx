import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { captionAccessible } from '../tv-accessibility';
import { useCinemaLanguage } from '../language';
import { useDesign } from '../theme';

export function RecommendationsPlaceholder() {
  const { t } = useCinemaLanguage();
  const { s, u } = useDesign();

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={s.row}
      >
        {[0, 1, 2, 3].map(slot => (
          <View
            key={slot}
            style={[
              s.fill,
              s.skeleton,
              { aspectRatio: 16 / 9, borderRadius: 8 * u },
            ]}
          />
        ))}
      </View>
      <Text
        accessible={captionAccessible}
        accessibilityLiveRegion="polite"
        style={s.detailCardCaption}
      >
        {t('Loading recommendations…')}
      </Text>
    </View>
  );
}
