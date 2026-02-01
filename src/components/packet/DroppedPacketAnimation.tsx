import { Package } from 'lucide-react';
import { motion } from 'framer-motion';
import { useRef } from 'react';
import { DROP_ANIMATION_DURATION } from '../../constants';

interface DroppedPacketAnimationProps {
  direction: 'left' | 'right';
  onComplete: () => void;
}

export function DroppedPacketAnimation({ direction, onComplete }: DroppedPacketAnimationProps) {
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const translateX = direction === 'right' ? 8 : -8;

  return (
    <motion.div
      className="absolute bottom-0 left-0"
      data-testid="drop-animation"
      style={{ willChange: 'transform, opacity' }}
      initial={{ opacity: 1, x: -96, rotate: 0 }}
      animate={{ opacity: 0, x: translateX, rotate: 12 }}
      transition={{
        duration: DROP_ANIMATION_DURATION / 1000,
        ease: 'easeOut',
        opacity: { delay: (DROP_ANIMATION_DURATION / 1000) * 0.6, duration: (DROP_ANIMATION_DURATION / 1000) * 0.4 },
        x: { duration: (DROP_ANIMATION_DURATION / 1000) * 0.6 },
        rotate: { duration: (DROP_ANIMATION_DURATION / 1000) * 0.6 },
      }}
      onAnimationComplete={() => onCompleteRef.current()}
    >
      <div className="w-10 h-10 bg-destructive rounded-lg shadow-lg flex items-center justify-center">
        <Package className="w-5 h-5 text-white" />
      </div>
    </motion.div>
  );
}
