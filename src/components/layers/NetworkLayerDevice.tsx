import { cn } from '../../lib/utils';
import { Shield, Cpu, Package, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { DroppedPacketAnimation } from '../packet/DroppedPacketAnimation';
import { DropStream } from '../packet/DropStream';
import { StreamFadeOut } from '../packet/StreamFadeOut';
import type { AnimatingPacket } from '../../types';

interface DroppedPileProps {
  packets: AnimatingPacket[];
  count: number;
  type: 'firewall' | 'nic';
  dropAnimations: AnimatingPacket[];
  onDropAnimationComplete: (packetId: string) => void;
  isDropStreamMode?: boolean;
}

export function DroppedPile({ packets, count, type, dropAnimations, onDropAnimationComplete, isDropStreamMode = false }: DroppedPileProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const tooltipMaxItems = 3;
  const reversedPackets = packets.slice().reverse();
  const tooltipPackets = reversedPackets.slice(0, tooltipMaxItems);
  const remainingCount = count - tooltipMaxItems;
  const dropLabel = type === 'firewall' ? 'Firewall' : 'NIC';

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setIsOpen(false);
      };
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen]);

  return (
    <div className="relative" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)} data-testid={`drop-pile-${type}`}>
      {/* Drop animations - positioned at the center of the pile */}
      <div className="absolute bottom-4 left-4 z-20">
        <StreamFadeOut active={isDropStreamMode}>
          <DropStream />
        </StreamFadeOut>
        {dropAnimations.map((packet) => (
          <DroppedPacketAnimation
            key={packet.id}
            direction="right"
            onComplete={() => onDropAnimationComplete(packet.id)}
          />
        ))}
      </div>

      {/* Stacked packages visualization - clickable for modal */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="relative w-24 h-20 cursor-pointer"
      >
        {/* Render up to 5 stacked packages - only when count > 0 */}
        {count > 0 && packets.slice(-5).map((_, index) => (
          <div
            key={packets[packets.length - 5 + index]?.id || index}
            className={cn(
              'absolute w-10 h-10 rounded-lg border-2 border-destructive bg-card flex items-center justify-center',
              !isDropStreamMode && 'transition-all duration-300'
            )}
            style={{
              bottom: `${index * 4}px`,
              left: `${index * 6}px`,
              transform: `rotate(${(index - 2) * 5}deg)`,
              zIndex: index,
            }}
          >
            <Package className="w-5 h-5 text-destructive" />
          </div>
        ))}

        {/* Count badge - only when count > 0 */}
        {count > 0 && (
          <div
            className="absolute -top-2 -right-2 min-w-6 h-6 px-2 bg-destructive text-white rounded-full flex items-center justify-center text-xs font-medium z-10"
            data-testid={`drop-count-${type}`}
          >
            {count > 99 ? '99+' : count}
          </div>
        )}
      </button>

      {/* Hover tooltip with packet details - only when count > 0 */}
      {isHovered && count > 0 && (
        <div className="absolute left-full ml-4 top-0 z-50 w-72 bg-card border border-border rounded-xl shadow-xl overflow-hidden" data-testid={`drop-tooltip-${type}`}>
          <div className="p-3 border-b border-border bg-destructive/5">
            <p className="text-sm font-medium text-foreground">{dropLabel} Drops</p>
            <p className="text-xs text-muted-foreground">{count} packet{count !== 1 ? 's' : ''} blocked</p>
          </div>
          <div className="p-2 space-y-1">
            {tooltipPackets.map((packet) => (
              <div key={packet.id} className="p-2 rounded-lg bg-muted/50 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{packet.protocol}</span>
                  <span className="text-muted-foreground">{packet.size}B</span>
                </div>
                <p className="text-muted-foreground truncate">
                  {packet.source}:{packet.srcPort} → {packet.destination}:{packet.destPort}
                </p>
                {packet.reason && <p className="text-destructive mt-1 truncate">{packet.reason}</p>}
              </div>
            ))}
            {remainingCount > 0 && (
              <p className="text-xs text-muted-foreground px-2 pt-1">+{remainingCount} more...</p>
            )}
          </div>
          <div className="px-3 pb-2">
            <p className="text-[10px] text-muted-foreground/70">click to see all</p>
          </div>
        </div>
      )}

      {/* Packet Detail Modal */}
      {isOpen && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
          data-testid="drop-modal-overlay"
        >
          <div
            className="bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full mx-4 max-h-[70vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <p className="font-medium text-foreground">{dropLabel} Drops</p>
                <p className="text-xs text-muted-foreground">{count} packet{count !== 1 ? 's' : ''} blocked</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-full hover:bg-muted transition-colors"
                data-testid="drop-modal-close"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[50vh]">
              {packets.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No dropped packets</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {reversedPackets.map((packet) => (
                    <div key={packet.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <Package className="w-4 h-4 text-destructive flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{packet.protocol}</span>
                          <span className="text-xs text-muted-foreground">{packet.size}B</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {packet.source}:{packet.srcPort} → {packet.destination}:{packet.destPort}
                        </p>
                        {packet.reason && (
                          <p className="text-xs text-destructive mt-1 truncate">{packet.reason}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

interface NetworkLayerDeviceProps {
  type: 'firewall' | 'nic';
  droppedPackets: AnimatingPacket[];
  droppedCount: number;
  isActive?: boolean;
  className?: string;
  dropAnimations: AnimatingPacket[];
  onDropAnimationComplete: (packetId: string) => void;
  isDropStreamMode?: boolean;
}

export function NetworkLayerDevice({ type, droppedPackets, droppedCount, isActive = false, className, dropAnimations, onDropAnimationComplete, isDropStreamMode = false }: NetworkLayerDeviceProps) {
  const isFirewall = type === 'firewall';

  return (
    <section className={cn('min-h-[50vh] py-16 px-6 flex items-center justify-center', className)}>
      <div className="flex items-center gap-12">
        {/* Main device - mailbox style */}
        <div className="relative flex flex-col items-center">
          {/* Flag indicator */}
          <div className="relative">
            <div
              className={cn(
                'absolute -right-3 top-4 w-3 h-6 rounded-sm transition-all duration-500 origin-bottom',
                isActive ? 'bg-success rotate-0' : 'bg-muted-foreground/30 -rotate-45'
              )}
            />

            {/* Device body - mailbox style */}
            <div
              className={cn(
                'relative w-24 h-20 rounded-t-full rounded-b-lg border-2 transition-all duration-300 flex items-center justify-center',
                isActive ? 'border-foreground bg-card shadow-lg scale-105' : 'border-border bg-card'
              )}
            >
              {isFirewall ? <Shield className="w-8 h-8 text-foreground/70" /> : <Cpu className="w-8 h-8 text-foreground/70" />}
            </div>

            {/* Post */}
            <div className="mx-auto w-4 h-10 bg-foreground/20 rounded-b" />
          </div>

          {/* Label */}
          <div className="mt-2 text-center">
            <p className="text-sm font-medium text-foreground">{isFirewall ? 'Firewall' : 'NIC'}</p>
            <p className="text-[10px] text-muted-foreground">{isFirewall ? 'iptables/nftables' : 'XDP Layer'}</p>
          </div>
        </div>

        {/* Dropped packets pile */}
        <DroppedPile
          packets={droppedPackets}
          count={droppedCount}
          type={type}
          dropAnimations={dropAnimations}
          onDropAnimationComplete={onDropAnimationComplete}
          isDropStreamMode={isDropStreamMode}
        />
      </div>
    </section>
  );
}
