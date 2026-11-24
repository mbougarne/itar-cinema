import { Platform } from 'react-native';
import { isProfileId } from './cinema-profiles';
import type { ProviderMode } from './catalog-types';

const key = 'itar.probe.session.v1';

export type BrowserSession = {
  mode: ProviderMode;
  profile: string;
};

type SessionStorage = {
  getItem: (name: string) => string | null;
  setItem: (name: string, value: string) => void;
  removeItem: (name: string) => void;
};

function storage(): SessionStorage | undefined {
  if (Platform.OS !== 'web') {
    return undefined;
  }

  return (globalThis as { localStorage?: SessionStorage }).localStorage;
}

// This remembers a demo session, not an authentication credential.
export function readBrowserSession(): BrowserSession | null {
  try {
    const raw = storage()?.getItem(key);
    const value: unknown = raw ? JSON.parse(raw) : null;

    if (
      typeof value === 'object' &&
      value !== null &&
      'signedIn' in value &&
      value.signedIn === true &&
      'mode' in value &&
      (value.mode === 'fixture' || value.mode === 'proxy') &&
      'profile' in value &&
      isProfileId(value.profile)
    ) {
      return { mode: value.mode, profile: value.profile };
    }
  } catch {
    // Storage may be blocked or contain an invalid previous value.
  }

  return null;
}

export function saveBrowserSession(session: BrowserSession | null): void {
  try {
    if (session) {
      storage()?.setItem(
        key,
        JSON.stringify({
          signedIn: true,
          mode: session.mode,
          profile: session.profile,
        }),
      );
    } else {
      storage()?.removeItem(key);
    }
  } catch {
    // The current session still works when persistence is unavailable.
  }
}
