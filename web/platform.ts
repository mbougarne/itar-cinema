import type { AlertButton, AlertOptions } from 'react-native';

export * from 'react-native-web';

export { View as TVFocusGuideView } from 'react-native-web';

type BackListener = () => boolean | null | undefined;

const listeners = new Set<BackListener>();

function lgSystem() {
  const host = window as Window & {
    webOSSystem?: { platformBack(): void };
    PalmSystem?: { platformBack(): void };
  };

  return host.webOSSystem ?? host.PalmSystem;
}

export function hasSystemBack() {
  return typeof lgSystem()?.platformBack === 'function';
}

function onBack(event: KeyboardEvent) {
  if (
    event.defaultPrevented ||
    event.repeat ||
    (!['Escape', 'BrowserBack', 'GoBack'].includes(event.key) &&
      ![10009, 461].includes(event.keyCode))
  ) {
    return;
  }

  for (const listener of Array.from(listeners).reverse()) {
    if (listener()) {
      event.preventDefault();
      event.stopPropagation();

      return;
    }
  }

  // A short Magic Remote Back at the root belongs to the system exit dialog.
  const system = lgSystem();

  if (event.keyCode === 461 && typeof system?.platformBack === 'function') {
    event.preventDefault();
    event.stopPropagation();
    system.platformBack();
  }
}

export const BackHandler = {
  addEventListener(_event: 'hardwareBackPress', listener: BackListener) {
    if (!listeners.size) {
      // RNW editors stop bubbling keydown; the latest Back listener still owns it.
      document.addEventListener('keydown', onBack, true);
    }

    listeners.add(listener);

    return {
      remove() {
        listeners.delete(listener);

        if (!listeners.size) {
          document.removeEventListener('keydown', onBack, true);
        }
      },
    };
  },
  exitApp() {
    window.close();
  },
};

// Only the OTT app's one/two-action confirmation contract is exposed here.
export const Alert = {
  alert(
    title: string,
    message?: string,
    buttons: AlertButton[] = [],
    options?: AlertOptions,
  ) {
    const text = [title, message].filter(Boolean).join('\n\n');
    const action = buttons.find(button => button.style !== 'cancel');
    const cancel = buttons.find(button => button.style === 'cancel');

    if (buttons.length > 1) {
      // Browser-owned dialogs keep exit confirmation accessible without another focus surface.
      // eslint-disable-next-line no-alert
      if (window.confirm(text)) {
        action?.onPress?.();
      } else {
        (cancel?.onPress ?? options?.onDismiss)?.();
      }
    } else {
      // eslint-disable-next-line no-alert
      window.alert(text);
      (buttons[0]?.onPress ?? options?.onDismiss)?.();
    }
  },
};
