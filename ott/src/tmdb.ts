import type { CinemaLanguage } from './language';
// Public build-time endpoint only. Provider credentials never enter this module.
import type {
  CastMember,
  CatalogueSort,
  Category,
  Episode,
  Network,
  Season,
  Film,
  Kind,
  Page,
  Person,
  Rail,
  Review,
} from './catalog-types';

// Replaced by the bundler; no Node runtime or server environment is loaded.
declare const process: { env: { ITAR_TMDB_PROXY_URL?: string } };

const PROXY = process.env.ITAR_TMDB_PROXY_URL || 'http://127.0.0.1:8789';

export const hasDeviceProxy = PROXY !== 'http://127.0.0.1:8789';

const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const string = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.length <= max;

const source = (v: unknown): v is 'tmdb' | 'tmdb-mock' =>
  v === 'tmdb' || v === 'tmdb-mock';

function artwork(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (
    !string(value, 300) ||
    !/^(https:\/\/image\.tmdb\.org\/t\/p\/(w185|w500|w1280)\/[\w.-]+\.(jpg|png|webp)|http:\/\/127\.0\.0\.1:8789\/v1\/mock-art\/[0-7])$/.test(
      value,
    )
  ) {
    throw new Error('Proxy returned an invalid artwork address.');
  }

  return value;
}

export function parseFilm(
  v: unknown,
  language: CinemaLanguage = 'en-US',
): Film {
  if (
    !record(v) ||
    !string(v.id, 80) ||
    !/^tmdb:(movie|series):\d+$/.test(v.id) ||
    !string(v.title, 200) ||
    !string(v.synopsis, 4000) ||
    !string(v.category, 300) ||
    !Number.isInteger(v.year) ||
    typeof v.year !== 'number' ||
    !source(v.source) ||
    (v.kind !== 'movie' && v.kind !== 'series') ||
    !v.id.startsWith(`tmdb:${v.kind}:`)
  ) {
    throw new Error('Proxy returned invalid title metadata.');
  }

  const metadata: Partial<
    Record<'rating' | 'votes' | 'runtime' | 'seasons' | 'episodes', number>
  > = {};

  for (const key of [
    'rating',
    'votes',
    'runtime',
    'seasons',
    'episodes',
  ] as const) {
    if (v[key] === undefined) {
      continue;
    }

    if (
      typeof v[key] !== 'number' ||
      !Number.isFinite(v[key]) ||
      v[key] < 0 ||
      v[key] > (key === 'rating' ? 10 : 1000000000)
    ) {
      throw new Error('Proxy returned invalid numeric metadata.');
    }

    metadata[key] = v[key];
  }

  const descriptions: Partial<
    Record<
      | 'certification'
      | 'certificationRegion'
      | 'tagline'
      | 'status'
      | 'languages'
      | 'countries'
      | 'studios',
      string
    >
  > = {};

  for (const key of [
    'certification',
    'certificationRegion',
    'tagline',
    'status',
    'languages',
    'countries',
    'studios',
  ] as const) {
    if (v[key] === undefined) {
      continue;
    }

    if (!string(v[key], 500)) {
      throw new Error('Proxy returned invalid descriptive metadata.');
    }

    descriptions[key] = v[key];
  }

  return {
    ...metadata,
    ...descriptions,
    id: v.id,
    title: v.title,
    synopsis: v.synopsis,
    category: v.category,
    year: v.year,
    kind: v.kind,
    language,
    source: v.source,
    art: 0,
    posterUrl: artwork(v.posterUrl),
    backdropUrl: artwork(v.backdropUrl),
    titleLogoUrl: artwork(v.titleLogoUrl),
  };
}

async function request(
  route: string,
  params: Record<string, string>,
  signal: AbortSignal,
): Promise<unknown> {
  const controller = new AbortController();
  const abort = () => controller.abort();

  signal.addEventListener('abort', abort, { once: true });

  if (signal.aborted) {
    abort();
  }

  const timer = setTimeout(abort, 12000);

  try {
    const query = Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');

    const response = await fetch(`${PROXY}${route}?${query}`, {
      signal: controller.signal,
    });

    const data: unknown = await response.json();

    if (!response.ok) {
      throw new Error(
        record(data) && string(data.error, 200)
          ? data.error
          : 'Local proxy request failed.',
      );
    }

    return data;
  } catch (error) {
    if (signal.aborted) {
      throw error;
    }

    if (error instanceof Error && /^(TMDB|Proxy|Local)/.test(error.message)) {
      throw error;
    }

    throw new Error(
      'Local TMDB proxy unavailable. Start the local backend or choose Fixtures in Settings.',
    );
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
  }
}

