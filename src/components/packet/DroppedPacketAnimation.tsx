import { Package } from 'lucide-react';
import { motion } from 'framer-motion';
import { useRef } from 'react';

interface DroppedPacketAnimationProps {
  id: string;
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
      initial={{ opacity: 1, x: -96, rotate: 0 }}
      animate={{ opacity: 0, x: translateX, rotate: 12 }}
      transition={{
        duration: 1,
        ease: 'easeOut',
        opacity: { delay: 0.6, duration: 0.4 },
        x: { duration: 0.6 },
        rotate: { duration: 0.6 },
      }}
      onAnimationComplete={() => onCompleteRef.current()}
    >
      <div className="w-10 h-10 bg-destructive rounded-lg shadow-lg flex items-center justify-center">
        <Package className="w-5 h-5 text-white" />
      </div>
    </motion.div>
  );
}
