import { createContext, useEffect, useRef } from 'react';

export const BrowserNavigation = createContext<{
  enabled: boolean;
  systemBackAtRoot?: boolean;
  toggle: () => void;
} | null>(null);

type BrowserEventHost = {
  addEventListener(type: string, handler: () => void, capture?: boolean): void;
  removeEventListener(
    type: string,
    handler: () => void,
    capture?: boolean,
  ): void;
};

// A focus-triggered scroll during a click can move its target before pointerup.
export function useBrowserPointerDown(active: boolean) {
  const pointerDown = useRef(false);

  useEffect(() => {
    const browser = (globalThis as { window?: BrowserEventHost }).window;

    if (!active || !browser) return;

    const down = () => {
      pointerDown.current = true;
    };

    const up = () => {
      pointerDown.current = false;
    };

    browser.addEventListener('pointerdown', down, true);
    browser.addEventListener('pointerup', up, true);
    browser.addEventListener('pointercancel', up, true);
    browser.addEventListener('blur', up);

    return () => {
      browser.removeEventListener('pointerdown', down, true);
      browser.removeEventListener('pointerup', up, true);
      browser.removeEventListener('pointercancel', up, true);
      browser.removeEventListener('blur', up);
      up();
    };
  }, [active]);

  return pointerDown;
}
