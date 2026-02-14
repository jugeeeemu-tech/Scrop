import { describe, expect, it } from 'vitest';
import { decodePacketBatch } from './decodePacketBatch';
import { scrop } from './generated/packet_stream.js';

describe('decodePacketBatch', () => {
  it('decodes protobuf payload into captured packet batch', () => {
    const encoded = scrop.packet.PacketBatchEnvelope.encode({
      schemaVersion: 1,
      packets: [
        {
          packet: {
            id: 'pkt-1',
            protocol: scrop.packet.Protocol.PROTOCOL_TCP,
            size: 128,
            source: '192.168.0.1',
            srcPort: 12345,
            destination: '10.0.0.1',
            destPort: 80,
            targetPort: 80,
            timestamp: 1_700_000_000_000,
            reason: 'blocked',
            captureMonoNs: 10_000_000,
          },
          result: scrop.packet.PacketResult.PACKET_RESULT_DELIVERED,
        },
      ],
    }).finish();

    const decoded = decodePacketBatch(encoded);
    expect(decoded).toEqual([
      {
        packet: {
          id: 'pkt-1',
          protocol: 'TCP',
          size: 128,
          source: '192.168.0.1',
          srcPort: 12345,
          destination: '10.0.0.1',
          destPort: 80,
          targetPort: 80,
          timestamp: 1_700_000_000_000,
          reason: 'blocked',
          captureMonoNs: 10_000_000,
        },
        result: 'delivered',
      },
    ]);
  });

  it('rejects unsupported schema version', () => {
    const encoded = scrop.packet.PacketBatchEnvelope.encode({
      schemaVersion: 999,
      packets: [],
    }).finish();

    expect(() => decodePacketBatch(encoded)).toThrow('Unsupported schema version');
  });

  it('skips packets with unknown enum values', () => {
    const encoded = scrop.packet.PacketBatchEnvelope.encode({
      schemaVersion: 1,
      packets: [
        {
          packet: {
            id: 'pkt-1',
            protocol: 99 as unknown as scrop.packet.Protocol,
            size: 100,
            source: 's',
            srcPort: 1,
            destination: 'd',
            destPort: 2,
            timestamp: 10,
          },
          result: scrop.packet.PacketResult.PACKET_RESULT_DELIVERED,
        },
        {
          packet: {
            id: 'pkt-2',
            protocol: scrop.packet.Protocol.PROTOCOL_TCP,
            size: 100,
            source: 's',
            srcPort: 1,
            destination: 'd',
            destPort: 2,
            timestamp: 10,
          },
          result: 999 as unknown as scrop.packet.PacketResult,
        },
      ],
    }).finish();

    expect(decodePacketBatch(encoded)).toEqual([]);
  });

  it('throws when protobuf payload is malformed', () => {
    const malformed = new Uint8Array([255, 255, 255, 255]);
    expect(() => decodePacketBatch(malformed)).toThrow();
  });
});
