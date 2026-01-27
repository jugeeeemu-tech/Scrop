import { Activity, Pause, Play, RotateCcw } from 'lucide-react';
import { cn } from '../../lib/utils';

interface HeaderProps {
  isCapturing: boolean;
  packetCount: number;
  onToggleCapture: () => void;
  onReset: () => void;
}

export function Header({ isCapturing, packetCount, onToggleCapture, onReset }: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-[var(--header-height)] bg-background/80 backdrop-blur-sm border-b border-border">
      <div className="h-full max-w-6xl mx-auto px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-foreground" />
          <span className="font-medium text-foreground">Scrop</span>
          <span className="text-sm text-muted-foreground hidden sm:inline">Packet Capture Visualizer</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-muted">
            <span
              className={cn('w-2 h-2 rounded-full', isCapturing ? 'bg-success animate-pulse' : 'bg-muted-foreground')}
            />
            <span className="text-sm font-medium text-foreground">{packetCount}</span>
          </div>

          <button
            type="button"
            onClick={onToggleCapture}
            className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
          >
            {isCapturing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={onReset}
            className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
