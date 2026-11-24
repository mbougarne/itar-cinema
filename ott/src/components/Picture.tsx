import React, { useEffect, useState } from 'react';
import {
  Image,
  Text,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useCinemaLanguage } from '../language';
import { useDesign } from '../theme';

export function Picture({
  source,
  style,
  fallback,
}: {
  source?: ImageSourcePropType;
  style: StyleProp<Pick<ViewStyle, 'width' | 'height' | 'borderRadius'>>;
  fallback: string;
}) {
  const { t } = useCinemaLanguage();
  const { s } = useDesign();
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [source]);

  return !source || failed ? (
    <View accessible={false} style={[style, s.fallback]}>
      <Text accessible={false} style={s.muted}>
        {t(fallback)}
      </Text>
    </View>
  ) : (
    <Image
      accessible={false}
      source={source}
      fadeDuration={0}
      resizeMode="cover"
      style={style}
      onError={() => setFailed(true)}
    />
  );
}
