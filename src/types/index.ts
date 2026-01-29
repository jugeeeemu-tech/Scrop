export type Protocol = 'TCP' | 'UDP';
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
  srcPort: number;
  destination: string;
  destPort: number;
  targetPort?: number;
  timestamp: number;
  reason?: string;
}

export interface SpecificPortInfo {
  type: 'port';
  port: number;
  label: string;
}

export interface EtcPortInfo {
  type: 'etc';
  label: string;
}

export type PortInfo = SpecificPortInfo | EtcPortInfo;

export type PacketResult = 'delivered' | 'nic-drop' | 'fw-drop';

export interface CapturedPacket {
  packet: AnimatingPacket;
  result: PacketResult;
}
