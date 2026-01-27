interface EmptyStateProps {
  message: string;
}

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="flex items-center justify-center p-8 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50/50">
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );
}
