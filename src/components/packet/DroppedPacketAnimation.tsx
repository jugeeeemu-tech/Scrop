import { cn } from '../../lib/utils';
import { Package } from 'lucide-react';
import { useState, useRef, type TransitionEvent } from 'react';

interface DroppedPacketAnimationProps {
  id: string;
  direction: 'left' | 'right';
  onComplete: () => void;
}

export function DroppedPacketAnimation({ direction, onComplete }: DroppedPacketAnimationProps) {
  const [phase, setPhase] = useState<'start' | 'bouncing' | 'done'>('start');
  const completedRef = useRef(false);

  // Trigger bouncing phase on first render via ref callback
  const hasStartedRef = useRef(false);

  const setRef = (el: HTMLDivElement | null) => {
    if (el && !hasStartedRef.current) {
      hasStartedRef.current = true;
      // Use requestAnimationFrame to ensure the 'start' styles are applied first
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setPhase('bouncing');
        });
      });
    }
  };

  const handleTransitionEnd = (e: TransitionEvent<HTMLDivElement>) => {
    // Trigger on transform completion
    if (e.propertyName === 'transform') {
      if (phase === 'bouncing') {
        setPhase('done');
      } else if (phase === 'done' && !completedRef.current) {
        completedRef.current = true;
        onComplete();
      }
    }
  };

  return (
    <div
      ref={setRef}
      className={cn(
        'absolute bottom-0 left-0 transition-all duration-500 ease-out',
        phase === 'start' && 'opacity-100 -translate-x-24',
        phase === 'bouncing' &&
          `opacity-100 ${direction === 'right' ? 'translate-x-2' : '-translate-x-2'} rotate-12`,
        phase === 'done' &&
          `opacity-0 ${direction === 'right' ? 'translate-x-2' : '-translate-x-2'} rotate-12`
      )}
      onTransitionEnd={handleTransitionEnd}
    >
      <div className="w-10 h-10 bg-destructive rounded-lg shadow-lg flex items-center justify-center">
        <Package className="w-5 h-5 text-white" />
      </div>
    </div>
  );
}
