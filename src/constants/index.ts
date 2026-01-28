// Animation timing (ms)
export const LAYER_TRANSITION_DURATION = 700;
export const PACKET_ANIMATION_DURATION = 900;
export const LAYER_ACTIVE_FLASH_DURATION = 300;
export const STREAM_STAGGER_DELAY = 200;
export const DROP_ANIMATION_DURATION = 1000;
export const ANIMATION_INITIAL_DELAY = 50;
export const PACKET_GENERATION_INTERVAL = 2000;

// Stream mode (rate-based)
export const STREAM_MODE_RATE_WINDOW = 1000;  // ms - レート計算ウィンドウ
export const STREAM_MODE_RATE_THRESHOLD = 5;   // この秒間パケット数以上でストリームモード突入
export const STREAM_MODE_RATE_EXIT_THRESHOLD = 3; // この秒間パケット数未満でストリームモード離脱（ヒステリシス）
export const STREAM_PACKET_COUNT = 4;          // ストリームアニメーションの同時表示数

// Stream drain timing (ms) - コンテナopacityのフェードアウト時間 & ドレインタイマー
export const STREAM_DRAIN_DURATION = 500;

// Storage limits
export const MAX_STORED_DROPPED_PACKETS = 50;
export const MAX_STORED_DELIVERED_PACKETS = 20;

// Port configuration
export const DEFAULT_PORTS = [
  { type: 'port', port: 80, label: 'HTTP' },
  { type: 'port', port: 443, label: 'HTTPS' },
  { type: 'port', port: 22, label: 'SSH' },
  { type: 'port', port: 8080, label: 'Proxy' },
  { type: 'etc', label: 'Other' },
] as const;

export const PROTOCOLS = ['TCP', 'UDP'] as const;
