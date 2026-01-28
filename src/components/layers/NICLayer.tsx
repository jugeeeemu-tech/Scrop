import { NetworkLayer } from './NetworkLayer';
import type { AnimatingPacket } from '../../types';

interface NICLayerProps {
  droppedPackets: AnimatingPacket[];
  isActive?: boolean;
  dropAnimations: AnimatingPacket[];
  incomingPackets: AnimatingPacket[];
  onDropAnimationComplete: (packetId: string) => void;
  onIncomingComplete: (packetId: string) => void;
  isDropStreamMode?: boolean;
  isPacketStreamMode?: boolean;
}

export function NICLayer({
  droppedPackets,
  isActive = false,
  dropAnimations,
  incomingPackets,
  onDropAnimationComplete,
  onIncomingComplete,
  isDropStreamMode = false,
  isPacketStreamMode = false,
}: NICLayerProps) {
  return (
    <NetworkLayer
      variant="nic"
      droppedPackets={droppedPackets}
      isActive={isActive}
      dropAnimations={dropAnimations}
      animatingPackets={incomingPackets}
      onDropAnimationComplete={onDropAnimationComplete}
      onAnimatingComplete={onIncomingComplete}
      isDropStreamMode={isDropStreamMode}
      isPacketStreamMode={isPacketStreamMode}
    />
  );
}
