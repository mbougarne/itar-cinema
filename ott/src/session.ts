import type { CinemaLanguage } from './language';
import type {
  CatalogueState,
  Kind,
  Category,
  CatalogueSort,
} from './catalog-types';
import { fetchPage } from './catalog';

const empty = (): CatalogueState => ({
  rows: [],
  cursor: null,
  loading: false,
  error: '',
  ended: false,
  source: null,
  limitReached: false,
});

export class CatalogueSession {
  private state = empty();
  private generation = 0;
  private closed = true;
  private controller: AbortController | null = null;
  private listeners = new Set<() => void>();
  constructor(
    private kind: Kind,
    private query: string,
    private options: () => {
      delay: number;
      fail: boolean;
      category?: Category;
      sort?: CatalogueSort;
      language?: CinemaLanguage;
    },
    private provider = fetchPage,
    private limit = 160,
  ) {}

  snapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  };

  private publish(state: CatalogueState) {
    this.state = state;
    this.listeners.forEach(listener => listener());
  }

  start = () => {
    this.dispose();
    this.closed = false;
    this.publish(empty());

    return this.loadMore();
  };

  nextWindow = () => {
    if (!this.state.limitReached || !this.state.cursor || this.state.loading) {
      return;
    }

    const cursor = this.state.cursor;

    this.dispose();
    this.closed = false;
    this.publish({ ...empty(), cursor });

    return this.loadMore();
  };

  dispose = () => {
    this.closed = true;
    this.generation += 1;
    this.controller?.abort();
  };

  loadMore = async () => {
    if (this.closed || this.state.loading || this.state.ended) {
      return;
    }

    const owner = this.generation;
    const request = new AbortController();

    this.controller = request;

    const before = this.state;

    this.publish({ ...before, loading: true, error: '' });

    try {
      const page = await this.provider(this.kind, this.query, before.cursor, {
        signal: request.signal,
        ...this.options(),
      });

      if (this.closed || owner !== this.generation || request.signal.aborted) {
        return;
      }

      let remaining = this.limit;

      const rows = [...before.rows, ...page.rows]
        .map(row => {
          const entries = row.entries.slice(0, remaining);

          remaining -= entries.length;

          return entries.length === row.entries.length
            ? row
            : { ...row, entries };
        })
        .filter(row => row.entries.length > 0);

      const previous = new Set(before.rows.map(row => row.id));

      if (
        page.rows.some(row => previous.has(row.id)) ||
        (page.nextCursor !== null && page.nextCursor === before.cursor)
      ) {
        throw new Error(
          'Catalogue pagination did not advance. Retry to continue.',
        );
      }

      const limitReached = remaining === 0 && page.nextCursor !== null;

      this.publish({
        rows,
        cursor: page.nextCursor,
        source: page.source,
        loading: false,
        error: '',
        limitReached,
        ended: page.nextCursor === null || limitReached,
      });
    } catch (error) {
      if (this.closed || owner !== this.generation || request.signal.aborted) {
        return;
      }

      this.publish({
        ...before,
        loading: false,
        error: error instanceof Error ? error.message : 'Fixture fetch failed',
      });
    }
  };
}
