# Scrop - Codex Agent Guide

`CLAUDE.md` と `.claude/` の設定を、Codex で運用しやすい形に移植したガイド。

## プロジェクト概要

パケットキャプチャの様子を可視化するアプリ。ポートをポスト、パケットを小包に見立て、各ポートに届く様子をアニメーションで表現する。Tauri ネイティブアプリと axum Web サーバの両方で動作する。

## 技術スタック

### フロントエンド
- React 19.1.0 + TypeScript
- Vite 7
- Tailwind CSS 4
- Framer Motion

### バックエンド
- Tauri 2.x
- axum (WebSocket + REST API)
- Rust
- Aya (eBPF)
- tokio

### パケット監視
- eBPF/XDP
- TC (Traffic Control)
- kprobe

## アーキテクチャ

```text
                    scrop-capture (lib crate)
                   broadcast::Sender<CapturedPacket>
                      ↙                ↘
              src-tauri/            scrop-server/
        (broadcast→Tauri emit)    (broadcast→WebSocket)
              ↕ IPC                  ↕ HTTP/WS
           [Tauriウィンドウ]         [ブラウザ]
```

## プロジェクト構成

```text
Scrop/
├── Cargo.toml                    # workspace root
├── scrop-capture/                # キャプチャロジック (lib crate)
│   ├── build.rs                  # eBPFコンパイル
│   └── src/
│       ├── lib.rs                # CaptureBackend, AppState
│       ├── ebpf.rs               # eBPFキャプチャ
│       ├── mock.rs               # モックキャプチャ
│       ├── drop_reason.rs        # BTF drop reason resolver
│       └── types.rs              # パケット型定義
├── scrop-server/                 # axum Webサーバ (bin crate)
│   └── src/
│       ├── main.rs               # エントリポイント (--host, --port)
│       ├── routes.rs             # REST API
│       └── ws.rs                 # WebSocket
├── src-tauri/                    # Tauri デスクトップアプリ
│   ├── build.rs                  # tauri_build のみ
│   └── src/
│       ├── main.rs
│       └── lib.rs                # broadcastブリッジ
├── scrop-common/                 # eBPF共有型定義
├── scrop-ebpf/                   # eBPFプログラム (C)
├── src/                          # React フロントエンド
│   ├── transport/                # 通信抽象化層
│   │   ├── index.ts              # 共通IF + 自動選択
│   │   ├── tauri.ts              # Tauri IPC実装
│   │   └── web.ts                # HTTP + WebSocket実装
│   ├── stores/
│   ├── components/
│   └── App.tsx
├── package.json
└── vite.config.ts
```

## 開発・ビルドコマンド

```bash
# Tauri版（開発）
npm run tauri dev

# Web版開発（2ターミナル）
cargo run -p scrop-server                    # :3000
npm run dev                                  # :1420 (proxy -> :3000)

# Web版 mockモード（eBPFなし）
cargo run -p scrop-server --no-default-features

# Web版プロダクションビルド
npm run build && cargo build --release -p scrop-server

# Tauriプロダクションビルド
npm run tauri build
```

## テストコマンド

```bash
# Frontend
npm test
npm run test:watch
npm run test:coverage

# Backend (mock)
cargo test --no-default-features -p scrop-capture
cargo test --no-default-features -p scrop-server
cargo test --no-default-features -p scrop-capture -p scrop-server

# Coverage
cargo llvm-cov test --no-default-features -p scrop-capture -p scrop-server

# E2E
npm run test:e2e
npm run test:e2e:ui
E2E_PORT=3001 npm run test:e2e

# Performance
npm run perf:lighthouse
npm run perf:cdp
npm run perf:stress
npm run perf
```

## REST API (scrop-server)

| Method | Path | Description |
|---|---|---|
| POST | `/api/capture/start` | キャプチャ開始 |
| POST | `/api/capture/stop` | キャプチャ停止 |
| GET | `/api/capture/status` | ステータス取得 |
| POST | `/api/capture/reset` | リセット |
| GET | `/api/interfaces` | インターフェース一覧 |
| POST | `/api/interfaces/:name/attach` | NIC attach |
| POST | `/api/interfaces/:name/detach` | NIC detach |
| GET | `/ws` | WebSocket（パケットストリーム） |

## 実行要件

- Linux (eBPF/XDP のため)
- カーネル 5.x 以上 (XDP/BTF 対応)
- root 権限または `CAP_BPF`, `CAP_NET_ADMIN`, `CAP_PERFMON`

## Codex向け運用ポリシー

Claude の `permissions.allow` を Codex 向けに読み替えた実務ルール。

- まず調査: `ls`, `tree`, `rg`, `find`, `wc`, `file`
- Rustツール確認: `rustup show`, `rustup toolchain list`, `rustup target list`
- ビルド: `cargo build`, `cargo check`, `cargo test`, `npm run build`
- E2E/Perf: `npx playwright test`, `npm run test:e2e`, `npm run perf:*`
- ネットワーク確認: `ip link`, `ip addr show`
- 差分確認: `git status`, `git diff`, `git log`

## Commit ワークフロー（移植）

`.claude/skills/commit` 相当のルール。

1. 変更全体を確認する（staged/unstaged を両方）。
2. 変更を論理単位に分割する（atomic commit）。
3. コミット計画を先に提示する。
4. ユーザー承認後に `git add` / `git commit` を実行する。
5. 形式は Conventional Commits を使う。

Conventional Commits:

```text
<type>(<scope>): <subject>
```

- type 例: `feat`, `fix`, `refactor`, `test`, `chore`
- subject は命令形・50文字以内・末尾ピリオドなし

## E2E 生成ワークフロー（移植）

`.claude/skills/e2e-gen` 相当のルール。

1. サーバー起動状態を確認し、必要なら mock モードで起動する。
2. 実際のUI操作で仕様を確認する（手順ログを残す）。
3. ログを基に Playwright テストを作成する。
4. `data-testid` を優先し、必要なら先にUIへ追加する。
5. テスト実行・修正を繰り返して安定化する。
6. 自分で起動したプロセスは最後に停止する。

## 注意

- パケットキャプチャには権限が必要。
- `--no-default-features` で mock モード動作が可能。
- WSL2 での利用時は GUI を使うなら WSLg が必要。
