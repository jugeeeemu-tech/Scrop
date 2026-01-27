import { useState, useEffect, useCallback, useMemo } from 'react';
import type { AnimatingPacket, PortInfo } from '../types';
import {
  LAYER_TRANSITION_DURATION,
  LAYER_ACTIVE_FLASH_DURATION,
  MAX_ANIMATING_PACKETS,
  MAX_STORED_DROPPED_PACKETS,
  MAX_STORED_DELIVERED_PACKETS,
  PACKET_GENERATION_INTERVAL,
  PROTOCOLS,
} from '../constants';

interface UsePacketAnimationOptions {
  isCapturing: boolean;
  ports: readonly PortInfo[];
}

interface UsePacketAnimationResult {
  // Packet counter
  packetCounter: number;

  // Stored packets
  deliveredPackets: Record<number, AnimatingPacket[]>;
  firewallDropped: AnimatingPacket[];
  nicDropped: AnimatingPacket[];

  // Animation states
  incomingPackets: AnimatingPacket[];
  nicToFwPackets: AnimatingPacket[];
  fwToPortPackets: AnimatingPacket[];
  nicDropAnimations: AnimatingPacket[];
  fwDropAnimations: AnimatingPacket[];

  // Layer active states
  nicActive: boolean;
  fwActive: boolean;

  // Stream mode states
  streamingPorts: number[];
  nicDropStreamMode: boolean;
  fwDropStreamMode: boolean;

  // Callbacks
  handleIncomingComplete: (packetId: string) => void;
  handleNicToFwComplete: (packetId: string) => void;
  handleFwToPortComplete: (packetId: string, targetPort: number) => void;
  handleDropAnimationComplete: (packetId: string, layer: 'nic' | 'fw') => void;
  clearAll: () => void;
}

function generatePacket(id: number, portCount: number): AnimatingPacket {
  return {
    id: `pkt-${id}-${Math.random().toString(36).slice(2, 8)}`,
    protocol: PROTOCOLS[Math.floor(Math.random() * PROTOCOLS.length)],
    size: Math.floor(Math.random() * 1500) + 64,
    source: `192.168.1.${Math.floor(Math.random() * 255)}`,
    destination: `10.0.0.${Math.floor(Math.random() * 255)}`,
    targetPort: Math.floor(Math.random() * portCount),
    timestamp: Date.now(),
  };
}

function createInitialDeliveredPackets(portCount: number): Record<number, AnimatingPacket[]> {
  const result: Record<number, AnimatingPacket[]> = {};
  for (let i = 0; i < portCount; i++) {
    result[i] = [];
  }
  return result;
}

