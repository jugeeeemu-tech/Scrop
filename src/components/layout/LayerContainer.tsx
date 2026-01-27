import type { ReactNode } from 'react';
import type { LayerType } from '../../types';
import { LAYER_COLORS, LAYER_LABELS } from '../../utils/constants';

interface LayerContainerProps {
  layer: LayerType;
  children: ReactNode;
}

export function LayerContainer({ layer, children }: LayerContainerProps) {
  const colors = LAYER_COLORS[layer];
  const label = LAYER_LABELS[layer];

  return (
    <section
      className={`min-h-[var(--layer-min-height)] ${colors.bg} ${colors.border} border-b-2`}
    >
      <div className="sticky top-[var(--header-height)] z-10 px-6 py-3 backdrop-blur-sm bg-white/70 border-b">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${colors.accent}`} />
          <h2 className={`text-lg font-semibold ${colors.text}`}>{label}</h2>
        </div>
      </div>
      <div className="p-6">
        {children}
      </div>
    </section>
  );
}
