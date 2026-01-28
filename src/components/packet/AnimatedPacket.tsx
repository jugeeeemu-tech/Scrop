import { Package } from 'lucide-react';
import { motion } from 'framer-motion';
import { useRef } from 'react';

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
      style={{ left: targetX, x: '-50%', willChange: 'transform, opacity' }}
      initial={{ bottom: 0, opacity: 1, scale: 1 }}
      animate={{ bottom: '100%', opacity: 0, scale: 0.5 }}
      transition={{
        duration: 0.9,
        ease: 'easeOut',
        bottom: { duration: 0.7 },
        opacity: { delay: 0.7, duration: 0.2 },
        scale: { delay: 0.7, duration: 0.2 },
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
