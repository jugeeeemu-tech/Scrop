import { NetworkLayer } from './NetworkLayer';
import { useFWLayerStore } from '../../hooks/useFWLayerStore';
import { handleDropAnimationComplete, handleNicToFwComplete } from '../../stores/packetStore';

export function FWLayer() {
  const {
    firewallDropped,
    fwDroppedCounter,
    fwActive,
    fwDropAnimations,
    nicToFwPackets,
    isFwDropStreamMode,
    isNicToFwStreamMode,
  } = useFWLayerStore();

  return (
    <NetworkLayer
      variant="firewall"
      droppedPackets={firewallDropped}
      droppedCount={fwDroppedCounter}
      isActive={fwActive}
      dropAnimations={fwDropAnimations}
      animatingPackets={nicToFwPackets}
      onDropAnimationComplete={(id) => handleDropAnimationComplete(id, 'fw')}
      onAnimatingComplete={handleNicToFwComplete}
      isDropStreamMode={isFwDropStreamMode}
      isPacketStreamMode={isNicToFwStreamMode}
      showScrollHint
    />
  );
}
