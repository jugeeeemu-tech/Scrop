import { Mailbox } from './Mailbox';
import { Reorder, useMotionValue, useTransform } from 'framer-motion';
import { useCallback, useRef, useState } from 'react';
import type { PortInfo } from '../../types';

const DELETE_Y_THRESHOLD = 100;

interface DraggableMailboxProps {
  portInfo: PortInfo;
  editingKey: string | number;
  onRemove: () => void;
  mailboxRef: (el: HTMLDivElement | null) => void;
  isEditing: boolean;
  editingField: 'port' | 'label' | null;
  onPortChange: (port: number) => void;
  onLabelChange: (label: string) => void;
  onStartEdit: (field: 'port' | 'label') => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  onDragSessionStart?: () => void;
  onDragSessionEnd?: () => void;
}

export function DraggableMailbox({
  portInfo,
  editingKey,
  onRemove,
  mailboxRef,
  onDragSessionStart,
  onDragSessionEnd,
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
        onDragSessionStart?.();
      }}
      onDragEnd={(_, info) => {
        setIsDragging(false);
        onDragSessionEnd?.();
        if (
          Math.abs(info.offset.y) > DELETE_Y_THRESHOLD ||
          Math.abs(info.velocity.y) > 500
        ) {
          onRemove();
        }
        // Reset wasDragged after the current event loop completes.
        // handleClickCapture may suppress a ghost click synchronously,
        // but if no ghost click fires (direction-dependent), this ensures
        // the flag is cleared before the user's next intentional click.
        requestAnimationFrame(() => {
          wasDragged.current = false;
        });
      }}
      onClickCapture={handleClickCapture}
      className=""
    >
      <Mailbox ref={mailboxRef} portInfo={portInfo} isDraggable {...mailboxProps} />
    </Reorder.Item>
  );
}
