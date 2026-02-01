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
      {visibleStreamPorts.map((port) => (
        <StreamFadeOut
          key={`stream-${port}`}
          active={streamingPorts.includes(port)}
          onFadeComplete={() => handleFadeComplete(port)}
        >
          <PacketStream targetX={mailboxPositions[portKeyToIndex(port)] || 0} />
        </StreamFadeOut>
      ))}
      {/* Individual packet animations */}
      {animatingPackets.map((packet) => (
        <AnimatedPacket
          key={packet.id}
          targetX={mailboxPositions[portKeyToIndex(packet.targetPort ?? ETC_PORT_KEY)] || 0}
          onComplete={() => handleFwToPortComplete(packet.id, packet.targetPort ?? ETC_PORT_KEY)}
        />
      ))}
    </div>
  );
}
