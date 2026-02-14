import type { CapturedPacket, CapturedPacketBatch, PacketResult } from '../../types';
import { scrop } from './generated/packet_stream.js';

const SCHEMA_VERSION = 1;

function toPacketResult(result: number): PacketResult | null {
  switch (result) {
    case scrop.packet.PacketResult.PACKET_RESULT_DELIVERED:
      return 'delivered';
    case scrop.packet.PacketResult.PACKET_RESULT_NIC_DROP:
      return 'nic-drop';
    case scrop.packet.PacketResult.PACKET_RESULT_FW_DROP:
      return 'fw-drop';
    default:
      return null;
  }
}

function toProtocol(protocol: number): string | null {
  switch (protocol) {
    case scrop.packet.Protocol.PROTOCOL_TCP:
      return 'TCP';
    case scrop.packet.Protocol.PROTOCOL_UDP:
      return 'UDP';
    default:
      return null;
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function mapCapturedPacket(payload: scrop.packet.ICapturedPacket): CapturedPacket | null {
  if (!payload.packet) return null;

  const result = toPacketResult(payload.result ?? scrop.packet.PacketResult.PACKET_RESULT_UNSPECIFIED);
  const protocol = toProtocol(payload.packet.protocol ?? scrop.packet.Protocol.PROTOCOL_UNSPECIFIED);
  if (!result || !protocol) return null;

  const packet = payload.packet;
  const id = packet.id;
  const source = packet.source;
  const destination = packet.destination;

  if (
    typeof id !== 'string' ||
    !isFiniteNumber(packet.size) ||
    typeof source !== 'string' ||
    !isFiniteNumber(packet.srcPort) ||
    typeof destination !== 'string' ||
    !isFiniteNumber(packet.destPort) ||
    !isFiniteNumber(packet.timestamp)
  ) {
    return null;
  }

  const mapped: CapturedPacket = {
    packet: {
      id,
      protocol,
      size: packet.size,
      source,
      srcPort: packet.srcPort,
      destination,
      destPort: packet.destPort,
      timestamp: packet.timestamp,
    },
    result,
  };

  if (isFiniteNumber(packet.targetPort)) {
    mapped.packet.targetPort = packet.targetPort;
  }

  if (typeof packet.reason === 'string') {
    mapped.packet.reason = packet.reason;
  }

  if (isFiniteNumber(packet.captureMonoNs)) {
    mapped.packet.captureMonoNs = packet.captureMonoNs;
  }

  return mapped;
}

export function decodePacketBatch(payload: ArrayBuffer | Uint8Array): CapturedPacketBatch {
  const bytes = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
  const envelope = scrop.packet.PacketBatchEnvelope.decode(bytes);

  if (envelope.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(
      `Unsupported schema version: expected ${SCHEMA_VERSION}, got ${envelope.schemaVersion}`,
    );
  }

  const packets = envelope.packets ?? [];
  const decoded: CapturedPacketBatch = [];
  for (const packet of packets) {
    const mapped = mapCapturedPacket(packet);
    if (mapped) decoded.push(mapped);
  }

  return decoded;
}
