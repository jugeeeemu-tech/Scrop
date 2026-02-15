// SPDX-License-Identifier: GPL-2.0
// scrop eBPF programs: XDP packet monitor + kfree_skb tracepoint

#include "vmlinux.h"
#include <bpf/bpf_helpers.h>
#include <bpf/bpf_core_read.h>
#include <bpf/bpf_endian.h>

// ---------------------------------------------------------------------------
// Constants (must match scrop-common/src/lib.rs)
// ---------------------------------------------------------------------------

#define ACTION_XDP_PASS   2
#define ACTION_KFREE_SKB  100

#define ETH_P_IP  0x0800
#define IPPROTO_TCP  6
#define IPPROTO_UDP  17

// ---------------------------------------------------------------------------
// PacketEvent — must match scrop_common::PacketEvent layout exactly
// ---------------------------------------------------------------------------

struct packet_event {
    __u32 src_addr;
    __u32 dst_addr;
    __u16 src_port;
    __u16 dst_port;
    __u8  protocol;
    __u8  _padding[3];
    __u32 pkt_len;
    __u32 action;
    __u32 drop_reason;
    __u64 ktime_ns;
};

// ---------------------------------------------------------------------------
// Maps
// ---------------------------------------------------------------------------

struct {
    __uint(type, BPF_MAP_TYPE_PERF_EVENT_ARRAY);
    __uint(key_size, sizeof(__u32));
    __uint(value_size, sizeof(__u32));
} EVENTS SEC(".maps");

struct {
    __uint(type, BPF_MAP_TYPE_HASH);
    __type(key, __u32);
    __type(value, __u32);
    __uint(max_entries, 32);
} MONITORED_IFS SEC(".maps");

// ---------------------------------------------------------------------------
// Packet header structs for XDP direct access
//
// vmlinux.h の struct ethhdr / iphdr 等は preserve_access_index 属性付きのため
// XDP パケットバッファの直接ポインタアクセスには使えない。
// XDP 専用に属性なしの構造体を定義する。
// ---------------------------------------------------------------------------

struct xdp_ethhdr {
    __u8  h_dest[6];
    __u8  h_source[6];
    __u16 h_proto;        // network byte order
} __attribute__((packed));

struct xdp_iphdr {
#if __BYTE_ORDER__ == __ORDER_LITTLE_ENDIAN__
    __u8  ihl:4,
          version:4;
#else
    __u8  version:4,
          ihl:4;
#endif
    __u8  tos;
    __u16 tot_len;        // network byte order
    __u16 id;
    __u16 frag_off;
    __u8  ttl;
    __u8  protocol;
    __u16 check;
    __u32 saddr;          // network byte order
    __u32 daddr;          // network byte order
} __attribute__((packed));

struct xdp_tcphdr {
    __u16 source;         // network byte order
    __u16 dest;           // network byte order
} __attribute__((packed));

struct xdp_udphdr {
    __u16 source;         // network byte order
    __u16 dest;           // network byte order
} __attribute__((packed));

// ---------------------------------------------------------------------------
// XDP program
// ---------------------------------------------------------------------------

SEC("xdp")
int scrop_xdp(struct xdp_md *ctx)
{
    void *data     = (void *)(long)ctx->data;
    void *data_end = (void *)(long)ctx->data_end;

    // Ethernet header
    struct xdp_ethhdr *eth = data;
    if ((void *)(eth + 1) > data_end)
        return XDP_PASS;

    // IPv4 only
    if (eth->h_proto != bpf_htons(ETH_P_IP))
        return XDP_PASS;

    // IP header
    struct xdp_iphdr *iph = (void *)(eth + 1);
    if ((void *)(iph + 1) > data_end)
        return XDP_PASS;

    __u8 proto = iph->protocol;
    if (proto != IPPROTO_TCP && proto != IPPROTO_UDP)
        return XDP_PASS;

    __u32 ip_hdr_len = iph->ihl * 4;
    if (ip_hdr_len < 20)
        return XDP_PASS;

    void *transport = (void *)iph + ip_hdr_len;
    __u16 src_port = 0;
    __u16 dst_port = 0;

    if (proto == IPPROTO_TCP) {
        struct xdp_tcphdr *tcph = transport;
        if ((void *)(tcph + 1) > data_end)
            return XDP_PASS;
        src_port = bpf_ntohs(tcph->source);
        dst_port = bpf_ntohs(tcph->dest);
    } else {
        struct xdp_udphdr *udph = transport;
        if ((void *)(udph + 1) > data_end)
            return XDP_PASS;
        src_port = bpf_ntohs(udph->source);
        dst_port = bpf_ntohs(udph->dest);
    }

    struct packet_event event = {};
    event.src_addr    = iph->saddr;
    event.dst_addr    = iph->daddr;
    event.src_port    = src_port;
    event.dst_port    = dst_port;
    event.protocol    = proto;
    event.pkt_len     = bpf_ntohs(iph->tot_len);
    event.action      = ACTION_XDP_PASS;
    event.drop_reason = 0;
    event.ktime_ns    = bpf_ktime_get_ns();

    bpf_perf_event_output(ctx, &EVENTS, BPF_F_CURRENT_CPU,
                          &event, sizeof(event));

    return XDP_PASS;
}

