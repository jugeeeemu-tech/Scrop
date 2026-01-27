import { NetworkLayerDevice } from './NetworkLayerDevice';

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
        <NetworkLayerDevice
          type="nic"
          droppedPackets={droppedPackets}
          isActive={isActive}
          dropAnimations={dropAnimations}
          onDropAnimationComplete={onDropAnimationComplete}
        />
      </div>
    </section>
  );
}
