import { NetworkLayer } from './NetworkLayer';
import type { AnimatingPacket } from '../../types';

interface FWLayerProps {
  droppedPackets: AnimatingPacket[];
  droppedCount: number;
  isActive?: boolean;
  dropAnimations: AnimatingPacket[];
  risingPackets: AnimatingPacket[];
  onDropAnimationComplete: (packetId: string) => void;
  onRisingComplete: (packetId: string) => void;
  isDropStreamMode?: boolean;
  isPacketStreamMode?: boolean;
}

export function FWLayer({
  droppedPackets,
  droppedCount,
  isActive = false,
  dropAnimations,
  risingPackets,
  onDropAnimationComplete,
  onRisingComplete,
  isDropStreamMode = false,
  isPacketStreamMode = false,
}: FWLayerProps) {
  return (
    <NetworkLayer
      variant="firewall"
      droppedPackets={droppedPackets}
      droppedCount={droppedCount}
      isActive={isActive}
      dropAnimations={dropAnimations}
      animatingPackets={risingPackets}
      onDropAnimationComplete={onDropAnimationComplete}
      onAnimatingComplete={onRisingComplete}
      isDropStreamMode={isDropStreamMode}
      isPacketStreamMode={isPacketStreamMode}
      showScrollHint
    />
  );
}
