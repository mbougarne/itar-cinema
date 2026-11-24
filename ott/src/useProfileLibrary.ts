import { useEffect, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ProfileLibrary } from './profile-library';

const profiles = new Map<string, ProfileLibrary>();

export function useProfileLibrary(profile: string) {
  let store = profiles.get(profile);

  if (!store) {
    store = new ProfileLibrary(
      AsyncStorage,
      `itar.cinema.library.v1.${profile}`,
    );

    profiles.set(profile, store);
  }

  const library = useSyncExternalStore(store.subscribe, store.read, store.read);

  useEffect(() => {
    store.load();
  }, [store]);

  return { library, store };
}
