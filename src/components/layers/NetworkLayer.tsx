import { NetworkLayerDevice } from './NetworkLayerDevice';
import { AnimatedPacket } from '../packet/AnimatedPacket';
import { PacketStream } from '../packet/PacketStream';
import { StreamFadeOut } from '../packet/StreamFadeOut';
import { ScrollHint } from '../common/ScrollHint';
import { useLayerCenterX } from '../../hooks';
import type { AnimatingPacket } from '../../types';

type LayerVariant = 'firewall' | 'nic';

interface NetworkLayerProps {
  variant: LayerVariant;
  droppedPackets: AnimatingPacket[];
  isActive?: boolean;
  dropAnimations: AnimatingPacket[];
  animatingPackets: AnimatingPacket[];
  onDropAnimationComplete: (packetId: string) => void;
  onAnimatingComplete: (packetId: string) => void;
  isDropStreamMode?: boolean;
  isPacketStreamMode?: boolean;
  showScrollHint?: boolean;
}

export function NetworkLayer({
  variant,
  droppedPackets,
  isActive = false,
  dropAnimations,
  animatingPackets,
  onDropAnimationComplete,
  onAnimatingComplete,
  isDropStreamMode = false,
  isPacketStreamMode = false,
  showScrollHint = false,
}: NetworkLayerProps) {
  const { ref: animationZoneRef, centerX } = useLayerCenterX();

  const isFirewall = variant === 'firewall';
  const sectionClass = isFirewall ? 'min-h-[60vh] bg-muted/30' : 'min-h-[50vh] bg-muted/50';

  return (
    <section className={`${sectionClass} relative`}>
      <div className="relative">
        <NetworkLayerDevice
          type={variant}
          droppedPackets={droppedPackets}
          isActive={isActive}
          dropAnimations={dropAnimations}
          onDropAnimationComplete={onDropAnimationComplete}
          isDropStreamMode={isDropStreamMode}
        />
      </div>

      {/* Animation zone */}
      <div ref={animationZoneRef} className="relative h-24 max-w-4xl mx-auto">
        <StreamFadeOut active={isPacketStreamMode}>
          <PacketStream targetX={centerX} />
        </StreamFadeOut>
        {animatingPackets.map((packet) => (
          <AnimatedPacket
            key={packet.id}
            targetX={centerX}
            onComplete={() => onAnimatingComplete(packet.id)}
          />
        ))}
      </div>

      {showScrollHint && <ScrollHint className="pb-4" />}
    </section>
  );
}
