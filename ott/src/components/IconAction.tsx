import React from 'react';
import { Image, View, type ImageSourcePropType } from 'react-native';
import { Action } from './Action';
import { useDesign } from '../theme';

export function IconAction({
  icon,
  size = 72,
  enabled = true,
  ...props
}: Omit<
  React.ComponentProps<typeof Action>,
  'children' | 'displayLabel' | 'style'
> & {
  icon: ImageSourcePropType;
  size?: number;
}) {
  const { s, u } = useDesign();

  return (
    <Action
      {...props}
      enabled={enabled}
      style={[
        s.iconAction,
        { width: size * u, height: size * u, borderRadius: (size * u) / 2 },
      ]}
    >
      <View style={s.centerIcon}>
        <Image
          accessible={false}
          source={icon}
          resizeMode="contain"
          style={[s.controlIcon, !enabled && s.disabledIcon]}
        />
      </View>
    </Action>
  );
}
