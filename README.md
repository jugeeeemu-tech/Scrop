# Scrop

Packet capture visualizer.

## Latest Release

- GitHub Releases: https://github.com/jugeeeemu-tech/Scrop/releases
- Current stable tag: `v0.2.1`

## Release Build Contents

- Runtime binary:
  - `scrop-server-v0.2.1-linux-x86_64.tar.gz`
- Checksum file:
  - `scrop-server-v0.2.1-linux-x86_64.tar.gz.sha256`

`scrop-server` is a single binary for browser usage.
After launch, open `http://127.0.0.1:3000`.

## Download From GitHub

```bash
mkdir -p /tmp/scrop-v0.2.1 && cd /tmp/scrop-v0.2.1
curl -fLO https://github.com/jugeeeemu-tech/Scrop/releases/download/v0.2.1/scrop-server-v0.2.1-linux-x86_64.tar.gz
curl -fLO https://github.com/jugeeeemu-tech/Scrop/releases/download/v0.2.1/scrop-server-v0.2.1-linux-x86_64.tar.gz.sha256
sha256sum -c scrop-server-v0.2.1-linux-x86_64.tar.gz.sha256
tar -xzf scrop-server-v0.2.1-linux-x86_64.tar.gz
sudo ./scrop-server
```

## Installation

```bash
# 1) verify archive
sha256sum -c scrop-server-v0.2.1-linux-x86_64.tar.gz.sha256

# 2) extract
mkdir -p scrop-v0.2.1
tar -xzf scrop-server-v0.2.1-linux-x86_64.tar.gz -C scrop-v0.2.1
cd scrop-v0.2.1

# 3) run (default: 127.0.0.1:3000)
sudo ./scrop-server
```

Then open `http://127.0.0.1:3000` in your browser.

## Constraints

- Linux (x86_64 for current release asset)
- Kernel 5.8+ (BPF ring buffer, XDP/BTF support)
- eBPF privileges are required (`CAP_BPF`, `CAP_NET_ADMIN`, `CAP_PERFMON`)
- For reliable eBPF mode startup, run `scrop-server` with `sudo`.
