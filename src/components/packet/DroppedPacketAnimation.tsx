import { cn } from '../../lib/utils';
import { Package } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface DroppedPacketAnimationProps {
  id: string;
  direction: 'left' | 'right';
  onComplete: () => void;
}

export function DroppedPacketAnimation({ direction, onComplete }: DroppedPacketAnimationProps) {
  const [phase, setPhase] = useState<'start' | 'bouncing' | 'done'>('start');
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const bounceTimer = setTimeout(() => setPhase('bouncing'), 50);
    const doneTimer = setTimeout(() => setPhase('done'), 800);
    const completeTimer = setTimeout(() => onCompleteRef.current(), 1300);

    return () => {
      clearTimeout(bounceTimer);
      clearTimeout(doneTimer);
      clearTimeout(completeTimer);
    };
  }, []);

  return (
    <div
      className={cn(
        'absolute bottom-0 left-0 transition-all duration-500 ease-out',
        phase === 'start' && 'opacity-100 -translate-x-24',
        phase === 'bouncing' &&
          `opacity-100 ${direction === 'right' ? 'translate-x-2' : '-translate-x-2'} rotate-12`,
        phase === 'done' &&
          `opacity-0 ${direction === 'right' ? 'translate-x-2' : '-translate-x-2'} rotate-12`
      )}
    >
      <div className="w-10 h-10 bg-destructive rounded-lg shadow-lg flex items-center justify-center">
        <Package className="w-5 h-5 text-white" />
      </div>
    </div>
  );
}
