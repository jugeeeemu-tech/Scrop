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

export interface WireAnimatingPacket {
  id: string;
  protocol: string;
  size: number;
  source: string;
  srcPort: number;
  destination: string;
  destPort: number;
  targetPort?: number;
  captureMonoNs: number;
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

export type CapturedPacketBatch = CapturedPacket[];

export interface ReplayFrame {
  packet: AnimatingPacket;
  result: PacketResult;
  monoMs: number;
}

export type ReplayFrameBatch = ReplayFrame[];

export interface WireCapturedPacket {
  packet: WireAnimatingPacket;
  result: PacketResult;
}

export interface CapturedPacketEnvelope {
  packets: WireCapturedPacket[];
  epochOffsetMs: number;
}
