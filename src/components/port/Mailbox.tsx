import { cn } from '../../lib/utils';
import { Package, X } from 'lucide-react';
import { useState } from 'react';
import { EditableLabel } from './EditableLabel';
import type { AnimatingPacket, PortInfo } from '../../types';

interface MailboxProps {
  portInfo: PortInfo;
  packets: AnimatingPacket[];
  packetCount: number;
  isActive?: boolean;
  className?: string;
  ref?: React.Ref<HTMLDivElement>;
  isEditing?: boolean;
  editingField?: 'port' | 'label' | null;
  onPortChange?: (port: number) => void;
  onLabelChange?: (label: string) => void;
  onStartEdit?: (field: 'port' | 'label') => void;
  onCommitEdit?: () => void;
  onCancelEdit?: () => void;
  onRemove?: () => void;
}

export function Mailbox({
  portInfo,
  packets,
  packetCount,
  isActive = false,
  className,
  ref,
  isEditing = false,
  editingField,
  onPortChange,
  onLabelChange,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onRemove,
}: MailboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isEtc = portInfo.type === 'etc';

  return (
    <div ref={ref} className={cn('relative group', className)}>
      {/* Remove button */}
      {onRemove && !isEtc && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute -top-1 -left-1 z-10 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:scale-110"
        >
          <X className="w-3 h-3" />
        </button>
      )}

      {/* Mailbox body - clickable for modal */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="relative flex flex-col items-center cursor-pointer"
      >
        <div className="relative">
          {/* Flag indicator */}
          <div
            className={cn(
              'absolute -right-3 top-4 w-3 h-6 rounded-sm transition-all duration-500 origin-bottom',
              isActive ? 'bg-success rotate-0' : 'bg-muted-foreground/30 -rotate-45'
            )}
          />

          {/* Mailbox body */}
          <div
            className={cn(
              'relative w-20 h-16 rounded-t-full rounded-b-lg border-2 transition-all duration-300',
              isActive
                ? 'border-foreground bg-card shadow-lg scale-105'
                : 'border-border bg-card group-hover:border-foreground/50 group-hover:scale-102'
            )}
          >
            {/* Mail slot */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-1.5 bg-foreground/80 rounded-full" />

            {/* Packet counter badge */}
            {packetCount > 0 && (
              <div className="absolute -top-2 -right-2 min-w-5 h-5 px-1.5 bg-foreground text-background rounded-full flex items-center justify-center text-xs font-medium">
                {packetCount > 99 ? '99+' : packetCount}
              </div>
            )}
          </div>

          {/* Post */}
          <div className="mx-auto w-3 h-8 bg-foreground/20 rounded-b" />
        </div>
      </button>

      {/* Labels - separate from button for double-click editing */}
      <div className="mt-2 text-center w-20 mx-auto">
        {isEtc ? (
          <>
            <p className="text-xs font-medium text-foreground">—</p>
            <p className="text-[10px] text-muted-foreground">{portInfo.label}</p>
          </>
        ) : (
          <>
            <EditableLabel
              value={portInfo.port === 0 ? '' : String(portInfo.port)}
              isEditing={isEditing && editingField === 'port'}
              onDoubleClick={() => onStartEdit?.('port')}
              onChange={(val) => {
                const num = parseInt(val, 10);
                if (!isNaN(num) && num >= 0 && num <= 65535) {
                  onPortChange?.(num);
                } else if (val === '') {
                  onPortChange?.(0);
                }
              }}
              onCommit={() => onCommitEdit?.()}
              onCancel={() => onCancelEdit?.()}
              placeholder="Port"
              className="text-xs font-medium text-foreground"
              type="number"
            />
            <EditableLabel
              value={portInfo.label}
              isEditing={isEditing && editingField === 'label'}
              onDoubleClick={() => onStartEdit?.('label')}
              onChange={(val) => onLabelChange?.(val)}
              onCommit={() => onCommitEdit?.()}
              onCancel={() => onCancelEdit?.()}
              placeholder="Label"
              className="text-[10px] text-muted-foreground"
            />
          </>
        )}
      </div>

      {/* Packet Detail Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && setIsOpen(false)}
        >
          <div
            className="bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full mx-4 max-h-[70vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-8 rounded-t-full rounded-b-lg border-2 border-foreground bg-card flex items-center justify-center">
                  <div className="w-6 h-1 bg-foreground/80 rounded-full" />
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    {portInfo.type === 'port' ? `Port ${portInfo.port}` : portInfo.label}
                  </p>
                  {portInfo.type === 'port' && (
                    <p className="text-xs text-muted-foreground">{portInfo.label}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-full hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[50vh]">
              {packets.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No packets yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {packets
                    .slice()
                    .reverse()
                    .map((packet) => (
                      <div key={packet.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        <Package className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground">{packet.protocol}</span>
                            <span className="text-xs text-muted-foreground">{packet.size}B</span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {packet.source} → {packet.destination}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
