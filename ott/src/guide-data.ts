import type { Programme, Channel, Guide } from './guide-types';

const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function parseGuide(data: unknown, now = Date.now() / 1000): Guide {
  if (
    !record(data) ||
    typeof data.updated !== 'string' ||
    !Number.isFinite(Date.parse(data.updated)) ||
    !Array.isArray(data.channels)
  ) {
    throw new Error('EPGTalk returned an invalid guide.');
  }

  const names = new Set<string>();
  const channels: Channel[] = [];

  for (const channel of data.channels) {
    if (
      !record(channel) ||
      typeof channel.name !== 'string' ||
      !channel.name ||
      names.has(channel.name) ||
      !Array.isArray(channel.programmes)
    ) {
      continue;
    }

    const starts = new Set<number>();

    const programmes = channel.programmes
      .flatMap((p): Programme[] => {
        if (
          !record(p) ||
          typeof p.start !== 'number' ||
          typeof p.stop !== 'number' ||
          !Number.isFinite(p.start) ||
          !Number.isFinite(p.stop) ||
          p.stop <= p.start ||
          p.stop <= now - 3600 ||
          p.start >= now + 10 * 3600 ||
          typeof p.title !== 'string' ||
          starts.has(p.start)
        ) {
          return [];
        }

        starts.add(p.start);

        return [
          {
            start: p.start,
            stop: p.stop,
            title: p.title.slice(0, 180),
            subtitle:
              typeof p.subtitle === 'string' ? p.subtitle.slice(0, 240) : '',
          },
        ];
      })
      .sort((a, b) => a.start - b.start)
      .slice(0, 48);

    if (programmes.length) {
      names.add(channel.name);

      channels.push({
        id: channel.name,
        name: channel.name.slice(0, 120),
        programmes,
      });
    }

    if (channels.length === 6) {
      break;
    }
  }

  return { updated: data.updated, channels };
}

const fixtureChannels = [
  ['Cinema One', 'Morning shorts', 'Open animation', 'Behind the scenes'],
  ['Cinema Two', 'World cinema', 'Studio visits', 'Documentary hour'],
  ['Cinema Sports', 'Athletics replay', 'Football archive', 'Sports profiles'],
] as const;

export function fixtureGuide(now: number): Guide {
  const start = Math.floor(now / 1800) * 1800;

  return {
    updated: new Date(start * 1000).toISOString(),
    channels: fixtureChannels.map(([name, ...titles], index) => ({
      id: `fixture-${index + 1}`,
      name,
      programmes: Array.from({ length: 14 }, (_, slot) => ({
        title: titles[slot % titles.length],
        subtitle: 'Sample programme',
        start: start + (slot - 2) * 1800,
        stop: start + (slot - 1) * 1800,
      })),
    })),
  };
}

export const guideTime = (time: number) =>
  new Date(time * 1000).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

export function guideWindow(
  guide: Guide | null,
  now: number,
  requested: number | null,
) {
  const programmes =
    guide?.channels.flatMap(channel => channel.programmes) ?? [];

  const current = Math.floor(now / 1800) * 1800;

  const first = programmes.length
    ? Math.floor(Math.min(...programmes.map(p => p.start)) / 1800) * 1800
    : current;

  const last = programmes.length
    ? Math.max(
        first,
        Math.ceil(Math.max(...programmes.map(p => p.stop)) / 1800) * 1800 -
          7200,
      )
    : current;

  const start = Math.min(last, Math.max(first, requested ?? current));

  return {
    start,
    end: start + 7200,
    previous: start > first,
    next: start < last,
  };
}
