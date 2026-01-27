import { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from './components/layout/Header';
import { PortLayer } from './components/layers/PortLayer';
import { FWLayer } from './components/layers/FWLayer';
import { NICLayer } from './components/layers/NICLayer';

const PORTS = [
  { port: 80, label: 'HTTP' },
  { port: 443, label: 'HTTPS' },
  { port: 22, label: 'SSH' },
  { port: 3306, label: 'MySQL' },
  { port: 8080, label: 'Proxy' },
];

const PROTOCOLS = ['TCP', 'UDP', 'HTTP', 'HTTPS', 'SSH'];

// Animation threshold - switch to stream mode when exceeded
const MAX_ANIMATING_PACKETS = 5;

interface Packet {
  id: string;
  protocol: string;
  size: number;
  source: string;
  destination: string;
  targetPort?: number;
  reason?: string;
  timestamp: number;
}

const generatePacket = (id: number): Packet => ({
  id: `pkt-${id}-${Math.random().toString(36).slice(2, 8)}`,
  protocol: PROTOCOLS[Math.floor(Math.random() * PROTOCOLS.length)],
  size: Math.floor(Math.random() * 1500) + 64,
  source: `192.168.1.${Math.floor(Math.random() * 255)}`,
  destination: `10.0.0.${Math.floor(Math.random() * 255)}`,
  targetPort: Math.floor(Math.random() * PORTS.length),
  timestamp: Date.now(),
});

function App() {
  const [isCapturing, setIsCapturing] = useState(true);
  const [packetCounter, setPacketCounter] = useState(0);
  const [deliveredPackets, setDeliveredPackets] = useState<Record<number, Packet[]>>({
    0: [],
    1: [],
    2: [],
    3: [],
    4: [],
  });
  const [firewallDropped, setFirewallDropped] = useState<Packet[]>([]);
  const [nicDropped, setNicDropped] = useState<Packet[]>([]);

  // Animation states
  const [nicToFwPackets, setNicToFwPackets] = useState<Packet[]>([]);
  const [fwToPortPackets, setFwToPortPackets] = useState<Packet[]>([]);
  const [nicDropAnimations, setNicDropAnimations] = useState<Packet[]>([]);
  const [fwDropAnimations, setFwDropAnimations] = useState<Packet[]>([]);

  const [nicActive, setNicActive] = useState(false);
  const [fwActive, setFwActive] = useState(false);

  // Determine streaming ports based on animation count threshold
  const streamingPorts = useMemo(() => {
    if (fwToPortPackets.length < MAX_ANIMATING_PACKETS) {
      return [];
    }
    // Count packets per port
    const portCounts: Record<number, number> = {};
    fwToPortPackets.forEach((p) => {
      const port = p.targetPort ?? 0;
      portCounts[port] = (portCounts[port] || 0) + 1;
    });
    // Return ports with 2+ packets (they're getting busy)
    return Object.entries(portCounts)
      .filter(([, count]) => count >= 2)
      .map(([port]) => Number(port));
  }, [fwToPortPackets]);

  useEffect(() => {
    if (!isCapturing) return;

    const interval = setInterval(() => {
      const packet = generatePacket(packetCounter);
      const random = Math.random();

      // Flash NIC active
      setNicActive(true);
      setTimeout(() => setNicActive(false), 300);

      if (random < 0.1) {
        // Dropped at NIC - animate bounce
        setNicDropAnimations((prev) => [...prev, { ...packet, reason: 'Buffer overflow' }]);
        setNicDropped((prev) => [...prev.slice(-49), { ...packet, reason: 'Buffer overflow' }]);
      } else if (random < 0.25) {
        // Will be dropped at Firewall - first animate NIC to FW
        setNicToFwPackets((prev) => [...prev, packet]);

        setTimeout(() => {
          setFwActive(true);
          setTimeout(() => setFwActive(false), 300);

          setFwDropAnimations((prev) => [...prev, { ...packet, reason: 'Blocked by rule' }]);
          setFirewallDropped((prev) => [...prev.slice(-49), { ...packet, reason: 'Blocked by rule' }]);
        }, 700);
      } else {
        // Delivered successfully - animate through layers
        setNicToFwPackets((prev) => [...prev, packet]);

        setTimeout(() => {
          setFwActive(true);
          setTimeout(() => setFwActive(false), 300);

          // Check if this port is in stream mode - if so, skip individual animation
          setFwToPortPackets((prev) => {
            const isStreamMode = prev.length >= MAX_ANIMATING_PACKETS;
            if (isStreamMode) {
              // Skip animation, directly add to delivered
              const targetPort = packet.targetPort ?? 0;
              setDeliveredPackets((d) => ({
                ...d,
                [targetPort]: [...(d[targetPort] || []).slice(-19), packet],
              }));
              return prev;
            }
            return [...prev, packet];
          });
        }, 700);
      }

      setPacketCounter((prev) => prev + 1);
    }, 2000);

    return () => clearInterval(interval);
  }, [isCapturing, packetCounter]);

  const handleNicToFwComplete = useCallback((packetId: string) => {
    setNicToFwPackets((prev) => prev.filter((p) => p.id !== packetId));
  }, []);

  const handleFwToPortComplete = useCallback((packetId: string, targetPort: number) => {
    setFwToPortPackets((prev) => {
      const packet = prev.find((p) => p.id === packetId);
      if (packet) {
        setDeliveredPackets((d) => ({
          ...d,
          [targetPort]: [...(d[targetPort] || []).slice(-19), packet],
        }));
      }
      return prev.filter((p) => p.id !== packetId);
    });
  }, []);

  const handleDropAnimationComplete = useCallback((packetId: string, layer: 'nic' | 'fw') => {
    if (layer === 'nic') {
      setNicDropAnimations((prev) => prev.filter((p) => p.id !== packetId));
    } else {
      setFwDropAnimations((prev) => prev.filter((p) => p.id !== packetId));
    }
  }, []);

  const clearAll = () => {
    setDeliveredPackets({ 0: [], 1: [], 2: [], 3: [], 4: [] });
    setFirewallDropped([]);
    setNicDropped([]);
    setPacketCounter(0);
    setNicToFwPackets([]);
    setFwToPortPackets([]);
    setNicDropAnimations([]);
    setFwDropAnimations([]);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header
        isCapturing={isCapturing}
        packetCount={packetCounter}
        onToggleCapture={() => setIsCapturing(!isCapturing)}
        onReset={clearAll}
      />

      <main>
        {/* Application Layer - Ports/Mailboxes */}
        <PortLayer
          ports={PORTS}
          deliveredPackets={deliveredPackets}
          animatingPackets={fwToPortPackets}
          onAnimationComplete={handleFwToPortComplete}
          streamingPorts={streamingPorts}
        />

        {/* Firewall Layer */}
        <FWLayer
          droppedPackets={firewallDropped}
          isActive={fwActive}
          dropAnimations={fwDropAnimations}
          risingPackets={nicToFwPackets}
          onDropAnimationComplete={(id) => handleDropAnimationComplete(id, 'fw')}
          onRisingComplete={handleNicToFwComplete}
        />

        {/* NIC Layer */}
        <NICLayer
          droppedPackets={nicDropped}
          isActive={nicActive}
          dropAnimations={nicDropAnimations}
          onDropAnimationComplete={(id) => handleDropAnimationComplete(id, 'nic')}
        />
      </main>

      {/* Footer */}
      <footer className="py-6 px-6 border-t border-border bg-background">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs text-muted-foreground">Scroll up to return to Application Layer</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
