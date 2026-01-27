export type Protocol = 'TCP' | 'UDP' | 'ICMP' | 'OTHER';
export type DropReason = 'FIREWALL_RULE' | 'RATE_LIMIT' | 'XDP_DROP' | 'INVALID_PACKET';
export type LayerType = 'PORT' | 'FW' | 'NIC';

export interface Packet {
  id: string;
  timestamp: number;
  sourceIp: string;
  sourcePort: number;
  destIp: string;
  destPort: number;
  protocol: Protocol;
  size: number;
  layer: LayerType;
  dropped: boolean;
  dropReason?: DropReason;
}

export interface Port {
  number: number;
  protocol: Protocol;
  serviceName?: string;
  packetCount: number;
  isActive: boolean;
}
