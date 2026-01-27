import { cn } from '../../lib/utils';
import { Package } from 'lucide-react';

interface PacketStreamProps {
  targetX: number;
}

export function PacketStream({ targetX }: PacketStreamProps) {
  return (
    <div
      className="absolute bottom-0 h-full"
      style={{
        left: targetX,
        transform: 'translateX(-50%)',
      }}
    >
      {/* Multiple packets flowing continuously */}
      {[0, 1, 2, 3].map((index) => (
        <div
          key={index}
          className={cn(
            'absolute w-6 h-6 bg-foreground rounded-md shadow-md flex items-center justify-center',
            'animate-stream-packet'
          )}
          style={{
            animationDelay: `${index * 200}ms`,
          }}
        >
          <Package className="w-3 h-3 text-background" />
        </div>
      ))}
    </div>
  );
}
