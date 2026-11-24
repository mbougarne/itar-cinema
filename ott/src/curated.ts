import { films } from './catalog';
import type { ProviderMode } from './catalog-types';
import { collectionTitles } from './collection-titles';

const picks = (indices: readonly number[]) =>
  indices.map(index => films[index]);

const collections = [
  {
    id: 'road',
    name: 'The Road Less Travelled',
    description:
      'Familiar worlds feel new again when you take the long way around.',
    titles: picks([0, 7, 2, 54, 55, 15, 23, 47]),
  },
  {
    id: 'mystery',
    name: 'Mysteries After Dark',
    description:
      'Follow the clues through unsettling mysteries and worlds with secrets.',
    titles: picks([1, 51, 5, 4, 9, 17, 25, 33]),
  },
  {
    id: 'escape',
    name: 'A Quiet Escape',
    description: 'Stories about starting over, finding home and slowing down.',
    titles: picks([4, 2, 7, 5, 54, 10, 18, 42]),
  },
  {
    id: 'signals',
    name: 'Signals from Elsewhere',
    description:
      'Travel beyond the map with stories about strange discoveries.',
    titles: picks([51, 3, 8, 12, 19, 27, 35, 59]),
  },
  {
    id: 'coast',
    name: 'Stories by the Sea',
    description: 'Stories of discovery, family and life along the water.',
    titles: picks([2, 10, 50, 7, 18, 26, 34, 58]),
  },
  {
    id: 'nights',
    name: 'Under Northern Skies',
    description:
      'Find a little light in stories of skywatchers and night trains.',
    titles: picks([54, 1, 3, 62, 6, 14, 22, 70]),
  },
  {
    id: 'magic',
    name: 'Everyday Magic',
    description: 'Find something extraordinary in a familiar place.',
    titles: picks([4, 12, 5, 60, 20, 28, 36, 44]),
  },
  {
    id: 'return',
    name: 'The Long Way Home',
    description: 'Journeys that make familiar places feel new again.',
    titles: picks([7, 15, 23, 55, 31, 39, 47, 63]),
  },
  {
    id: 'new',
    name: 'A Fresh Start',
    description: 'Meet people finding a new beginning after life changes.',
    titles: picks([5, 6, 2, 53, 13, 21, 29, 37]),
  },
] as const;

const tmdbPicks = [
  [116745, 5915, 4538, 1653, 773, 404, 508943, 120467],
  [381288, 42009, 27205, 335984, 66732, 87108, 329865, 399055],
  [508943, 120467, 37165, 313369, 522, 585, 404, 773],
  [329865, 157336, 438631, 42009, 127585, 140607, 335984, 66732],
  [76600, 508943, 399055, 116745, 404, 354912, 5915, 329865],
  [157336, 66732, 87108, 438631, 120467, 135397, 404, 335984],
  [354912, 12445, 177572, 630, 12155, 9479, 585, 508943],
  [85, 140607, 135397, 98, 9615, 438631, 116745, 157336],
  [37165, 313369, 508943, 177572, 522, 354912, 120467, 773],
];

const tmdbCollections = collections.map((collection, index) => ({
  ...collection,
  titles: tmdbPicks[index].map(id => collectionTitles[id]),
}));

export const collectionsForMode = (mode: ProviderMode) =>
  mode === 'proxy' ? tmdbCollections : collections;
