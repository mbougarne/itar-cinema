import type {
  CatalogueSort,
  Category,
  Film,
  Kind,
  Page,
  Rail,
} from './catalog-types';

const stories = [
  [
    'Beyond the Atlas',
    'Adventure',
    'A cartographer follows an unfinished map into the High Atlas, where every village has a different story about the same missing road.',
  ],
  [
    'The Last Night Train',
    'Mystery',
    'Two strangers board a train whose destination is missing from every timetable.',
  ],
  [
    'A Different Tide',
    'Drama',
    'A boat builder returns home to finish the vessel her father left behind.',
  ],
  [
    'Quiet Signal',
    'Science fiction',
    'An observatory receives a message heard only in the silence between storms.',
  ],
  [
    'The Glass Orchard',
    'Fantasy',
    'A gardener discovers a city reflected in the fruit of an ancient tree.',
  ],
  [
    'Letters from Tomorrow',
    'Drama',
    'A post office begins receiving letters from a town that has not been built.',
  ],
  [
    'Northern Lights Club',
    'Comedy',
    'Four neighbours turn an abandoned weather station into a gathering place.',
  ],
  [
    'The Long Way Home',
    'Adventure',
    'Two sisters take the scenic route through a country of forgotten roads.',
  ],
] as const;

// Authored fictional stories; numbered volumes deliberately create a larger test catalogue.
export const films: readonly Film[] = Array.from({ length: 96 }, (_, index) => {
  const seed = stories[index % stories.length];
  const kind = index < 48 ? 'movie' : 'series';
  const volume = Math.floor((index % 48) / stories.length) + 1;

  return {
    id: `fixture:${kind}:${index % 48}`,
    title: `${seed[0]}${volume > 1 ? ` · Volume ${volume}` : ''}${
      kind === 'series' ? ' — The Series' : ''
    }`,
    category: seed[1],
    synopsis: seed[2],
    year: 2026 - (index % 4),
    kind,
    art: index % 8,
    ...(index === 0 ? { runtime: 113, certification: '13+' } : {}),
  };
});

export const hero = films[0];

export const cast = [
  {
    id: 'aya',
    name: 'Aya Nadir',
    role: 'Lead',
    bio: 'A fictional performer who brings quiet, adventurous characters to life.',
  },
  {
    id: 'sami',
    name: 'Sami Vale',
    role: 'Supporting',
    bio: 'A fictional ensemble actor with a love of mysteries.',
  },
  {
    id: 'lina',
    name: 'Lina Maren',
    role: 'Supporting',
    bio: 'A fictional performer known for stories about returning home.',
  },
  {
    id: 'noor',
    name: 'Noor Idris',
    role: 'Director',
    bio: 'A fictional storyteller exploring imagined places and unfamiliar journeys.',
  },
] as const;

export async function fetchPage(
  kind: Kind,
  query: string,
  cursor: string | null,
  {
    signal,
    delay = 180,
    fail = false,
    category = 'All',
    sort = 'popular',
  }: {
    signal: AbortSignal;
    delay?: number;
    fail?: boolean;
    category?: Category;
    sort?: CatalogueSort;
  },
): Promise<Page> {
  if (!Number.isFinite(delay) || delay < 0 || delay > 2000) {
    throw new Error('Invalid fixture delay');
  }

  const normalized = query.trim().toLocaleLowerCase('en-US');

  const prefix = `${kind}/${encodeURIComponent(normalized)}${
    category === 'All' ? '' : `:${category}`
  }${sort === 'popular' ? '' : `:${sort}`}/`;

  const offset = cursor === null ? 0 : Number(cursor.slice(prefix.length));

  if (
    cursor !== null &&
    (!cursor.startsWith(prefix) ||
      !/^\d+$/.test(cursor.slice(prefix.length)) ||
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      offset > 48 ||
      offset % 24 !== 0)
  ) {
    throw new Error('Cursor does not belong to this query');
  }

  await new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      reject(Object.assign(new Error('Cancelled'), { name: 'AbortError' }));
    };

    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, delay);

    if (signal.aborted) {
      abort();
    } else {
      signal.addEventListener('abort', abort, { once: true });
    }
  });

  if (fail) {
    throw new Error('Simulated local fixture failure. Retry to continue.');
  }

  const candidates =
    kind === 'all'
      ? films.slice(0, 48).flatMap((film, index) => [film, films[index + 48]])
      : films;

  const genre =
    category === 'All'
      ? ''
      : category === 'Action'
      ? 'adventure'
      : category === 'Sci-fi'
      ? 'science fiction'
      : category.toLowerCase();

  const source = candidates.filter(
    film =>
      (kind === 'all' || film.kind === kind) &&
      (!genre || film.category.toLowerCase().includes(genre)) &&
      `${film.title} ${film.category}`
        .toLocaleLowerCase('en-US')
        .includes(normalized),
  );

  if (sort === 'az' || sort === 'za')
    source.sort(
      (a, b) => a.title.localeCompare(b.title) * (sort === 'az' ? 1 : -1),
    );

  if (sort === 'newest') source.sort((a, b) => b.year - a.year);

  source.splice(48);

  const entries = source.slice(offset, offset + 24);

  const rows = Array.from(
    { length: Math.ceil(entries.length / 6) },
    (_, index): Rail => {
      const row = offset / 6 + index;
      const format = row % 4 < 2 ? 'landscape' : 'poster';

      return {
        id: `rail-${row}`,
        title: [
          'Featured journeys',
          'Stories to discover',
          'The poster collection',
          'Worth a closer look',
        ][row % 4],
        format,
        entries: entries.slice(index * 6, index * 6 + 6),
      };
    },
  );

  return {
    rows,
    nextCursor:
      offset + entries.length < source.length
        ? `${prefix}${offset + entries.length}`
        : null,
    source: 'simulated-local',
  };
}
