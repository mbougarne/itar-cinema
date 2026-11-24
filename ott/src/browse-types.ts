import type {
  CatalogueSort,
  Category,
  Film,
  Kind,
  ProviderMode,
} from './catalog-types';
import type { WatchingEntry } from './profile-library';

export type BrowseVisual = {
  film?: Film;
  poster?: boolean;
  rank?: number;
  preview?: boolean;
  kidsPreview?: boolean;
  watching?: WatchingEntry;
  live?: boolean;
  feedback?: boolean;
};

export type BrowseProps = {
  grid?: boolean;
  category?: Category;
  sort?: CatalogueSort;
  sortNavigation?: { keys: readonly string[]; entry: string };
  onSave?: (film: Film) => void;
  savedIds?: readonly string[];
  saveReady?: boolean;
  previewsEnabled?: boolean;
  onPlaySample?: (film: Film, openerKey: string) => void;
  onCollection?: (id: string, openerKey: string) => void;
  onCollections?: (openerKey: string) => void;
  onGuide?: (openerKey: string) => void;
  onLive?: (openerKey: string, channelId?: string) => void;
  onReady?: (initialKey?: string) => void;
  onHomeLoading?: () => void;
  viewportWidth?: number;
  mode: ProviderMode;
  id: string;
  kind: Kind;
  query?: string;
  active: boolean;
  delay: number;
  failNext: () => boolean;
  onOpen: (film: Film, openerKey: string) => void;
  highContrast: boolean;
  featured?: boolean;
  continueWatching?: readonly WatchingEntry[];
  searchResults?: boolean;
};
