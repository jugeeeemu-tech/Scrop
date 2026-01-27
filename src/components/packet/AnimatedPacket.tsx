import { cn } from '../../lib/utils';
import { Package } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';

interface AnimatedPacketProps {
  id: string;
  targetX: number;
  onComplete: () => void;
}

export function AnimatedPacket({ targetX, onComplete }: AnimatedPacketProps) {
  const [phase, setPhase] = useState<'start' | 'rising' | 'delivered'>('start');
  const mountTime = useRef(Date.now());
  const completedRef = useRef(false);

  useEffect(() => {
    let animationFrameId: number;

    const checkPhase = () => {
      const elapsed = Date.now() - mountTime.current;

      if (elapsed >= 750 && !completedRef.current) {
        completedRef.current = true;
        setPhase('delivered');
        onComplete();
      } else if (elapsed >= 50) {
        setPhase('rising');
        if (!completedRef.current) {
          animationFrameId = requestAnimationFrame(checkPhase);
        }
      } else {
        animationFrameId = requestAnimationFrame(checkPhase);
      }
    };

    animationFrameId = requestAnimationFrame(checkPhase);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [onComplete]);

  return (
    <div
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
