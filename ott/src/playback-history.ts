import type { ImageSourcePropType } from 'react-native';
import type { CinemaProfile } from './cinema-profiles';
import type { DemoMedia } from './demo-stream';

export type VideoChoice = Readonly<{
  key: string;
  title: string;
  artwork?: ImageSourcePropType;
  note?: string;
}>;

export type EpisodePlayback = Readonly<{
  label: string;
  opener: string;
  seasonNumber: number;
  queue?: readonly VideoChoice[];
}>;

export type PlaybackChoice = VideoChoice & {
  current?: boolean;
  play: () => void;
};

export type PlaybackChoices = Readonly<{
  episodes: readonly PlaybackChoice[];
  related: readonly PlaybackChoice[];
  nextEpisode?: PlaybackChoice;
  startsNextSeason?: boolean;
}>;

export type PlayerProps = {
  title: string;
  artwork?: ImageSourcePropType;
  media?: DemoMedia;
  choices?: PlaybackChoices;
  channels?: readonly PlaybackChoice[];
  languages?: Pick<CinemaProfile, 'audio' | 'subtitles'>;
  autoNext?: boolean;
  onClose: () => void;
  onPlaybackStarted?: () => void;
  startPosition?: number;
  onCheckpoint?: (
    position: number,
    duration: number,
    finished: boolean,
  ) => void;
};

// Metadata and seeks can arrive without playback (for example when autoplay is blocked).
export class PlaybackHistory {
  private started = false;
  private position = 0;
  private duration = 0;
  private saved = 0;
  private resume: number;

  constructor(
    startPosition = 0,
    private readonly report?: PlayerProps['onCheckpoint'],
  ) {
    this.resume = startPosition;
  }

  resumeAt(duration: number) {
    const next = this.resume;

    this.resume = 0;

    return Number.isFinite(next) && next > 0 && next < duration ? next : 0;
  }

  playing() {
    this.started = true;
  }

  progress(position: number, duration: number) {
    if (
      !this.started ||
      !Number.isFinite(position) ||
      !Number.isFinite(duration) ||
      duration <= 0 ||
      position <= 0 ||
      position > duration
    )
      return;

    this.position = position;
    this.duration = duration;

    if (this.saved === 0 || Math.abs(position - this.saved) >= 10) this.flush();
  }

  flush() {
    if (this.started && this.position > 0 && this.saved !== this.position) {
      this.report?.(this.position, this.duration, false);
      this.saved = this.position;
    }
  }

  ended(duration: number) {
    if (this.started && Number.isFinite(duration) && duration > 0)
      this.report?.(duration, duration, true);

    this.started = false;
    this.position = 0;
    this.saved = 0;
  }
}
