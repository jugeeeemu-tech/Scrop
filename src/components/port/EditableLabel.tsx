import { useCallback, useEffect, useState } from 'react';
import { cn } from '../../lib/utils';

interface EditableLabelProps {
  value: string;
  isEditing: boolean;
  onClick: () => void;
  onCommit: (value: string) => void;
  onCancel: () => void;
  placeholder?: string;
  className?: string;
  type?: 'text' | 'number';
  testId?: string;
}

const sharedClassName =
  'block w-full border-b p-0 leading-none text-center';

export function EditableLabel({
  value,
  isEditing,
  onClick,
  onCommit,
  onCancel,
  placeholder,
  className,
  type = 'text',
  testId,
}: EditableLabelProps) {
  const [localValue, setLocalValue] = useState(value);

  // 編集開始時にローカルステートを親の値で初期化
  // eslint-disable-next-line react-hooks/exhaustive-deps -- 編集開始時のみ同期
  useEffect(() => {
    if (isEditing) {
      setLocalValue(value);
    }
  }, [isEditing]);

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
        data-testid={testId}
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
      value={localValue}
      placeholder={placeholder}
      data-testid={testId ? `${testId}-input` : undefined}
      className={cn(
        sharedClassName,
        'bg-transparent border-foreground/50 outline-none min-w-0 h-auto font-[inherit] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
        className
      )}
      onChange={(e) => setLocalValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onCommit(localValue);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }}
      onBlur={() => onCommit(localValue)}
      onClick={(e) => e.stopPropagation()}
    />
  );
}
