import { AnimatedPacket } from '../packet/AnimatedPacket';
import { PacketStream } from '../packet/PacketStream';
import { StreamFadeOut } from '../packet/StreamFadeOut';
import { useState } from 'react';
import type { PortInfo } from '../../types';
import { ETC_PORT_KEY } from '../../constants';
import { usePortLayerStore } from '../../hooks/usePortLayerStore';
import { handleFwToPortComplete } from '../../stores/packetStore';

interface PortAnimationZoneProps {
  ports: PortInfo[];
  animationZoneRef: React.RefObject<HTMLDivElement | null>;
  mailboxPositions: number[];
}

export function PortAnimationZone({ ports, animationZoneRef, mailboxPositions }: PortAnimationZoneProps) {
  const { fwToPortPackets: animatingPackets, streamingPorts } = usePortLayerStore();

  // Helper: ポートキーから配列インデックスへの逆変換 (Map で O(1) ルックアップ)
  const portKeyToIndexMap = new Map<number, number>();
  ports.forEach((p, i) => {
    portKeyToIndexMap.set(p.type === 'port' ? p.port : ETC_PORT_KEY, i);
  });
  const portKeyToIndex = (portKey: number) => portKeyToIndexMap.get(portKey) ?? -1;
  const toMailboxTestId = (portKey: number) => (portKey === ETC_PORT_KEY ? 'mailbox-etc' : `mailbox-${portKey}`);
  const resolveTargetX = (portKey: number): number | null => {
    // Prefer live DOM coordinates during drag/remove, because ref-index mapping can
    // be transiently stale while mailboxes are being re-bound.
    const zone = animationZoneRef.current;
    if (zone) {
      const mailboxEl = document.querySelector(`[data-testid="${toMailboxTestId(portKey)}"]`) as HTMLElement | null;
      if (mailboxEl) {
        const zoneRect = zone.getBoundingClientRect();
        const rect = mailboxEl.getBoundingClientRect();
        const pos = rect.left + rect.width / 2 - zoneRect.left;
        if (Number.isFinite(pos) && pos > 0) {
          return pos;
        }
      }
    }

    const idx = portKeyToIndex(portKey);
    if (idx < 0) return null;
    const pos = mailboxPositions[idx];
    return typeof pos === 'number' && Number.isFinite(pos) && pos > 0 ? pos : null;
  };

  // Track ports that need visible stream (active or fading out)
  const [visibleStreamPorts, setVisibleStreamPorts] = useState<number[]>([]);
  const [prevStreamingPorts, setPrevStreamingPorts] = useState(streamingPorts);

  if (streamingPorts !== prevStreamingPorts) {
    setPrevStreamingPorts(streamingPorts);
    const combined = [...new Set([...visibleStreamPorts, ...streamingPorts])];
    if (combined.length !== visibleStreamPorts.length || !combined.every((p, i) => p === visibleStreamPorts[i])) {
      setVisibleStreamPorts(combined);
    }
  }

  const handleFadeComplete = (port: number) => {
    setVisibleStreamPorts((prev) => prev.filter((p) => p !== port));
  };

  return (
    <div ref={animationZoneRef} className="relative h-32">
      {/* Stream mode: show fading streams for ports that are active or fading */}
      {visibleStreamPorts.map((port) => {
        const targetX = resolveTargetX(port);
        if (targetX === null) return null;
        return (
          <StreamFadeOut
            key={`stream-${port}`}
            active={streamingPorts.includes(port)}
            onFadeComplete={() => handleFadeComplete(port)}
          >
            <PacketStream targetX={targetX} />
          </StreamFadeOut>
        );
      })}
      {/* Individual packet animations */}
      {animatingPackets.map((packet) => {
        const targetPort = packet.targetPort ?? ETC_PORT_KEY;
        const targetX = resolveTargetX(targetPort);
        if (targetX === null) return null;
        return (
          <AnimatedPacket
            key={packet.id}
            targetX={targetX}
            onComplete={() => handleFwToPortComplete(packet.id, targetPort)}
          />
        );
      })}
    </div>
  );
}
