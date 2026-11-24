import type { Rail } from './catalog-types';

export const homeCharts = ['top-movies', 'top-series'] as const;

function orderedTitles(rows: readonly Rail[]) {
  const distinct = new Map<string, Rail['entries'][number]>();

  for (const { entries } of rows) {
    for (const title of entries) {
      if (!distinct.has(title.id)) distinct.set(title.id, title);
    }
  }

  return Array.from(distinct.values());
}

// Preserve the trending feed order before distributing titles into the charts.
export function chartRows(rows: readonly Rail[]): readonly Rail[] {
  const entries = orderedTitles(rows);

  return homeCharts
    .map(
      (id, index): Rail => ({
        id,
        title: index === 0 ? 'Top 10 Movies' : 'Top 10 Series',
        format: 'poster',
        entries: entries
          .filter(film => film.kind === (index === 0 ? 'movie' : 'series'))
          .slice(0, 10),
      }),
    )
    .filter(row => row.entries.length > 0);
}

// Repack API pages without repeating titles or changing earlier occurrence positions.
export function layoutRows(
  rows: readonly Rail[],
  mode: 'home' | 'grid',
): readonly Rail[] {
  const entries = orderedTitles(rows);

  if (mode === 'home') {
    return [
      'Popular stories',
      'Worth exploring',
      'The poster collection',
      'More discoveries',
    ]
      .map(
        (title, index): Rail => ({
          id: `home-${index}`,
          title,
          format: index < 2 ? 'landscape' : 'poster',
          entries: entries
            .filter((_, position) => position % 4 === index)
            .slice(0, 15),
        }),
      )
      .filter(row => row.entries.length > 0);
  }

  return Array.from(
    { length: Math.ceil(entries.length / 5) },
    (_, index): Rail => ({
      id: `grid-${index}`,
      title: '',
      format: 'landscape',
      entries: entries.slice(index * 5, index * 5 + 5),
    }),
  );
}
