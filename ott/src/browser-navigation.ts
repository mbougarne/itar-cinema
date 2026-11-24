import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react';
import { useFocusCommands } from '@bougarnem/itar/react';

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

type FocusDirection = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown';

type FocusTarget = { dataset?: { itarKey?: string } };

type FocusKeyEvent = {
  key: string;
  keyCode: number;
  target?: FocusTarget;
  defaultPrevented: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  preventDefault(): void;
  stopPropagation(): void;
};

const directions = ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'] as const;

function occurrenceFromHost(target?: FocusTarget | null) {
  const targetKey = target?.dataset?.itarKey;

  if (!targetKey) return;

  const [kind, key] = JSON.parse(targetKey) as [string, string];

  return kind === 'target' ? key : undefined;
}

export function browserFocusedOccurrenceKey() {
  const browser = globalThis as {
    document?: { activeElement: FocusTarget | null };
  };

  return occurrenceFromHost(browser.document?.activeElement);
}

// Use the public focus command at screen-specific boundaries. Itar still owns
// the targets, including preparing cards that are outside a virtualized window.
export function useBrowserFocusRoute(
  active: boolean,
  resolve: (
    key: string,
    direction: FocusDirection,
  ) => string | false | undefined,
) {
  const navigation = useContext(BrowserNavigation);
  const commands = useFocusCommands();

  useLayoutEffect(() => {
    const browser = (
      globalThis as {
        window?: {
          addEventListener(
            type: string,
            handler: (event: FocusKeyEvent) => void,
            capture: boolean,
          ): void;
          removeEventListener(
            type: string,
            handler: (event: FocusKeyEvent) => void,
            capture: boolean,
          ): void;
        };
      }
    ).window;

    if (!active || !navigation?.enabled || !browser) return;

    const keydown = (event: FocusKeyEvent) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      )
        return;

      const direction =
        directions.find(value => value === event.key) ??
        directions[event.keyCode - 37];

      if (!direction) return;

      // Read the owned host key now. DOM focus can advance before React
      // renders its next focus snapshot during consecutive remote presses.
      const key = occurrenceFromHost(event.target);

      if (!key) return;

      const destination = resolve(key, direction);

      if (destination === undefined) return;

      event.preventDefault();
      event.stopPropagation();

      if (destination) commands.focusByKey(destination);
    };

    browser.addEventListener('keydown', keydown, true);

    return () => browser.removeEventListener('keydown', keydown, true);
  }, [active, commands, navigation?.enabled, resolve]);
}
