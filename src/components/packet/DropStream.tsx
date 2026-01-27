import { cn } from '../../lib/utils';
import { Package } from 'lucide-react';

export function DropStream() {
  return (
    <div className="absolute bottom-0 left-0 h-full w-full pointer-events-none">
      {/* Multiple packets flowing continuously */}
      {[0, 1, 2, 3].map((index) => (
        <div
          key={index}
          className={cn(
            'absolute w-6 h-6 bg-destructive rounded-md shadow-md flex items-center justify-center',
            'animate-drop-stream'
          )}
          style={{
            animationDelay: `${index * 200}ms`,
          }}
        >
          <Package className="w-3 h-3 text-white" />
        </div>
      ))}
    </div>
  );
}
