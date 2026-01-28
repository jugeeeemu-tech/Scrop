import { Package } from 'lucide-react';
import { motion } from 'framer-motion';
import { PACKET_ANIMATION_DURATION, STREAM_PACKET_COUNT, STREAM_STAGGER_DELAY } from '../../constants';

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
        style={{ left: targetX, transform: 'translateX(-50%)' }}
      >
        {Array.from({ length: STREAM_PACKET_COUNT }).map((_, index) => (
          <motion.div
            key={index}
            className="absolute w-6 h-6 bg-foreground rounded-md shadow-md flex items-center justify-center"
            initial={{ bottom: 0, opacity: 0 }}
            animate={{ bottom: '100%', opacity: [0, 1, 1, 0] }}
            transition={{
              duration: PACKET_ANIMATION_DURATION / 1000,
              ease: 'easeOut',
              repeat: Infinity,
              delay: index * (STREAM_STAGGER_DELAY / 1000),
              opacity: { times: [0, 0.1, 0.9, 1] },
            }}
          >
            <Package className="w-3 h-3 text-background" />
          </motion.div>
        ))}
      </div>
    );
  }

  // Drop variant
  return (
    <div className="absolute bottom-0 left-0 h-full w-full pointer-events-none">
      {Array.from({ length: STREAM_PACKET_COUNT }).map((_, index) => (
        <motion.div
          key={index}
          className="absolute w-6 h-6 bg-destructive rounded-md shadow-md flex items-center justify-center"
          initial={{ left: -24, bottom: '50%', opacity: 0, scale: 0.8, rotate: 0 }}
          animate={{
            left: ['0%', '50%', '70%', '65%', '60%'],
            bottom: ['50%', '50%', '20%', '30%', '0%'],
            opacity: [0, 1, 1, 1, 0],
            scale: [0.8, 1, 1, 0.9, 0.7],
            rotate: [0, 0, 15, -10, 5],
          }}
          transition={{
            duration: PACKET_ANIMATION_DURATION / 1000,
            ease: 'easeInOut',
            repeat: Infinity,
            delay: index * (STREAM_STAGGER_DELAY / 1000),
            times: [0, 0.1, 0.5, 0.7, 1],
          }}
        >
          <Package className="w-3 h-3 text-white" />
        </motion.div>
      ))}
    </div>
  );
}

// Re-exports
export function PacketStream({ targetX }: { targetX: number }) {
  return <StreamAnimation variant="packet" targetX={targetX} />;
}

export function DropStream() {
  return <StreamAnimation variant="drop" />;
}
