import { Mailbox } from '../port/Mailbox';
import { AddMailbox } from '../port/AddMailbox';
import { DraggableMailbox } from '../port/DraggableMailbox';
import { AnimatedPacket } from '../packet/AnimatedPacket';
import { PacketStream } from '../packet/PacketStream';
import { StreamFadeOut } from '../packet/StreamFadeOut';
import { ScrollHint } from '../common/ScrollHint';
import { useRef, useState } from 'react';
import { Reorder } from 'framer-motion';
import type { AnimatingPacket, PortInfo } from '../../types';
import { ETC_PORT_KEY, getPortKey } from '../../constants';
import { usePortPositionStore } from '../../hooks';

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
  const animationZoneRef = useRef<HTMLDivElement>(null);
  const { mailboxPositions, setMailboxRef } = usePortPositionStore(animationZoneRef, ports.length);

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
    <section data-testid="port-layer" className="min-h-screen pt-20 pb-8 px-6 flex flex-col">
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
