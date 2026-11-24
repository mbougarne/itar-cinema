import React, { useEffect, useState } from 'react';
import { BackHandler, Text, View } from 'react-native';
import {
  FocusScope,
  occurrenceKey,
  useFocusCommands,
  useFocusReady,
  useScreenReaderEnabled,
} from '@bougarnem/itar/react';
import { captionAccessible } from './tv-accessibility';
import { Action } from './components/Action';
import { useCinemaLanguage } from './language';
import { useDesign } from './theme';
import { guideTime, useGuide } from './guide';
import type { ProviderMode } from './catalog-types';
import type { Programme } from './guide-types';
import { guideWindow } from './guide-data';

type Selection = { programme: Programme; key: string; channel: string };

export default function Epg({
  onClose,
  onTune,
  active,
  mode,
}: {
  onClose: () => void;
  onTune: (key: string) => void;
  active: boolean;
  mode: ProviderMode;
}) {
  const { t, language } = useCinemaLanguage();
  const { s, u } = useDesign();
  const offline = mode === 'fixture';
  const { guide, error, retry } = useGuide(true, mode);
  const [selection, setSelection] = useState<Selection | null>(null);
  const selected = selection?.programme;
  const [requested, setRequested] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now() / 1000);
  const commands = useFocusCommands();
  const ready = useFocusReady();
  const reader = useScreenReaderEnabled();

  useEffect(() => {
    if (!ready || !active || reader) return;

    const request = commands.focusByKey(
      selection?.key ?? occurrenceKey('epg', 'back'),
    );

    return () => request.cancel();
  }, [active, commands, ready, reader, selection?.key]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now() / 1000), 60000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!active) return false;

      onClose();

      return true;
    });

    return () => listener.remove();
  }, [onClose, active]);

  const { start, end, previous, next } = guideWindow(guide, now, requested);

  const move = (time: number | null) => {
    setSelection(null);
    setRequested(time);
  };

  const scale = (1380 * u) / (end - start);

  return (
    <View style={s.fill}>
      <FocusScope
        active={active}
        accessibilityPaneTitle={reader ? 'TV guide' : undefined}
        preferredKey={
          reader ? selection?.key ?? occurrenceKey('epg', 'back') : undefined
        }
        id="guide"
        layout="spatial"
        style={[s.profilePage, { padding: 48 * u }, !active && s.hidden]}
      >
        <View style={[s.row, s.guideHeader]}>
          <Action
            id={occurrenceKey('epg', 'back')}
            label="Back to Home"
            tvDescription={
              offline
                ? 'Offline TV guide. Sample channels. Times are local.'
                : 'TV guide. EPGTalk, US local channels. Times are local. Select a programme to tune a live channel.'
            }
            onPress={onClose}
            style={{ width: 260 * u }}
          />
          <Text
            accessibilityRole="header"
            accessible={captionAccessible}
            style={s.messageTitle}
          >
            {t('TV guide')}
          </Text>
          <Text accessible={captionAccessible} style={s.muted}>
            {offline
              ? t('Offline guide · Sample channels · Your local time')
              : t('EPGTalk · US local channels · Your local time')}
          </Text>
        </View>
        <FocusScope
          id="guide-time"
          layout="row"
          boundary="parent"
          style={s.filters}
        >
          <Action
            id={occurrenceKey('epg', 'previous')}
            label="Previous hour"
            displayLabel="‹  Previous"
            enabled={previous}
            onPress={() => move(start - 3600)}
            style={s.filter}
          />
          <Action
            order={1}
            id={occurrenceKey('epg', 'now')}
            label="Now"
            tvDescription={`${new Date(
              start * 1000,
            ).toLocaleDateString()}, ${guideTime(start)} to ${guideTime(end)}`}
            onPress={() => move(null)}
            style={s.filter}
          />
          <Action
            order={2}
            id={occurrenceKey('epg', 'next')}
            label="Next hour"
            displayLabel="Next  ›"
            enabled={next}
            onPress={() => move(start + 3600)}
            style={s.filter}
          />
          <Text accessible={captionAccessible} style={s.muted}>
            {new Date(start * 1000).toLocaleDateString()} · {guideTime(start)}–
            {guideTime(end)}
          </Text>
        </FocusScope>
        <View style={[s.guideRow, { marginLeft: 212 * u }]}>
          {[0, 1, 2, 3].map(slot => (
            <Text
              accessible={captionAccessible}
              key={slot}
              style={[s.muted, { width: 345 * u - 12 * u }]}
            >
              {guideTime(start + slot * 1800)}
            </Text>
          ))}
        </View>
        {guide?.channels.map(channel => (
          <FocusScope
            key={channel.id}
            id={`channel-${channel.id}`}
            layout="row"
            boundary="parent"
            style={s.guideRow}
          >
            <View style={s.guideTitle}>
              <Text
                accessible={captionAccessible}
                numberOfLines={2}
                style={s.muted}
              >
                {channel.name}
              </Text>
            </View>
            <View style={{ width: 1380 * u, height: 84 * u }}>
              {!channel.programmes.some(
                p => p.stop > start && p.start < end,
              ) && (
                <Text accessible={captionAccessible} style={s.muted}>
                  {t('No listings for this time')}
                </Text>
              )}
              {channel.programmes
                .filter(p => p.stop > start && p.start < end)
                .slice(0, 12)
                .map((p, order) => {
                  const left = (Math.max(p.start, start) - start) * scale;

                  const width =
                    (Math.min(p.stop, end) - Math.max(p.start, start)) * scale;

                  const key = occurrenceKey('epg', channel.id, String(p.start));
                  const current = p.start <= now && p.stop > now;

                  return (
                    <Action
                      key={p.start}
                      order={order}
                      id={key}
                      label={`${channel.name}, ${p.title}, ${t(
                        '{start} to {end}',
                        {
                          start: guideTime(p.start),
                          end: guideTime(p.stop),
                        },
                      )}${current ? `, ${t('on now')}` : ''}`}
                      tvDescription={p.subtitle}
                      displayLabel={`${guideTime(p.start)}  ${p.title}`}
                      onPress={() => {
                        setSelection({
                          programme: p,
                          key,
                          channel: channel.name,
                        });

                        setRequested(start);
                        onTune(key);
                      }}
                      style={[
                        s.guideCell,
                        s.programmePosition,
                        current && s.currentProgramme,
                        {
                          start: left,
                          height: 84 * u,
                          width: Math.max(1, width - 6 * u),
                        },
                      ]}
                    />
                  );
                })}
            </View>
          </FocusScope>
        ))}
        {(!guide || !guide.channels.length || error) && (
          <View style={s.message}>
            <Text accessible={captionAccessible} style={s.body}>
              {t(
                error ||
                  (guide
                    ? 'No current listings in this schedule. Refresh later.'
                    : 'Loading the TV guide…'),
              )}
            </Text>
            <Action
              id={occurrenceKey('epg', 'retry')}
              label="Refresh guide"
              tvDescription={
                error ||
                (guide ? 'No current listings.' : 'Loading the TV guide.')
              }
              onPress={retry}
            />
          </View>
        )}
        <Text accessible={captionAccessible} numberOfLines={2} style={s.body}>
          {selected
            ? `${selected.title} · ${guideTime(selected.start)}–${guideTime(
                selected.stop,
              )}${selected.subtitle ? ` · ${selected.subtitle}` : ''}`
            : t('Select a programme to tune a live channel.')}
        </Text>
        <Text accessible={captionAccessible} style={s.footer}>
          {offline
            ? t('Sample schedule · Live playback')
            : t('Programme listings · EPGTalk / epgtalk.com')}
          {guide
            ? ` · ${t('Updated {date}', {
                date: new Date(guide.updated).toLocaleString(language),
              })}`
            : ''}
        </Text>
      </FocusScope>
    </View>
  );
}
