import { cn } from '../../lib/utils';
import { Package } from 'lucide-react';
import { useEffect, useState } from 'react';

interface AnimatedPacketProps {
  id: string;
  targetMailboxIndex: number;
  onComplete: () => void;
}

export function AnimatedPacket({ targetMailboxIndex, onComplete }: AnimatedPacketProps) {
  const [phase, setPhase] = useState<'start' | 'rising' | 'delivered'>('start');

  useEffect(() => {
    const riseTimer = setTimeout(() => setPhase('rising'), 50);
    const deliverTimer = setTimeout(() => {
      setPhase('delivered');
      onComplete();
    }, 1000);

    return () => {
      clearTimeout(riseTimer);
      clearTimeout(deliverTimer);
    };
  }, [onComplete]);

  // Calculate horizontal position based on target mailbox (5 mailboxes)
  const getTranslateX = () => {
    const positions = [-160, -80, 0, 80, 160];
    return positions[targetMailboxIndex] || 0;
  };

  return (
    <div
      className={cn(
        'absolute left-1/2 transition-all duration-700 ease-out z-10',
        phase === 'start' && 'bottom-0 opacity-100',
        phase === 'rising' && 'bottom-full opacity-100',
        phase === 'delivered' && 'bottom-full opacity-0 scale-50'
      )}
      style={{
        transform: `translateX(calc(-50% + ${getTranslateX()}px))`,
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