// ---------------------------------------------------------------------------
// kfree_skb tracepoint
// ---------------------------------------------------------------------------

// tracepoint/skb/kfree_skb context layout (kernel 5.17+):
//   offset  0: common fields (8 bytes)
//   offset  8: void *skbaddr
//   offset 16: void *location
//   offset 24: unsigned short protocol (ETH_P_IP = 0x0800)
//   offset 26: 2 bytes padding
//   offset 28: enum skb_drop_reason reason

struct kfree_skb_ctx {
    __u64 __pad0;         // common fields
    void *skbaddr;        // offset 8
    void *location;       // offset 16
    __u16 protocol;       // offset 24
    __u16 __pad1;         // offset 26
    __u32 reason;         // offset 28
};

SEC("tracepoint/skb/kfree_skb")
int scrop_kfree_skb(struct kfree_skb_ctx *ctx)
{
    // 1. IPv4 only
    if (ctx->protocol != ETH_P_IP)
        return 0;

    __u32 reason = ctx->reason;
    struct sk_buff *skb = ctx->skbaddr;
    if (!skb)
        return 0;

    // 2. Check if the interface is monitored
    int iif = BPF_CORE_READ(skb, skb_iif);
    if (iif <= 0)
        return 0;
    __u32 iif_u32 = (__u32)iif;
    if (!bpf_map_lookup_elem(&MONITORED_IFS, &iif_u32))
        return 0;

    // 3. Read sk_buff fields via CO-RE
    unsigned char *head = BPF_CORE_READ(skb, head);
    if (!head)
        return 0;
    __u16 network_header    = BPF_CORE_READ(skb, network_header);
    __u16 transport_header  = BPF_CORE_READ(skb, transport_header);
    __u32 pkt_len           = BPF_CORE_READ(skb, len);

    // 4. Read IP header from kernel memory
    struct xdp_iphdr iph;
    if (bpf_probe_read_kernel(&iph, sizeof(iph), head + network_header) < 0)
        return 0;

    __u8 proto = iph.protocol;
    if (proto != IPPROTO_TCP && proto != IPPROTO_UDP)
        return 0;

    // 5. Read transport header
    __u16 src_port = 0;
    __u16 dst_port = 0;
    void *th_ptr = head + transport_header;

    if (proto == IPPROTO_TCP) {
        struct xdp_tcphdr tcph;
        if (bpf_probe_read_kernel(&tcph, sizeof(tcph), th_ptr) < 0)
            return 0;
        src_port = bpf_ntohs(tcph.source);
        dst_port = bpf_ntohs(tcph.dest);
    } else {
        struct xdp_udphdr udph;
        if (bpf_probe_read_kernel(&udph, sizeof(udph), th_ptr) < 0)
            return 0;
        src_port = bpf_ntohs(udph.source);
        dst_port = bpf_ntohs(udph.dest);
    }

    // 6. Emit event
    struct packet_event event = {};
    event.src_addr    = iph.saddr;
    event.dst_addr    = iph.daddr;
    event.src_port    = src_port;
    event.dst_port    = dst_port;
    event.protocol    = proto;
    event.pkt_len     = pkt_len;
    event.action      = ACTION_KFREE_SKB;
    event.drop_reason = reason;
    event.ktime_ns    = bpf_ktime_get_ns();

    bpf_perf_event_output(ctx, &EVENTS, BPF_F_CURRENT_CPU,
                          &event, sizeof(event));

    return 0;
}

char LICENSE[] SEC("license") = "GPL";
