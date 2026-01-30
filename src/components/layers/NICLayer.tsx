import { NicDevice } from '../nic/NicDevice';
import { DroppedPile } from './NetworkLayerDevice';
import { AnimatedPacket } from '../packet/AnimatedPacket';
import { PacketStream } from '../packet/PacketStream';
import { StreamFadeOut } from '../packet/StreamFadeOut';
import { useLayerCenterX } from '../../hooks';
import { useNICLayerStore } from '../../hooks/useNICLayerStore';
import { handleDropAnimationComplete, handleIncomingComplete } from '../../stores/packetStore';

interface NICLayerProps {
  availableNics: string[];
  attachedNics: Set<string>;
  onToggleNic: (name: string) => void;
}

export function NICLayer({
  availableNics,
  attachedNics,
  onToggleNic,
}: NICLayerProps) {
  const {
    nicDropped,
    nicDroppedCounter,
    nicDropAnimations,
    incomingPackets,
    isNicDropStreamMode,
    isIncomingStreamMode,
    nicActive,
  } = useNICLayerStore();

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
              isActive={nicActive}
            />

            {/* Dropped packets pile */}
            <DroppedPile
              packets={nicDropped}
              count={nicDroppedCounter}
              type="nic"
              dropAnimations={nicDropAnimations}
              onDropAnimationComplete={(id) => handleDropAnimationComplete(id, 'nic')}
              isDropStreamMode={isNicDropStreamMode}
            />
          </div>
        </section>
      </div>

      {/* Animation zone */}
      <div ref={animationZoneRef} className="relative h-24 max-w-4xl mx-auto">
        <StreamFadeOut active={isIncomingStreamMode}>
          <PacketStream targetX={centerX} />
        </StreamFadeOut>
        {incomingPackets.map((packet) => (
          <AnimatedPacket
            key={packet.id}
            targetX={centerX}
            onComplete={() => handleIncomingComplete(packet.id)}
          />
        ))}
      </div>
    </section>
  );
}
