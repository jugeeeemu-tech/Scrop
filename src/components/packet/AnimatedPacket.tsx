import { cn } from '../../lib/utils';
import { Package } from 'lucide-react';
import { useState, useRef, type TransitionEvent } from 'react';

interface AnimatedPacketProps {
  id: string;
  targetX: number;
  onComplete: () => void;
}

export function AnimatedPacket({ targetX, onComplete }: AnimatedPacketProps) {
  const [phase, setPhase] = useState<'start' | 'rising' | 'delivered'>('start');
  const completedRef = useRef(false);

  // Trigger rising phase on first render via ref callback
  const elementRef = useRef<HTMLDivElement | null>(null);
  const hasStartedRef = useRef(false);

  const setRef = (el: HTMLDivElement | null) => {
    elementRef.current = el;
    if (el && !hasStartedRef.current) {
      hasStartedRef.current = true;
      // Use requestAnimationFrame to ensure the 'start' styles are applied first
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setPhase('rising');
        });
      });
    }
  };

  const handleTransitionEnd = (e: TransitionEvent<HTMLDivElement>) => {
    // Only trigger on the 'bottom' property ending (the main animation)
    if (e.propertyName === 'bottom' && phase === 'rising' && !completedRef.current) {
      completedRef.current = true;
      setPhase('delivered');
      onComplete();
    }
  };

  return (
    <div
      ref={setRef}
      className={cn(
        'absolute transition-all ease-out z-10',
        phase === 'delivered' ? 'duration-200' : 'duration-700',
        phase === 'start' && 'bottom-0 opacity-100',
        phase === 'rising' && 'bottom-full opacity-100',
        phase === 'delivered' && 'bottom-full opacity-0 scale-50'
      )}
      style={{
        left: targetX,
        transform: 'translateX(-50%)',
      }}
      onTransitionEnd={handleTransitionEnd}
    >
      <div
        className={cn(
          'w-10 h-10 bg-foreground rounded-lg shadow-lg flex items-center justify-center transition-transform',
          phase === 'rising' && 'animate-pulse'
        )}
      >
        <Package className="w-5 h-5 text-background" />
      </div>
    </div>
  );
}
