import { LayerContainer } from '../layout/LayerContainer';
import { Packet } from '../packet/Packet';
import { EmptyState } from '../common/EmptyState';
import type { Packet as PacketType } from '../../types';

interface NICLayerProps {
  packets: PacketType[];
}

export function NICLayer({ packets }: NICLayerProps) {
  return (
    <LayerContainer layer="NIC">
      <div>
        <h3 className="text-sm font-medium text-gray-600 mb-3">
          XDPでDropされたパケット
        </h3>
        {packets.length > 0 ? (
          <div className="space-y-2">
            {packets.map((packet) => (
              <Packet key={packet.id} packet={packet} />
            ))}
          </div>
        ) : (
          <EmptyState message="Dropされたパケットはありません" />
        )}
      </div>
    </LayerContainer>
  );
}
