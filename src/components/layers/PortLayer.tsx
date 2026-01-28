import { Mailbox } from '../port/Mailbox';
import { AnimatedPacket } from '../packet/AnimatedPacket';
import { PacketStream } from '../packet/PacketStream';
import { ScrollHint } from '../common/ScrollHint';
import { useRef, useSyncExternalStore } from 'react';
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

function createPositionStore(
  getAnimationZone: () => HTMLDivElement | null,
  getMailboxRefs: () => (HTMLDivElement | null)[]
): PositionStore {
  let positions: number[] = [];
  const listeners = new Set<() => void>();

  const calculatePositions = () => {
    const zone = getAnimationZone();
    const refs = getMailboxRefs();
    if (!zone) return [];

    const zoneRect = zone.getBoundingClientRect();
    return refs.map((ref) => {
      if (!ref) return 0;
      const rect = ref.getBoundingClientRect();
      return rect.left + rect.width / 2 - zoneRect.left;
    });
  };

  const observer = new ResizeObserver(() => {
    const newPositions = calculatePositions();
    if (JSON.stringify(newPositions) !== JSON.stringify(positions)) {
      positions = newPositions;
      listeners.forEach((l) => l());
    }
  });

  let observing = false;

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);

      if (!observing) {
        const zone = getAnimationZone();
        if (zone) {
          positions = calculatePositions();
          observer.observe(zone);
          // Also observe window resize
          window.addEventListener('resize', () => {
            const newPositions = calculatePositions();
            if (JSON.stringify(newPositions) !== JSON.stringify(positions)) {
              positions = newPositions;
              listeners.forEach((l) => l());
            }
          });
          observing = true;
        }
      }

      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && observing) {
          observer.disconnect();
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
    () => [] // Server snapshot
  );

  return (
    <section className="min-h-screen pt-20 pb-8 px-6 flex flex-col">
      <div className="flex-1 flex flex-col justify-center max-w-4xl mx-auto w-full">
        {/* Mailboxes */}
        <div className="flex flex-wrap justify-center gap-6 md:gap-10 mb-8">
          {ports.map((portInfo, index) => (
            <Mailbox
              key={portInfo.port}
              ref={(el) => {
                mailboxRefs.current[index] = el;
              }}
              port={portInfo.port}
              label={portInfo.label}
              packets={deliveredPackets[index] || []}
              isActive={animatingPackets.some((p) => p.targetPort === index)}
            />
          ))}
        </div>

        {/* Animation zone - packets rising from below */}
        <div ref={animationZoneRef} className="relative h-32">
          {/* Stream mode for high-traffic ports */}
          {streamingPorts.map((portIndex) => (
            <PacketStream key={`stream-${portIndex}`} targetX={mailboxPositions[portIndex] || 0} />
          ))}
          {/* Individual packet animations for normal traffic */}
          {animatingPackets
            .filter((packet) => !streamingPorts.includes(packet.targetPort || 0))
            .map((packet) => (
              <AnimatedPacket
                key={packet.id}
                id={packet.id}
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
