import React, { createContext, useContext, useMemo, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { createStyles, accentThemes, type AccentName } from './styles';

const accentKey = 'itar.cinema.accent';

type Storage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function accentStorage() {
  return (globalThis as { localStorage?: Storage }).localStorage;
}

function initialAccent(): AccentName {
  try {
    const storage = accentStorage();
    const saved = storage?.getItem(accentKey);

    if (saved != null) return saved === 'blue' ? 'blue' : 'cyan';

    return storage?.getItem('itar.cinema.palette') === 'midnight'
      ? 'blue'
      : 'cyan';
  } catch {
    return 'cyan';
  }
}

const Context = createContext<{
  s: ReturnType<typeof createStyles>;
  u: number;
  accentName: AccentName;
  colors: (typeof accentThemes)[AccentName];
  toggleAccent: () => void;
}>({
  s: createStyles(1),
  u: 1,
  accentName: 'cyan',
  colors: accentThemes.cyan,
  toggleAccent: () => {},
});

export function DesignTheme({ children }: { children: React.ReactNode }) {
  const { width, height } = useWindowDimensions();
  const u = Math.min(width / 1920, height / 1080);
  const [accentName, setAccentName] = useState(initialAccent);

  const value = useMemo(
    () => ({
      s: createStyles(u, accentName),
      u,
      accentName,
      colors: accentThemes[accentName],
      toggleAccent: () => {
        const next = accentName === 'cyan' ? 'blue' : 'cyan';

        setAccentName(next);

        try {
          accentStorage()?.setItem(accentKey, next);
        } catch {
          // The preview remains selected for this session.
        }
      },
    }),
    [accentName, u],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export const useDesign = () => useContext(Context);
