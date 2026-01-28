import { Plus } from 'lucide-react';

interface AddMailboxProps {
  onClick: () => void;
}

export function AddMailbox({ onClick }: AddMailboxProps) {
  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        className="relative flex flex-col items-center cursor-pointer group"
      >
        <div className="relative">
          {/* Mailbox body - dashed border */}
          <div className="relative w-20 h-16 rounded-t-full rounded-b-lg border-2 border-dashed border-muted-foreground/30 bg-card/50 transition-all duration-300 group-hover:border-foreground/50 group-hover:scale-102 flex items-center justify-center">
            <Plus className="w-6 h-6 text-muted-foreground/50 group-hover:text-foreground/50 transition-colors" />
          </div>

          {/* Post */}
          <div className="mx-auto w-3 h-8 bg-foreground/10 rounded-b" />
        </div>

        {/* Label placeholder */}
        <div className="mt-2 text-center">
          <p className="text-xs font-medium text-muted-foreground/50">Add</p>
        </div>
      </button>
    </div>
  );
}
