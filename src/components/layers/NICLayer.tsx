import { NetworkLayerDevice } from './NetworkLayerDevice';
import { DroppedPacketAnimation } from '../packet/DroppedPacketAnimation';

interface DroppedPacket {
  id: string;
  protocol: string;
  size: number;
  source: string;
  destination: string;
  reason?: string;
}

interface NICLayerProps {
  droppedPackets: DroppedPacket[];
  isActive?: boolean;
  dropAnimations: DroppedPacket[];
  onDropAnimationComplete: (packetId: string) => void;
}

export function NICLayer({ droppedPackets, isActive = false, dropAnimations, onDropAnimationComplete }: NICLayerProps) {
  return (
    <section className="min-h-[50vh] relative bg-muted/50">
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

        <NetworkLayerDevice type="nic" droppedPackets={droppedPackets} isActive={isActive} />
      </div>
    </section>
  );
}
