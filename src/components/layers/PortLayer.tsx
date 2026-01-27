import { LayerContainer } from '../layout/LayerContainer';
import { PortList } from '../port/PortList';
import { Packet } from '../packet/Packet';
import { EmptyState } from '../common/EmptyState';
import type { Port as PortType, Packet as PacketType } from '../../types';

interface PortLayerProps {
  ports: PortType[];
  packets: PacketType[];
}

export function PortLayer({ ports, packets }: PortLayerProps) {
  return (
    <LayerContainer layer="PORT">
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-medium text-gray-600 mb-3">アクティブなポート</h3>
          {ports.length > 0 ? (
            <PortList ports={ports} />
          ) : (
            <EmptyState message="アクティブなポートがありません" />
          )}
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-600 mb-3">受信パケット</h3>
          {packets.length > 0 ? (
            <div className="space-y-2">
              {packets.map((packet) => (
                <Packet key={packet.id} packet={packet} />
              ))}
            </div>
          ) : (
            <EmptyState message="パケットがありません" />
          )}
        </div>
      </div>
    </LayerContainer>
  );
}
