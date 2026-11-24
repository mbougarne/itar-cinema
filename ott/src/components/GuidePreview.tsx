import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Text, View } from 'react-native';
import { occurrenceKey } from '@bougarnem/itar/react';
import type { VirtualizedFocusRail } from './CinemaRails';
import type { ProviderMode } from '../catalog-types';
import { guideTime, useGuide } from '../guide';
import { fixtureGuide, guideWindow } from '../guide-data';
import type { Programme } from '../guide-types';
import { useCinemaLanguage } from '../language';
import { useDesign } from '../theme';
import { Action } from './Action';

type Listing = {
  key: string;
  programme: Programme;
  channel: string;
  airing: boolean;
};

const selectedListing = createContext<string | undefined>(undefined);

export const HomeGuideSelection = selectedListing.Provider;

const listingTime = ({ start, stop }: Programme) =>
  `${guideTime(start)}–${guideTime(stop)}`;

function GuideCell({ listing }: { listing: Listing }) {
  const { s } = useDesign();
  const { t } = useCinemaLanguage();
  const selected = useContext(selectedListing);

  return (
    <View
      style={[
        s.homeGuideCell,
        (listing.airing || selected === listing.key) && s.currentProgramme,
      ]}
    >
      <Text numberOfLines={1} style={s.homeGuideTitle}>
        {listing.programme.title}
      </Text>
      <Text numberOfLines={1} style={s.homeGuideMeta}>
        {listingTime(listing.programme)}
        {listing.airing ? ` · ${t('On now')}` : ''}
      </Text>
    </View>
  );
}

function GuideSummary({ listings }: { listings: readonly Listing[] }) {
  const { s } = useDesign();
  const { t } = useCinemaLanguage();
  const selected = useContext(selectedListing);

  const listing =
    listings.find(value => value.key === selected) ??
    listings.find(value => value.airing) ??
    listings[0];

  return (
    <View
      testID="home-guide-summary"
      style={[s.homeGuidePanel, s.homeGuideSummary]}
    >
      <Text numberOfLines={1} style={s.homeGuideTitle}>
        {listing?.programme.title ?? t('No listings in this window')}
      </Text>
      {listing && (
        <Text numberOfLines={1} style={s.homeGuideMeta}>
          {listing.channel} · {listingTime(listing.programme)}
          {listing.programme.subtitle ? ` · ${listing.programme.subtitle}` : ''}
        </Text>
      )}
    </View>
  );
}

