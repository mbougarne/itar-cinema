import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  AppState,
  Image,
  BackHandler,
  Platform,
  TVFocusGuideView,
  Text,
  View,
  ScrollView,
  useTVEventHandler,
  type HWEvent,
} from 'react-native';
import Video, { SelectedTrackType } from 'react-native-video';
import type { VideoRef } from 'react-native-video';
import {
  Focusable,
  FocusScope,
  occurrenceKey,
  useFocusCommands,
  useFocusReady,
  useFocusState,
  useScreenReaderEnabled,
} from '@bougarnem/itar/react';
import { captionAccessible } from './tv-accessibility';
import { Action } from './components/Action';
import { Picture } from './components/Picture';
import { IconAction } from './components/IconAction';
import { icons } from './artwork';
import { useCinemaLanguage } from './language';
import { useDesign } from './theme';

import { usePlaybackControls } from './usePlaybackControls';
import { formatPlaybackTime } from './playback-time';

import { bigBuckBunny } from './demo-stream';
import { PlaybackHistory, type PlayerProps } from './playback-history';

// A full-width UIKit guide connects the centered transport to the top-right
// actions. Only the actual controls are accessibility elements or receive focus.
const appleTV = Platform.OS === 'ios' && Platform.isTV;
const ControlBand = appleTV ? TVFocusGuideView : View;

const wakeFocusStyle = {
  accentColor: 'transparent',
  backgroundColor: 'transparent',
};

const bufferConfig = {
  minBufferMs: 5000,
  maxBufferMs: 15000,
  bufferForPlaybackMs: 1000,
  bufferForPlaybackAfterRebufferMs: 2000,
  backBufferDurationMs: 0,
  cacheSizeMB: 0,
};