export const fetchProxyPage = async (
  kind: Kind,
  query: string,
  cursor: string | null,
  options: {
    signal: AbortSignal;
    delay?: number;
    fail?: boolean;
    category?: Category;
    sort?: CatalogueSort;
    language?: CinemaLanguage;
  },
): Promise<Page> => {
  if ((options.delay || 0) > 180) {
    await new Promise<void>((resolve, reject) => {
      const abort = () => {
        clearTimeout(timer);
        options.signal.removeEventListener('abort', abort);
        reject(new Error('Local request cancelled.'));
      };

      const timer = setTimeout(() => {
        options.signal.removeEventListener('abort', abort);
        resolve();
      }, options.delay);

      if (options.signal.aborted) {
        abort();
      } else {
        options.signal.addEventListener('abort', abort, { once: true });
      }
    });
  }

  if (options.fail) {
    throw new Error('Simulated local client failure. Retry to continue.');
  }

  const data = await request(
    '/v1/catalogue',
    {
      kind,
      query,
      category: options.category || 'All',
      sort: options.sort || 'popular',
      ...(options.language === 'ar-SA' ? { language: options.language } : {}),
      ...(cursor ? { cursor } : {}),
    },
    options.signal,
  );

  if (
    !record(data) ||
    !source(data.source) ||
    !Array.isArray(data.rows) ||
    data.rows.length > 4 ||
    !(data.nextCursor === null || string(data.nextCursor, 1000))
  ) {
    throw new Error('Proxy returned an invalid page.');
  }

  const pageSource = data.source;
  const seen = new Set<string>();

  const rows = data.rows.map((row): Rail => {
    if (
      !record(row) ||
      !string(row.id, 100) ||
      seen.has(row.id) ||
      !string(row.title, 200) ||
      (row.format !== 'landscape' && row.format !== 'poster') ||
      !Array.isArray(row.entries) ||
      row.entries.length > 5
    ) {
      throw new Error('Proxy returned an invalid rail.');
    }

    seen.add(row.id);

    const entries = row.entries.map(value =>
      parseFilm(value, options.language),
    );

    if (
      new Set(entries.map(film => film.id)).size !== entries.length ||
      entries.some(film => film.source !== pageSource)
    ) {
      throw new Error('Proxy returned inconsistent title identities.');
    }

    return { id: row.id, title: row.title, format: row.format, entries };
  });

  return {
    rows,
    nextCursor: data.nextCursor,
    source: pageSource,
    attribution: string(data.attribution, 300) ? data.attribution : undefined,
  };
};

const index = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

export async function fetchSeason(
  film: Film,
  season: number,
  signal: AbortSignal,
): Promise<readonly Episode[]> {
  const data = await request(
    '/v1/season',
    { id: film.id, season: String(season), language: film.language ?? 'en-US' },
    signal,
  );

  if (
    !record(data) ||
    data.id !== film.id ||
    data.source !== film.source ||
    data.season !== season ||
    !Array.isArray(data.episodes)
  ) {
    throw new Error('Proxy returned inconsistent season data.');
  }

  const seen = new Set<number>();

  return data.episodes.map(value => {
    if (
      !record(value) ||
      !index(value.number) ||
      seen.has(value.number) ||
      !string(value.name, 200) ||
      !string(value.synopsis, 4000) ||
      (value.runtime !== null && !index(value.runtime)) ||
      (value.airDate !== null &&
        (typeof value.airDate !== 'string' ||
          !/^\d{4}-\d{2}-\d{2}$/.test(value.airDate)))
    ) {
      throw new Error('Proxy returned invalid episode metadata.');
    }

    seen.add(value.number);

    return {
      number: value.number,
      name: value.name,
      synopsis: value.synopsis,
      stillUrl: artwork(value.stillUrl),
      runtime: value.runtime,
      airDate: value.airDate,
    };
  });
}

