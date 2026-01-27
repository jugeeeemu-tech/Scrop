import { NetworkLayerDevice } from './NetworkLayerDevice';
import { AnimatedPacket } from '../packet/AnimatedPacket';
import { DroppedPacketAnimation } from '../packet/DroppedPacketAnimation';
import { ScrollHint } from '../common/ScrollHint';
import { useRef, useState, useEffect, useCallback } from 'react';

interface DroppedPacket {
  id: string;
  protocol: string;
  size: number;
  source: string;
  destination: string;
  reason?: string;
}

interface AnimatingPacket {
  id: string;
  targetPort?: number;
}

interface FWLayerProps {
  droppedPackets: DroppedPacket[];
  isActive?: boolean;
  dropAnimations: DroppedPacket[];
  risingPackets: AnimatingPacket[];
  onDropAnimationComplete: (packetId: string) => void;
  onRisingComplete: (packetId: string) => void;
}

export function FWLayer({
  droppedPackets,
  isActive = false,
  dropAnimations,
  risingPackets,
  onDropAnimationComplete,
  onRisingComplete,
}: FWLayerProps) {
  const animationZoneRef = useRef<HTMLDivElement>(null);
  const [centerX, setCenterX] = useState(0);

  const updateCenterX = useCallback(() => {
    if (!animationZoneRef.current) return;
    const rect = animationZoneRef.current.getBoundingClientRect();
    setCenterX(rect.width / 2);
  }, []);

  useEffect(() => {
    updateCenterX();
    window.addEventListener('resize', updateCenterX);
    return () => window.removeEventListener('resize', updateCenterX);
  }, [updateCenterX]);

  return (
    <section className="min-h-[60vh] relative bg-muted/30">
      <div className="relative">
        {/* Drop animations */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
          {dropAnimations.map((packet) => (
            <DroppedPacketAnimation
              key={packet.id}
              id={packet.id}
              direction="right"
              onComplete={() => onDropAnimationComplete(packet.id)}
            />
          ))}
        </div>

        <NetworkLayerDevice type="firewall" droppedPackets={droppedPackets} isActive={isActive} />
      </div>

      {/* Animation zone - packets rising from NIC */}
      <div ref={animationZoneRef} className="relative h-24 max-w-4xl mx-auto">
        {risingPackets.map((packet) => (
          <AnimatedPacket
            key={packet.id}
            id={packet.id}
            targetX={centerX}
            onComplete={() => onRisingComplete(packet.id)}
          />
        ))}
      </div>

      {/* Scroll hint */}
      <ScrollHint className="pb-4" />
    </section>
  );
}
