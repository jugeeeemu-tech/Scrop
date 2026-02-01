import { Package } from 'lucide-react';
import { motion } from 'framer-motion';
import { useRef } from 'react';
import { PACKET_ANIMATION_DURATION } from '../../constants';

interface AnimatedPacketProps {
  targetX: number;
  onComplete: () => void;
}

export function AnimatedPacket({ targetX, onComplete }: AnimatedPacketProps) {
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  return (
    <motion.div
      className="absolute z-10"
      data-testid="animated-packet"
      style={{ left: targetX, x: '-50%', willChange: 'transform, opacity' }}
      initial={{ bottom: 0, opacity: 1, scale: 1 }}
      animate={{ bottom: 'calc(100% - 10px)', opacity: 0, scale: 0.5 }}
      transition={{
        duration: PACKET_ANIMATION_DURATION / 1000,
        ease: 'easeOut',
        bottom: { duration: (PACKET_ANIMATION_DURATION / 1000) * (7 / 9) },
        opacity: { delay: (PACKET_ANIMATION_DURATION / 1000) * (7 / 9), duration: (PACKET_ANIMATION_DURATION / 1000) * (2 / 9) },
        scale: { delay: (PACKET_ANIMATION_DURATION / 1000) * (7 / 9), duration: (PACKET_ANIMATION_DURATION / 1000) * (2 / 9) },
      }}
      onAnimationComplete={() => onCompleteRef.current()}
    >
      <motion.div
        className="w-10 h-10 bg-foreground rounded-lg shadow-lg flex items-center justify-center"
        animate={{ scale: [1, 1.05, 1] }}
        transition={{
          duration: 0.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <Package className="w-5 h-5 text-background" />
      </motion.div>
    </motion.div>
  );
}
