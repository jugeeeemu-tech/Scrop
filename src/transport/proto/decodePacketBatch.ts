import type {
  AnimatingPacket,
  PacketResult,
  ReplayFrame,
  ReplayFrameBatch,
} from '../../types';
import { scrop } from './generated/packet_stream.js';

const SCHEMA_VERSION = 2;

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

function mapCapturedPacket(
  payload: scrop.packet.ICapturedPacket,
  epochOffsetMs: number,
): ReplayFrame | null {
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
    !isFiniteNumber(packet.captureMonoNs)
  ) {
    return null;
  }

  const monoMs = packet.captureMonoNs / 1_000_000;
  const timestamp = monoMs + epochOffsetMs;

  const packetForUi: AnimatingPacket = {
    id,
    protocol,
    size: packet.size,
    source,
    srcPort: packet.srcPort,
    destination,
    destPort: packet.destPort,
    timestamp,
  };

  if (isFiniteNumber(packet.targetPort)) {
    packetForUi.targetPort = packet.targetPort;
  }

  if (typeof packet.reason === 'string') {
    packetForUi.reason = packet.reason;
  }

  return {
    packet: packetForUi,
    result,
    monoMs,
  };
}

export function decodePacketBatch(payload: ArrayBuffer | Uint8Array): ReplayFrameBatch {
  const bytes = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
  const envelope = scrop.packet.PacketBatchEnvelope.decode(bytes);

  if (envelope.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(
      `Unsupported schema version: expected ${SCHEMA_VERSION}, got ${envelope.schemaVersion}`,
    );
  }
  if (!isFiniteNumber(envelope.epochOffsetMs)) {
    throw new Error('epochOffsetMs is missing or invalid');
  }

  const packets = envelope.packets ?? [];
  const decoded: ReplayFrameBatch = [];
  for (const packet of packets) {
    const mapped = mapCapturedPacket(packet, envelope.epochOffsetMs);
    if (mapped) decoded.push(mapped);
  }

  return decoded;
}
