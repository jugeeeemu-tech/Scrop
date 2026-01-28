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
    Tcp,
    Udp,
    Http,
    Https,
    Ssh,
}

impl Protocol {
    pub fn random() -> Self {
        use rand::Rng;
        let mut rng = rand::rng();
        match rng.random_range(0..5) {
            0 => Protocol::Tcp,
            1 => Protocol::Udp,
            2 => Protocol::Http,
            3 => Protocol::Https,
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
    pub fn generate(counter: u64, port_count: u8) -> Self {
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

        AnimatingPacket {
            id,
            protocol: Protocol::random(),
            size: rng.random_range(64..1564),
            source: format!("192.168.1.{}", rng.random_range(1..255)),
            destination: format!("10.0.0.{}", rng.random_range(1..255)),
            target_port: Some(rng.random_range(0..port_count)),
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
