import { occurrenceKey } from '@bougarnem/itar/react';

export const screens = [
  'Home',
  'Movies',
  'Series',
  'Sports',
  'Live TV',
  'Search',
  'Collections',
  'Kids',
  'My List',
  'Profile',
  'Settings',
] as const;

export type Screen = (typeof screens)[number];

export const subtitles = {
  Home: '',
  Movies: 'Find your next story.',
  Series: 'Stories worth staying with.',
  Sports: '',
  'Live TV': '',
  Search: 'Find a title or genre.',
  Collections: '',
  Kids: '',
  'My List': 'Titles saved on this device.',
  Profile: '',
  Settings: 'Make the demo yours.',
};

export const detailTabs = [
  'More like this',
  'Cast & crew',
  'Information',
  'Reviews',
] as const;

export const detailControlKeys = new Set([
  ...['play', 'list', 'like', 'retry'].map(action =>
    occurrenceKey('details', action),
  ),
  ...[...detailTabs, 'Episodes'].map(tab =>
    occurrenceKey('details', 'tab', tab),
  ),
]);
