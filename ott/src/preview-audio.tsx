import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const key = 'itar.cinema.preview-audio';

const PreviewAudio = createContext({
  enabled: false,
  toggle: () => {},
});

export function PreviewAudioProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [enabled, setEnabled] = useState<boolean>();

  useEffect(() => {
    let active = true;

    AsyncStorage.getItem(key).then(
      value => {
        if (active) setEnabled(current => current ?? value === 'on');
      },
      () => {},
    );

    return () => {
      active = false;
    };
  }, []);

  const toggle = useCallback(() => {
    const next = !enabled;

    setEnabled(next);
    AsyncStorage.setItem(key, next ? 'on' : 'off').catch(() => {});
  }, [enabled]);

  return (
    <PreviewAudio.Provider value={{ enabled: enabled ?? false, toggle }}>
      {children}
    </PreviewAudio.Provider>
  );
}

export function usePreviewAudio() {
  return useContext(PreviewAudio);
}
