import React from 'react';
import { Platform, Text, View } from 'react-native';
import { FocusProvider } from '@bougarnem/itar/react';
import { useCinemaLanguage } from './language';
import Cinema from './Cinema';
import { useDesign } from './theme';

export default function TVApp({ onOpenProbes }: { onOpenProbes?: () => void }) {
  const { s } = useDesign();
  const { rtl } = useCinemaLanguage();

  if (
    Platform.OS !== 'web' &&
    (!Platform.isTV || !['ios', 'android'].includes(Platform.OS))
  ) {
    return (
      <View style={s.shell}>
        <Text style={s.body}>
          This consumer requires the Itar native adapter on tvOS or Android TV.
        </Text>
      </View>
    );
  }

  return (
    <FocusProvider style={[s.fill, rtl && s.rightToLeft]}>
      <Cinema onOpenProbes={onOpenProbes} />
    </FocusProvider>
  );
}
