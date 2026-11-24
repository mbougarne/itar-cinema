import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Image, Platform, Text, View, useWindowDimensions } from 'react-native';
import {
  FocusScope,
  FocusVirtualizedRails,
  occurrenceKey,
} from '@bougarnem/itar/react';
import type { ProviderMode } from './catalog-types';
import type { VirtualizedFocusItem } from '@bougarnem/itar/react';
import { icons } from './artwork';
import { liveChannels } from './live-source';
import { Action } from './components/Action';
import { useCinemaLanguage } from './language';
import { useDesign } from './theme';
import { usePreviewAudio } from './preview-audio';
import { BrowserNavigation } from './browser-navigation';
import { DevelopmentSettings } from './development-settings';

const appleTV = Platform.OS === 'ios' && Platform.isTV;

const sessionNote = 'Focus and request settings last for this session.';

const attribution =
  'This product uses the TMDB API but is not endorsed or certified by TMDB.';

const sections = [
  'Plans',
  'Privacy',
  'App settings',
  'Content source',
  'Diagnostics',
  'Credits',
] as const;

const sectionIcons = [
  icons.play,
  icons.check,
  icons.Settings,
  icons.Movies,
  icons.Series,
  icons.like,
];

const appVersion: string = require('../../package.json').version;

const itarVersion: string = require('@bougarnem/itar/package.json').version;

const plans = [
  {
    name: 'Essential',
    subtitle: 'Free with ads',
    description: 'Watch selected films and live channels in HD on one screen.',
    terms: 'Free plan. An account is required.',
  },
  {
    name: 'Standard',
    subtitle: '$8.99 / month',
    description:
      'Stream the full movies and series catalogue ad-free in Full HD on two screens.',
    terms: '7-day free trial for new subscribers. Cancel anytime.',
  },
  {
    name: 'Premium',
    subtitle: '$14.99 / month',
    description:
      'Watch supported titles in 4K HDR with surround sound. Stream on four screens at once.',
    terms: '7-day free trial for new subscribers. Cancel anytime.',
  },
  {
    name: 'Family',
    subtitle: '$17.99 / month',
    description:
      'Create six profiles with individual watchlists, Kids viewing and parental controls.',
    terms: '7-day free trial for new subscribers. Cancel anytime.',
  },
  {
    name: 'Cinema + Sports',
    subtitle: '$21.99 / month',
    description:
      'Get the Premium catalogue plus live events, sports channels and replays.',
    terms: 'Live event availability varies by region. Cancel anytime.',
  },
];

const supportsCheckedState = Platform.OS === 'android' || Platform.OS === 'web';

