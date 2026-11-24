import { useEffect } from 'react';
import { useFocusState } from '@bougarnem/itar/react';

export function EndObserver({
  keys,
  active,
  blocked,
  onEnd,
}: {
  keys: readonly string[];
  active: boolean;
  blocked: boolean;
  onEnd: () => void;
}) {
  const focus = useFocusState();

  const focused =
    focus.kind === 'managed' &&
    !!focus.occurrenceKey &&
    keys.includes(focus.occurrenceKey);

  useEffect(() => {
    if (focused && active && !blocked) {
      onEnd();
    }
  }, [focused, active, blocked, onEnd]);

  return null;
}
