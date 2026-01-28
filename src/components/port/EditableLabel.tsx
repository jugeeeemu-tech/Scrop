import { useCallback } from 'react';
import { cn } from '../../lib/utils';

interface EditableLabelProps {
  value: string;
  isEditing: boolean;
  onClick: () => void;
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
  onClick,
  onChange,
  onCommit,
  onCancel,
  placeholder,
  className,
  type = 'text',
}: EditableLabelProps) {
  const callbackRef = useCallback((node: HTMLInputElement | null) => {
    if (node) {
      node.focus();
      node.select();
    }
  }, []);

  if (!isEditing) {
    return (
      <p
        className={cn(sharedClassName, 'border-transparent cursor-text', className)}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        {value || placeholder || ''}
      </p>
    );
  }

  return (
    <input
      ref={callbackRef}
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