export function Settings({
  onReady,
  id,
  contrast,
  onContrast,
  slow,
  onSlow,
  armed,
  onArm,
  onOpenProbes,
  mode,
  onMode,
  previews,
  onPreviews,
  onProfiles,
  onBack,
  onSignOut,
}: {
  onReady?: (initialKey?: string) => void;
  mode: ProviderMode;
  previews: boolean;
  onPreviews: () => void;
  onProfiles: () => void;
  onBack?: () => void;
  onSignOut?: () => void;
  onMode: () => void;
  id: string;
  contrast: boolean;
  onContrast: () => void;
  slow: boolean;
  onSlow: () => void;
  armed: boolean;
  onArm: () => void;
  onOpenProbes?: () => void;
}) {
  const { t, rtl, toggle } = useCinemaLanguage();
  const { s, u, accentName, toggleAccent, colors } = useDesign();

  const { enabled: previewAudio, toggle: togglePreviewAudio } =
    usePreviewAudio();

  const { width, height: windowHeight } = useWindowDimensions();
  const navigation = useContext(BrowserNavigation);
  const development = useContext(DevelopmentSettings);
  const refresh = development?.refresh;

  useEffect(() => {
    refresh?.();
  }, [refresh]);

  const [height, setHeight] = useState(0);
  const [reviewedPlan, setReviewedPlan] = useState<string>();
  const [privacyExpanded, setPrivacyExpanded] = useState(false);

  const [section, setSection] = useState<(typeof sections)[number]>('Plans');

  const viewport = Math.max(200 * u, width - 692 * u);
  const panelHeight = height || Math.max(96 * u, windowHeight - 245 * u);

  const planExtent = 460 * u;

  const planRail = useMemo(
    () => [
      {
        id: 'options',
        itemStyle: [s.subscriptionCard, { width: planExtent - 18 * u }],
        items: plans.map(plan => ({
          occurrenceKey: occurrenceKey(id, 'plan', plan.name),
          accessibilityLabel: `View ${t(plan.name)} plan. ${t(
            plan.subtitle,
          )}. ${plan.description} ${t(plan.terms)}`,
          displayLabel: '',
          focusStyle: { accentColor: '#FFFFFF' },
          onPress: () => setReviewedPlan(plan.name),
        })),
      },
    ],
    [id, planExtent, s.subscriptionCard, t, u],
  );

  const reportReady = useCallback(
    () => onReady?.(occurrenceKey(id, 'section', 'Plans')),
    [id, onReady],
  );

  useEffect(() => {
    reportReady();
  }, [reportReady]);

  const model = useMemo(() => {
    const values = [
      {
        key: 'accent',
        title: 'Appearance',
        label: 'Accent color',
        value: accentName === 'blue' ? 'Cinema blue' : 'Cinema cyan',
        press: toggleAccent,
      },
      {
        key: 'contrast',
        title: 'Appearance',
        label: 'White focus accent',
        value: contrast ? 'On' : 'Off',
        checked: contrast,
        press: onContrast,
      },
      {
        key: 'previews',
        title: 'Playback',
        label: 'Autoplay video previews',
        value: previews ? 'On' : 'Off',
        checked: previews,
        press: onPreviews,
      },
      {
        key: 'preview-audio',
        title: 'Playback',
        label: 'Preview video audio',
        value: previewAudio ? 'On' : 'Off',
        checked: previewAudio,
        press: togglePreviewAudio,
      },
      ...(Platform.OS === 'web'
        ? [
            {
              key: 'language',
              title: 'Settings',
              label: 'Interface language',
              value: rtl ? 'العربية' : 'English',
              press: toggle,
            },
          ]
        : []),
      {
        key: 'profiles',
        title: 'Profiles',
        label: 'Manage profiles',
        value: 'Names, avatars and autoplay next',
        press: onProfiles,
      },
      {
        key: 'delay',
        title: 'Request scenarios',
        label: 'Slow requests',
        value: slow ? 'On / 650 ms' : 'Off',
        checked: slow,
        press: onSlow,
      },
      {
        key: 'failure',
        title: '',
        label: 'Fail next local fetch',
        value: armed ? 'Armed' : 'Not armed',
        checked: armed,
        press: onArm,
      },
      ...(development?.actions ?? []),
      ...(__DEV__ && onOpenProbes
        ? [
            {
              key: 'probes',
              title: '',
              label: 'Open original Itar probes',
              value: 'Development only',
              press: onOpenProbes,
            },
          ]
        : []),
      {
        key: 'source',
        title: 'Content source',
        label: 'Catalogue',
        value: mode === 'proxy' ? 'TMDB proxy' : 'Offline fixtures',
        press: onMode,
      },
      ...(navigation
        ? [
            {
              key: 'navigation',
              title: 'Keyboard',
              label: 'TV arrow-key navigation',
              value: navigation.enabled ? 'On' : 'Off',
              checked: navigation.enabled,
              press: navigation.toggle,
            },
          ]
        : []),
    ];

    const app = [
      'accent',
      'language',
      'contrast',
      'previews',
      'preview-audio',
      'profiles',
      'navigation',
    ];

    const visible = values.filter(value =>
      section === 'Content source'
        ? value.key === 'source'
        : section === 'App settings'
        ? app.includes(value.key)
        : section === 'Diagnostics' &&
          value.key !== 'source' &&
          !app.includes(value.key),
    );

    const visuals = new Map(
      visible.map(value => [occurrenceKey(id, value.key), value]),
    );

    const rails = visible.map(value => ({
      id: value.key,
      itemExtent: viewport,
      itemStyle: {
        width: viewport,
        height: 76 * u,
        backgroundColor: '#172535',
        borderRadius: 8 * u,
      },
      items: [
        {
          occurrenceKey: occurrenceKey(id, value.key),
          accessibilityLabel:
            supportsCheckedState && 'checked' in value
              ? t(value.label)
              : [
                  `${t(value.label)}: ${t(value.value)}`,
                  appleTV && value.title,
                  appleTV &&
                    value.key === 'contrast' &&
                    `Settings. ${sessionNote}`,
                  appleTV && value.key === 'source' && attribution,
                ]
                  .filter(Boolean)
                  .join('. '),
          accessibilityRole:
            supportsCheckedState && 'checked' in value
              ? ('switch' as const)
              : undefined,
          accessibilityState:
            supportsCheckedState && 'checked' in value
              ? { checked: value.checked }
              : undefined,
          displayLabel: '',
          labelSize: 24 * u,
          baseAccentColor: '#BDC8D3',
          focusStyle: { accentColor: contrast ? '#FFFFFF' : colors.focus },
          onPress: value.press,
        },
      ],
    }));

    return {
      rails,
      visuals,
    };
  }, [
    id,
    section,
    accentName,
    toggleAccent,
    colors,
    t,
    rtl,
    toggle,
    previews,
    onPreviews,
    previewAudio,
    togglePreviewAudio,
    onProfiles,
    mode,
    navigation,
    development,
    contrast,
    slow,
    armed,
    onMode,
    onContrast,
    onSlow,
    onArm,
    onOpenProbes,
    viewport,
    u,
  ]);

  const renderItem = useCallback(
    (item: VirtualizedFocusItem) => {
      const value = model.visuals.get(item.occurrenceKey);

      return (
        <View style={[s.settingContents, { width: viewport }]}>
          <Text style={s.body}>{value && t(value.label)}</Text>
          <Text style={s.muted}>{value && t(value.value)}</Text>
        </View>
      );
    },
    [model.visuals, viewport, s, t],
  );

  return (
    <View style={s.settingsLayout}>
      <FocusScope
        id="settings-sections"
        layout="column"
        boundary="parent"
        style={s.settingsSections}
      >
        <Text accessible={false} style={s.accountWordmark}>
          {t('▶ ITAR CINEMA')}
        </Text>
        <Text accessibilityRole="header" style={s.settingsHeading}>
          {t('Settings')}
        </Text>
        {sections.map((name, index) => {
          const selected = section === name;

          return (
            <Action
              key={name}
              order={index}
              id={occurrenceKey(id, 'section', name)}
              label={`${name}${selected ? ', selected' : ''}`}
              highContrast={contrast}
              quiet
              style={s.settingsSectionAction}
              onPress={() => setSection(name)}
            >
              <View style={s.settingsItem}>
                {selected && <View style={s.settingsActiveMarker} />}
                <Image
                  source={sectionIcons[index]}
                  style={[s.settingsIcon, selected && s.settingsActiveIcon]}
                  accessible={false}
                />
                <Text style={[s.body, selected && s.settingsActiveLabel]}>
                  {t(name)}
                </Text>
              </View>
            </Action>
          );
        })}
        {onSignOut && (
          <Action
            id={occurrenceKey(id, 'settings', 'signout')}
            order={sections.length}
            label="Sign out"
            quiet
            style={s.settingsSectionAction}
            onPress={onSignOut}
          >
            <View style={s.settingsItem}>
              <Image
                source={icons.signOut}
                style={s.settingsIcon}
                accessible={false}
              />
              <Text style={s.body}>{t('Sign out')}</Text>
            </View>
          </Action>
        )}
        {onBack && (
          <Action
            id={occurrenceKey(id, 'settings', 'back')}
            order={sections.length + 1}
            label="Back to Cinema"
            quiet
            style={[s.settingsSectionAction, s.settingsBack]}
            onPress={onBack}
          >
            <View style={s.settingsItem}>
              <Image
                source={icons.Home}
                style={s.settingsIcon}
                accessible={false}
              />
              <Text style={s.body}>{t('Back to Cinema')}</Text>
            </View>
          </Action>
        )}
        <Text style={s.footer}>
          Cinema {appVersion} · Itar {itarVersion}
        </Text>
      </FocusScope>
      <View style={s.settingsPanel}>
        <Text accessibilityRole="header" style={s.homeHeroTitle}>
          {t(section)}
        </Text>
        {section === 'Plans' ? (
          <View style={s.planSection}>
            <Text style={s.body}>{t('Choose a Cinema plan')}</Text>
            <Text style={s.muted}>{t('Example plans and pricing')}</Text>
            <FocusVirtualizedRails
              id="subscription-plans"
              rails={planRail}
              itemExtent={planExtent}
              rowExtent={430 * u}
              viewportExtent={viewport}
              horizontalAlignment="nearest"
              renderItem={(_, index) => {
                const plan = plans[index];

                return (
                  <View style={s.planCardCopy}>
                    <Text style={s.heading}>{t(plan.name)}</Text>
                    <Text style={s.settingsCurrent}>{t(plan.subtitle)}</Text>
                    <Text style={s.body}>{t(plan.description)}</Text>
                    <Text style={s.muted}>{t(plan.terms)}</Text>
                    <Text style={s.planCta}>{t('View plan →')}</Text>
                  </View>
                );
              }}
            />
            {!!reviewedPlan && (
              <Text accessibilityLiveRegion="polite" style={s.body}>
                {t(
                  '{plan} selected. These example plans are available for preview.',
                  { plan: t(reviewedPlan) },
                )}
              </Text>
            )}
          </View>
        ) : section === 'Privacy' ? (
          <View style={s.privacyContent}>
            <Text accessibilityRole="header" style={s.heading}>
              {t('Data on this device')}
            </Text>
            <Text style={s.body}>
              {t(
                'Cinema stores demo profiles, My List and viewing progress locally.',
              )}
            </Text>
            <Action
              id={occurrenceKey(id, 'privacy', 'summary')}
              label={
                privacyExpanded
                  ? 'Hide example data summary'
                  : 'View example data summary'
              }
              quiet
              onPress={() => setPrivacyExpanded(value => !value)}
            />
            {privacyExpanded && (
              <Text accessibilityLiveRegion="polite" style={s.body}>
                {t(
                  'Example profile activity · 3 saved titles · 2 titles in progress.',
                )}
              </Text>
            )}
          </View>
        ) : section === 'Credits' ? (
          <View style={s.creditList}>
            <View style={s.credits}>
              <Image
                accessible={false}
                source={require('../assets/cinematic/tmdb-attribution.png')}
                style={s.tmdbLogo}
                resizeMode="contain"
              />
              <Text accessible={appleTV ? false : undefined} style={s.muted}>
                {t(attribution)}
              </Text>
            </View>
            <Text accessibilityRole="header" style={s.virtualHeading}>
              {t('Live channels')}
            </Text>
            <Text style={s.muted}>
              {t('Channel directory · IPTV-org. Programme listings · EPGTalk.')}
            </Text>
            <Text style={s.muted}>
              {liveChannels.map(channel => channel.title).join(' · ')}
            </Text>
            <Text accessibilityRole="header" style={s.virtualHeading}>
              {t('Open films and sports')}
            </Text>
            <Text style={s.muted}>
              {t(
                'Big Buck Bunny, Sintel and Tears of Steel · Blender Foundation · CC BY 3.0. Playback sources include GARR, Mux and Internet Archive.',
              )}
            </Text>
            <Text style={s.muted}>
              {t(
                'World Cup results · OpenFootball · CC0 1.0. Men’s Triple Jump · FISUTV via Wikimedia Commons · CC BY 3.0.',
              )}
            </Text>
            <Text accessibilityRole="header" style={s.virtualHeading}>
              {t('Open-source software and artwork')}
            </Text>
            <Text style={s.muted}>
              {t(
                'Itar, React Native, React Native Video, HLS.js, and Feather icons.',
              )}
            </Text>
          </View>
        ) : (
          <View
            style={s.fill}
            onLayout={event => setHeight(event.nativeEvent.layout.height)}
          >
            {panelHeight > 0 && (
              <FocusVirtualizedRails
                id="settings-controls"
                rails={model.rails}
                itemExtent={viewport}
                viewportExtent={viewport}
                rowExtent={96 * u}
                viewportHeight={panelHeight}
                renderItem={renderItem}
              />
            )}
            {section === 'Diagnostics' && (
              <Text style={s.footer}>{sessionNote}</Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
}
