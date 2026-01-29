use std::collections::{HashMap, HashSet};
use std::fs;

use crate::packet::PacketResult;

// ---------------------------------------------------------------------------
// BTF binary format structures
// ---------------------------------------------------------------------------

#[repr(C)]
#[derive(Debug, Clone, Copy)]
struct BtfHeader {
    magic: u16,
    version: u8,
    flags: u8,
    hdr_len: u32,
    type_off: u32,
    type_len: u32,
    str_off: u32,
    str_len: u32,
}

const BTF_MAGIC: u16 = 0xEB9F;
const BTF_KIND_ENUM: u32 = 6;
const BTF_KIND_ENUM64: u32 = 19;

/// BTF から `enum skb_drop_reason` を解決し、drop reason 値と名前のマッピングを保持する。
pub struct DropReasonResolver {
    /// drop_reason 値 → 名前 (`SKB_DROP_REASON_` prefix 除去済み)
    names: HashMap<u32, String>,
    /// FW 関連の drop_reason 値の集合
    fw_reasons: HashSet<u32>,
}

impl DropReasonResolver {
    /// `/sys/kernel/btf/vmlinux` から BTF を読み込み、`enum skb_drop_reason` を解決する。
    /// 失敗時は `Err(String)` を返す（フォールバックなし）。
    pub fn new() -> Result<Self, String> {
        let btf_path = "/sys/kernel/btf/vmlinux";
        let data = fs::read(btf_path)
            .map_err(|e| format!("Failed to read {}: {}", btf_path, e))?;

        Self::from_btf_bytes(&data)
    }

    fn from_btf_bytes(data: &[u8]) -> Result<Self, String> {
        if data.len() < std::mem::size_of::<BtfHeader>() {
            return Err("BTF data too short for header".into());
        }

        let header: BtfHeader =
            unsafe { std::ptr::read_unaligned(data.as_ptr() as *const BtfHeader) };

        if header.magic != BTF_MAGIC {
            return Err(format!(
                "Invalid BTF magic: expected 0x{:04X}, got 0x{:04X}",
                BTF_MAGIC, header.magic
            ));
        }

        let hdr_len = header.hdr_len as usize;
        let type_start = hdr_len + header.type_off as usize;
        let type_end = type_start + header.type_len as usize;
        let str_start = hdr_len + header.str_off as usize;
        let str_end = str_start + header.str_len as usize;

        if type_end > data.len() || str_end > data.len() {
            return Err("BTF data too short for type/string sections".into());
        }

        let type_section = &data[type_start..type_end];
        let str_section = &data[str_start..str_end];

        // type section を走査して skb_drop_reason enum を検索
        // BTF_KIND_ENUM を優先し、見つからなければ BTF_KIND_ENUM64 を探索
        let result = Self::find_enum(type_section, str_section, BTF_KIND_ENUM)
            .or_else(|| Self::find_enum(type_section, str_section, BTF_KIND_ENUM64));

        match result {
            Some((names, fw_reasons)) => {
                eprintln!(
                    "BTF drop reason resolver loaded: {} reasons",
                    names.len()
                );
                Ok(Self { names, fw_reasons })
            }
            None => Err("enum skb_drop_reason not found in BTF".into()),
        }
    }

    /// type section を走査して `skb_drop_reason` という名前の enum を探す。
    fn find_enum(
        type_section: &[u8],
        str_section: &[u8],
        target_kind: u32,
    ) -> Option<(HashMap<u32, String>, HashSet<u32>)> {
        let mut offset = 0;

        while offset + 12 <= type_section.len() {
            // btf_type: name_off(4) + info(4) + size_or_type(4) = 12 bytes
            let name_off =
                u32::from_le_bytes(type_section[offset..offset + 4].try_into().unwrap());
            let info =
                u32::from_le_bytes(type_section[offset + 4..offset + 8].try_into().unwrap());

            let kind = (info >> 24) & 0x1f;
            let vlen = info & 0xffff;

            offset += 12; // skip btf_type header

            if kind == target_kind {
                let type_name = read_str(str_section, name_off as usize);
                if type_name == "skb_drop_reason" {
                    return Some(Self::parse_enum_variants(
                        type_section,
                        str_section,
                        offset,
                        vlen,
                        target_kind,
                    ));
                }
            }

            // skip variant data for this type
            offset += Self::extra_bytes(kind, vlen, target_kind) as usize;
        }

        None
    }

