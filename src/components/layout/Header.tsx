import { Activity, AlertCircle, Pause, Play, RotateCcw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useHeaderStore } from '../../hooks/useHeaderStore';

const ACTIVITY_ICON = <Activity className="w-5 h-5 text-foreground" />;
const PAUSE_ICON = <Pause className="w-4 h-4" />;
const PLAY_ICON = <Play className="w-4 h-4" />;
const ROTATE_CCW_ICON = <RotateCcw className="w-4 h-4" />;
const ALERT_CIRCLE_ICON = <AlertCircle className="w-4 h-4 flex-shrink-0" />;

interface HeaderProps {
  isCapturing: boolean;
  onToggleCapture: () => void;
  onReset: () => void;
}

export function Header({ isCapturing, onToggleCapture, onReset }: HeaderProps) {
  const { deliveredCounter: deliveredCount, droppedCounter: droppedCount, error } = useHeaderStore();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
      <div className="h-[var(--header-height)] max-w-6xl mx-auto px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {ACTIVITY_ICON}
          <span className="font-medium text-foreground">Scrop</span>
          <span className="text-sm text-muted-foreground hidden sm:inline">Packet Capture Visualizer</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-3 px-3 py-1 rounded-full bg-muted">
            <div className="flex items-center gap-1.5">
              <span
                className={cn('w-2 h-2 rounded-full', isCapturing ? 'bg-success animate-pulse' : 'bg-muted-foreground')}
              />
              <span className="text-sm font-medium text-foreground" data-testid="delivered-count">{deliveredCount}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={cn('w-2 h-2 rounded-full', isCapturing ? 'bg-destructive animate-pulse' : 'bg-muted-foreground')}
              />
              <span className="text-sm font-medium text-foreground" data-testid="dropped-count">{droppedCount}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleCapture}
            className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
            data-testid="capture-toggle"
          >
            {isCapturing ? PAUSE_ICON : PLAY_ICON}
          </button>

          <button
            type="button"
            onClick={onReset}
            className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
            data-testid="capture-reset"
          >
            {ROTATE_CCW_ICON}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive text-destructive-foreground px-6 py-2" data-testid="error-banner">
          <div className="max-w-6xl mx-auto flex items-center gap-2">
            {ALERT_CIRCLE_ICON}
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}
    </header>
  );
}
