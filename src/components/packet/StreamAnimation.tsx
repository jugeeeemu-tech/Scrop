import { cn } from '../../lib/utils';
import { Package } from 'lucide-react';
import { STREAM_PACKET_COUNT, STREAM_STAGGER_DELAY } from '../../constants';

type StreamVariant = 'packet' | 'drop';

interface StreamAnimationProps {
  variant: StreamVariant;
  targetX?: number;
}

export function StreamAnimation({ variant, targetX }: StreamAnimationProps) {
  const isPacket = variant === 'packet';

  if (isPacket && targetX !== undefined) {
    return (
      <div
        className="absolute bottom-0 h-full"
        style={{
          left: targetX,
          transform: 'translateX(-50%)',
        }}
      >
        {Array.from({ length: STREAM_PACKET_COUNT }).map((_, index) => (
          <div
            key={index}
            className={cn(
              'absolute w-6 h-6 bg-foreground rounded-md shadow-md flex items-center justify-center',
              'animate-stream-packet'
            )}
            style={{
              animationDelay: `${index * STREAM_STAGGER_DELAY}ms`,
            }}
          >
            <Package className="w-3 h-3 text-background" />
          </div>
        ))}
      </div>
    );
  }

  // Drop variant
  return (
    <div className="absolute bottom-0 left-0 h-full w-full pointer-events-none">
      {Array.from({ length: STREAM_PACKET_COUNT }).map((_, index) => (
        <div
          key={index}
          className={cn(
            'absolute w-6 h-6 bg-destructive rounded-md shadow-md flex items-center justify-center',
            'animate-drop-stream'
          )}
          style={{
            animationDelay: `${index * STREAM_STAGGER_DELAY}ms`,
          }}
        >
          <Package className="w-3 h-3 text-white" />
        </div>
      ))}
    </div>
  );
}

// Re-exports for backwards compatibility
export function PacketStream({ targetX }: { targetX: number }) {
  return <StreamAnimation variant="packet" targetX={targetX} />;
}

export function DropStream() {
  return <StreamAnimation variant="drop" />;
}
