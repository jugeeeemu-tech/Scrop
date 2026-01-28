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

// L4プロトコル色（パケットの背景色等に使用）
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
} as const;

// サービス名の色（ポート番号→サービス名の表示用）
export const SERVICE_COLORS: Record<string, { bg: string; text: string; light: string }> = {
  HTTP: { bg: 'bg-blue-500', text: 'text-blue-500', light: 'bg-blue-100' },
  HTTPS: { bg: 'bg-blue-600', text: 'text-blue-600', light: 'bg-blue-100' },
  SSH: { bg: 'bg-green-500', text: 'text-green-500', light: 'bg-green-100' },
  Proxy: { bg: 'bg-orange-500', text: 'text-orange-500', light: 'bg-orange-100' },
  Other: { bg: 'bg-gray-500', text: 'text-gray-500', light: 'bg-gray-100' },
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
  8080: 'Proxy',
} as const;

/** ポート番号からサービス名を取得 */
export function getServiceName(port: number): string {
  return SERVICE_NAMES[port] ?? 'Other';
}

/** サービス名から色を取得 */
export function getServiceColors(serviceName: string) {
  return SERVICE_COLORS[serviceName] ?? SERVICE_COLORS.Other;
}
