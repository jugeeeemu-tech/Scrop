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

export interface AnimatingPacket {
  id: string;
  protocol: string;
  size: number;
  source: string;
  destination: string;
  targetPort?: number;
  timestamp: number;
  reason?: string;
}

export interface PortInfo {
  port: number;
  label: string;
}

export type PacketResult = 'delivered' | 'nic-drop' | 'fw-drop';

export interface CapturedPacket {
  packet: AnimatingPacket;
  result: PacketResult;
}
