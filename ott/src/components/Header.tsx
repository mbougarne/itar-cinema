import React from 'react';
import { Text } from 'react-native';
import { captionAccessible } from '../tv-accessibility';
import { useDesign } from '../theme';

export function Header({ children }: { children: React.ReactNode }) {
  const { s } = useDesign();

  return (
    <Text
      accessible={captionAccessible}
      accessibilityRole="header"
      style={s.heading}
    >
      {children}
    </Text>
  );
}
