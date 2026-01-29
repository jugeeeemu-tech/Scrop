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
    pub fn generate(counter: u64) -> Self {
        use rand::Rng;
        let mut rng = rand::rng();

        let id = format!(
            "pkt-{}-{}",
            counter,
            (0..6)
                .map(|_| {
                    let idx = rng.random_range(0..36);
                    if idx < 10 {
                        (b'0' + idx) as char
                    } else {
                        (b'a' + idx - 10) as char
                    }
                })
                .collect::<String>()
        );

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
