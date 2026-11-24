import React, {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import Hls from 'hls.js';
import { BackHandler } from '../../web/platform';
import PlaybackIcon from '../../web/PlaybackIcon';
import { BrowserNavigation } from './browser-navigation';
import { useCinemaLanguage } from './language';
import { useDesign } from './theme';
import { formatPlaybackTime } from './playback-time';
import { usePlaybackControls } from './usePlaybackControls';

import { Picture } from './components/Picture';
import { bigBuckBunny } from './demo-stream';
import { PlaybackHistory, type PlayerProps } from './playback-history';

const legacyKeys: Record<number, string> = {
  13: 'Enter',
  32: ' ',
  37: 'ArrowLeft',
  38: 'ArrowUp',
  39: 'ArrowRight',
  40: 'ArrowDown',
};

const playerRows = [
  'header',
  'progress',
  'next',
  'transport',
  'related',
] as const;

const suggestionArtwork = {
  width: '100%',
  height: '100%',
  borderRadius: 5,
} as const;

function remoteKey(event: React.KeyboardEvent) {
  // Some TV browsers send keyCode with a missing or unidentified key.
  return event.key && event.key !== 'Unidentified'
    ? event.key
    : legacyKeys[event.keyCode] ?? '';
}

export default function Player({
  title,
  artwork,
  media: asset = bigBuckBunny,
  choices,
  channels,
  languages,
  autoNext = false,
  onClose,
  startPosition,
  onCheckpoint,
  onPlaybackStarted,
}: PlayerProps) {
  const { t, rtl } = useCinemaLanguage();
  const { colors } = useDesign();

  const chromeColors = {
    '--player-accent': colors.accent,
    '--player-button': colors.playerButton,
    '--player-hover': colors.playerHover,
    '--player-selection': colors.playerFocus,
    '--player-focus-ring': colors.actionRing,
  } as React.CSSProperties;

  const video = useRef<HTMLVideoElement>(null);
  const playButton = useRef<HTMLButtonElement>(null);
  const channelButton = useRef<HTMLButtonElement>(null);
  const drawerClose = useRef<HTMLButtonElement>(null);
  const channelDrawerOpen = useRef(false);
  const [showChannels, setShowChannels] = useState(false);
  const dialog = useRef<HTMLElement>(null);
  const suggestionRail = useRef<HTMLDivElement>(null);
  const lastControl = useRef<HTMLButtonElement | HTMLInputElement | null>(null);
  const wakeKey = useRef('');
  const alive = useRef(true);
  const mutedAtLaunch = useRef(!!asset.live);
  const [paused, setPaused] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(!!asset.live);
  const [volume, setVolume] = useState(1);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState('Loading video…');
  const [stripFocused, setStripFocused] = useState(false);

  const setChannelDrawer = useCallback((open: boolean) => {
    channelDrawerOpen.current = open;
    setShowChannels(open);

    if (!open) requestAnimationFrame(() => channelButton.current?.focus());
  }, []);

  useLayoutEffect(() => {
    if (showChannels) drawerClose.current?.focus();
  }, [showChannels]);

  const audio = languages?.audio;
  const subtitles = languages?.subtitles;
  const cards = choices?.episodes.length ? choices.episodes : choices?.related;
  const nextChoice = choices?.nextEpisode ?? choices?.related[0];

  const nextLabel = choices?.startsNextSeason
    ? 'Play next season'
    : 'Play next';

  const loading =
    !failed && (status === 'Loading video…' || status === 'Buffering…');

  const historyRef = useRef<PlaybackHistory | null>(null);

  if (!historyRef.current)
    historyRef.current = new PlaybackHistory(startPosition, onCheckpoint);

  const history = historyRef.current;

  const directionalNavigationEnabled =
    useContext(BrowserNavigation)?.enabled ?? true;

  const { visible, wake, cancelHide } = usePlaybackControls(
    playing &&
      !paused &&
      !failed &&
      !stripFocused &&
      !showChannels &&
      directionalNavigationEnabled,
  );

  useLayoutEffect(() => {
    if (!visible) {
      // Keep remote and Tab events in the modal when its focused button disappears.
      dialog.current?.focus();
    } else if (document.activeElement === dialog.current) {
      const control = lastControl.current;

      (control && !control.disabled ? control : playButton.current)?.focus();
    }
  }, [visible]);

  const play = useCallback(async () => {
    const media = video.current;

    if (!media) {
      return;
    }

    try {
      if (media.ended) {
        media.currentTime = 0;
      }

      await media.play();
    } catch (error) {
      if (
        !alive.current ||
        (error instanceof Error && error.name === 'AbortError')
      ) {
        return;
      }

      if (error instanceof Error && error.name === 'NotAllowedError') {
        setStatus('Press Play to start.');
      } else {
        setFailed(true);
        setStatus('Video could not play. Check your connection and retry.');
      }
    }
  }, []);

  useEffect(() => {
    alive.current = true;

    const media = video.current;

    playButton.current?.focus();

    let stream: Hls | undefined;

    const selectTextTrack = () => {
      for (const track of Array.from(media?.textTracks ?? [])) {
        const match =
          subtitles && track.language.toLowerCase().split('-')[0] === subtitles;

        track.mode = match ? 'showing' : 'disabled';

        if (match) break;
      }
    };

    if (!asset.live || !Hls.isSupported())
      media?.textTracks?.addEventListener('addtrack', selectTextTrack);

    if (!asset.live || !Hls.isSupported())
      media?.addEventListener('loadedmetadata', selectTextTrack);

    if (!asset.live) {
      play();
    } else if (media && Hls.isSupported()) {
      stream = new Hls({ startLevel: 0, capLevelToPlayerSize: true });
      media.muted = mutedAtLaunch.current;

      let recovered = false;

      stream.on(Hls.Events.MANIFEST_PARSED, () => {
        if (alive.current && !document.hidden) play();
      });

      stream.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_, event) => {
        const track = audio
          ? event.audioTracks.findIndex(
              value => value.lang?.toLowerCase().split('-')[0] === audio,
            )
          : -1;

        if (stream && track >= 0) stream.audioTrack = track;
      });

      stream.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_, event) => {
        if (stream)
          stream.subtitleTrack = subtitles
            ? event.subtitleTracks.findIndex(
                value => value.lang?.toLowerCase().split('-')[0] === subtitles,
              )
            : -1;
      });

      stream.on(Hls.Events.ERROR, (_, error) => {
        if (!error.fatal || !alive.current) return;

        if (error.type === Hls.ErrorTypes.MEDIA_ERROR && stream && !recovered) {
          recovered = true;
          stream.autoLevelCapping = 0;
          stream.recoverMediaError();

          return;
        }

        setFailed(true);
        setPlaying(false);
        setStatus('This channel could not load. Select Retry to reconnect.');
      });

      stream.attachMedia(media);
      stream.loadSource(asset.web);
    } else if (media?.canPlayType('application/vnd.apple.mpegurl')) {
      media.muted = mutedAtLaunch.current;
      media.src = asset.web;
      play();
    } else {
      setFailed(true);
      setStatus('This browser cannot play HLS channels.');
    }

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (channelDrawerOpen.current) {
          setChannelDrawer(false);

          return true;
        }

        media?.pause();
        onClose();

        return true;
      },
    );

    const pause = () => {
      if (document.hidden) {
        wakeKey.current = '';
        setPlaying(false);
        media?.pause();
      }
    };

    document.addEventListener('visibilitychange', pause);

    return () => {
      alive.current = false;
      history.flush();
      subscription.remove();
      document.removeEventListener('visibilitychange', pause);
      stream?.destroy();
      media?.textTracks?.removeEventListener('addtrack', selectTextTrack);
      media?.removeEventListener('loadedmetadata', selectTextTrack);
      media?.pause();
      media?.removeAttribute('src');
      media?.load();
    };
  }, [
    onClose,
    play,
    history,
    asset.live,
    asset.web,
    attempt,
    audio,
    subtitles,
    setChannelDrawer,
  ]);

  const seek = (value: number) => {
    const media = video.current;

    if (media && Number.isFinite(media.duration) && media.duration > 0) {
      media.currentTime = Math.max(0, Math.min(media.duration, value));
      setTime(media.currentTime);
    }
  };

  const toggle = () => {
    const media = video.current;

    if (!media) {
      return;
    }

    if (failed) {
      setFailed(false);
      setStatus('Loading video…');

      if (asset.live) setAttempt(value => value + 1);
      else {
        media.load();
        play();
      }
    } else if (media.paused) {
      play();
    } else {
      media.pause();
    }
  };

  const keyboard = (event: React.KeyboardEvent<HTMLElement>) => {
    const key = remoteKey(event);

    if (wakeKey.current && wakeKey.current === key) {
      event.preventDefault();
      event.stopPropagation();

      return;
    }

    wake();

    if (
      !visible &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      (key.startsWith('Arrow') ||
        ['Enter', 'Select', ' ', 'Spacebar', 'Tab'].includes(key))
    ) {
      wakeKey.current = key;
      cancelHide();
      event.preventDefault();
      event.stopPropagation();

      return;
    }

    const controls = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        showChannels
          ? '.itar-player-live-drawer button:not(:disabled)'
          : 'button:not(:disabled), input:not(:disabled)',
      ),
    );

    const target = event.target as HTMLElement;
    const index = controls.indexOf(target);

    if (index < 0) {
      return;
    }

    let next: HTMLElement | undefined;

    if (key === 'Tab') {
      next =
        controls[
          (index + (event.shiftKey ? -1 : 1) + controls.length) %
            controls.length
        ];
    } else if (
      directionalNavigationEnabled &&
      ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key) &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey
    ) {
      // Range controls keep native Left/Right adjustment and reader semantics.
      if (
        target.tagName === 'INPUT' &&
        ['ArrowLeft', 'ArrowRight'].includes(key)
      ) {
        return;
      }

      const row = target.closest('[data-player-row]');

      if (!row) return;

      if (key === 'ArrowUp' || key === 'ArrowDown') {
        const step = key === 'ArrowUp' ? -1 : 1;

        if (showChannels) {
          next = controls[index + step];
        } else {
          const rowName = row.getAttribute('data-player-row');
          const rowIndex = playerRows.findIndex(name => name === rowName);

          if (rowIndex < 0) return;

          // Up from the transport goes straight to the timeline. Down from
          // the timeline lets the remote reach the optional Play Next card.
          const adjacent =
            step > 0
              ? playerRows.slice(rowIndex + 1)
              : rowName === 'transport'
              ? ['progress', 'next', 'header']
              : playerRows.slice(0, rowIndex).reverse();

          const bands = Array.from(
            event.currentTarget.querySelectorAll('[data-player-row]'),
          );

          for (const name of adjacent) {
            const band = bands.find(
              candidate => candidate.getAttribute('data-player-row') === name,
            );

            next =
              band?.querySelector<HTMLElement>(
                '[data-player-entry]:not(:disabled)',
              ) ?? controls.find(control => band?.contains(control));

            if (next) break;
          }
        }
      } else if (!showChannels) {
        const siblings = controls.filter(control => row.contains(control));
        const rowRtl = getComputedStyle(row).direction === 'rtl';
        const step = (key === 'ArrowRight') !== rowRtl ? 1 : -1;

        next = siblings[siblings.indexOf(target) + step];
      }
    } else {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    next?.focus({ preventScroll: true });
  };

  return createPortal(
    <section
      ref={dialog}
      tabIndex={-1}
      className="itar-web-player"
      style={chromeColors}
      dir={rtl ? 'rtl' : 'ltr'}
      lang={rtl ? 'ar' : 'en'}
      data-live={asset.live || undefined}
      data-strip-focused={stripFocused || undefined}
      data-channels-open={showChannels || undefined}
      data-controls-hidden={visible ? undefined : true}
      role="dialog"
      aria-modal="true"
      aria-label={t('Player: {title}', { title })}
      onKeyDown={keyboard}
      onKeyUp={event => {
        if (wakeKey.current && wakeKey.current === remoteKey(event)) {
          wakeKey.current = '';
          event.preventDefault();
          event.stopPropagation();
        }

        wake();
      }}
      onFocusCapture={event => {
        const control = event.target.closest<
          HTMLButtonElement | HTMLInputElement
        >('button, input');

        if (control) {
          lastControl.current = control;

          if (
            control.closest('.itar-player-channel-list') ||
            suggestionRail.current?.contains(control)
          ) {
            control.scrollIntoView({ block: 'nearest', inline: 'nearest' });
          }

          if (!wakeKey.current) wake();
        }
      }}
      onPointerMove={wake}
      onPointerDown={wake}
      onPointerUp={wake}
      onClickCapture={wake}
    >
      {artwork && duration === 0 && !playing && (
        <div className="itar-player-cover" aria-hidden="true">
          <Picture source={artwork} fallback="" style={suggestionArtwork} />
        </div>
      )}
      <video
        ref={video}
        src={asset.live ? undefined : asset.web}
        playsInline
        preload="auto"
        controls={false}
        disablePictureInPicture
        disableRemotePlayback
        aria-label={
          title === asset.name
            ? t('{title} video', { title: asset.name })
            : t('{title} demo video', { title: asset.name })
        }
        onContextMenu={event => event.preventDefault()}
        onLoadedMetadata={event => {
          const media = event.currentTarget;

          setDuration(Number.isFinite(media.duration) ? media.duration : 0);

          const resume = history.resumeAt(media.duration);

          if (resume > 0) media.currentTime = resume;
        }}
        onTimeUpdate={event => {
          if (asset.live) return;

          const media = event.currentTarget;

          setTime(media.currentTime);
          history.progress(media.currentTime, media.duration);
        }}
        onPlay={() => setPaused(false)}
        onPlaying={() => {
          history.playing();
          onPlaybackStarted?.();
          setPlaying(true);
          setStatus('');
        }}
        onPause={() => {
          history.flush();
          setPlaying(false);
          setPaused(true);
          setStatus(current => (current === 'Buffering…' ? '' : current));
        }}
        onEnded={() => {
          history.ended(video.current?.duration ?? 0);
          setPlaying(false);
          setPaused(true);
          setStatus('Playback finished. Select Play to watch again.');

          if (autoNext) choices?.nextEpisode?.play();
        }}
        onWaiting={() => {
          setPlaying(false);
          setStatus('Buffering…');
        }}
        onCanPlay={event => {
          if (event.currentTarget.paused)
            setStatus(current => (current === 'Buffering…' ? '' : current));
        }}
        onVolumeChange={event => {
          setMuted(event.currentTarget.muted);
          setVolume(event.currentTarget.volume);
        }}
        onError={() => {
          setPlaying(false);
          setFailed(true);
          setStatus('Video could not load. Check your connection and retry.');
        }}
      />
      {loading && (
        <div className="itar-player-loader" aria-hidden="true">
          <span />
        </div>
      )}
      {visible && <div className="itar-player-scrim" aria-hidden="true" />}
      <header className="itar-player-header" data-player-row="header">
        <button
          className="itar-player-close"
          aria-label={t('Close player')}
          onClick={() => {
            video.current?.pause();
            onClose();
          }}
        >
          {rtl ? `→ ${t('Back')}` : `← ${t('Back')}`}
        </button>
        <div className="itar-player-heading">
          <small>
            {asset.live
              ? `● ${t('LIVE')}`
              : title === asset.name
              ? ''
              : t('Demo · {title}', { title: asset.name })}
          </small>
          <h1>{title}</h1>
        </div>
        <div className="itar-player-utilities">
          {!!channels?.length && (
            <button
              ref={channelButton}
              data-player-entry
              aria-expanded={showChannels}
              aria-controls="live-channels-drawer"
              onClick={() => setChannelDrawer(true)}
            >
              {t('Channels & content')}
            </button>
          )}
          <button
            data-player-entry
            aria-label={t(muted ? 'Unmute' : 'Mute')}
            title={t(muted ? 'Unmute' : 'Mute')}
            onClick={() => {
              if (video.current) {
                video.current.muted = !video.current.muted;
                mutedAtLaunch.current = video.current.muted;
              }
            }}
          >
            <PlaybackIcon name={muted ? 'mute' : 'unmute'} />
          </button>
          <input
            type="range"
            aria-label={t('Volume')}
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={event => {
              if (video.current) {
                video.current.volume = Number(event.currentTarget.value);
                video.current.muted = false;
              }
            }}
          />
        </div>
      </header>
      <div className="itar-player-transport" data-player-row="transport">
        {!asset.live && (
          <button
            aria-label={t('Rewind 10 seconds')}
            title={t('Rewind 10 seconds')}
            disabled={!duration || failed}
            onClick={() => seek((video.current?.currentTime ?? 0) - 10)}
          >
            <PlaybackIcon name="rewind" />
            <span aria-hidden="true">10</span>
          </button>
        )}
        <button
          data-player-entry
          ref={playButton}
          onClick={toggle}
          aria-label={t(failed ? 'Retry' : paused ? 'Play' : 'Pause')}
          title={t(failed ? 'Retry' : paused ? 'Play' : 'Pause')}
        >
          {failed ? (
            t('Retry')
          ) : (
            <PlaybackIcon name={paused ? 'play' : 'pause'} />
          )}
        </button>
        {!asset.live && (
          <button
            aria-label={t('Forward 10 seconds')}
            title={t('Forward 10 seconds')}
            disabled={!duration || failed}
            onClick={() => seek((video.current?.currentTime ?? 0) + 10)}
          >
            <PlaybackIcon name="forward" />
            <span aria-hidden="true">10</span>
          </button>
        )}
      </div>
      {showChannels && (
        <section
          id="live-channels-drawer"
          className="itar-player-live-drawer"
          aria-label={t('Live channels')}
          data-player-row
        >
          <div className="itar-player-drawer-heading">
            <h2>{t('Live channels')}</h2>
            <button ref={drawerClose} onClick={() => setChannelDrawer(false)}>
              {t('Close channels')}
            </button>
          </div>
          <div className="itar-player-channel-list">
            {channels?.map((channel, index) => (
              <button
                key={channel.key}
                aria-current={channel.current || undefined}
                disabled={channel.current}
                onClick={channel.current ? undefined : channel.play}
              >
                <span className="itar-player-card-art">
                  <Picture
                    source={channel.artwork}
                    style={suggestionArtwork}
                    fallback=""
                  />
                </span>
                <span className="itar-player-channel-copy">
                  <small>
                    {String(index + 1).padStart(2, '0')} ·{' '}
                    {channel.note && t(channel.note)}
                  </small>
                  <strong>{channel.title}</strong>
                  <small>
                    {t(channel.current ? 'Watching now' : 'Live now')}
                  </small>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
      <div className="itar-player-controls">
        {nextChoice && (
          <div className="itar-player-next-row" data-player-row="next">
            <button
              data-player-entry
              className="itar-player-next"
              aria-label={`${t(nextLabel)} · ${t(nextChoice.title)}`}
              onClick={nextChoice.play}
            >
              <span className="itar-player-next-art">
                <Picture
                  source={nextChoice.artwork}
                  fallback=""
                  style={suggestionArtwork}
                />
                <PlaybackIcon name="forward" />
              </span>
              <span>
                {t(nextLabel)}
                <strong>{t(nextChoice.title)}</strong>
              </span>
            </button>
          </div>
        )}
        <div className="itar-player-meta">
          <span
            className="itar-player-time"
            dir={asset.live ? undefined : 'ltr'}
          >
            {asset.live
              ? `● ${t('LIVE')}`
              : `${formatPlaybackTime(time)} / ${formatPlaybackTime(duration)}`}
          </span>
          {status && (
            <p
              className="itar-player-status"
              role={failed ? 'alert' : 'status'}
            >
              {t(status)}
            </p>
          )}
        </div>
        {asset.live && (
          <div className="itar-player-live-track" aria-hidden="true" />
        )}
        {!asset.live && (
          <div className="itar-player-timeline-row" data-player-row="progress">
            <input
              data-player-entry
              type="range"
              dir={rtl ? 'rtl' : 'ltr'}
              aria-label={t('Playback position')}
              min={0}
              max={duration || 1}
              step={1}
              value={Math.min(time, duration)}
              disabled={!duration || failed}
              aria-valuetext={t('{elapsed} of {duration}', {
                elapsed: formatPlaybackTime(time),
                duration: formatPlaybackTime(duration),
              })}
              onChange={event => seek(Number(event.currentTarget.value))}
            />
          </div>
        )}
        <p className="itar-player-credit">
          {asset.name} · {asset.credit}
        </p>
      </div>
      {!!cards?.length && (
        <div
          ref={suggestionRail}
          className="itar-player-suggestion-rail"
          data-player-row="related"
          role="group"
          aria-label={t(
            choices?.episodes.length ? 'Season episodes' : 'Related titles',
          )}
          onFocus={() => setStripFocused(true)}
          onBlur={event => {
            if (!event.currentTarget.contains(event.relatedTarget))
              setStripFocused(false);
          }}
        >
          {cards.map(item => (
            <button
              key={item.key}
              data-player-entry
              aria-label={t(item.title)}
              onClick={item.play}
            >
              <span className="itar-player-card-art">
                <Picture
                  source={item.artwork}
                  fallback="Artwork unavailable"
                  style={suggestionArtwork}
                />
              </span>
              <strong aria-hidden="true">{t(item.title)}</strong>
            </button>
          ))}
        </div>
      )}
    </section>,
    document.body,
  );
}
