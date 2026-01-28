import { useState, useCallback } from 'react';
import { getMockConfig, setMockConfig, sendBurst } from '../../mocks/packetGenerator';
import { STREAM_MODE_RATE_THRESHOLD } from '../../constants';

interface MockControllerProps {
  className?: string;
}

export function MockController({ className = '' }: MockControllerProps) {
  const [config, setLocalConfig] = useState(getMockConfig);
  const [isExpanded, setIsExpanded] = useState(true);

  const updateRate = useCallback((rate: number) => {
    setMockConfig({ rate });
    setLocalConfig(getMockConfig());
  }, []);

  const updateNicDropRate = useCallback((nicDropRate: number) => {
    setMockConfig({ nicDropRate });
    setLocalConfig(getMockConfig());
  }, []);

  const updateFwDropRate = useCallback((fwDropRate: number) => {
    setMockConfig({ fwDropRate });
    setLocalConfig(getMockConfig());
  }, []);

  const handleBurst = useCallback((count: number, interval: number) => {
    sendBurst(count, interval);
  }, []);

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className={`fixed bottom-4 right-4 z-50 px-3 py-2 bg-yellow-500 text-black text-sm font-medium rounded shadow-lg hover:bg-yellow-400 ${className}`}
      >
        Mock Controls
      </button>
    );
  }

  return (
    <div className={`fixed bottom-4 right-4 z-50 w-72 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl ${className}`}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700">
        <span className="text-sm font-medium text-yellow-500">Mock Controller</span>
        <button
          onClick={() => setIsExpanded(false)}
          className="text-zinc-400 hover:text-white text-lg leading-none"
        >
          &times;
        </button>
      </div>

      <div className="p-3 space-y-4">
        {/* Packet Rate */}
        <div>
          <div className="flex justify-between text-xs text-zinc-400 mb-1">
            <span>Packet Rate</span>
            <span className={config.rate >= STREAM_MODE_RATE_THRESHOLD ? 'text-orange-400' : ''}>
              {config.rate.toFixed(1)} pkt/s
              {config.rate >= STREAM_MODE_RATE_THRESHOLD && ' (Stream)'}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="20"
            step="0.5"
            value={config.rate}
            onChange={(e) => updateRate(parseFloat(e.target.value))}
            className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
          />
          <div className="flex justify-between text-xs text-zinc-500 mt-1">
            <span>0</span>
            <span className="text-orange-400/50">{STREAM_MODE_RATE_THRESHOLD} (threshold)</span>
            <span>20</span>
          </div>
        </div>

        {/* NIC Drop Rate */}
        <div>
          <div className="flex justify-between text-xs text-zinc-400 mb-1">
            <span>NIC Drop Rate</span>
            <span>{(config.nicDropRate * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={config.nicDropRate}
            onChange={(e) => updateNicDropRate(parseFloat(e.target.value))}
            className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-red-500"
          />
        </div>

        {/* FW Drop Rate */}
        <div>
          <div className="flex justify-between text-xs text-zinc-400 mb-1">
            <span>FW Drop Rate</span>
            <span>{(config.fwDropRate * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={config.fwDropRate}
            onChange={(e) => updateFwDropRate(parseFloat(e.target.value))}
            className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
          />
        </div>

        {/* Burst Buttons */}
        <div>
          <div className="text-xs text-zinc-400 mb-2">Send Burst</div>
          <div className="flex gap-2">
            <button
              onClick={() => handleBurst(10, 80)}
              className="flex-1 px-2 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-600"
            >
              10 pkts
            </button>
            <button
              onClick={() => handleBurst(20, 50)}
              className="flex-1 px-2 py-1.5 text-xs bg-yellow-600 hover:bg-yellow-500 text-black font-medium rounded"
            >
              20 pkts (fast)
            </button>
            <button
              onClick={() => handleBurst(50, 30)}
              className="flex-1 px-2 py-1.5 text-xs bg-orange-600 hover:bg-orange-500 text-black font-medium rounded"
            >
              50 pkts
            </button>
          </div>
        </div>

        {/* Presets */}
        <div>
          <div className="text-xs text-zinc-400 mb-2">Presets</div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setMockConfig({ rate: 1, nicDropRate: 0, fwDropRate: 0 });
                setLocalConfig(getMockConfig());
              }}
              className="flex-1 px-2 py-1.5 text-xs bg-green-800 hover:bg-green-700 text-green-100 rounded"
            >
              Slow
            </button>
            <button
              onClick={() => {
                setMockConfig({ rate: 3, nicDropRate: 0.1, fwDropRate: 0.1 });
                setLocalConfig(getMockConfig());
              }}
              className="flex-1 px-2 py-1.5 text-xs bg-blue-800 hover:bg-blue-700 text-blue-100 rounded"
            >
              Normal
            </button>
            <button
              onClick={() => {
                setMockConfig({ rate: 10, nicDropRate: 0.2, fwDropRate: 0.2 });
                setLocalConfig(getMockConfig());
              }}
              className="flex-1 px-2 py-1.5 text-xs bg-orange-800 hover:bg-orange-700 text-orange-100 rounded"
            >
              Stream
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
