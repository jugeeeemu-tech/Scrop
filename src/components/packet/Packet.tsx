import type { Packet as PacketType } from '../../types';
import { PROTOCOL_COLORS, DROP_REASON_LABELS } from '../../utils/constants';

interface PacketProps {
  packet: PacketType;
}

export function Packet({ packet }: PacketProps) {
  const protocolColors = PROTOCOL_COLORS[packet.protocol];

  return (
    <div
      className={`
        p-3 rounded-lg border bg-white shadow-sm
        ${packet.dropped ? 'border-red-200 bg-red-50/50' : 'border-gray-200'}
      `}
    >
      <div className="flex items-center gap-3">
        {/* Packet icon */}
        <div className={`
          w-8 h-8 rounded flex items-center justify-center text-white text-sm
          ${packet.dropped ? 'bg-red-400' : protocolColors.bg}
        `}>
          📦
        </div>

        {/* Packet info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`
              px-2 py-0.5 text-xs font-medium rounded
              ${protocolColors.light} ${protocolColors.text}
            `}>
              {packet.protocol}
            </span>
            <span className="text-sm font-mono text-gray-700">
              {packet.sourceIp}:{packet.sourcePort}
            </span>
            <span className="text-gray-400">→</span>
            <span className="text-sm font-mono text-gray-700">
              {packet.destIp}:{packet.destPort}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
            <span>{packet.size} bytes</span>
            <span>{new Date(packet.timestamp).toLocaleTimeString()}</span>
            {packet.dropped && packet.dropReason && (
              <span className="text-red-500 font-medium">
                ⛔ {DROP_REASON_LABELS[packet.dropReason]}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