export async function fetchDetails(
  film: Film,
  signal: AbortSignal,
): Promise<{
  film: Film;
  cast: readonly CastMember[];
  related: readonly Film[];
  seasons: readonly Season[];
  networks: readonly Network[];
}> {
  const data = await request(
    '/v1/details',
    { id: film.id, language: film.language ?? 'en-US' },
    signal,
  );

  if (!record(data) || !Array.isArray(data.cast) || data.cast.length > 8) {
    throw new Error('Proxy returned invalid cast data.');
  }

  const updated = parseFilm(data.film, film.language);

  if (updated.id !== film.id || updated.source !== film.source) {
    throw new Error('Proxy changed the selected title identity.');
  }

  const cast = data.cast.map(person => {
    if (
      !record(person) ||
      !string(person.id, 32) ||
      !/^\d+$/.test(person.id) ||
      !string(person.name, 120) ||
      !string(person.role, 120)
    ) {
      throw new Error('Proxy returned invalid cast metadata.');
    }

    return {
      id: person.id,
      name: person.name,
      role: person.role,
      portraitUrl: artwork(person.portraitUrl),
    };
  });

  if (new Set(cast.map(person => person.id)).size !== cast.length) {
    throw new Error('Proxy returned duplicate cast identities.');
  }

  if (!Array.isArray(data.related) || data.related.length > 12) {
    throw new Error('Proxy returned invalid related titles.');
  }

  const related = data.related.map(value => parseFilm(value, film.language));

  if (
    new Set(related.map(value => value.id)).size !== related.length ||
    related.some(value => value.source !== film.source || value.id === film.id)
  ) {
    throw new Error('Proxy returned inconsistent related identities.');
  }

  const seasons: Season[] = (
    Array.isArray(data.seasons) ? data.seasons : []
  ).map(value => {
    if (!record(value) || !index(value.number) || !string(value.name, 200)) {
      throw new Error('Proxy returned invalid season metadata.');
    }

    return { number: value.number, name: value.name };
  });

  const networks: Network[] = (
    Array.isArray(data.networks) ? data.networks : []
  ).map(value => {
    if (!record(value) || !index(value.id) || !string(value.name, 120)) {
      throw new Error('Proxy returned invalid network metadata.');
    }

    return { id: value.id, name: value.name, logoUrl: artwork(value.logoUrl) };
  });

  if (
    new Set(seasons.map(value => value.number)).size !== seasons.length ||
    new Set(networks.map(value => value.id)).size !== networks.length
  ) {
    throw new Error('Proxy returned duplicate series metadata.');
  }

  // Different TMDB endpoints can omit different sizes or kinds of title artwork.
  return {
    film: {
      ...updated,
      posterUrl: updated.posterUrl ?? artwork(film.posterUrl),
      backdropUrl: updated.backdropUrl ?? artwork(film.backdropUrl),
      titleLogoUrl: updated.titleLogoUrl ?? artwork(film.titleLogoUrl),
    },
    cast,
    related,
    seasons,
    networks,
  };
}

export async function fetchReviews(
  film: Film,
  signal: AbortSignal,
): Promise<readonly Review[]> {
  const data = await request(
    '/v1/reviews',
    { id: film.id, language: film.language ?? 'en-US' },
    signal,
  );

  if (
    !record(data) ||
    data.id !== film.id ||
    data.source !== film.source ||
    !Array.isArray(data.reviews) ||
    data.reviews.length > 10
  ) {
    throw new Error('Proxy returned inconsistent reviews.');
  }

  const seen = new Set<string>();

  return data.reviews.map(value => {
    if (
      !record(value) ||
      !string(value.id, 80) ||
      !value.id ||
      seen.has(value.id) ||
      !string(value.author, 120) ||
      !string(value.content, 16000) ||
      !value.content ||
      (value.date !== null &&
        (typeof value.date !== 'string' ||
          !/^\d{4}-\d{2}-\d{2}$/.test(value.date))) ||
      (value.rating !== null &&
        (typeof value.rating !== 'number' ||
          !Number.isFinite(value.rating) ||
          value.rating < 0 ||
          value.rating > 10))
    ) {
      throw new Error('Proxy returned invalid review metadata.');
    }

    seen.add(value.id);

    return {
      id: value.id,
      author: value.author,
      content: value.content,
      date: value.date,
      rating: value.rating,
    };
  });
}

const validDate = (value: unknown) =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : undefined;

export async function fetchPerson(
  person: CastMember,
  film: Film,
  signal: AbortSignal,
): Promise<Person> {
  const data = await request(
    '/v1/person',
    { id: person.id, language: film.language ?? 'en-US' },
    signal,
  );

  if (
    !record(data) ||
    data.id !== person.id ||
    data.source !== film.source ||
    !string(data.bio, 8000) ||
    !Array.isArray(data.credits) ||
    data.credits.length > 16
  ) {
    throw new Error('Proxy returned invalid person details.');
  }

  const credits = data.credits.map(value => parseFilm(value, film.language));

  if (
    new Set(credits.map(value => value.id)).size !== credits.length ||
    credits.some(value => value.source !== film.source)
  ) {
    throw new Error('Proxy returned inconsistent title credits.');
  }

  return {
    biography: data.bio,
    credits,
    portraitUrl: artwork(data.portraitUrl),
    department: string(data.department, 80) ? data.department : undefined,
    birthplace: string(data.birthplace, 160) ? data.birthplace : undefined,
    birthday: validDate(data.birthday),
    deathday: validDate(data.deathday),
    aliases: Array.isArray(data.aliases)
      ? data.aliases
          .filter((value): value is string => string(value, 100))
          .slice(0, 5)
      : [],
    creditCount: index(data.creditCount) ? data.creditCount : undefined,
  };
}
