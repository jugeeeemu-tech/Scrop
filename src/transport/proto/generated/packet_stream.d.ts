import * as $protobuf from "protobufjs/minimal";

export namespace scrop {
  namespace packet {
    enum Protocol {
      PROTOCOL_UNSPECIFIED = 0,
      PROTOCOL_TCP = 1,
      PROTOCOL_UDP = 2,
    }

    enum PacketResult {
      PACKET_RESULT_UNSPECIFIED = 0,
      PACKET_RESULT_DELIVERED = 1,
      PACKET_RESULT_NIC_DROP = 2,
      PACKET_RESULT_FW_DROP = 3,
    }

    interface IAnimatingPacket {
      id?: string | null;
      protocol?: Protocol | null;
      size?: number | null;
      source?: string | null;
      srcPort?: number | null;
      destination?: string | null;
      destPort?: number | null;
      targetPort?: number | null;
      reason?: string | null;
      captureMonoNs?: number | null;
    }

    class AnimatingPacket implements IAnimatingPacket {
      constructor(properties?: IAnimatingPacket);
      public id: string;
      public protocol: Protocol;
      public size: number;
      public source: string;
      public srcPort: number;
      public destination: string;
      public destPort: number;
      public targetPort?: number | null;
      public reason?: string | null;
      public captureMonoNs: number;
    }

    interface ICapturedPacket {
      packet?: IAnimatingPacket | null;
      result?: PacketResult | null;
    }

    class CapturedPacket implements ICapturedPacket {
      constructor(properties?: ICapturedPacket);
      public packet?: AnimatingPacket | null;
      public result: PacketResult;
    }

    interface IPacketBatchEnvelope {
      schemaVersion?: number | null;
      packets?: ICapturedPacket[] | null;
      epochOffsetMs?: number | null;
    }

    class PacketBatchEnvelope implements IPacketBatchEnvelope {
      constructor(properties?: IPacketBatchEnvelope);
      public schemaVersion: number;
      public packets: CapturedPacket[];
      public epochOffsetMs: number;
      public static encode(
        message: IPacketBatchEnvelope,
        writer?: $protobuf.Writer
      ): $protobuf.Writer;
      public static decode(
        reader: $protobuf.Reader | Uint8Array,
        length?: number,
        error?: number
      ): PacketBatchEnvelope;
    }
  }
}
