// Layer colors
export const LAYER_COLORS = {
  PORT: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-900',
    accent: 'bg-amber-500',
  },
  FW: {
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    text: 'text-rose-900',
    accent: 'bg-rose-500',
  },
  NIC: {
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    text: 'text-indigo-900',
    accent: 'bg-indigo-500',
  },
} as const;

// Protocol colors
export const PROTOCOL_COLORS = {
  TCP: {
    bg: 'bg-blue-500',
    text: 'text-blue-500',
    border: 'border-blue-500',
    light: 'bg-blue-100',
  },
  UDP: {
    bg: 'bg-green-500',
    text: 'text-green-500',
    border: 'border-green-500',
    light: 'bg-green-100',
  },
  ICMP: {
    bg: 'bg-amber-500',
    text: 'text-amber-500',
    border: 'border-amber-500',
    light: 'bg-amber-100',
  },
  OTHER: {
    bg: 'bg-gray-500',
    text: 'text-gray-500',
    border: 'border-gray-500',
    light: 'bg-gray-100',
  },
} as const;

// Layer labels
export const LAYER_LABELS = {
  PORT: 'ポート層',
  FW: 'ファイアウォール層',
  NIC: 'NIC層',
} as const;

// Drop reason labels
export const DROP_REASON_LABELS = {
  FIREWALL_RULE: 'ファイアウォールルール',
  RATE_LIMIT: 'レート制限',
  XDP_DROP: 'XDP Drop',
  INVALID_PACKET: '不正パケット',
} as const;

// Common service names
export const SERVICE_NAMES: Record<number, string> = {
  22: 'SSH',
  80: 'HTTP',
  443: 'HTTPS',
  3000: 'Dev Server',
  3306: 'MySQL',
  5432: 'PostgreSQL',
  6379: 'Redis',
  8080: 'HTTP Alt',
} as const;
