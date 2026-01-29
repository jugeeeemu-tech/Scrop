import { cn } from '../../lib/utils';
import { Cpu, Settings } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface NicDeviceProps {
  availableNics: string[];
  attachedNics: Set<string>;
  onToggleNic: (name: string) => void;
  isActive: boolean;
}

export function NicDevice({
  availableNics,
  attachedNics,
  onToggleNic,
  isActive,
}: NicDeviceProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isExpanded) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isExpanded]);

  return (
    <div ref={containerRef} className="relative group">
      {/* Gear icon hint (top-left, visible on hover) */}
      <div className="absolute -top-2 -left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
        <Settings className="w-4 h-4 text-muted-foreground" />
      </div>

      {/* Interface boxes: expand above post */}
      <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2">
        <AnimatePresence>
          {isExpanded && (
            <div className="flex gap-2 justify-center">
              {availableNics.map((name, i) => {
                const attached = attachedNics.has(name);
                return (
                  <motion.button
                    key={name}
                    type="button"
                    initial={{ opacity: 0, scale: 0.8, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, y: 10 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => onToggleNic(name)}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap',
                      attached
                        ? 'border-2 border-success bg-success/10 text-foreground'
                        : 'border-2 border-dashed border-muted-foreground/30 text-muted-foreground hover:border-muted-foreground/50'
                    )}
                  >
                    {name}
                  </motion.button>
                );
              })}
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* NIC post body: click to toggle expand */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
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

          {/* Device body */}
          <div
            className={cn(
              'relative w-24 h-20 rounded-t-full rounded-b-lg border-2 transition-all duration-300 flex items-center justify-center',
              isActive ? 'border-foreground bg-card shadow-lg scale-105' : 'border-border bg-card'
            )}
          >
            <Cpu className="w-8 h-8 text-foreground/70" />
          </div>

          {/* Post */}
          <div className="mx-auto w-3 h-8 bg-foreground/20 rounded-b" />
        </div>
      </button>

      {/* Label */}
      <div className="mt-2 text-center">
        <p className="text-xs font-medium text-foreground">NIC</p>
        <p className="text-[10px] text-muted-foreground">XDP Layer</p>
      </div>
    </div>
  );
}
