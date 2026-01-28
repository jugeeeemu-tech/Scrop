import type { AnimatingPacket, PacketResult, CapturedPacket } from '../types';
import { PROTOCOLS } from '../constants';
import { getPorts } from '../stores/portStore';

type PacketListener = (packet: CapturedPacket) => void;

interface MockConfig {
  /** Packets per second */
  rate: number;
  /** Probability of NIC drop (0-1) */
  nicDropRate: number;
  /** Probability of FW drop (0-1) */
  fwDropRate: number;
}

const DEFAULT_CONFIG: MockConfig = {
  rate: 2,
  nicDropRate: 0.1,
  fwDropRate: 0.1,
};

let config: MockConfig = { ...DEFAULT_CONFIG };
let listeners: PacketListener[] = [];
let intervalId: ReturnType<typeof setInterval> | null = null;
let packetCounter = 0;

const MOCK_IPS = [
  '192.168.1.100',
  '10.0.0.50',
  '172.16.0.10',
  '8.8.8.8',
  '1.1.1.1',
  '203.0.113.1',
];

function randomElement<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generatePacket(): AnimatingPacket {
  const ports = getPorts();
  const portInfo = ports[Math.floor(Math.random() * ports.length)];
  const destPort = portInfo.type === 'port' ? portInfo.port : Math.floor(Math.random() * 60000) + 1024;

  return {
    id: `mock-${Date.now()}-${packetCounter++}`,
    protocol: randomElement(PROTOCOLS),
    size: Math.floor(Math.random() * 1400) + 64,
    source: `${randomElement(MOCK_IPS)}:${Math.floor(Math.random() * 60000) + 1024}`,
    destination: `192.168.1.1:${destPort}`,
    destPort,
    timestamp: Date.now(),
  };
}

function determineResult(): PacketResult {
  const rand = Math.random();
  if (rand < config.nicDropRate) {
    return 'nic-drop';
  }
  if (rand < config.nicDropRate + config.fwDropRate) {
    return 'fw-drop';
  }
  return 'delivered';
}

function emitPacket(): void {
  const packet = generatePacket();
  const result = determineResult();
  const captured: CapturedPacket = { packet, result };

  listeners.forEach((listener) => listener(captured));
}

export function startMockCapture(): void {
  if (intervalId) return;

  const interval = config.rate > 0 ? 1000 / config.rate : 1000;
  intervalId = setInterval(emitPacket, interval);
}

export function stopMockCapture(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export function resetMockCapture(): void {
  packetCounter = 0;
}

export function addPacketListener(listener: PacketListener): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function setMockConfig(newConfig: Partial<MockConfig>): void {
  const wasRunning = intervalId !== null;
  if (wasRunning) {
    stopMockCapture();
  }

  config = { ...config, ...newConfig };

  if (wasRunning) {
    startMockCapture();
  }
}

export function getMockConfig(): MockConfig {
  return { ...config };
}

export function isMockRunning(): boolean {
  return intervalId !== null;
}

/** Send a burst of packets for testing stream mode */
export function sendBurst(count: number, intervalMs: number = 50): void {
  let sent = 0;
  const burstInterval = setInterval(() => {
    emitPacket();
    sent++;
    if (sent >= count) {
      clearInterval(burstInterval);
    }
  }, intervalMs);
}
