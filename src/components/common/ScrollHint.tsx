import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ScrollHintProps {
  className?: string;
}

export function ScrollHint({ className }: ScrollHintProps) {
  return (
    <div className={cn('flex flex-col items-center text-muted-foreground animate-bounce', className)}>
      <ChevronDown className="w-5 h-5" />
    </div>
  );
}
