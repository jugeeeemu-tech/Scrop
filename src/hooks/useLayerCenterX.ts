import { useRef, useState, useEffect, useCallback, type RefObject } from 'react';

interface UseLayerCenterXResult {
  ref: RefObject<HTMLDivElement | null>;
  centerX: number;
}

export function useLayerCenterX(): UseLayerCenterXResult {
  const ref = useRef<HTMLDivElement>(null);
  const [centerX, setCenterX] = useState(0);

  const updateCenterX = useCallback(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setCenterX(rect.width / 2);
  }, []);

  useEffect(() => {
    updateCenterX();
    window.addEventListener('resize', updateCenterX);
    return () => window.removeEventListener('resize', updateCenterX);
  }, [updateCenterX]);

  return { ref, centerX };
}
