use scrop_capture::types::{
    AnimatingPacket, CapturedPacket, CapturedPacketBatch, PacketResult, Protocol,
};

pub const SCHEMA_VERSION: u32 = 1;

pub mod pb {
    include!(concat!(env!("OUT_DIR"), "/scrop.packet.rs"));
}

pub fn batch_to_envelope(batch: &CapturedPacketBatch) -> pb::PacketBatchEnvelope {
    pb::PacketBatchEnvelope {
        schema_version: SCHEMA_VERSION,
        packets: batch.iter().map(packet_to_proto).collect(),
    }
}

fn packet_to_proto(packet: &CapturedPacket) -> pb::CapturedPacket {
    pb::CapturedPacket {
        packet: Some(animating_packet_to_proto(&packet.packet)),
        result: packet_result_to_proto(&packet.result) as i32,
    }
}

fn animating_packet_to_proto(packet: &AnimatingPacket) -> pb::AnimatingPacket {
    pb::AnimatingPacket {
        id: packet.id.clone(),
        protocol: protocol_to_proto(&packet.protocol) as i32,
        size: packet.size,
        source: packet.source.clone(),
        src_port: packet.src_port as u32,
        destination: packet.destination.clone(),
        dest_port: packet.dest_port as u32,
        target_port: packet.target_port.map(u32::from),
        timestamp: packet.timestamp as f64,
        reason: packet.reason.clone(),
        capture_mono_ns: None,
    }
}

fn protocol_to_proto(protocol: &Protocol) -> pb::Protocol {
    match protocol {
        Protocol::Tcp => pb::Protocol::Tcp,
        Protocol::Udp => pb::Protocol::Udp,
    }
}

fn packet_result_to_proto(result: &PacketResult) -> pb::PacketResult {
    match result {
        PacketResult::Delivered => pb::PacketResult::Delivered,
        PacketResult::NicDrop => pb::PacketResult::NicDrop,
        PacketResult::FwDrop => pb::PacketResult::FwDrop,
    }
}
