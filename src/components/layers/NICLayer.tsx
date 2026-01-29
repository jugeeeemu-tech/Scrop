import { NicDevice } from '../nic/NicDevice';
import { DroppedPile } from './NetworkLayerDevice';
import { AnimatedPacket } from '../packet/AnimatedPacket';
import { PacketStream } from '../packet/PacketStream';
import { StreamFadeOut } from '../packet/StreamFadeOut';
import { useLayerCenterX } from '../../hooks';
import type { AnimatingPacket } from '../../types';

interface NICLayerProps {
  droppedPackets: AnimatingPacket[];
  droppedCount: number;
  dropAnimations: AnimatingPacket[];
  incomingPackets: AnimatingPacket[];
  onDropAnimationComplete: (packetId: string) => void;
  onIncomingComplete: (packetId: string) => void;
  isDropStreamMode?: boolean;
  isPacketStreamMode?: boolean;
  isActive?: boolean;
  availableNics: string[];
  attachedNics: Set<string>;
  onToggleNic: (name: string) => void;
}

export function NICLayer({
  droppedPackets,
  droppedCount,
  dropAnimations,
  incomingPackets,
  onDropAnimationComplete,
  onIncomingComplete,
  isDropStreamMode = false,
  isPacketStreamMode = false,
  isActive = false,
  availableNics,
  attachedNics,
  onToggleNic,
}: NICLayerProps) {
  const { ref: animationZoneRef, centerX } = useLayerCenterX();

  return (
    <section className="min-h-[50vh] bg-muted/50 relative">
      <div className="relative">
        <section className="min-h-[50vh] py-16 px-6 flex items-center justify-center">
          <div className="flex items-center gap-12">
            {/* Single NIC device */}
            <NicDevice
              availableNics={availableNics}
              attachedNics={attachedNics}
              onToggleNic={onToggleNic}
              isActive={isActive}
            />

            {/* Dropped packets pile */}
            <DroppedPile
              packets={droppedPackets}
              count={droppedCount}
              type="nic"
              dropAnimations={dropAnimations}
              onDropAnimationComplete={onDropAnimationComplete}
              isDropStreamMode={isDropStreamMode}
            />
          </div>
        </section>
      </div>

      {/* Animation zone */}
      <div ref={animationZoneRef} className="relative h-24 max-w-4xl mx-auto">
        <StreamFadeOut active={isPacketStreamMode}>
          <PacketStream targetX={centerX} />
        </StreamFadeOut>
        {incomingPackets.map((packet) => (
          <AnimatedPacket
            key={packet.id}
            targetX={centerX}
            onComplete={() => onIncomingComplete(packet.id)}
          />
        ))}
      </div>
    </section>
  );
}
