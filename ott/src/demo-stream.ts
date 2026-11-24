import type { ComponentProps } from 'react';
import type Video from 'react-native-video';
import type { ImageSourcePropType } from 'react-native';
import type { Film } from './catalog-types';

export type DemoMedia = Readonly<{
  name: string;
  native: NonNullable<ComponentProps<typeof Video>['source']>;
  web: string;
  credit: string;
  web4K?: boolean;
  live?: boolean;
  preview?: number | { uri: string };
  duration?: number;
}>;

const attribution = '© Blender Foundation · CC BY 3.0';

export const bigBuckBunny: DemoMedia = {
  name: 'Big Buck Bunny',
  preview: require('../assets/cinematic/previews/bunny.mp4'),
  web4K: true,
  native: {
    uri: 'https://test-streams.mux.dev/x36xhzz/url_6/193039199_mp4_h264_aac_hq_7.m3u8',
    type: 'm3u8',
  },
  web: 'https://kodi.mirror.garr.it/demo-files/BBB/bbb_sunflower_2160p_30fps_normal.mp4',
  credit: `${attribution} · peach.blender.org`,
};

function openMovie(
  name: string,
  web: string,
  project: string,
  duration: number,
  preview: DemoMedia['preview'],
): DemoMedia {
  return {
    name,
    duration,
    preview,
    web,
    native: { uri: web, type: 'mp4' },
    credit: `${attribution} · ${project}`,
  };
}

const sintel = openMovie(
  'Sintel',
  'https://archive.org/download/Sintel/sintel-2048-stereo_512kb.mp4',
  'durian.blender.org',
  888.064,
  require('../assets/cinematic/previews/sintel.mp4'),
);

const tearsOfSteel = openMovie(
  'Tears of Steel',
  'https://archive.org/download/Tears-of-Steel/tears_of_steel_720p.mp4',
  'mango.blender.org',
  734.125,
  require('../assets/cinematic/previews/tears.mp4'),
);

const films: readonly [string, DemoMedia, ImageSourcePropType][] = [
  [
    'big-buck-bunny',
    bigBuckBunny,
    require('../assets/cinematic/open-bunny.jpg'),
  ],
  ['sintel', sintel, require('../assets/cinematic/open-sintel.jpg')],
  [
    'tears-of-steel',
    tearsOfSteel,
    require('../assets/cinematic/open-tears-of-steel.jpg'),
  ],
];

const samples = new Map(
  films.map(([id, media, artwork]) => [`open-film:${id}`, { media, artwork }]),
);

export const sportsClip: Film = {
  id: 'archive:triple-jump',
  title: 'Men’s triple jump',
  synopsis: '',
  year: 2015,
  kind: 'movie',
  category: 'Athletics',
  art: 0,
};

function bundledSample(
  name: string,
  file: number | Readonly<{ uri: string }>,
  artwork: ImageSourcePropType,
  credit: string,
  preview = false,
) {
  // Metro supplies a numeric asset ID, which react-native-video accepts at runtime.
  const native =
    typeof file === 'number'
      ? ({ uri: file } as unknown as DemoMedia['native'])
      : file;

  return {
    media: {
      name,
      native,
      web: typeof file === 'object' ? file.uri : '',
      preview: preview ? file : undefined,
      credit,
    },
    artwork,
  };
}

const clip = bundledSample(
  sportsClip.title,
  require('../assets/cinematic/triple-jump.mp4'),
  require('../assets/cinematic/triple-jump.jpg'),
  'FISUTV · CC BY 3.0 · Wikimedia Commons · Transcoded',
);

const kidsClips = [
  [
    'Finn in the Flower Forest',
    'fox',
    require('../assets/cinematic/kids/fox-preview.mp4'),
    require('../assets/cinematic/kids/kids-fox.jpg'),
  ],
  [
    'Dragon Above the Clouds',
    'dragon',
    require('../assets/cinematic/kids/dragon-preview.mp4'),
    require('../assets/cinematic/kids/kids-dragon.jpg'),
  ],
  [
    'Little Orbit',
    'space',
    require('../assets/cinematic/kids/space-preview.mp4'),
    require('../assets/cinematic/kids/kids-space.jpg'),
  ],
  [
    'The Reef Rangers',
    'ocean',
    require('../assets/cinematic/kids/ocean-preview.mp4'),
    require('../assets/cinematic/kids/kids-ocean.jpg'),
  ],
  [
    'Panda in the Rain',
    'panda',
    require('../assets/cinematic/kids/panda-preview.mp4'),
    require('../assets/cinematic/kids/kids-panda.jpg'),
  ],
  [
    'A Whale Called Blue',
    'whale',
    require('../assets/cinematic/kids/whale-preview.mp4'),
    require('../assets/cinematic/kids/kids-whale.jpg'),
  ],
] as const;

for (const [name, id, file, artwork] of kidsClips) {
  samples.set(
    `kids-preview:${id}`,
    bundledSample(
      name,
      file,
      artwork,
      'Itar Cinema · Original animation preview',
      true,
    ),
  );
}

export const sampleFilm = (id: string) =>
  id === sportsClip.id ? clip : samples.get(id);

const featuredDemos: ReadonlyMap<string, DemoMedia> = new Map([
  ['fixture:movie:0', bigBuckBunny],
  ['fixture:series:3', sintel],
  ['fixture:movie:2', tearsOfSteel],
  ['tmdb:movie:1368337', tearsOfSteel],
  ['tmdb:series:42009', sintel],
]);

export function demoForTitle(film: Film): DemoMedia {
  const media = sampleFilm(film.id)?.media ?? featuredDemos.get(film.id);

  if (media) return media;

  const index =
    Array.from(film.id).reduce((sum, char) => sum + char.charCodeAt(0), 0) %
    films.length;

  return films[index][1];
}

export const openFilmTitles: readonly Film[] = Array.from(samples)
  .filter(([id]) => id.startsWith('open-film:'))
  .map(([id, { media }]) => ({
    id,
    title: media.name,
    synopsis: '',
    category: 'Open film',
    year: 0,
    kind: 'movie',
    art: 0,
  }));

export const kidsTitles: readonly Film[] = [
  {
    ...openFilmTitles[0],
    category: 'Family / Animation',
    synopsis:
      'A gentle rabbit finds a way to stand up to three woodland bullies.',
  },
  ...kidsClips.map(
    ([title, id]): Film => ({
      id: `kids-preview:${id}`,
      title,
      category: 'Kids / Family / Animation',
      synopsis:
        id === 'fox'
          ? 'Finn follows a winding trail of flowers to help a friend find home.'
          : 'A short animated adventure for the whole family.',
      year: 0,
      kind: 'movie',
      art: 0,
    }),
  ),
];
