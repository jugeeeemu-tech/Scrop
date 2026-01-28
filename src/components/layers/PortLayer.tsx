import { Mailbox } from '../port/Mailbox';
import { AddMailbox } from '../port/AddMailbox';
import { AnimatedPacket } from '../packet/AnimatedPacket';
import { PacketStream } from '../packet/PacketStream';
import { StreamFadeOut } from '../packet/StreamFadeOut';
import { ScrollHint } from '../common/ScrollHint';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { AnimatingPacket, PortInfo } from '../../types';
import { ETC_PORT_KEY, getPortKey } from '../../constants';

interface PortLayerProps {
  ports: PortInfo[];
  deliveredPackets: Record<number, AnimatingPacket[]>;
  deliveredCounterPerPort: Record<number, number>;
  animatingPackets: AnimatingPacket[];
  onAnimationComplete: (packetId: string, targetPort: number) => void;
  streamingPorts?: number[];
  editingIndex: number | null;
  editingField: 'port' | 'label' | null;
  onAddPort: () => void;
  onPortChange: (index: number, port: number) => void;
  onLabelChange: (index: number, label: string) => void;
  onStartEdit: (index: number, field: 'port' | 'label') => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  onRemovePort: (index: number) => void;
}

interface PositionStore {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => number[];
  recalculate: () => void;
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
    recalculate: updatePositions,
  };
}

export function PortLayer({
  ports,
  deliveredPackets,
  deliveredCounterPerPort,
  animatingPackets,
  onAnimationComplete,
  streamingPorts = [],
  editingIndex,
  editingField,
  onAddPort,
  onPortChange,
  onLabelChange,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onRemovePort,
}: PortLayerProps) {
  const mailboxRefs = useRef<(HTMLDivElement | null)[]>([]);
  const animationZoneRef = useRef<HTMLDivElement>(null);
  const storeRef = useRef<PositionStore | null>(null);
  const recalcRAF = useRef<number>(0);

  // Keep ref array length in sync with ports
  mailboxRefs.current.length = ports.length;

  if (!storeRef.current) {
    storeRef.current = createPositionStore(
      () => animationZoneRef.current,
      () => mailboxRefs.current
    );
  }

  const setMailboxRef = (index: number, el: HTMLDivElement | null) => {
    mailboxRefs.current[index] = el;
    // Schedule recalculation after DOM layout settles
    cancelAnimationFrame(recalcRAF.current);
    recalcRAF.current = requestAnimationFrame(() => {
      storeRef.current?.recalculate();
    });
  };

  const mailboxPositions = useSyncExternalStore(
    storeRef.current.subscribe,
    storeRef.current.getSnapshot,
    () => EMPTY_POSITIONS // Server snapshot - must return same reference
  );

  // Helper: ポートキーから配列インデックスへの逆変換
  const portKeyToIndex = (portKey: number): number => {
    if (portKey === ETC_PORT_KEY) {
      return ports.findIndex((p) => p.type === 'etc');
    }
    return ports.findIndex((p) => p.type === 'port' && p.port === portKey);
  };

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

  // Find the etc index to insert AddMailbox before it
  const etcIndex = ports.findIndex((p) => p.type === 'etc');

  return (
    <section className="min-h-screen pt-20 pb-8 px-6 flex flex-col">
      <div className="flex-1 flex flex-col justify-center max-w-4xl mx-auto w-full">
        {/* Mailboxes */}
        <div className="flex flex-wrap justify-center gap-6 md:gap-10 mb-8">
          {ports.map((portInfo, index) => {
            // Insert AddMailbox before etc
            const isEtc = portInfo.type === 'etc';

            return (
              <div key={portInfo.type === 'port' ? (portInfo.port === 0 ? `new-${index}` : portInfo.port) : 'etc'} className="flex gap-6 md:gap-10">
                {isEtc && index === etcIndex && (
                  <AddMailbox onClick={onAddPort} />
                )}
                <Mailbox
                  ref={(el) => setMailboxRef(index, el)}
                  portInfo={portInfo}
                  packets={deliveredPackets[getPortKey(portInfo)] || []}
                  packetCount={deliveredCounterPerPort[getPortKey(portInfo)] || 0}
                  isActive={
                    animatingPackets.some((p) => p.targetPort === getPortKey(portInfo)) ||
                    streamingPorts.includes(getPortKey(portInfo))
                  }
                  isEditing={editingIndex === index}
                  editingField={editingIndex === index ? editingField : null}
                  onPortChange={(port) => onPortChange(index, port)}
                  onLabelChange={(label) => onLabelChange(index, label)}
                  onStartEdit={(field) => onStartEdit(index, field)}
                  onCommitEdit={onCommitEdit}
                  onCancelEdit={onCancelEdit}
                  onRemove={isEtc ? undefined : () => onRemovePort(index)}
                />
              </div>
            );
          })}
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
              <PacketStream targetX={mailboxPositions[portKeyToIndex(port)] || 0} />
            </StreamFadeOut>
          ))}
          {/* Individual packet animations */}
          {animatingPackets.map((packet) => (
              <AnimatedPacket
                key={packet.id}
                targetX={mailboxPositions[portKeyToIndex(packet.targetPort ?? ETC_PORT_KEY)] || 0}
                onComplete={() => onAnimationComplete(packet.id, packet.targetPort ?? ETC_PORT_KEY)}
              />
            ))}
        </div>
      </div>

      {/* Scroll hint */}
      <ScrollHint />
    </section>
  );
}
