# Scrop

Scrop is a packet capture visualizer.
It renders packets as parcel-like animations flowing into mailbox-like ports.

The repository provides two runtimes:

- `scrop-server`: single Linux binary for browser usage (serves embedded frontend + API + WebSocket)
- `scrop` (Tauri): desktop app runtime

## Latest Release

- GitHub Releases: https://github.com/jugeeeemu-tech/Scrop/releases
- Current stable tag: `v0.1.0`
- Release asset for browser runtime:
  - `scrop-server-v0.1.0-linux-x86_64.tar.gz`
  - `scrop-server-v0.1.0-linux-x86_64.tar.gz.sha256`

## Quick Start (Release Binary)

```bash
# 1) verify
sha256sum -c scrop-server-v0.1.0-linux-x86_64.tar.gz.sha256

# 2) extract
mkdir -p scrop-v0.1.0
tar -xzf scrop-server-v0.1.0-linux-x86_64.tar.gz -C scrop-v0.1.0
cd scrop-v0.1.0

# 3) run (default: 127.0.0.1:3000)
sudo ./scrop-server
```

Then open `http://127.0.0.1:3000` in your browser.

## Permissions (eBPF mode)

`scrop-server` and `scrop` require eBPF-related capabilities:
`CAP_BPF`, `CAP_NET_ADMIN`, `CAP_PERFMON`.

Use either:

```bash
sudo ./scrop-server
```

or:

```bash
sudo setcap 'cap_bpf,cap_net_admin,cap_perfmon+ep' ./scrop-server
./scrop-server
```

## Requirements

- Linux (x86_64 for current release asset)
- Kernel 5.x+ (XDP/BTF support)
- Elevated privileges/capabilities for eBPF runtime

## Build From Source

```bash
npm ci
npm run build
cargo build --release -p scrop-server
```

Binary output:

- `target/release/scrop-server`

## Development

Web mode (two terminals):

```bash
# terminal 1
cargo run -p scrop-server

# terminal 2
npm run dev
```

Mock mode (no eBPF privileges required):

```bash
npm run build
cargo run -p scrop-server --no-default-features
```

Tauri desktop mode:

```bash
npm run tauri dev
```

## Tests

```bash
# frontend
npm test
npm run test:coverage

# backend (mock mode)
cargo test --no-default-features -p scrop-capture -p scrop-server

# e2e
npm run test:e2e
```

## API Endpoints (scrop-server)

- `POST /api/capture/start`
- `POST /api/capture/stop`
- `GET /api/capture/status`
- `POST /api/capture/reset`
- `GET /api/interfaces`
- `POST /api/interfaces/:name/attach`
- `POST /api/interfaces/:name/detach`
- `GET /ws`
