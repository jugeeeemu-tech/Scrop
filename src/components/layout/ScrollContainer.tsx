import type { ReactNode } from 'react';

interface ScrollContainerProps {
  children: ReactNode;
}

export function ScrollContainer({ children }: ScrollContainerProps) {
  return (
    <div className="h-screen overflow-y-auto">
      {children}
    </div>
  );
}
