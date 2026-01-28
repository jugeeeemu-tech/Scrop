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

const sharedClassName =
  'block w-full border-b p-0 leading-none text-center';

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
        className={cn(sharedClassName, 'border-transparent cursor-default', className)}
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
      size={1}
      value={value}
      placeholder={placeholder}
      className={cn(
        sharedClassName,
        'bg-transparent border-foreground/50 outline-none min-w-0 h-auto font-[inherit] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
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
