import React from 'react';
import { Image, Platform, Text, View } from 'react-native';
import { FocusScope, occurrenceKey } from '@bougarnem/itar/react';
import { profileAvatars, icons } from './artwork';
import { SidebarButton } from './components/SidebarButton';
import { useCinemaLanguage } from './language';
import { useDesign } from './theme';
import { screens, type Screen } from './navigation';
import type { ProviderMode } from './catalog-types';
import { androidVerticalBoundary } from './android-focus-boundary';

export function Sidebar({
  active,
  expanded,
  reserveWidth,
  readerEntry,
  profile,
  avatar,
  contrast,
  mode,
  screen,
  onNavigate,
  onSignOut,
}: {
  active: boolean;
  expanded: boolean;
  reserveWidth: boolean;
  readerEntry: boolean;
  profile: string;
  avatar?: number;
  contrast: boolean;
  mode: ProviderMode;
  screen: Screen;
  onNavigate: (screen: Screen) => void;
  onSignOut: () => void;
}) {
  const { t } = useCinemaLanguage();
  const { s, u } = useDesign();

  return (
    <View
      {...androidVerticalBoundary}
      style={[
        s.sidebarSlot,
        // Keep both panes visible and stationary as VoiceOver explores them.
        reserveWidth && { width: 360 * u },
        // Android clips accessibility bounds to this parent even when its
        // child draws outside it. Keep the overlay's full semantic width
        // without shifting the content when the sidebar expands.
        Platform.OS === 'android' &&
          expanded && { width: 360 * u, marginRight: -248 * u },
      ]}
    >
      <FocusScope
        id={screen === 'Settings' ? 'account-navigation' : 'navigation'}
        active={active}
        accessibilityPaneTitle={readerEntry ? 'Navigation' : undefined}
        layout="column"
        boundary="parent"
        preferredKey={occurrenceKey('nav', screen)}
        restoreOnEntry
        style={[
          s.sidebar,
          s.sidebarOverlay,
          { width: (expanded ? 360 : 112) * u },
        ]}
      >
        {expanded ? (
          <Text
            accessible={reserveWidth ? false : undefined}
            accessibilityElementsHidden={reserveWidth}
            numberOfLines={1}
            style={s.brand}
          >
            {t('ITAR CINEMA')}
          </Text>
        ) : (
          <View accessible={false} style={s.compactBrand}>
            <Image
              accessible={false}
              source={icons.play}
              style={s.compactBrandMark}
            />
          </View>
        )}
        <View style={s.nav}>
          {screens.map((name, index) => (
            <View key={name} style={s.navRow}>
              {name === screen && (
                <View accessible={false} style={s.routeMarker} />
              )}
              <SidebarButton
                id={occurrenceKey('nav', name)}
                order={index}
                title={t(name)}
                icon={icons[name]}
                expanded={expanded}
                selected={name === screen}
                onPress={() => onNavigate(name)}
                highContrast={contrast}
              />
            </View>
          ))}
        </View>
        <View style={s.sidebarBottom}>
          <SidebarButton
            order={screens.length}
            id={occurrenceKey('nav', 'profile-switcher')}
            title={profile}
            label={t('{name}, switch profile', { name: profile })}
            icon={profileAvatars?.[avatar ?? 0]}
            avatar
            expanded={expanded}
            onPress={() => onNavigate('Profile')}
            highContrast={contrast}
          />
          <SidebarButton
            order={screens.length + 1}
            id={occurrenceKey('nav', 'signout')}
            title={t('Sign out')}
            icon={icons.signOut}
            expanded={expanded}
            onPress={onSignOut}
            highContrast={contrast}
          />
          {expanded && (
            <Text
              accessible={reserveWidth ? false : undefined}
              accessibilityElementsHidden={reserveWidth}
              style={s.fixtureLabel}
            >
              {t(mode === 'proxy' ? 'TMDB CATALOGUE' : 'FIXTURE CATALOGUE')}
            </Text>
          )}
        </View>
      </FocusScope>
    </View>
  );
}
