import type { Film } from './catalog-types';
import { films } from './catalog';
import { parseFilm } from './tmdb';

export type WatchingEntry = Readonly<{
  film: Film;
  position: number;
  duration: number;
}>;

type Library = Readonly<{
  saved: readonly Film[];
  watching: readonly WatchingEntry[];
}>;

type Snapshot = Library & { ready: boolean; error: string };

type Storage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

const empty: Library = { saved: [], watching: [] };

export function libraryId(film: Film) {
  return `${film.source ?? 'fixture'}/${film.id}`;
}

function restoreFilm(value: unknown): Film | undefined {
  if (!value || typeof value !== 'object' || !('id' in value)) return undefined;

  if (!('source' in value)) return films.find(film => film.id === value.id);

  try {
    return parseFilm(value);
  } catch {
    return undefined;
  }
}

function decode(raw: string | null): Library {
  if (raw === null) return empty;

  const data = JSON.parse(raw);

  if (
    data?.version !== 1 ||
    !Array.isArray(data.saved) ||
    !Array.isArray(data.watching)
  ) {
    throw new Error('Unrecognized library format');
  }

  const saved: Film[] = [];
  const watching: WatchingEntry[] = [];

  for (const item of data.saved) {
    const film = restoreFilm(item);

    if (film) saved.push(film);
  }

  for (const item of data.watching) {
    const film = restoreFilm(item?.film);

    if (
      film &&
      Number.isFinite(item.position) &&
      item.position > 0 &&
      Number.isFinite(item.duration) &&
      item.position < item.duration
    ) {
      watching.push({ film, position: item.position, duration: item.duration });
    }
  }

  return { saved, watching };
}

// One owner per profile serializes writes and retains in-memory progress while a device write is pending.
export class ProfileLibrary {
  private snapshot: Snapshot = { ...empty, ready: false, error: '' };
  private loading?: Promise<void>;
  private writing = false;
  private pending?: Library;
  private listeners = new Set<() => void>();

  constructor(
    private readonly storage: Storage,
    private readonly key: string,
  ) {}

  read = () => this.snapshot;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  };

  private publish(next: Snapshot) {
    this.snapshot = next;
    this.listeners.forEach(listener => listener());
  }

  load = async () => {
    if (this.snapshot.ready) return;

    if (this.loading) return this.loading;

    this.loading = this.storage
      .getItem(this.key)
      .then(raw => {
        this.publish({ ...decode(raw), ready: true, error: '' });
      })
      .catch(() => {
        this.publish({
          ...this.snapshot,
          error: 'Your local library could not be opened.',
        });
      })
      .finally(() => {
        this.loading = undefined;
      });

    return this.loading;
  };

  toggle = (film: Film) => {
    if (!this.snapshot.ready) return;

    const id = libraryId(film);
    const other = this.snapshot.saved.filter(item => libraryId(item) !== id);

    this.save({
      ...this.snapshot,
      saved:
        other.length === this.snapshot.saved.length ? [film, ...other] : other,
    });
  };

  progress = (
    film: Film,
    position: number,
    duration: number,
    finished: boolean,
  ) => {
    if (
      !this.snapshot.ready ||
      !Number.isFinite(duration) ||
      duration <= 0 ||
      !Number.isFinite(position) ||
      position <= 0
    )
      return;

    const id = libraryId(film);

    const others = this.snapshot.watching.filter(
      item => libraryId(item.film) !== id,
    );

    if (!finished && position >= duration) return;

    if (finished && others.length === this.snapshot.watching.length) return;

    const watching = finished
      ? others
      : [{ film, position, duration }, ...others];

    this.save({ ...this.snapshot, watching });
  };

  private save({ saved, watching }: Library) {
    this.pending = { saved, watching };
    this.publish({ saved, watching, ready: true, error: '' });
    this.persist();
  }

  retry = () => {
    if (!this.snapshot.ready) this.load();
    else this.save(this.snapshot);
  };

  private async persist() {
    if (this.writing) return;

    this.writing = true;

    try {
      while (this.pending) {
        const next = this.pending;

        this.pending = undefined;

        try {
          await this.storage.setItem(
            this.key,
            JSON.stringify({ version: 1, ...next }),
          );
        } catch {
          if (!this.pending)
            this.publish({
              ...this.snapshot,
              error: 'Your changes could not be saved on this device.',
            });
        }
      }
    } finally {
      this.writing = false;
    }
  }
}
