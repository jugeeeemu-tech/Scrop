import { useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';

interface EditableLabelProps {
  value: string;
  isEditing: boolean;
  onDoubleClick: () => void;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  placeholder?: string;
  className?: string;
  type?: 'text' | 'number';
}

export function EditableLabel({
  value,
  isEditing,
  onDoubleClick,
  onChange,
  onCommit,
  onCancel,
  placeholder,
  className,
  type = 'text',
}: EditableLabelProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  if (!isEditing) {
    return (
      <p
        className={cn('cursor-default', className)}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onDoubleClick();
        }}
      >
        {value || placeholder || ''}
      </p>
    );
  }

  return (
    <input
      ref={inputRef}
      type={type}
      value={value}
      placeholder={placeholder}
      className={cn(
        'bg-transparent border-b border-foreground/50 outline-none text-center w-full',
        className
      )}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onCommit();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }}
      onBlur={onCommit}
      onClick={(e) => e.stopPropagation()}
    />
  );
}
