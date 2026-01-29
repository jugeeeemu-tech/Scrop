#![no_std]
#![no_main]

use aya_ebpf::{
    bindings::xdp_action,
    helpers::bpf_probe_read_kernel,
    macros::{map, tracepoint, xdp},
    maps::PerfEventArray,
    programs::{TracePointContext, XdpContext},
};
use aya_log_ebpf::info;
use core::mem;
use network_types::{
    eth::{EthHdr, EtherType},
    ip::{IpProto, Ipv4Hdr},
    tcp::TcpHdr,
    udp::UdpHdr,
};
use scrop_common::{PacketEvent, ACTION_KFREE_SKB, ACTION_XDP_PASS};

#[map]
static EVENTS: PerfEventArray<PacketEvent> = PerfEventArray::new(0);

// ---------------------------------------------------------------------------
// XDP プログラム
// ---------------------------------------------------------------------------

#[xdp]
pub fn scrop_xdp(ctx: XdpContext) -> u32 {
    match try_scrop_xdp(&ctx) {
        Ok(action) => action,
        Err(_) => xdp_action::XDP_PASS,
    }
}

#[inline(always)]
fn ptr_at<T>(ctx: &XdpContext, offset: usize) -> Result<*const T, ()> {
    let start = ctx.data();
    let end = ctx.data_end();
    let len = mem::size_of::<T>();

    if start + offset + len > end {
        return Err(());
    }

    Ok((start + offset) as *const T)
}

fn try_scrop_xdp(ctx: &XdpContext) -> Result<u32, ()> {
    let ethhdr: *const EthHdr = ptr_at(ctx, 0)?;
    // IPv4のみ処理
    if unsafe { (*ethhdr).ether_type } != EtherType::Ipv4 {
        return Ok(xdp_action::XDP_PASS);
    }

    let ipv4hdr: *const Ipv4Hdr = ptr_at(ctx, EthHdr::LEN)?;
    let src_addr = unsafe { (*ipv4hdr).src_addr };
    let dst_addr = unsafe { (*ipv4hdr).dst_addr };
    let proto = unsafe { (*ipv4hdr).proto };
    let tot_len = u16::from_be(unsafe { (*ipv4hdr).tot_len }) as u32;
    let ihl = unsafe { (*ipv4hdr).ihl() } as usize * 4;

    let (src_port, dst_port) = match proto {
        IpProto::Tcp => {
            let tcphdr: *const TcpHdr = ptr_at(ctx, EthHdr::LEN + ihl)?;
            (
                u16::from_be(unsafe { (*tcphdr).source }),
                u16::from_be(unsafe { (*tcphdr).dest }),
            )
        }
        IpProto::Udp => {
            let udphdr: *const UdpHdr = ptr_at(ctx, EthHdr::LEN + ihl)?;
            (
                u16::from_be(unsafe { (*udphdr).source }),
                u16::from_be(unsafe { (*udphdr).dest }),
            )
        }
        _ => return Ok(xdp_action::XDP_PASS),
    };

    let event = PacketEvent {
        src_addr,
        dst_addr,
        src_port,
        dst_port,
        protocol: proto as u8,
        _padding: [0; 3],
        pkt_len: tot_len,
        action: ACTION_XDP_PASS,
        drop_reason: 0,
    };

    EVENTS.output(ctx, &event, 0);

    info!(ctx, "packet: {}:{} -> {}:{}", src_addr, src_port, dst_addr, dst_port);

    Ok(xdp_action::XDP_PASS)
}

// ---------------------------------------------------------------------------
// kfree_skb トレースポイント
// ---------------------------------------------------------------------------

#[tracepoint]
pub fn scrop_kfree_skb(ctx: TracePointContext) -> u32 {
    match try_scrop_kfree_skb(&ctx) {
        Ok(ret) => ret,
        Err(_) => 0,
    }
}

fn try_scrop_kfree_skb(ctx: &TracePointContext) -> Result<u32, i64> {
    // kfree_skb トレースポイントフォーマット (kernel 5.17+):
    //   offset  0: common fields (8 bytes: type, flags, preempt_count, pid)
    //   offset  8: void *skbaddr
    //   offset 16: void *location
    //   offset 24: unsigned short protocol (ETH_P_IP = 0x0800, host byte order)
    //   offset 26: 2 bytes padding
    //   offset 28: enum skb_drop_reason reason

    // 1. L2プロトコル確認（IPv4のみ処理）
    let l2_proto: u16 = unsafe { ctx.read_at(24)? };
    if l2_proto != 0x0800_u16 {
        return Ok(0);
    }

    // 2. drop reason 取得
    let reason: u32 = unsafe { ctx.read_at(28)? };

    // 3. skb ポインタ取得
    let skb_ptr: *const u8 = unsafe { ctx.read_at(8)? };
    if skb_ptr.is_null() {
        return Ok(0);
    }

    // 4. sk_buff からネットワークヘッダ情報を読み取り
    //    sk_buff のフィールドオフセット (kernel 6.6, x86_64):
    //      head: offset 200 (unsigned char *)
    //      network_header: offset 184 (u16)
    //      transport_header: offset 182 (u16)
    //      len: offset 112 (unsigned int)

    let head: *const u8 = unsafe {
        bpf_probe_read_kernel((skb_ptr.add(200)) as *const *const u8).map_err(|e| e as i64)?
    };
    if head.is_null() {
        return Ok(0);
    }

    let network_header: u16 = unsafe {
        bpf_probe_read_kernel((skb_ptr.add(184)) as *const u16).map_err(|e| e as i64)?
    };

    let transport_header: u16 = unsafe {
        bpf_probe_read_kernel((skb_ptr.add(182)) as *const u16).map_err(|e| e as i64)?
    };

    let pkt_len: u32 = unsafe {
        bpf_probe_read_kernel((skb_ptr.add(112)) as *const u32).map_err(|e| e as i64)?
    };

    // 5. IP ヘッダパース
    let ip_ptr = unsafe { head.add(network_header as usize) };
    let iph: Ipv4Hdr = unsafe {
        bpf_probe_read_kernel(ip_ptr as *const Ipv4Hdr).map_err(|e| e as i64)?
    };
    let src_addr = iph.src_addr;
    let dst_addr = iph.dst_addr;
    let ip_proto = iph.proto as u8;

    // TCP/UDP のみ処理
    if ip_proto != 6 && ip_proto != 17 {
        return Ok(0);
    }

    // 6. トランスポートヘッダパース
    let th_ptr = unsafe { head.add(transport_header as usize) };
    let (src_port, dst_port) = if ip_proto == 6 {
        let tcph: TcpHdr = unsafe {
            bpf_probe_read_kernel(th_ptr as *const TcpHdr).map_err(|e| e as i64)?
        };
        (u16::from_be(tcph.source), u16::from_be(tcph.dest))
    } else {
        let udph: UdpHdr = unsafe {
            bpf_probe_read_kernel(th_ptr as *const UdpHdr).map_err(|e| e as i64)?
        };
        (u16::from_be(udph.source), u16::from_be(udph.dest))
    };

    // 7. イベント出力
    let event = PacketEvent {
        src_addr,
        dst_addr,
        src_port,
        dst_port,
        protocol: ip_proto,
        _padding: [0; 3],
        pkt_len,
        action: ACTION_KFREE_SKB,
        drop_reason: reason,
    };

    EVENTS.output(ctx, &event, 0);

    Ok(0)
}

#[cfg(not(test))]
#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    loop {}
}
