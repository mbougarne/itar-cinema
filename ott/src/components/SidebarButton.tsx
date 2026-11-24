import React from 'react';
import { Image, Text, View, type ImageSourcePropType } from 'react-native';
import { Action } from './Action';
import { useDesign } from '../theme';

export function SidebarButton({
  title,
  label = title,
  icon,
  expanded,
  avatar = false,
  selected = false,
  ...action
}: Pick<
  React.ComponentProps<typeof Action>,
  'id' | 'order' | 'onPress' | 'highContrast'
> & {
  title: string;
  label?: string;
  icon: ImageSourcePropType;
  expanded: boolean;
  avatar?: boolean;
  selected?: boolean;
}) {
  const { s } = useDesign();

  return (
    <Action
      {...action}
      label={label}
      style={[s.navAction, selected && s.navCurrent, expanded && s.expandedNav]}
    >
      <View style={[s.navContent, !expanded && s.compactNavContent]}>
        <View style={s.navIconSlot}>
          <Image
            accessible={false}
            source={icon}
            resizeMode={avatar ? 'cover' : 'contain'}
            style={
              avatar ? s.avatar : [s.navIcon, !expanded && s.compactNavIcon]
            }
          />
        </View>
        {expanded && (
          <Text numberOfLines={1} style={s.navLabel}>
            {title}
          </Text>
        )}
      </View>
    </Action>
  );
}
