import { Mailbox } from '../port/Mailbox';
import { AddMailbox } from '../port/AddMailbox';
import { DraggableMailbox } from '../port/DraggableMailbox';
import { PortAnimationZone } from './PortAnimationZone';
import { ScrollHint } from '../common/ScrollHint';
import { useRef } from 'react';
import { Reorder } from 'framer-motion';
import type { PortInfo } from '../../types';
import { usePortPositionStore, useScrollOverflow } from '../../hooks';

interface PortLayerProps {
  ports: PortInfo[];
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
  const { mailboxPositions, setMailboxRef, startPolling, stopPolling } = usePortPositionStore(animationZoneRef, ports.length);
  const { ref: scrollRef, canScrollLeft, canScrollRight } = useScrollOverflow();

  // Separate draggable ports from etc
  const draggablePorts = ports.filter((p) => p.type !== 'etc');
  const etcPort = ports.find((p) => p.type === 'etc');
  const etcIndex = ports.findIndex((p) => p.type === 'etc');

  return (
    <section data-testid="port-layer" className="min-h-screen pt-20 pb-8 px-6 flex flex-col">
      <div className="flex-1 flex flex-col justify-center w-full">
        <div className="relative">
          <div ref={scrollRef} className="overflow-x-auto hide-scrollbar -my-40 py-40">
            <div className="w-max min-w-full">
              {/* Mailboxes */}
              <div className="flex justify-center gap-6 md:gap-10 mb-8 px-6">
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
                        isEditing={editingIndex === index}
                        editingField={editingIndex === index ? editingField : null}
                        onPortChange={(port) => onPortChange(index, port)}
                        onLabelChange={(label) => onLabelChange(index, label)}
                        onStartEdit={(field) => onStartEdit(index, field)}
                        onCommitEdit={onCommitEdit}
                        onCancelEdit={onCancelEdit}
                        onDragSessionStart={startPolling}
                        onDragSessionEnd={stopPolling}
                      />
                    );
                  })}
                </Reorder.Group>
                <AddMailbox onClick={onAddPort} />
                {etcPort && (
                  <Mailbox
                    ref={(el) => setMailboxRef(etcIndex, el)}
                    portInfo={etcPort}
                    isEditing={false}
                    editingField={null}
                    onCommitEdit={onCommitEdit}
                    onCancelEdit={onCancelEdit}
                  />
                )}
              </div>

              {/* Animation zone - independent store subscription */}
              <PortAnimationZone
                ports={ports}
                animationZoneRef={animationZoneRef}
                mailboxPositions={mailboxPositions}
              />
            </div>
          </div>
          {/* Scroll fade indicators */}
          {canScrollLeft && (
            <div className="absolute -top-3 bottom-0 left-0 w-12 pointer-events-none bg-gradient-to-r from-[var(--background)] to-transparent" />
          )}
          {canScrollRight && (
            <div className="absolute -top-3 bottom-0 right-0 w-12 pointer-events-none bg-gradient-to-l from-[var(--background)] to-transparent" />
          )}
        </div>
      </div>

      {/* Scroll hint */}
      <ScrollHint />
    </section>
  );
}
