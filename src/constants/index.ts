// Animation timing (ms)
export const LAYER_TRANSITION_DURATION = 700;
export const PACKET_ANIMATION_DURATION = 750;
export const LAYER_ACTIVE_FLASH_DURATION = 300;
export const STREAM_STAGGER_DELAY = 200;
export const DROP_ANIMATION_DURATION = 1300;
export const ANIMATION_INITIAL_DELAY = 50;
export const PACKET_GENERATION_INTERVAL = 2000;

// Thresholds
export const MAX_ANIMATING_PACKETS = 5;
export const STREAM_PACKET_COUNT = 4;

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
