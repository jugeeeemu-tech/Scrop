#![no_std]
#![no_main]

use aya_ebpf::{
    bindings::xdp_action,
    macros::{map, xdp},
    maps::PerfEventArray,
    programs::XdpContext,
};
use aya_log_ebpf::info;
use core::mem;
use network_types::{
    eth::{EthHdr, EtherType},
    ip::{IpProto, Ipv4Hdr},
    tcp::TcpHdr,
    udp::UdpHdr,
};
use scrop_common::PacketEvent;

#[map]
static EVENTS: PerfEventArray<PacketEvent> = PerfEventArray::new(0);

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
        action: xdp_action::XDP_PASS,
    };

    EVENTS.output(ctx, &event, 0);

    info!(ctx, "packet: {}:{} -> {}:{}", src_addr, src_port, dst_addr, dst_port);

    Ok(xdp_action::XDP_PASS)
}

#[cfg(not(test))]
#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    loop {}
}
