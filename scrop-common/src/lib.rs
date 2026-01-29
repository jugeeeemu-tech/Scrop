#![no_std]

// アクション定数
pub const ACTION_XDP_PASS: u32 = 2;
pub const ACTION_KFREE_SKB: u32 = 100;

// kfree_skb reason 定数 (kernel 6.6)
// cf. include/net/dropreason-core.h
pub const SKB_DROP_REASON_NETFILTER_DROP: u32 = 8;

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
    /// アクション（ACTION_XDP_PASS or ACTION_KFREE_SKB）
    pub action: u32,
    /// skb_drop_reason（0 = ドロップなし、kfree_skb時のみ有効）
    pub drop_reason: u32,
}
