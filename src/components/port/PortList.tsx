import type { Port as PortType } from '../../types';
import { Port } from './Port';

interface PortListProps {
  ports: PortType[];
}

export function PortList({ ports }: PortListProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {ports.map((port) => (
        <Port key={`${port.protocol}-${port.number}`} port={port} />
      ))}
    </div>
  );
}
