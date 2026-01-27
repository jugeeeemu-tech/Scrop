import { cn } from '../../lib/utils';
import { Package } from 'lucide-react';
import { useEffect, useState } from 'react';

interface DroppedPacketAnimationProps {
  id: string;
  direction: 'left' | 'right';
  onComplete: () => void;
}

export function DroppedPacketAnimation({ direction, onComplete }: DroppedPacketAnimationProps) {
  const [phase, setPhase] = useState<'start' | 'bouncing' | 'done'>('start');

  useEffect(() => {
    const bounceTimer = setTimeout(() => setPhase('bouncing'), 50);
    const doneTimer = setTimeout(() => {
      setPhase('done');
      onComplete();
    }, 800);

    return () => {
      clearTimeout(bounceTimer);
      clearTimeout(doneTimer);
    };
  }, [onComplete]);

  return (
    <div
      className={cn(
        'absolute transition-all duration-500 ease-out',
        phase === 'start' && 'opacity-100 translate-x-0',
        phase === 'bouncing' &&
          `opacity-100 ${direction === 'right' ? 'translate-x-32' : '-translate-x-32'} rotate-45`,
        phase === 'done' && `opacity-0 ${direction === 'right' ? 'translate-x-40' : '-translate-x-40'}`
      )}
    >
      <div className="w-10 h-10 bg-destructive rounded-lg shadow-lg flex items-center justify-center">
        <Package className="w-5 h-5 text-white" />
      </div>
    </div>
  );
}
