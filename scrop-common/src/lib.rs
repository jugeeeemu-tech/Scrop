#![no_std]

/// eBPFプログラムからユーザースペースへPerfEventArrayで送るパケット情報。
/// `#[repr(C)]`でメモリレイアウトを固定し、eBPF側とユーザースペース側で安全に共有する。
#[repr(C)]
#[derive(Clone, Copy)]
#[cfg_attr(feature = "user", derive(serde::Serialize, serde::Deserialize))]
pub struct PacketEvent {
    /// IPv4送信元アドレス（ネットワークバイトオーダー）
    pub src_addr: u32,
    /// IPv4宛先アドレス（ネットワークバイトオーダー）
    pub dst_addr: u32,
    /// 送信元ポート（ホストバイトオーダー）
    pub src_port: u16,
    /// 宛先ポート（ホストバイトオーダー）
    pub dst_port: u16,
    /// IPプロトコル番号（6=TCP, 17=UDP）
    pub protocol: u8,
    /// アラインメント用パディング
    pub _padding: [u8; 3],
    /// パケットサイズ（バイト）
    pub pkt_len: u32,
    /// XDPアクション（2=XDP_PASS）
    pub action: u32,
}
