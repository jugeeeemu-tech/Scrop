import { useState, useEffect, useCallback, useMemo } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import type { AnimatingPacket, CapturedPacket, PortInfo } from '../types';
import {
  LAYER_ACTIVE_FLASH_DURATION,
  LAYER_TRANSITION_DURATION,
  MAX_ANIMATING_PACKETS,
  MAX_STORED_DROPPED_PACKETS,
  MAX_STORED_DELIVERED_PACKETS,
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

  // Start/stop capture via Tauri commands
  useEffect(() => {
    if (isCapturing) {
      invoke('start_capture').catch((err) => {
        console.error('Failed to start capture:', err);
      });
    } else {
      invoke('stop_capture').catch((err) => {
        console.error('Failed to stop capture:', err);
      });
    }
  }, [isCapturing]);

  // Listen to single Tauri event and schedule animations with setTimeout
  useEffect(() => {
    const unlisteners: UnlistenFn[] = [];

    listen<CapturedPacket>('packet:captured', (event) => {
      const { packet, result } = event.payload;

      // 1. Start incoming animation immediately
      setIncomingPackets((prev) => [...prev, packet]);
      setPacketCounter((prev) => prev + 1);

      // 2. After LAYER_TRANSITION_DURATION, process at NIC
      setTimeout(() => {
        setNicActive(true);
        setTimeout(() => setNicActive(false), LAYER_ACTIVE_FLASH_DURATION);

        if (result === 'nic-drop') {
          // NIC drop animation
          setNicDropAnimations((prev) => [...prev, packet]);
          setNicDropped((prev) => [...prev.slice(-(MAX_STORED_DROPPED_PACKETS - 1)), packet]);
        } else {
          // Move to FW
          setNicToFwPackets((prev) => [...prev, packet]);

          // 3. After another delay, process at FW
          setTimeout(() => {
            setFwActive(true);
            setTimeout(() => setFwActive(false), LAYER_ACTIVE_FLASH_DURATION);

            if (result === 'fw-drop') {
              // FW drop animation
              setFwDropAnimations((prev) => [...prev, packet]);
              setFirewallDropped((prev) => [
                ...prev.slice(-(MAX_STORED_DROPPED_PACKETS - 1)),
                packet,
              ]);
            } else {
              // Delivered - check stream mode
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
            }
          }, LAYER_TRANSITION_DURATION);
        }
      }, LAYER_TRANSITION_DURATION);
    }).then((unlisten) => unlisteners.push(unlisten));

    return () => {
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, []);

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
    invoke('reset_capture').catch((err) => {
      console.error('Failed to reset capture:', err);
    });
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
