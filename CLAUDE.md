# Scrop - Packet Capture Visualizer

パケットキャプチャの様子を可視化するアプリ。ポートをポスト、パケットを小包に見立て、パケットが各ポートに届く様子をアニメーションで表現する。Tauriネイティブアプリとaxum Webサーバの両方で動作。

## 技術スタック

### フロントエンド
- **React 19.1.0** + TypeScript
- **Vite 7** - ビルドツール
- **Tailwind CSS 4** - スタイリング
- **Framer Motion** - 2Dアニメーション

### バックエンド
- **Tauri 2.x** - デスクトップアプリフレームワーク
- **axum** - Web サーバ (WebSocket + REST API)
- **Rust** - バックエンド言語
- **Aya** - eBPFライブラリ
- **tokio** - 非同期ランタイム

### パケット監視
- **eBPF/XDP** - NIC層でのパケット監視・Drop検出
- **TC (Traffic Control)** - FW層でのパケット監視
- **kprobe** - iptables/nftables フック

## アーキテクチャ

```
                    scrop-capture (lib crate)
                   broadcast::Sender<CapturedPacket>
                      ↙                ↘
              src-tauri/            scrop-server/
        (broadcast→Tauri emit)    (broadcast→WebSocket)
              ↕ IPC                  ↕ HTTP/WS
           [Tauriウィンドウ]         [ブラウザ]
```

## プロジェクト構成

```
Scrop/
├── Cargo.toml                    # workspace root
├── scrop-capture/                # キャプチャロジック (lib crate)
│   ├── Cargo.toml
│   ├── build.rs                  # eBPFコンパイル
│   └── src/
│       ├── lib.rs                # CaptureBackend, AppState
│       ├── ebpf.rs               # eBPFキャプチャ
│       ├── mock.rs               # モックキャプチャ
│       ├── drop_reason.rs        # BTF drop reason resolver
│       └── types.rs              # パケット型定義
├── scrop-server/                 # axum Webサーバ (bin crate)
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs               # エントリポイント (--host, --port)
│       ├── routes.rs             # REST API
│       └── ws.rs                 # WebSocket
├── src-tauri/                    # Tauri デスクトップアプリ
│   ├── Cargo.toml                # scrop-capture依存
│   ├── build.rs                  # tauri_build のみ
│   └── src/
│       ├── main.rs
│       └── lib.rs                # broadcastブリッジ
├── scrop-common/                 # eBPF共有型定義
├── scrop-ebpf/                   # eBPFプログラム (C)
├── src/                          # React フロントエンド
│   ├── transport/                # 通信抽象化層
│   │   ├── index.ts              # 共通インターフェース + 自動選択
│   │   ├── tauri.ts              # Tauri IPC実装
│   │   └── web.ts                # HTTP + WebSocket実装
│   ├── stores/                   # 状態管理
│   ├── components/               # UIコンポーネント
│   └── App.tsx
├── package.json
└── vite.config.ts                # proxy設定含む
```

## 開発コマンド

```bash
# Tauri版（従来通り）
npm run tauri dev

# Web版開発（2ターミナル）
cargo run -p scrop-server                    # :3000
npm run dev                                   # :1420 (proxy → :3000)

# Web版 mockモード（eBPFなし）
cargo run -p scrop-server --no-default-features

# Web版プロダクションビルド
npm run build && cargo build --release -p scrop-server
# → target/release/scrop-server (シングルバイナリ、dist/を埋め込み)

# プロダクションビルド（Tauri）
npm run tauri build

# リモートアクセス
ssh -L 3000:127.0.0.1:3000 user@remote
# ブラウザ: http://localhost:3000
```

## テストコマンド

```bash
# フロントエンド (Vitest)
npm test                                      # 全テスト実行
npm run test:watch                            # ウォッチモード
npm run test:coverage                         # カバレッジ付き実行

# バックエンド (cargo test) ※ --no-default-features で mock モード
cargo test --no-default-features -p scrop-capture   # scrop-capture 単体テスト
cargo test --no-default-features -p scrop-server    # scrop-server 統合テスト
cargo test --no-default-features -p scrop-capture -p scrop-server  # 両方

# バックエンド カバレッジ (cargo-llvm-cov)
cargo llvm-cov test --no-default-features -p scrop-capture -p scrop-server

# E2E テスト (Playwright) ※ mockサーバを自動起動
npm run test:e2e                              # E2Eテスト実行
npm run test:e2e:ui                           # UIモードで実行
E2E_PORT=3001 npm run test:e2e                # 別ポートで実行（eBPFサーバが:3000を占有時）

# パフォーマンス計測 ※ mockサーバを自動起動
npm run perf:lighthouse                       # Lighthouse Web Vitals → perf-report/lighthouse.json
npm run perf:cdp                              # CDP FPS/メモリ/Long Tasks → perf-report/cdp-metrics.json
npm run perf                                  # 両方実行
```

## REST API (scrop-server)

| メソッド | パス | 処理 |
|----------|------|------|
| POST | `/api/capture/start` | キャプチャ開始 |
| POST | `/api/capture/stop` | キャプチャ停止 |
| GET | `/api/capture/status` | ステータス取得 |
| POST | `/api/capture/reset` | リセット |
| GET | `/api/interfaces` | インターフェース一覧 |
| POST | `/api/interfaces/:name/attach` | NIC attach |
| POST | `/api/interfaces/:name/detach` | NIC detach |
| GET | `/ws` | WebSocket (パケットストリーム) |

## 画面構成

縦スクロールで3つの層を表示：

1. **ポート層（上部）** - 各ポートをポストとして表示、パケット（小包）が届くアニメーション
2. **FW層（中部）** - iptables/nftablesでDropされたパケットを表示
3. **NIC層（下部）** - XDPでDropされたパケットを表示

## 実行要件

- **Linux** (eBPF/XDPはLinux専用)
- **カーネル 5.x以上** (XDP/BTF対応)
- **root権限** または CAP_BPF capability

## 注意事項

- パケットキャプチャにはroot権限が必要
- WSL2で動作確認済み（WSLg必要）
- `--no-default-features` でmockモード（eBPFなし）で動作可能
