import { Mailbox } from '../port/Mailbox';
import { AddMailbox } from '../port/AddMailbox';
import { AnimatedPacket } from '../packet/AnimatedPacket';
import { PacketStream } from '../packet/PacketStream';
import { StreamFadeOut } from '../packet/StreamFadeOut';
import { ScrollHint } from '../common/ScrollHint';
import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import { Reorder, useMotionValue, useTransform } from 'framer-motion';
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
  onReorderPorts: (newOrder: PortInfo[]) => void;
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

const DELETE_Y_THRESHOLD = 100;

interface DraggableMailboxProps {
  portInfo: PortInfo;
  editingKey: string | number;
  onRemove: () => void;
  mailboxRef: (el: HTMLDivElement | null) => void;
  packets: AnimatingPacket[];
  packetCount: number;
  isActive: boolean;
  isEditing: boolean;
  editingField: 'port' | 'label' | null;
  onPortChange: (port: number) => void;
  onLabelChange: (label: string) => void;
  onStartEdit: (field: 'port' | 'label') => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
}

function DraggableMailbox({
  portInfo,
  editingKey,
  onRemove,
  mailboxRef,
  ...mailboxProps
}: DraggableMailboxProps) {
  const y = useMotionValue(0);
  const opacity = useTransform(
    y,
    [-DELETE_Y_THRESHOLD * 1.5, -DELETE_Y_THRESHOLD, 0, DELETE_Y_THRESHOLD, DELETE_Y_THRESHOLD * 1.5],
    [0.2, 0.5, 1, 0.5, 0.2]
  );
  const wasDragged = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleClickCapture = useCallback((e: React.MouseEvent) => {
    if (wasDragged.current) {
      e.stopPropagation();
      e.preventDefault();
      wasDragged.current = false;
    }
  }, []);

  return (
    <Reorder.Item
      key={editingKey}
      as="div"
      value={portInfo}
      drag
      style={{ y, opacity, position: 'relative' }}
      animate={{
        scale: isDragging ? 1.05 : 1,
        boxShadow: isDragging ? '0 8px 25px rgba(0,0,0,0.15)' : '0 0px 0px rgba(0,0,0,0)',
      }}
      transition={{ duration: 0.2 }}
      onDragStart={() => {
        wasDragged.current = true;
        setIsDragging(true);
      }}
      onDragEnd={(_, info) => {
        setIsDragging(false);
        if (
          Math.abs(info.offset.y) > DELETE_Y_THRESHOLD ||
          Math.abs(info.velocity.y) > 500
        ) {
          onRemove();
        }
      }}
      onClickCapture={handleClickCapture}
      className=""
    >
      <Mailbox ref={mailboxRef} portInfo={portInfo} isDraggable {...mailboxProps} />
    </Reorder.Item>
  );
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
  onReorderPorts,
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

  // Separate draggable ports from etc
  const draggablePorts = ports.filter((p) => p.type !== 'etc');
  const etcPort = ports.find((p) => p.type === 'etc');
  const etcIndex = ports.findIndex((p) => p.type === 'etc');

  return (
    <section className="min-h-screen pt-20 pb-8 px-6 flex flex-col">
      <div className="flex-1 flex flex-col justify-center max-w-4xl mx-auto w-full">
        {/* Mailboxes */}
        <div className="flex flex-wrap justify-center gap-6 md:gap-10 mb-8">
          <Reorder.Group
            as="div"
            axis="x"
            values={draggablePorts}
            onReorder={onReorderPorts}
            style={{ display: 'contents' }}
          >
            {draggablePorts.map((portInfo) => {
              const index = ports.indexOf(portInfo);
              const editingKey = editingIndex === index
                ? `editing-${index}`
                : (portInfo.type === 'port' ? (portInfo.port === 0 ? `new-${index}` : portInfo.port) : 'etc');

              return (
                <DraggableMailbox
                  key={editingKey}
                  editingKey={editingKey}
                  portInfo={portInfo}
                  mailboxRef={(el) => setMailboxRef(index, el)}
                  onRemove={() => onRemovePort(index)}
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
                />
              );
            })}
          </Reorder.Group>
          <AddMailbox onClick={onAddPort} />
          {etcPort && (
            <Mailbox
              ref={(el) => setMailboxRef(etcIndex, el)}
              portInfo={etcPort}
              packets={deliveredPackets[getPortKey(etcPort)] || []}
              packetCount={deliveredCounterPerPort[getPortKey(etcPort)] || 0}
              isActive={
                animatingPackets.some((p) => p.targetPort === getPortKey(etcPort)) ||
                streamingPorts.includes(getPortKey(etcPort))
              }
              isEditing={false}
              editingField={null}
              onCommitEdit={onCommitEdit}
              onCancelEdit={onCancelEdit}
            />
          )}
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
