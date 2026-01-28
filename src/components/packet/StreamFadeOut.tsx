import { useEffect, useRef, useState } from 'react';
import { STREAM_DRAIN_DURATION } from '../../constants';

interface StreamFadeOutProps {
  active: boolean;
  children: React.ReactNode;
  onFadeComplete?: () => void;
}

export function StreamFadeOut({ active, children, onFadeComplete }: StreamFadeOutProps) {
  const [visible, setVisible] = useState(active);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevActiveRef = useRef(active);
  const onFadeCompleteRef = useRef(onFadeComplete);
  onFadeCompleteRef.current = onFadeComplete;

  useEffect(() => {
    const wasActive = prevActiveRef.current;
    prevActiveRef.current = active;

    if (active) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setVisible(true);
    } else if (wasActive) {
      timerRef.current = setTimeout(() => {
        setVisible(false);
        timerRef.current = null;
        onFadeCompleteRef.current?.();
      }, STREAM_DRAIN_DURATION);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [active]);

  if (!visible) return null;

  return (
    <div style={{
      opacity: active ? 1 : 0,
      transition: active ? 'none' : `opacity ${STREAM_DRAIN_DURATION}ms ease-out`,
    }}>
      {children}
    </div>
  );
}
