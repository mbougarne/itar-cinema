import type {
  CastMember,
  Episode,
  Film,
  Person,
  Review,
} from './catalog-types';
import { fetchDetails, fetchPerson, fetchReviews, fetchSeason } from './tmdb';

type TitleDetails = Awaited<ReturnType<typeof fetchDetails>>;

// Only public catalogue metadata is shared for the lifetime of Cinema.
const recent = new Map<string, TitleDetails>();
const limit = 32;
const recentSeasons = new Map<string, readonly Episode[]>();

export function cachedSeason(film: Film, season: number) {
  return recentSeasons.get(`${key(film)}/${season}`);
}

export async function loadSeason(
  film: Film,
  season: number,
  signal: AbortSignal,
) {
  const id = `${key(film)}/${season}`;
  const previous = recentSeasons.get(id);
  const result = previous ?? (await fetchSeason(film, season, signal));

  if (!signal.aborted) remember(recentSeasons, id, result);

  return result;
}

const reviews = new Map<string, readonly Review[]>();

export const cachedReviews = (film: Film) => reviews.get(key(film));

export async function loadReviews(film: Film, signal: AbortSignal) {
  const id = key(film);
  const result = reviews.get(id) ?? (await fetchReviews(film, signal));

  if (!signal.aborted) remember(reviews, id, result);

  return result;
}

const people = new Map<string, Person>();

const personKey = (film: Film, person: CastMember) =>
  `${film.source}/${film.language ?? 'en-US'}/${person.id}`;

export const cachedPerson = (film: Film, person: CastMember) =>
  people.get(personKey(film, person));

export async function loadPerson(
  film: Film,
  person: CastMember,
  signal: AbortSignal,
) {
  const id = personKey(film, person);
  const result = people.get(id) ?? (await fetchPerson(person, film, signal));

  if (!signal.aborted) remember(people, id, result);

  return result;
}

function remember<T>(cache: Map<string, T>, id: string, result: T) {
  cache.delete(id);
  cache.set(id, result);

  if (cache.size > limit) {
    const oldest = cache.keys().next();

    if (!oldest.done) cache.delete(oldest.value);
  }
}

function key(film: Film) {
  return `${film.source}/${film.language ?? 'en-US'}/${film.id}`;
}

export function cachedDetails(film: Film) {
  return recent.get(key(film));
}

export async function loadDetails(film: Film, signal: AbortSignal) {
  const id = key(film);
  const result = recent.get(id) ?? (await fetchDetails(film, signal));

  if (!signal.aborted) remember(recent, id, result);

  return result;
}
