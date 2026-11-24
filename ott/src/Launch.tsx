import React, { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { captionAccessible, tvControlLabel } from './tv-accessibility';
import TVApp from './TVApp';
import { useCinemaLanguage } from './language';
import { useDesign } from './theme';

export default function Launch({
  onOpenProbes,
}: {
  onOpenProbes?: () => void;
}) {
  const { t, rtl } = useCinemaLanguage();
  const { s } = useDesign();
  const [splash, setSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setSplash(false), 1200);

    return () => clearTimeout(timer);
  }, []);

  return splash ? (
    <View style={s.splash}>
      <Image
        source={require('../assets/branding/cinema-mark.png')}
        resizeMode="contain"
        accessible={false}
        style={s.splashMark}
      />
      <Text
        accessibilityLabel={
          captionAccessible === false
            ? tvControlLabel('Itar Cinema', 'Stories worth exploring.')
            : undefined
        }
        style={s.splashBrand}
      >
        {rtl ? (
          t('ITAR CINEMA')
        ) : (
          <>
            <Text style={s.brandStrong}>ITAR</Text> CINEMA
          </>
        )}
      </Text>
      <Text accessible={captionAccessible} style={s.muted}>
        {t('Stories worth exploring.')}
      </Text>
    </View>
  ) : (
    <TVApp onOpenProbes={onOpenProbes} />
  );
}