    /// 各 BTF kind のバリアント/メンバーデータサイズを計算してスキップする。
    fn extra_bytes(kind: u32, vlen: u32, _target_kind: u32) -> u32 {
        match kind {
            // BTF_KIND_INT
            1 => 4,
            // BTF_KIND_ENUM
            6 => vlen * 8, // name_off(4) + val(4)
            // BTF_KIND_ARRAY
            4 => 12,
            // BTF_KIND_STRUCT, BTF_KIND_UNION
            5 | 2 => vlen * 12, // name_off(4) + type(4) + offset(4)
            // BTF_KIND_FUNC_PROTO
            13 => vlen * 8, // name_off(4) + type(4)
            // BTF_KIND_DATASEC
            15 => vlen * 12, // type(4) + offset(4) + size(4)
            // BTF_KIND_ENUM64
            19 => vlen * 12, // name_off(4) + val_lo(4) + val_hi(4)
            // BTF_KIND_DECL_TAG
            17 => 4,
            // BTF_KIND_PTR, BTF_KIND_TYPEDEF, BTF_KIND_VOLATILE, BTF_KIND_CONST,
            // BTF_KIND_RESTRICT, BTF_KIND_FUNC, BTF_KIND_FWD, BTF_KIND_VAR,
            // BTF_KIND_TYPE_TAG
            _ => 0,
        }
    }

    fn parse_enum_variants(
        type_section: &[u8],
        str_section: &[u8],
        offset: usize,
        vlen: u32,
        kind: u32,
    ) -> (HashMap<u32, String>, HashSet<u32>) {
        let mut names = HashMap::new();
        let mut fw_reasons = HashSet::new();

        let entry_size: usize = if kind == BTF_KIND_ENUM64 { 12 } else { 8 };

        for i in 0..vlen as usize {
            let entry_off = offset + i * entry_size;
            if entry_off + entry_size > type_section.len() {
                break;
            }

            let name_off = u32::from_le_bytes(
                type_section[entry_off..entry_off + 4].try_into().unwrap(),
            );
            let val = if kind == BTF_KIND_ENUM64 {
                let lo = u32::from_le_bytes(
                    type_section[entry_off + 4..entry_off + 8].try_into().unwrap(),
                );
                // high 32 bits are not needed for drop reasons (values are small)
                lo
            } else {
                u32::from_le_bytes(
                    type_section[entry_off + 4..entry_off + 8].try_into().unwrap(),
                )
            };

            let full_name = read_str(str_section, name_off as usize);
            let short_name = full_name
                .strip_prefix("SKB_DROP_REASON_")
                .unwrap_or(&full_name)
                .to_string();

            // FW 関連判定: NETFILTER, IPTABLES, NFTABLES を含むか
            let upper = short_name.to_uppercase();
            if upper.contains("NETFILTER")
                || upper.contains("IPTABLES")
                || upper.contains("NFTABLES")
            {
                fw_reasons.insert(val);
            }

            names.insert(val, short_name);
        }

        (names, fw_reasons)
    }

    /// drop_reason から PacketResult を分類する。
    pub fn classify_drop(&self, drop_reason: u32) -> PacketResult {
        if self.fw_reasons.contains(&drop_reason) {
            PacketResult::FwDrop
        } else {
            PacketResult::NicDrop
        }
    }

    /// drop_reason と result から人間向けの理由文字列を生成する。
    pub fn drop_reason_string(&self, drop_reason: u32, result: &PacketResult) -> String {
        let reason_name = self
            .names
            .get(&drop_reason)
            .map(|s| s.as_str())
            .unwrap_or_else(|| "");

        let reason_part = if reason_name.is_empty() {
            format!("unknown reason {}", drop_reason)
        } else {
            reason_name.to_string()
        };

        match result {
            PacketResult::FwDrop => format!("Dropped by firewall ({})", reason_part),
            PacketResult::NicDrop => format!("Dropped in network stack ({})", reason_part),
            PacketResult::Delivered => unreachable!(),
        }
    }
}

