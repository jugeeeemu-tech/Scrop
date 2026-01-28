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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum Protocol {
    Http,
    Https,
    Ssh,
}

impl Protocol {
    /// プロトコルに対応するポートインデックスを返す
    pub fn target_port_indices(&self) -> &[u8] {
        match self {
            Protocol::Http => &[0, 3],  // ポート80, 8080（Proxy）
            Protocol::Https => &[1],     // ポート443
            Protocol::Ssh => &[2],       // ポート22
        }
    }

    pub fn random() -> Self {
        use rand::Rng;
        let mut rng = rand::rng();
        match rng.random_range(0..3) {
            0 => Protocol::Http,
            1 => Protocol::Https,
            _ => Protocol::Ssh,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnimatingPacket {
    pub id: String,
    pub protocol: Protocol,
    pub size: u32,
    pub source: String,
    pub destination: String,
    pub target_port: Option<u8>,
    pub timestamp: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

impl AnimatingPacket {
    pub fn generate(counter: u64, _port_count: u8) -> Self {
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
        let valid_ports = protocol.target_port_indices();
        let target_port = valid_ports[rng.random_range(0..valid_ports.len())];

        AnimatingPacket {
            id,
            protocol,
            size: rng.random_range(64..1564),
            source: format!("192.168.1.{}", rng.random_range(1..255)),
            destination: format!("10.0.0.{}", rng.random_range(1..255)),
            target_port: Some(target_port),
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