export function usePacketAnimation({
  isCapturing,
  ports,
}: UsePacketAnimationOptions): UsePacketAnimationResult {
  const [packetCounter, setPacketCounter] = useState(0);
  const [deliveredPackets, setDeliveredPackets] = useState<Record<number, AnimatingPacket[]>>(
    () => createInitialDeliveredPackets(ports.length)
  );
  const [firewallDropped, setFirewallDropped] = useState<AnimatingPacket[]>([]);
  const [nicDropped, setNicDropped] = useState<AnimatingPacket[]>([]);

  // Animation states
  const [incomingPackets, setIncomingPackets] = useState<AnimatingPacket[]>([]);
  const [nicToFwPackets, setNicToFwPackets] = useState<AnimatingPacket[]>([]);
  const [fwToPortPackets, setFwToPortPackets] = useState<AnimatingPacket[]>([]);
  const [nicDropAnimations, setNicDropAnimations] = useState<AnimatingPacket[]>([]);
  const [fwDropAnimations, setFwDropAnimations] = useState<AnimatingPacket[]>([]);

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

  // Determine drop stream mode for NIC and FW layers
  const nicDropStreamMode = nicDropAnimations.length >= MAX_ANIMATING_PACKETS;
  const fwDropStreamMode = fwDropAnimations.length >= MAX_ANIMATING_PACKETS;

  useEffect(() => {
    if (!isCapturing) return;

    const interval = setInterval(() => {
      const packet = generatePacket(packetCounter, ports.length);
      const random = Math.random();

      // First, start incoming animation (external -> NIC)
      setIncomingPackets((prev) => [...prev, packet]);

      // After incoming animation completes, process at NIC
      setTimeout(() => {
        // Flash NIC active
        setNicActive(true);
        setTimeout(() => setNicActive(false), LAYER_ACTIVE_FLASH_DURATION);

        if (random < 0.1) {
          // Dropped at NIC - animate bounce
          setNicDropAnimations((prev) => [...prev, { ...packet, reason: 'Buffer overflow' }]);
          setNicDropped((prev) => [
            ...prev.slice(-(MAX_STORED_DROPPED_PACKETS - 1)),
            { ...packet, reason: 'Buffer overflow' },
          ]);
        } else if (random < 0.25) {
          // Will be dropped at Firewall - first animate NIC to FW
          setNicToFwPackets((prev) => [...prev, packet]);

          setTimeout(() => {
            setFwActive(true);
            setTimeout(() => setFwActive(false), LAYER_ACTIVE_FLASH_DURATION);

            setFwDropAnimations((prev) => [...prev, { ...packet, reason: 'Blocked by rule' }]);
            setFirewallDropped((prev) => [
              ...prev.slice(-(MAX_STORED_DROPPED_PACKETS - 1)),
              { ...packet, reason: 'Blocked by rule' },
            ]);
          }, LAYER_TRANSITION_DURATION);
        } else {
          // Delivered successfully - animate through layers
          setNicToFwPackets((prev) => [...prev, packet]);

          setTimeout(() => {
            setFwActive(true);
            setTimeout(() => setFwActive(false), LAYER_ACTIVE_FLASH_DURATION);

            // Check if this port is in stream mode - if so, skip individual animation
            setFwToPortPackets((prev) => {
              const isStreamMode = prev.length >= MAX_ANIMATING_PACKETS;
              if (isStreamMode) {
                // Skip animation, directly add to delivered
                const targetPort = packet.targetPort ?? 0;
                setDeliveredPackets((d) => ({
                  ...d,
                  [targetPort]: [
                    ...(d[targetPort] || []).slice(-(MAX_STORED_DELIVERED_PACKETS - 1)),
                    packet,
                  ],
                }));
                return prev;
              }
              return [...prev, packet];
            });
          }, LAYER_TRANSITION_DURATION);
        }
      }, LAYER_TRANSITION_DURATION);

      setPacketCounter((prev) => prev + 1);
    }, PACKET_GENERATION_INTERVAL);

    return () => clearInterval(interval);
  }, [isCapturing, packetCounter, ports.length]);

  const handleIncomingComplete = useCallback((packetId: string) => {
    setIncomingPackets((prev) => prev.filter((p) => p.id !== packetId));
  }, []);

  const handleNicToFwComplete = useCallback((packetId: string) => {
    setNicToFwPackets((prev) => prev.filter((p) => p.id !== packetId));
  }, []);

  const handleFwToPortComplete = useCallback((packetId: string, targetPort: number) => {
    setFwToPortPackets((prev) => {
      const packet = prev.find((p) => p.id === packetId);
      if (packet) {
        setDeliveredPackets((d) => ({
          ...d,
          [targetPort]: [
            ...(d[targetPort] || []).slice(-(MAX_STORED_DELIVERED_PACKETS - 1)),
            packet,
          ],
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

  const clearAll = useCallback(() => {
    setDeliveredPackets(createInitialDeliveredPackets(ports.length));
    setFirewallDropped([]);
    setNicDropped([]);
    setPacketCounter(0);
    setIncomingPackets([]);
    setNicToFwPackets([]);
    setFwToPortPackets([]);
    setNicDropAnimations([]);
    setFwDropAnimations([]);
  }, [ports.length]);

  return {
    packetCounter,
    deliveredPackets,
    firewallDropped,
    nicDropped,
    incomingPackets,
    nicToFwPackets,
    fwToPortPackets,
    nicDropAnimations,
    fwDropAnimations,
    nicActive,
    fwActive,
    streamingPorts,
    nicDropStreamMode,
    fwDropStreamMode,
    handleIncomingComplete,
    handleNicToFwComplete,
    handleFwToPortComplete,
    handleDropAnimationComplete,
    clearAll,
  };
}