/// string section から NUL 終端文字列を読み取る。
fn read_str(str_section: &[u8], offset: usize) -> String {
    if offset >= str_section.len() {
        return String::new();
    }
    let slice = &str_section[offset..];
    let end = slice.iter().position(|&b| b == 0).unwrap_or(slice.len());
    String::from_utf8_lossy(&slice[..end]).into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// テスト用のミニマルな BTF バイナリを生成する。
    fn make_test_btf(variants: &[(&str, u32)]) -> Vec<u8> {
        // string section の構築
        let mut str_section = vec![0u8]; // offset 0 = empty string
        let type_name = b"skb_drop_reason";
        let type_name_off = str_section.len() as u32;
        str_section.extend_from_slice(type_name);
        str_section.push(0);

        let mut variant_offsets = Vec::new();
        for (name, _) in variants {
            let off = str_section.len() as u32;
            str_section.extend_from_slice(name.as_bytes());
            str_section.push(0);
            variant_offsets.push(off);
        }

        // type section: 1 つの BTF_KIND_ENUM
        let mut type_section = Vec::new();
        // btf_type header: name_off(4) + info(4) + size(4)
        type_section.extend_from_slice(&type_name_off.to_le_bytes());
        let info: u32 = (BTF_KIND_ENUM << 24) | (variants.len() as u32);
        type_section.extend_from_slice(&info.to_le_bytes());
        type_section.extend_from_slice(&4u32.to_le_bytes()); // size = 4

        for (i, (_, val)) in variants.iter().enumerate() {
            type_section.extend_from_slice(&variant_offsets[i].to_le_bytes());
            type_section.extend_from_slice(&val.to_le_bytes());
        }

        // header
        let hdr_len = std::mem::size_of::<BtfHeader>() as u32;
        let header = BtfHeader {
            magic: BTF_MAGIC,
            version: 1,
            flags: 0,
            hdr_len,
            type_off: 0,
            type_len: type_section.len() as u32,
            str_off: type_section.len() as u32,
            str_len: str_section.len() as u32,
        };

        let mut data = Vec::new();
        let header_bytes: [u8; std::mem::size_of::<BtfHeader>()] =
            unsafe { std::mem::transmute(header) };
        data.extend_from_slice(&header_bytes);
        data.extend_from_slice(&type_section);
        data.extend_from_slice(&str_section);

        data
    }

    #[test]
    fn test_parse_drop_reasons() {
        let btf = make_test_btf(&[
            ("SKB_DROP_REASON_NOT_SPECIFIED", 0),
            ("SKB_DROP_REASON_TCP_CSUM", 3),
            ("SKB_DROP_REASON_NETFILTER_DROP", 8),
            ("SKB_DROP_REASON_IPTABLES_REJECT", 20),
            ("SKB_DROP_REASON_NFTABLES_REJECT", 21),
        ]);

        let resolver = DropReasonResolver::from_btf_bytes(&btf).unwrap();

        assert_eq!(resolver.names.len(), 5);
        assert_eq!(resolver.names.get(&0).unwrap(), "NOT_SPECIFIED");
        assert_eq!(resolver.names.get(&3).unwrap(), "TCP_CSUM");
        assert_eq!(resolver.names.get(&8).unwrap(), "NETFILTER_DROP");

        // FW 関連判定
        assert!(resolver.fw_reasons.contains(&8));  // NETFILTER
        assert!(resolver.fw_reasons.contains(&20)); // IPTABLES
        assert!(resolver.fw_reasons.contains(&21)); // NFTABLES
        assert!(!resolver.fw_reasons.contains(&0));
        assert!(!resolver.fw_reasons.contains(&3));
    }

    #[test]
    fn test_classify_drop() {
        let btf = make_test_btf(&[
            ("SKB_DROP_REASON_TCP_CSUM", 3),
            ("SKB_DROP_REASON_NETFILTER_DROP", 8),
        ]);
        let resolver = DropReasonResolver::from_btf_bytes(&btf).unwrap();

        assert!(matches!(resolver.classify_drop(8), PacketResult::FwDrop));
        assert!(matches!(resolver.classify_drop(3), PacketResult::NicDrop));
        assert!(matches!(resolver.classify_drop(99), PacketResult::NicDrop));
    }

    #[test]
    fn test_drop_reason_string() {
        let btf = make_test_btf(&[
            ("SKB_DROP_REASON_TCP_CSUM", 3),
            ("SKB_DROP_REASON_NETFILTER_DROP", 8),
        ]);
        let resolver = DropReasonResolver::from_btf_bytes(&btf).unwrap();

        assert_eq!(
            resolver.drop_reason_string(8, &PacketResult::FwDrop),
            "Dropped by firewall (NETFILTER_DROP)"
        );
        assert_eq!(
            resolver.drop_reason_string(3, &PacketResult::NicDrop),
            "Dropped in network stack (TCP_CSUM)"
        );
        assert_eq!(
            resolver.drop_reason_string(99, &PacketResult::NicDrop),
            "Dropped in network stack (unknown reason 99)"
        );
    }

    #[test]
    fn test_invalid_btf() {
        let result = DropReasonResolver::from_btf_bytes(&[0u8; 4]);
        assert!(result.is_err());
    }
}
