import { Mailbox } from '../port/Mailbox';
import { AnimatedPacket } from '../packet/AnimatedPacket';
import { PacketStream } from '../packet/PacketStream';
import { StreamFadeOut } from '../packet/StreamFadeOut';
import { ScrollHint } from '../common/ScrollHint';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { AnimatingPacket, PortInfo } from '../../types';

interface PortLayerProps {
  ports: readonly PortInfo[];
  deliveredPackets: Record<number, AnimatingPacket[]>;
  animatingPackets: AnimatingPacket[];
  onAnimationComplete: (packetId: string, targetPort: number) => void;
  streamingPorts?: number[];
}

interface PositionStore {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => number[];
}

// Module-level constant to avoid creating new empty array on each getSnapshot call
const EMPTY_POSITIONS: number[] = [];

function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function createPositionStore(
  getAnimationZone: () => HTMLDivElement | null,
  getMailboxRefs: () => (HTMLDivElement | null)[]
): PositionStore {
  let positions: number[] = EMPTY_POSITIONS;
  const listeners = new Set<() => void>();

  const calculatePositions = () => {
    const zone = getAnimationZone();
    const refs = getMailboxRefs();
    if (!zone) return EMPTY_POSITIONS;

    const zoneRect = zone.getBoundingClientRect();
    return refs.map((ref) => {
      if (!ref) return 0;
      const rect = ref.getBoundingClientRect();
      return rect.left + rect.width / 2 - zoneRect.left;
    });
  };

  const updatePositions = () => {
    const newPositions = calculatePositions();
    if (!arraysEqual(newPositions, positions)) {
      positions = newPositions;
      listeners.forEach((l) => l());
    }
  };

  const observer = new ResizeObserver(updatePositions);

  let observing = false;

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);

      if (!observing) {
        const zone = getAnimationZone();
        if (zone) {
          positions = calculatePositions();
          observer.observe(zone);
          window.addEventListener('resize', updatePositions);
          observing = true;
        }
      }

      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && observing) {
          observer.disconnect();
          window.removeEventListener('resize', updatePositions);
          observing = false;
        }
      };
    },
    getSnapshot() {
      if (positions.length === 0) {
        positions = calculatePositions();
      }
      return positions;
    },
  };
}

export function PortLayer({
  ports,
  deliveredPackets,
  animatingPackets,
  onAnimationComplete,
  streamingPorts = [],
}: PortLayerProps) {
  const mailboxRefs = useRef<(HTMLDivElement | null)[]>([]);
  const animationZoneRef = useRef<HTMLDivElement>(null);
  const storeRef = useRef<PositionStore | null>(null);

  if (!storeRef.current) {
    storeRef.current = createPositionStore(
      () => animationZoneRef.current,
      () => mailboxRefs.current
    );
  }

  const mailboxPositions = useSyncExternalStore(
    storeRef.current.subscribe,
    storeRef.current.getSnapshot,
    () => EMPTY_POSITIONS // Server snapshot - must return same reference
  );

  // Track ports that need visible stream (active or fading out)
  const [visibleStreamPorts, setVisibleStreamPorts] = useState<number[]>([]);

  useEffect(() => {
    setVisibleStreamPorts((prev) => {
      // Merge: keep ports already visible + add new streaming ports
      const combined = [...new Set([...prev, ...streamingPorts])];
      if (combined.length === prev.length && combined.every((p, i) => p === prev[i])) {
        return prev;
      }
      return combined;
    });
  }, [streamingPorts]);

  const handleFadeComplete = (port: number) => {
    setVisibleStreamPorts((prev) => prev.filter((p) => p !== port));
  };

  return (
    <section className="min-h-screen pt-20 pb-8 px-6 flex flex-col">
      <div className="flex-1 flex flex-col justify-center max-w-4xl mx-auto w-full">
        {/* Mailboxes */}
        <div className="flex flex-wrap justify-center gap-6 md:gap-10 mb-8">
          {ports.map((portInfo, index) => (
            <Mailbox
              key={portInfo.type === 'port' ? portInfo.port : 'etc'}
              ref={(el) => {
                mailboxRefs.current[index] = el;
              }}
              portInfo={portInfo}
              packets={deliveredPackets[index] || []}
              isActive={animatingPackets.some((p) => p.targetPort === index)}
            />
          ))}
        </div>

        {/* Animation zone - packets rising from below */}
        <div ref={animationZoneRef} className="relative h-32">
          {/* Stream mode: show fading streams for ports that are active or fading */}
          {visibleStreamPorts.map((port) => (
            <StreamFadeOut
              key={`stream-${port}`}
              active={streamingPorts.includes(port)}
              onFadeComplete={() => handleFadeComplete(port)}
            >
              <PacketStream targetX={mailboxPositions[port] || 0} />
            </StreamFadeOut>
          ))}
          {/* Individual packet animations - skip for actively streaming ports */}
          {animatingPackets
            .filter((packet) => !streamingPorts.includes(packet.targetPort || 0))
            .map((packet) => (
              <AnimatedPacket
                key={packet.id}
                targetX={mailboxPositions[packet.targetPort || 0] || 0}
                onComplete={() => onAnimationComplete(packet.id, packet.targetPort || 0)}
              />
            ))}
        </div>
      </div>

      {/* Scroll hint */}
      <ScrollHint />
    </section>
  );
}
