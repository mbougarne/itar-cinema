import type { CinemaLanguage } from './language';

export type DataSource = 'simulated-local' | 'tmdb' | 'tmdb-mock';

export type CastMember = Readonly<{
  id: string;
  name: string;
  role: string;
  bio?: string;
  portraitUrl?: string | null;
}>;

export type Kind = 'all' | 'movie' | 'series';

export const categories = [
  'All',
  'Action',
  'Comedy',
  'Drama',
  'Documentary',
  'Sci-fi',
  'Mystery',
  'Animation',
  'Family',
  'Kids',
  'Adventure',
  'Crime',
  'Fantasy',
  'History',
  'Horror',
  'Music',
  'Romance',
  'Thriller',
  'War',
  'Western',
  'News',
  'Reality',
  'Soap',
  'Talk',
] as const;

export type Category = (typeof categories)[number];

export type CatalogueSort = 'popular' | 'az' | 'za' | 'newest';

export type Film = Readonly<{
  id: string;
  title: string;
  category: string;
  year: number;
  rating?: number;
  votes?: number;
  runtime?: number;
  certification?: string;
  certificationRegion?: string;
  tagline?: string;
  status?: string;
  languages?: string;
  countries?: string;
  studios?: string;
  seasons?: number;
  episodes?: number;
  kind: 'movie' | 'series';
  language?: CinemaLanguage;
  synopsis: string;
  art: number;
  source?: 'tmdb' | 'tmdb-mock';
  posterUrl?: string | null;
  backdropUrl?: string | null;
  titleLogoUrl?: string | null;
}>;

export type Season = Readonly<{ number: number; name: string }>;

export type Network = Readonly<{
  id: number;
  name: string;
  logoUrl: string | null;
}>;

export type Episode = Readonly<{
  number: number;
  name: string;
  synopsis: string;
  stillUrl: string | null;
  runtime: number | null;
  airDate: string | null;
}>;

export type Person = Readonly<{
  biography: string;
  department?: string;
  birthplace?: string;
  birthday?: string;
  deathday?: string;
  aliases?: readonly string[];
  creditCount?: number;
  portraitUrl: string | null;
  credits: readonly Film[];
}>;

export type Review = Readonly<{
  id: string;
  author: string;
  date: string | null;
  rating: number | null;
  content: string;
}>;

export type Rail = Readonly<{
  id: string;
  title: string;
  format: 'landscape' | 'poster';
  entries: readonly Film[];
}>;

export type Page = Readonly<{
  rows: readonly Rail[];
  nextCursor: string | null;
  source: DataSource;
  attribution?: string;
}>;

export type CatalogueState = Readonly<{
  rows: readonly Rail[];
  cursor: string | null;
  loading: boolean;
  error: string;
  ended: boolean;
  source: DataSource | null;
  limitReached: boolean;
}>;

export type ProviderMode = 'proxy' | 'fixture';
