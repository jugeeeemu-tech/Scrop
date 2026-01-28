import { Package } from 'lucide-react';
import { PACKET_ANIMATION_DURATION, STREAM_PACKET_COUNT, STREAM_STAGGER_DELAY } from '../../constants';

type StreamVariant = 'packet' | 'drop';

interface StreamAnimationProps {
  variant: StreamVariant;
  targetX?: number;
}

const durationSec = PACKET_ANIMATION_DURATION / 1000;
const staggerSec = STREAM_STAGGER_DELAY / 1000;

export function StreamAnimation({ variant, targetX }: StreamAnimationProps) {
  const isPacket = variant === 'packet';

  if (isPacket && targetX !== undefined) {
    return (
      <div
        className="absolute bottom-0 h-full w-6"
        style={{ left: targetX, transform: 'translateX(-50%)' }}
      >
        {Array.from({ length: STREAM_PACKET_COUNT }, (_, index) => (
          <div
            key={index}
            className="absolute w-6 h-6 bg-foreground rounded-md shadow-md flex items-center justify-center"
            style={{
              animation: `stream-rise ${durationSec}s ease-out ${index * staggerSec}s infinite backwards`,
            }}
          >
            <Package className="w-3 h-3 text-background" />
          </div>
        ))}
      </div>
    );
  }

  // Drop variant - items positioned at bottom-0 left-0, animated with pixel-based translateX
  return (
    <>
      {Array.from({ length: STREAM_PACKET_COUNT }, (_, index) => (
        <div
          key={index}
          className="absolute left-0 w-6 h-6 bg-destructive rounded-md shadow-md flex items-center justify-center"
          style={{
            bottom: 8,
            animation: `stream-drop ${durationSec}s ease-out ${index * staggerSec}s infinite backwards`,
          }}
        >
          <Package className="w-3 h-3 text-white" />
        </div>
      ))}
    </>
  );
}

// Re-exports
export function PacketStream({ targetX }: { targetX: number }) {
  return <StreamAnimation variant="packet" targetX={targetX} />;
}

export function DropStream() {
  return <StreamAnimation variant="drop" />;
}
