import React, { createContext, useContext, useMemo, useState } from 'react';
import { arabic } from './translations-ar';

export type CinemaLanguage = 'en-US' | 'ar-SA';

const storageKey = 'itar.cinema.language';

type Storage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function storage() {
  return (globalThis as { localStorage?: Storage }).localStorage;
}

function initialLanguage(): CinemaLanguage {
  try {
    return storage()?.getItem(storageKey) === 'ar-SA' ? 'ar-SA' : 'en-US';
  } catch {
    return 'en-US';
  }
}

type Fields = Readonly<Record<string, string | number>>;

function interpolate(message: string, fields?: Fields) {
  if (!fields) return message;

  return message.replace(/\{(\w+)\}/g, (token, name: string) =>
    Object.prototype.hasOwnProperty.call(fields, name)
      ? String(fields[name])
      : token,
  );
}

const english = {
  language: 'en-US' as CinemaLanguage,
  rtl: false,
  t: interpolate,
  toggle: () => {},
};

const Language = createContext(english);

export function CinemaLanguageProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [language, setLanguage] = useState(initialLanguage);
  const rtl = language === 'ar-SA';

  const value = useMemo(
    () => ({
      language,
      rtl,
      t: rtl ? translateArabic : english.t,
      toggle: () => {
        const next = rtl ? 'en-US' : 'ar-SA';

        setLanguage(next);

        try {
          storage()?.setItem(storageKey, next);
        } catch {
          // The new language remains active until the current session ends.
        }
      },
    }),
    [language, rtl],
  );

  return <Language.Provider value={value}>{children}</Language.Provider>;
}

export const useCinemaLanguage = () => useContext(Language);

function translateArabic(value: string, fields?: Fields): string {
  if (Object.prototype.hasOwnProperty.call(arabic, value))
    return interpolate(arabic[value], fields);

  const suffix = ', selected';

  if (value.endsWith(suffix)) {
    return `${translateArabic(value.slice(0, -suffix.length), fields)}، محدد`;
  }

  const season = /^Season (\d+)$/.exec(value);

  if (season) return `الموسم ${season[1]}`;

  const episode = /^S(\d+) E(\d+) · (.+)$/.exec(value);

  if (episode)
    return `الموسم ${episode[1]}، الحلقة ${episode[2]} · ${episode[3]}`;

  return interpolate(value, fields);
}