export default function Playback({
  title,
  media = bigBuckBunny,
  choices,
  channels,
  languages,
  autoNext = false,
  onClose,
  startPosition,
  onCheckpoint,
  onPlaybackStarted,
}: PlayerProps) {
  const { t } = useCinemaLanguage();
  const { s, u, colors } = useDesign();

  const timelineFocusStyle = {
    accentColor: colors.actionRing,
    backgroundColor: colors.focusFill,
  };

  const source = useMemo(() => ({ ...media.native, bufferConfig }), [media]);

  const video = useRef<VideoRef>(null);
  const [paused, setPaused] = useState(false);
  const focus = useFocusState();
  const [showChannels, setShowChannels] = useState(false);
  const showingChannels = useRef(false);
  const restoreChannelButton = useRef(false);

  const setChannelDrawer = (value: boolean) => {
    restoreChannelButton.current = !value;
    showingChannels.current = value;
    setShowChannels(value);
  };

  const cards = choices?.episodes.length ? choices.episodes : choices?.related;

  const stripFocused = cards?.some(
    item => focus.occurrenceKey === occurrenceKey('player', 'choice', item.key),
  );

  const stripHeight = stripFocused ? 176 * u : 13 * u;
  const nextChoice = choices?.nextEpisode ?? choices?.related[0];

  const nextLabel = choices?.startsNextSeason
    ? 'Play next season'
    : 'Play next';

  const [foreground, setForeground] = useState(
    AppState.currentState === 'active',
  );

  const [playing, setPlaying] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [readyFrame, setReadyFrame] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [buffering, setBuffering] = useState(true);
  const [time, setTime] = useState(0);
  const position = useRef(0);
  const ended = useRef(false);
  const pendingSeek = useRef<number | null>(null);
  const historyRef = useRef<PlaybackHistory | null>(null);

  if (!historyRef.current)
    historyRef.current = new PlaybackHistory(startPosition, onCheckpoint);

  const history = historyRef.current;

  useEffect(() => () => history.flush(), [history]);

  const commands = useFocusCommands();
  const ready = useFocusReady();
  const reader = useScreenReaderEnabled();

  const readerLayout = appleTV && reader === true;
  const bandProps = appleTV ? { autoFocus: true, accessible: false } : {};

  const { visible, wake, cancelHide } = usePlaybackControls(
    ready &&
      loaded &&
      playing &&
      !buffering &&
      !paused &&
      !stripFocused &&
      !showChannels &&
      !error &&
      foreground &&
      reader === false,
  );

  const onRemote = useCallback(
    (event: HWEvent) => {
      // Siri Remote trackpad swipes arrive without a key-down or key-up phase.
      if (appleTV && /^swipe(up|down|left|right)$/i.test(event.eventType)) {
        wake();

        return;
      }

      if (
        !/^(long)?(up|down|left|right|select|playPause)$/i.test(event.eventType)
      ) {
        return;
      }

      // Wait for release so a held wake key cannot act on newly mounted controls.
      if (event.eventKeyAction === 0) {
        cancelHide();
      } else if (event.eventKeyAction === 1 || event.eventKeyAction == null) {
        wake();
      }
    },
    [cancelHide, wake],
  );

  useTVEventHandler(onRemote);

  useEffect(() => {
    if (!ready || readerLayout) {
      return;
    }

    const target = showChannels
      ? 'close-channels'
      : !visible
      ? 'wake'
      : restoreChannelButton.current
      ? 'channels'
      : 'pause';

    if (visible) restoreChannelButton.current = false;

    const request = commands.focusByKey(occurrenceKey('player', target));

    return () => request.cancel();
  }, [commands, ready, visible, readerLayout, showChannels]);

  useEffect(() => {
    const event = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showingChannels.current) setChannelDrawer(false);
      else onClose();

      return true;
    });

    return () => event.remove();
  }, [onClose]);

  useEffect(() => {
    const event = AppState.addEventListener('change', value =>
      setForeground(value === 'active'),
    );

    return () => event.remove();
  }, []);

  const seekTo = (value: number) => {
    wake();

    if (!loaded || !video.current) {
      return;
    }

    const next = Math.max(0, Math.min(duration, value));

    ended.current = false;
    position.current = next;
    pendingSeek.current = next;
    setTime(next);
    video.current.seek(next);
  };

  const seek = (offset: number) => seekTo(position.current + offset);

  const togglePlayback = () => {
    wake();

    if (
      paused &&
      loaded &&
      duration > 0 &&
      (ended.current || position.current >= duration - 1)
    ) {
      seekTo(0);
      setPaused(false);

      return;
    }

    setPaused(value => !value);
  };

  return (
    <View style={s.player}>
      <Video
        key={attempt}
        ref={video}
        source={source}
        style={s.video}
        resizeMode="contain"
        accessible={false}
        accessibilityElementsHidden={appleTV}
        controls={false}
        focusable={false}
        showNotificationControls={false}
        muted={muted}
        selectedAudioTrack={
          languages?.audio
            ? { type: SelectedTrackType.LANGUAGE, value: languages.audio }
            : { type: SelectedTrackType.SYSTEM }
        }
        selectedTextTrack={
          languages?.subtitles
            ? { type: SelectedTrackType.LANGUAGE, value: languages.subtitles }
            : { type: SelectedTrackType.DISABLED }
        }
        paused={paused || !foreground}
        maxBitRate={1500000}
        playInBackground={false}
        playWhenInactive={false}
        progressUpdateInterval={2000}
        onPlaybackStateChanged={event => {
          setPlaying(event.isPlaying);

          if (event.isPlaying) {
            history.playing();
            onPlaybackStarted?.();
          } else {
            history.flush();
          }
        }}
        onLoad={event => {
          ended.current = false;
          setDuration(event.duration);

          const resume = history.resumeAt(event.duration);

          if (resume > 0) {
            pendingSeek.current = resume;
            position.current = resume;
            setTime(resume);
            video.current?.seek(resume);
          }

          setLoaded(true);
          setError(false);
          setBuffering(false);
        }}
        onReadyForDisplay={() => setReadyFrame(true)}
        onBuffer={event => setBuffering(event.isBuffering)}
        onProgress={event => {
          // A no-op seek at a boundary may not emit onSeek; matching progress
          // also confirms arrival so the displayed clock cannot stay frozen.
          if (
            pendingSeek.current === null ||
            Math.abs(event.currentTime - pendingSeek.current) < 2.5
          ) {
            pendingSeek.current = null;
            position.current = event.currentTime;
            setTime(event.currentTime);
            history.progress(event.currentTime, duration);
          }
        }}
        onSeek={event => {
          // Ignore a completion from an older key press during rapid scrubbing.
          if (
            pendingSeek.current !== null &&
            Math.abs(event.seekTime - pendingSeek.current) < 0.5
          ) {
            pendingSeek.current = null;
          }
        }}
        onError={() => {
          setError(true);
          setLoaded(false);
        }}
        onEnd={() => {
          // A completion from the old end position can arrive after replay seeks.
          if (
            pendingSeek.current !== null &&
            pendingSeek.current < duration - 1
          ) {
            return;
          }

          ended.current = true;
          history.ended(duration);
          pendingSeek.current = null;
          position.current = duration;
          setTime(duration);
          setPaused(true);

          if (autoNext) choices?.nextEpisode?.play();
        }}
      />
      {foreground &&
        !error &&
        (!loaded || (!paused && (buffering || (!readyFrame && !playing)))) && (
          <View pointerEvents="none" accessible={false} style={s.playerLoading}>
            <View style={s.playerLoadingBadge}>
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
          </View>
        )}
      {showChannels ? (
        <FocusScope
          id="live-channels-drawer"
          layout="column"
          boundary="parent"
          accessibilityPaneTitle="Live channels"
          preferredKey={occurrenceKey('player', 'close-channels')}
          style={s.livePlayerDrawer}
        >
          <Text style={s.heading} accessibilityRole="header">
            {t('Live channels')}
          </Text>
          <Action
            label="Close channels"
            id={occurrenceKey('player', 'close-channels')}
            quiet
            onPress={() => setChannelDrawer(false)}
          />
          <ScrollView style={s.fill} showsVerticalScrollIndicator={false}>
            {channels?.map((channel, index) => (
              <Action
                key={channel.key}
                order={index + 1}
                id={occurrenceKey('player', 'channel', channel.key)}
                label={channel.title}
                tvDescription={channel.current ? 'Watching now' : channel.note}
                quiet
                style={s.livePlayerChannel}
                onPress={
                  channel.current ? () => setChannelDrawer(false) : channel.play
                }
              >
                <View style={s.livePlayerChannelCopy}>
                  <Picture
                    source={channel.artwork}
                    style={s.livePlayerChannelImage}
                    fallback=""
                  />
                  <View style={s.fill}>
                    <Text style={s.muted}>
                      {index + 1} · {channel.note}
                    </Text>
                    <Text numberOfLines={1} style={s.body}>
                      {channel.title}
                    </Text>
                    <Text style={s.muted}>
                      {channel.current ? 'Watching now' : 'Live now'}
                    </Text>
                  </View>
                </View>
              </Action>
            ))}
          </ScrollView>
        </FocusScope>
      ) : visible ? (
        // Static scopes share the default order. Their keys order the header
        // before transport within this column, with the timeline ordered last.
        <FocusScope
          id="playback"
          layout="column"
          style={s.fill}
          accessibilityPaneTitle={readerLayout ? 'Player' : undefined}
          preferredKey={
            readerLayout ? occurrenceKey('player', 'pause') : undefined
          }
        >
          <ControlBand {...bandProps} style={s.playerHeader}>
            <View style={s.fill}>
              <Text accessible={captionAccessible} style={s.playerTitle}>
                {media.name}
              </Text>
              <Text
                accessible={captionAccessible}
                numberOfLines={1}
                style={s.muted}
              >
                {media.live
                  ? `● ${t('LIVE')}`
                  : title === media.name
                  ? 'Open film'
                  : t('Demo for {title}', { title })}
              </Text>
            </View>
            <FocusScope
              id="header-actions"
              layout="row"
              boundary="parent"
              style={s.playerControls}
            >
              {!!channels?.length && (
                <Action
                  id={occurrenceKey('player', 'channels')}
                  order={-1}
                  label="Channels & content"
                  quiet
                  onPress={() => setChannelDrawer(true)}
                />
              )}
              <IconAction
                order={0}
                id={occurrenceKey('player', 'restart')}
                label={error ? 'Retry stream' : 'Restart'}
                enabled={!media.live || error}
                tvDescription={
                  error ? 'The public test stream could not load.' : undefined
                }
                icon={icons.restart}
                onPress={() => {
                  wake();

                  if (error) {
                    setAttempt(value => value + 1);
                    setError(false);
                    setLoaded(false);
                    setReadyFrame(false);
                    setBuffering(true);
                    setTime(0);
                    position.current = 0;
                    pendingSeek.current = null;
                    setDuration(0);
                  } else {
                    seekTo(0);
                  }

                  setPaused(false);
                }}
              />
              <IconAction
                order={1}
                id={occurrenceKey('player', 'mute')}
                label={muted ? 'Unmute' : 'Mute'}
                icon={muted ? icons.muted : icons.volume}
                onPress={() => {
                  wake();
                  setMuted(value => !value);
                }}
              />
              <IconAction
                order={2}
                id={occurrenceKey('player', 'close')}
                label="Close player"
                icon={icons.close}
                onPress={onClose}
              />
            </FocusScope>
          </ControlBand>
          <ControlBand {...bandProps} style={s.playerTransport}>
            <FocusScope
              id="transport"
              layout="row"
              boundary="parent"
              style={s.playerControls}
            >
              <IconAction
                order={0}
                id={occurrenceKey('player', 'rewind')}
                label="Rewind 10 seconds"
                icon={icons.rewind}
                enabled={loaded && !media.live}
                onPress={() => seek(-10)}
              />
              <IconAction
                order={1}
                id={occurrenceKey('player', 'pause')}
                label={paused ? 'Play' : 'Pause'}
                tvDescription={`${media.name}${
                  title === media.name
                    ? ''
                    : ` · ${t('Demo for {title}', { title })}`
                }. ${
                  error
                    ? 'Playback unavailable.'
                    : !loaded
                    ? 'Loading.'
                    : buffering
                    ? 'Buffering.'
                    : ''
                }`}
                icon={paused ? icons.play : icons.pause}
                size={108}
                onPress={togglePlayback}
              />
              <IconAction
                order={2}
                id={occurrenceKey('player', 'forward')}
                label="Forward 10 seconds"
                icon={icons.forward}
                enabled={loaded && !media.live}
                onPress={() => seek(10)}
              />
            </FocusScope>
          </ControlBand>
          <View
            style={[s.playerChrome, !!cards?.length && { bottom: stripHeight }]}
          >
            {nextChoice && (
              <Action
                id={occurrenceKey('player', 'next')}
                label={`${t(nextLabel)} · ${t(nextChoice.title)}`}
                displayLabel=""
                style={s.playerNext}
                onPress={nextChoice.play}
              >
                <View>
                  <Picture
                    source={nextChoice.artwork}
                    fallback=""
                    style={{
                      width: 96 * u,
                      height: 54 * u,
                      borderRadius: 5 * u,
                    }}
                  />
                  <Image
                    accessible={false}
                    source={icons.forward}
                    style={s.playerNextIcon}
                  />
                </View>
                <View style={s.fill}>
                  <Text accessible={false} style={s.footer}>
                    {t(nextLabel)}
                  </Text>
                  <Text
                    accessible={false}
                    numberOfLines={1}
                    style={s.detailCardCaption}
                  >
                    {t(nextChoice.title)}
                  </Text>
                </View>
              </Action>
            )}
            <View style={s.playerMeta}>
              <Text accessible={captionAccessible} style={s.muted}>
                {media.live
                  ? `● ${t('LIVE')}`
                  : `${formatPlaybackTime(time)} / ${formatPlaybackTime(
                      duration,
                    )}`}
              </Text>
              <Text accessible={captionAccessible} style={s.playerStatus}>
                {t(
                  error
                    ? 'Playback unavailable'
                    : !loaded
                    ? 'Loading…'
                    : buffering
                    ? 'Buffering…'
                    : paused
                    ? 'Paused'
                    : 'Playing',
                )}
              </Text>
            </View>
            {error && (
              <Text accessible={captionAccessible} style={s.muted}>
                {t(
                  'The public test stream could not load. Select Retry stream to try again.',
                )}
              </Text>
            )}
            {media.live && <View style={s.livePlayerTrack} />}
            {!media.live && (
              <Focusable
                occurrenceKey={occurrenceKey('player', 'timeline')}
                order={1}
                displayLabel=""
                enabled={loaded}
                accessibilityLabel={t(
                  'Timeline, {elapsed} of {duration}. Left or right seeks 10 seconds. Select plays or pauses.',
                  {
                    elapsed: formatPlaybackTime(time),
                    duration: formatPlaybackTime(duration),
                  },
                )}
                onAdjust={delta => seek(delta * 10)}
                onPress={togglePlayback}
                focusStyle={timelineFocusStyle}
                style={s.timelineAction}
              >
                <View style={s.timelineInset}>
                  <View style={s.playerTrack}>
                    <View
                      style={[
                        s.playerProgress,
                        {
                          width: `${
                            duration
                              ? Math.min(100, (time / duration) * 100)
                              : 0
                          }%`,
                        },
                      ]}
                    />
                    <View
                      style={[
                        s.timelineThumb,
                        {
                          left: `${
                            duration
                              ? Math.min(100, (time / duration) * 100)
                              : 0
                          }%`,
                        },
                      ]}
                    />
                  </View>
                </View>
              </Focusable>
            )}
            <Text accessible={captionAccessible} style={s.footer}>
              {media.name} · {media.credit}
              {!media.live && ' · creativecommons.org/licenses/by/3.0/'}
            </Text>
          </View>
          {!!cards?.length && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={[s.playerSuggestions, { height: stripHeight }]}
              scrollEnabled={stripFocused}
            >
              <FocusScope
                id="choices"
                layout="row"
                boundary="parent"
                style={s.row}
              >
                {cards.map((item, index) => {
                  const id = occurrenceKey('player', 'choice', item.key);

                  return (
                    <Action
                      key={item.key}
                      order={index}
                      id={id}
                      label={item.title}
                      displayLabel=""
                      quiet
                      style={[s.playerChoice, { height: stripHeight }]}
                      onPress={item.play}
                    >
                      <Picture
                        source={item.artwork}
                        fallback="Artwork unavailable"
                        style={{
                          width: 236 * u,
                          height: 133 * u,
                          borderRadius: 5 * u,
                        }}
                      />
                      {focus.occurrenceKey === id && (
                        <Text
                          accessible={false}
                          numberOfLines={1}
                          style={s.detailCardCaption}
                        >
                          {t(item.title)}
                        </Text>
                      )}
                    </Action>
                  );
                })}
              </FocusScope>
            </ScrollView>
          )}
        </FocusScope>
      ) : (
        <Focusable
          occurrenceKey={occurrenceKey('player', 'wake')}
          accessibilityLabel="Show player controls"
          displayLabel=""
          baseAccentColor="transparent"
          focusStyle={wakeFocusStyle}
          style={s.video}
          onPress={wake}
        >
          <View />
        </Focusable>
      )}
    </View>
  );
}
