use std::sync::Arc;
use std::time::Duration;

use axum::routing::get;
use axum::Router;
use futures_util::StreamExt;
use prost::Message as _;
use tokio_tungstenite::tungstenite::Message;

use scrop_capture::types::{
    AnimatingPacket, CapturedPacket, CapturedPacketEnvelope, PacketResult, Protocol,
};
use scrop_capture::AppState;

#[path = "../src/ws.rs"]
mod ws;
#[path = "../src/ws_proto.rs"]
mod ws_proto;

fn sample_captured_packet(id: &str) -> CapturedPacket {
    CapturedPacket {
        packet: AnimatingPacket {
            id: id.to_string(),
            protocol: Protocol::Tcp,
            size: 128,
            source: "192.168.0.10".to_string(),
            src_port: 12345,
            destination: "10.0.0.1".to_string(),
            dest_port: 80,
            target_port: Some(80),
            capture_mono_ns: 1_000_000_000,
            reason: None,
        },
        result: PacketResult::Delivered,
    }
}

async fn send_batch_when_subscribed(state: &Arc<AppState>, batch: CapturedPacketEnvelope) {
    for _ in 0..30 {
        if state.event_tx.send(batch.clone()).is_ok() {
            return;
        }
        tokio::time::sleep(Duration::from_millis(10)).await;
    }
    panic!("timed out waiting for websocket subscriber");
}

#[tokio::test]
async fn websocket_streams_batches_as_binary_protobuf() {
    let state = Arc::new(AppState::new());
    let app = Router::new()
        .route("/ws", get(ws::ws_handler))
        .with_state(state.clone());

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind listener");
    let addr = listener.local_addr().expect("read local addr");

    let server = tokio::spawn(async move {
        axum::serve(listener, app).await.expect("serve app");
    });

    let ws_url = format!("ws://{}/ws", addr);
    let (mut socket, _response) = tokio_tungstenite::connect_async(ws_url)
        .await
        .expect("connect websocket");

    let batch = CapturedPacketEnvelope {
        packets: vec![
            sample_captured_packet("pkt-test-1"),
            sample_captured_packet("pkt-test-2"),
        ],
        epoch_offset_ms: 1_700_000_000_000.0,
    };
    send_batch_when_subscribed(&state, batch).await;

    let next = tokio::time::timeout(Duration::from_secs(2), socket.next())
        .await
        .expect("timed out waiting websocket message")
        .expect("websocket stream ended")
        .expect("websocket read error");

    let bytes = match next {
        Message::Binary(bytes) => bytes,
        other => panic!("expected websocket binary message, got {:?}", other),
    };

    let envelope = ws_proto::pb::PacketBatchEnvelope::decode(bytes).expect("decode protobuf");
    assert_eq!(envelope.schema_version, ws_proto::SCHEMA_VERSION);
    assert_eq!(envelope.epoch_offset_ms, 1_700_000_000_000.0);
    assert_eq!(envelope.packets.len(), 2);

    let first = envelope.packets.first().expect("first packet");
    let packet = first.packet.as_ref().expect("captured packet payload");
    assert_eq!(packet.id, "pkt-test-1");
    assert_eq!(packet.capture_mono_ns, 1_000_000_000.0);

    let result = ws_proto::pb::PacketResult::try_from(first.result).expect("packet result enum");
    assert_eq!(result, ws_proto::pb::PacketResult::Delivered);

    server.abort();
}