export function useHomeGuide(
  id: string,
  enabled: boolean,
  active: boolean,
  mode: ProviderMode,
  viewport: number,
  onTune?: (key: string) => void,
) {
  const { s, u } = useDesign();
  const { language, t } = useCinemaLanguage();
  const { guide } = useGuide(enabled && active, mode);
  const [now, setNow] = useState(() => Date.now() / 1000);
  const [requested, setRequested] = useState<number | null>(null);
  const [selected, setSelected] = useState<string>();

  useEffect(() => {
    if (!enabled || !active) return;

    setNow(Date.now() / 1000);

    const timer = setInterval(() => setNow(Date.now() / 1000), 60_000);

    return () => clearInterval(timer);
  }, [active, enabled]);

  const sample = !guide?.channels.length || mode === 'fixture';

  const fallback = useMemo(
    () =>
      enabled ? fixtureGuide(Math.floor(Date.now() / 1800000) * 1800) : null,
    [enabled],
  );

  const schedule = sample ? fallback : guide;

  const { start, end } = guideWindow(schedule, now, requested);

  const rails = useMemo((): VirtualizedFocusRail[] => {
    if (!enabled || !schedule) return [];

    const controls = [
      ['Previous', '‹  Previous', start - 3600],
      ['Now', 'Now', null],
      ['Next', 'Next  ›', start + 3600],
    ] as const;

    const items = controls.map(([label, display, time]) => ({
      occurrenceKey: occurrenceKey(id, 'tv-guide', label),
      accessibilityLabel: `${label} guide window`,
      displayLabel: language === 'ar-SA' ? t(label) : display,
      onPress: () => {
        setRequested(time);
        setSelected(undefined);
      },
    }));

    const date = new Date(start * 1000).toLocaleDateString(language, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

    const guideWidth = viewport - 104 * u;
    const channelWidth = 203 * u;
    const slotWidth = (guideWidth - channelWidth - 20 * u) / 4;
    const listings: Listing[] = [];

    return [
      {
        id: 'tv-guide',
        revealGroup: 'tv-guide',
        headerExtent: 0,
        rowExtent: 150 * u,
        items,
        renderBody: () => (
          <View style={[s.homeGuidePanel, s.homeGuideHeader]}>
            <Text accessibilityRole="header" style={s.virtualHeading}>
              {t('TV guide')}
            </Text>
            <View style={s.homeGuideTools}>
              <Text numberOfLines={1} style={s.homeGuideMeta}>
                {date} · {guideTime(start)}–{guideTime(end)} ·{' '}
                {sample ? t('Sample listings') : 'EPGTalk'}
              </Text>
              <View style={s.homeGuideButtons}>
                {items.map((item, order) => (
                  <Action
                    key={item.occurrenceKey}
                    id={item.occurrenceKey}
                    order={order}
                    label={item.accessibilityLabel}
                    displayLabel={item.displayLabel}
                    onPress={item.onPress}
                    style={s.homeGuideControl}
                    quiet
                  />
                ))}
              </View>
            </View>
            <View style={s.homeGuideTimes}>
              <Text style={[s.homeGuideMeta, { width: channelWidth }]}>
                {t('Channel')}
              </Text>
              {[0, 1, 2, 3].map(slot => (
                <Text
                  key={slot}
                  style={[s.homeGuideMeta, { width: slotWidth }]}
                >
                  {guideTime(start + slot * 1800)}
                </Text>
              ))}
            </View>
          </View>
        ),
      },
      ...schedule.channels
        .slice(0, 3)
        .map((channel, index): VirtualizedFocusRail => {
          const entries = channel.programmes
            .filter(p => p.stop > start && p.start < end)
            .slice(0, 6)
            .map(programme => ({
              key: occurrenceKey(
                id,
                'tv-guide',
                channel.id,
                String(programme.start),
              ),
              channel: channel.name,
              programme,
              airing: programme.start <= now && now < programme.stop,
            }));

          listings.push(...entries);

          return {
            id: `tv-guide-line-${index}`,
            revealGroup: 'tv-guide',
            headerExtent: 0,
            rowExtent: 82 * u,
            items: entries.map(listing => ({
              occurrenceKey: listing.key,
              accessibilityLabel: `${listing.programme.title}, ${
                listing.channel
              }, ${listingTime(listing.programme)}`,
              onPress: () => {
                setSelected(listing.key);
                onTune?.(listing.key);
              },
            })),
            renderBody: () => (
              <View style={[s.homeGuidePanel, s.homeGuideLine]}>
                <View style={[s.homeGuideChannel, { width: channelWidth }]}>
                  <Text accessible={false} style={s.homeGuideMonogram}>
                    {channel.name.charAt(0)}
                  </Text>
                  <View style={s.fill}>
                    <Text numberOfLines={1} style={s.homeGuideTitle}>
                      {channel.name}
                    </Text>
                    <Text style={s.homeGuideMeta}>
                      {String(index + 1).padStart(2, '0')}
                    </Text>
                  </View>
                </View>
                <View style={s.fill}>
                  {entries.map((listing, order) => {
                    const left =
                      ((Math.max(start, listing.programme.start) - start) /
                        1800) *
                      slotWidth;

                    const next = entries[order + 1]?.programme.start ?? end;

                    const right =
                      ((Math.min(end, next, listing.programme.stop) - start) /
                        1800) *
                      slotWidth;

                    return (
                      <Action
                        key={listing.key}
                        id={listing.key}
                        order={order}
                        label={`${listing.programme.title}, ${
                          listing.channel
                        }, ${listingTime(listing.programme)}`}
                        style={[
                          s.homeGuideProgramme,
                          { start: left, width: right - left },
                        ]}
                        onPress={() => {
                          setSelected(listing.key);
                          onTune?.(listing.key);
                        }}
                        quiet
                      >
                        <GuideCell listing={listing} />
                      </Action>
                    );
                  })}
                  {start <= now && now < end && (
                    <View
                      pointerEvents="none"
                      style={[
                        s.homeGuideMarker,
                        { start: ((now - start) * slotWidth) / 1800 },
                      ]}
                    />
                  )}
                </View>
              </View>
            ),
          };
        }),
      {
        id: 'tv-guide-summary',
        revealGroup: 'tv-guide',
        headerExtent: 0,
        rowExtent: 80 * u + 42,
        items: [],
        renderBody: () => <GuideSummary listings={listings} />,
      },
    ];
  }, [
    enabled,
    schedule,
    id,
    start,
    end,
    now,
    sample,
    s,
    u,
    viewport,
    onTune,
    t,
    language,
  ]);

  return { rails, selected };
}
