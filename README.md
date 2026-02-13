# Scrop

Packet capture visualizer.

## Latest Release

- GitHub Releases: https://github.com/jugeeeemu-tech/Scrop/releases
- Current stable tag: `v0.1.0`

## Release Build Contents

- Runtime binary:
  - `scrop-server-v0.1.0-linux-x86_64.tar.gz`
- Checksum file:
  - `scrop-server-v0.1.0-linux-x86_64.tar.gz.sha256`

`scrop-server` is a single binary for browser usage.
After launch, open `http://127.0.0.1:3000`.

## Installation

```bash
# 1) verify archive
sha256sum -c scrop-server-v0.1.0-linux-x86_64.tar.gz.sha256

# 2) extract
mkdir -p scrop-v0.1.0
tar -xzf scrop-server-v0.1.0-linux-x86_64.tar.gz -C scrop-v0.1.0
cd scrop-v0.1.0

# 3) run (default: 127.0.0.1:3000)
sudo ./scrop-server
```

Then open `http://127.0.0.1:3000` in your browser.

If you do not want to use `sudo` every time:

```bash
sudo setcap 'cap_bpf,cap_net_admin,cap_perfmon+ep' ./scrop-server
./scrop-server
```

## Constraints

- Linux (x86_64 for current release asset)
- Kernel 5.x+ (XDP/BTF support)
- eBPF privileges are required (`CAP_BPF`, `CAP_NET_ADMIN`, `CAP_PERFMON`)
