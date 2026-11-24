import { useCallback, useEffect, useRef, useState } from 'react';

const idleMs = 3000;

export function usePlaybackControls(canHide: boolean) {
  const [hidden, setHidden] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelHide = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const wake = useCallback(() => {
    cancelHide();
    setHidden(false);

    if (canHide) {
      timer.current = setTimeout(() => {
        timer.current = null;
        setHidden(true);
      }, idleMs);
    }
  }, [canHide, cancelHide]);

  useEffect(() => {
    wake();

    return cancelHide;
  }, [wake, cancelHide]);

  return { visible: !canHide || !hidden, wake, cancelHide };
}
