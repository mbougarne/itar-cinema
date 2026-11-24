import React, { useEffect } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { FocusScope, occurrenceKey } from '@bougarnem/itar/react';
import { Action } from './components/Action';
import { Picture } from './components/Picture';
import { liveChannels, type LiveChannel } from './live-source';
import { useCinemaLanguage } from './language';
import { useDesign } from './theme';

const guideKey = occurrenceKey('live', 'guide');

export function Live({
  active,
  onReady,
  onGuide,
  onWatch,
}: {
  active: boolean;
  onReady: (key: string) => void;
  onGuide: (key: string) => void;
  onWatch: (channel: LiveChannel, key: string) => void;
}) {
  const { t } = useCinemaLanguage();
  const { s } = useDesign();

  useEffect(() => {
    if (active) onReady(guideKey);
  }, [active, onReady]);

  return (
    <View style={s.fill}>
      <Action
        id={guideKey}
        label="TV guide"
        style={s.liveGuideAction}
        onPress={() => onGuide(guideKey)}
      />
      <Text accessibilityRole="header" style={s.heading}>
        {t('Live channels')}
      </Text>
      <FocusScope
        id="live-channels"
        layout="row"
        boundary="parent"
        style={s.fill}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.liveChannels}
        >
          {liveChannels.map((channel, index) => {
            const key = occurrenceKey('live', channel.id);

            return (
              <Action
                key={key}
                order={index}
                id={key}
                label={t('Watch live · {channel}', { channel: channel.title })}
                style={s.liveChannelCard}
                onPress={() => onWatch(channel, key)}
              >
                <View style={s.fill}>
                  <Picture
                    source={channel.artwork}
                    style={s.liveChannelImage}
                    fallback="Artwork unavailable"
                  />
                  <Text style={s.liveBadge}>● {t('LIVE')}</Text>
                  <Text numberOfLines={1} style={s.discoveryLabel}>
                    {channel.title}
                  </Text>
                  <Text style={s.muted}>{channel.category}</Text>
                </View>
              </Action>
            );
          })}
        </ScrollView>
      </FocusScope>
    </View>
  );
}
