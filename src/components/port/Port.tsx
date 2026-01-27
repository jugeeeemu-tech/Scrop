import type { Port as PortType } from '../../types';
import { PROTOCOL_COLORS } from '../../utils/constants';

interface PortProps {
  port: PortType;
}

export function Port({ port }: PortProps) {
  const protocolColors = PROTOCOL_COLORS[port.protocol];

  return (
    <div
      className={`
        relative p-4 rounded-lg border-2 bg-white shadow-sm
        transition-all hover:shadow-md
        ${port.isActive ? 'border-amber-300' : 'border-gray-200 opacity-60'}
      `}
    >
      {/* Post icon representation */}
      <div className="flex items-start gap-3">
        <div className={`
          w-10 h-12 rounded-t-lg flex items-center justify-center
          ${port.isActive ? 'bg-amber-400' : 'bg-gray-300'}
        `}>
          <span className="text-white text-lg">📮</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-gray-900">:{port.number}</span>
            <span className={`
              px-2 py-0.5 text-xs font-medium rounded
              ${protocolColors.light} ${protocolColors.text}
            `}>
              {port.protocol}
            </span>
          </div>
          {port.serviceName && (
            <p className="text-sm text-gray-500 truncate">{port.serviceName}</p>
          )}
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
            <span>📦 {port.packetCount} packets</span>
            {port.isActive && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Active
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
