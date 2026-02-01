// Common service names
export const SERVICE_NAMES: Record<number, string> = {
  21: 'FTP',
  22: 'SSH',
  25: 'SMTP',
  53: 'DNS',
  80: 'HTTP',
  443: 'HTTPS',
  3000: 'Dev Server',
  3306: 'MySQL',
  5000: 'App Server',
  5432: 'PostgreSQL',
  6379: 'Redis',
  8080: 'Proxy',
  8443: 'HTTPS Alt',
  9090: 'Prometheus',
} as const;
