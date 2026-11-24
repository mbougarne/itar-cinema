import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const languages = {
  en: 'English',
  ar: 'Arabic',
  fr: 'French',
  es: 'Spanish',
  de: 'German',
  ja: 'Japanese',
} as const;

export type ProfileLanguage = keyof typeof languages;

function language(value: unknown): ProfileLanguage | undefined {
  return typeof value === 'string' && Object.hasOwn(languages, value)
    ? (value as ProfileLanguage)
    : undefined;
}

export type CinemaProfile = Readonly<{
  id: string;
  name: string;
  avatar: number;
  autoNext: boolean;
  audio?: ProfileLanguage;
  subtitles?: ProfileLanguage;
}>;

export const defaultProfiles: readonly CinemaProfile[] = [
  { id: 'Explorer', name: 'Explorer', avatar: 0, autoNext: false },
  { id: 'Stargazer', name: 'Stargazer', avatar: 3, autoNext: false },
];

const profilesKey = 'itar.cinema.profiles.v1';

export const isProfileId = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^(Explorer|Stargazer|profile-[a-z0-9-]{1,48})$/.test(value);

function parseProfiles(value: unknown): readonly CinemaProfile[] {
  if (!Array.isArray(value)) return defaultProfiles;

  const ordered = new Map(
    defaultProfiles.map(profile => [profile.id, profile]),
  );

  for (const profile of value) {
    if (
      profile &&
      isProfileId(profile.id) &&
      typeof profile.name === 'string' &&
      profile.name.trim() &&
      profile.name.length <= 22 &&
      Number.isInteger(profile.avatar) &&
      profile.avatar >= 0 &&
      profile.avatar <= 7 &&
      typeof profile.autoNext === 'boolean'
    ) {
      const { id, name, avatar, autoNext } = profile;

      ordered.set(id, {
        id,
        name,
        avatar,
        autoNext,
        audio: language(profile.audio),
        subtitles: language(profile.subtitles),
      });
    }
  }

  return Array.from(ordered.values());
}

export function useCinemaProfiles() {
  const [profiles, setProfiles] = useState(defaultProfiles);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    AsyncStorage.getItem(profilesKey)
      .then(raw => {
        if (mounted && raw) setProfiles(parseProfiles(JSON.parse(raw)));
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setReady(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const save = async (profile: CinemaProfile) => {
    if (!ready) throw new Error('Profiles are still loading.');

    const next = parseProfiles([...profiles, profile]);

    await AsyncStorage.setItem(profilesKey, JSON.stringify(next));
    setProfiles(next);
  };

  return { profiles, ready, save };
}
