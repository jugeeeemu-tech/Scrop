use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PacketResult {
    Delivered,
    NicDrop,
    FwDrop,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CapturedPacket {
    pub packet: AnimatingPacket,
    pub result: PacketResult,
}

pub type CapturedPacketBatch = Vec<CapturedPacket>;

/// L4プロトコル（パケットヘッダに含まれる情報）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum Protocol {
    Tcp,
    Udp,
}

impl Protocol {
    pub fn random() -> Self {
        use rand::Rng;
        if rand::rng().random_bool(0.9) {
            Protocol::Tcp // 90% TCP
        } else {
            Protocol::Udp // 10% UDP
        }
    }
}

/// モック用のwell-knownポート一覧
const WELL_KNOWN_PORTS: &[u16] = &[80, 443, 22, 8080, 53, 25, 21];
const SESSION_ID_LENGTH: usize = 6;

pub fn generate_session_id() -> String {
    use rand::Rng;
    let mut rng = rand::rng();

    (0..SESSION_ID_LENGTH)
        .map(|_| {
            let idx: u8 = rng.random_range(0..36);
            if idx < 10 {
                (b'0' + idx) as char
            } else {
                (b'a' + idx - 10) as char
            }
        })
        .collect()
}

pub fn build_packet_id(session_id: &str, counter: u64) -> String {
    format!("pkt-{}-{}", session_id, counter)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnimatingPacket {
    pub id: String,
    pub protocol: Protocol,
    pub size: u32,
    pub source: String,
    pub src_port: u16,
    pub destination: String,
    pub dest_port: u16,
    pub target_port: Option<u8>,
    pub timestamp: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

impl AnimatingPacket {
    pub fn generate(session_id: &str, counter: u64) -> Self {
        use rand::Rng;
        let mut rng = rand::rng();

        let id = build_packet_id(session_id, counter);

        let protocol = Protocol::random();
        // well-knownポートからランダム選択
        let dest_port = WELL_KNOWN_PORTS[rng.random_range(0..WELL_KNOWN_PORTS.len())];

        AnimatingPacket {
            id,
            protocol,
            size: rng.random_range(64..1564),
            source: format!("192.168.1.{}", rng.random_range(1..255)),
            src_port: rng.random_range(1024..65535),
            destination: format!("10.0.0.{}", rng.random_range(1..255)),
            dest_port,
            target_port: None,
            timestamp: chrono::Utc::now().timestamp_millis(),
            reason: None,
        }
    }

    pub fn with_reason(mut self, reason: &str) -> Self {
        self.reason = Some(reason.to_string());
        self
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureStats {
    pub total_packets: u64,
    pub nic_dropped: u64,
    pub fw_dropped: u64,
    pub delivered: u64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn generate_produces_valid_fields() {
        let pkt = AnimatingPacket::generate("abc123", 0);
        assert!(pkt.size >= 64 && pkt.size < 1564);
        assert!(pkt.src_port >= 1024 && pkt.src_port < 65535);
        assert!(WELL_KNOWN_PORTS.contains(&pkt.dest_port));
        assert!(pkt.source.starts_with("192.168.1."));
        assert!(pkt.destination.starts_with("10.0.0."));
        assert_eq!(pkt.id, "pkt-abc123-0");
        assert!(pkt.target_port.is_none());
        assert!(pkt.reason.is_none());
    }

    #[test]
    fn generate_produces_unique_ids() {
        let mut ids = HashSet::new();
        let session_id = "abc123";
        for i in 0..100 {
            let pkt = AnimatingPacket::generate(session_id, i);
            assert!(ids.insert(pkt.id), "Duplicate ID detected");
        }
    }

    #[test]
    fn with_reason_sets_reason() {
        let pkt = AnimatingPacket::generate("abc123", 0).with_reason("test reason");
        assert_eq!(pkt.reason, Some("test reason".to_string()));
    }

    #[test]
    fn protocol_random_returns_tcp_or_udp() {
        let mut has_tcp = false;
        let mut has_udp = false;
        for _ in 0..200 {
            match Protocol::random() {
                Protocol::Tcp => has_tcp = true,
                Protocol::Udp => has_udp = true,
            }
            if has_tcp && has_udp {
                break;
            }
        }
        assert!(has_tcp, "TCP was never generated");
        assert!(has_udp, "UDP was never generated");
    }

    #[test]
    fn packet_result_serializes_to_kebab_case() {
        let delivered = serde_json::to_string(&PacketResult::Delivered).unwrap();
        assert_eq!(delivered, "\"delivered\"");
        let nic_drop = serde_json::to_string(&PacketResult::NicDrop).unwrap();
        assert_eq!(nic_drop, "\"nic-drop\"");
        let fw_drop = serde_json::to_string(&PacketResult::FwDrop).unwrap();
        assert_eq!(fw_drop, "\"fw-drop\"");
    }

    #[test]
    fn animating_packet_serializes_to_camel_case() {
        let pkt = AnimatingPacket::generate("abc123", 42);
        let json = serde_json::to_string(&pkt).unwrap();
        assert!(json.contains("\"srcPort\""));
        assert!(json.contains("\"destPort\""));
        assert!(json.contains("\"targetPort\""));
        // reason=None のときは skip_serializing_if で省略される
        assert!(!json.contains("\"reason\""));
    }

    #[test]
    fn animating_packet_with_reason_includes_reason_in_json() {
        let pkt = AnimatingPacket::generate("abc123", 0).with_reason("blocked");
        let json = serde_json::to_string(&pkt).unwrap();
        assert!(json.contains("\"reason\":\"blocked\""));
    }

    #[test]
    fn generate_session_id_is_base36_with_fixed_length() {
        let session_id = generate_session_id();
        assert_eq!(session_id.len(), SESSION_ID_LENGTH);
        assert!(session_id
            .chars()
            .all(|c| c.is_ascii_digit() || c.is_ascii_lowercase()));
    }

    #[test]
    fn build_packet_id_uses_expected_format() {
        let id = build_packet_id("a1b2c3", 42);
        assert_eq!(id, "pkt-a1b2c3-42");
    }

    #[test]
    fn capture_stats_default_is_all_zero() {
        let stats = CaptureStats::default();
        assert_eq!(stats.total_packets, 0);
        assert_eq!(stats.nic_dropped, 0);
        assert_eq!(stats.fw_dropped, 0);
        assert_eq!(stats.delivered, 0);
    }
}
