# Scrop - Packet Capture Visualizer

パケットキャプチャの様子を可視化するデスクトップアプリ。ポートをポスト、パケットを小包に見立て、パケットが各ポートに届く様子をアニメーションで表現する。

## 技術スタック

### フロントエンド
- **React 19** + TypeScript
- **Vite 7** - ビルドツール
- **Tailwind CSS 4** - スタイリング
- **Framer Motion** - 2Dアニメーション

### バックエンド
- **Tauri 2.x** - デスクトップアプリフレームワーク
- **Rust** - バックエンド言語
- **Aya** - eBPFライブラリ
- **tokio** - 非同期ランタイム

### パケット監視
- **eBPF/XDP** - NIC層でのパケット監視・Drop検出
- **TC (Traffic Control)** - FW層でのパケット監視
- **kprobe** - iptables/nftables フック

## プロジェクト構成

```
Scrop/
├── src/                    # React フロントエンド
│   ├── App.tsx
│   ├── index.css          # Tailwind CSS
│   └── main.tsx
├── src-tauri/             # Rust バックエンド
│   ├── src/
│   │   ├── lib.rs         # Tauriアプリロジック
│   │   └── main.rs
│   └── Cargo.toml
├── .node-version          # fnm用 (Node.js 22)
└── package.json
```

## 開発コマンド

```bash
# 開発サーバー起動
npm run tauri dev

# プロダクションビルド
npm run tauri build

# フロントエンドのみ起動（Rustなし）
npm run dev

# 型チェック
npm run build
```

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
