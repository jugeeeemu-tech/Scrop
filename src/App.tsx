import { useEffect } from 'react';
import { usePortStore } from './hooks/usePortStore';
import { useNicStore } from './hooks/useNicStore';
import { useCaptureControl } from './hooks/useCaptureControl';
import { Header } from './components/layout/Header';
import { PortLayer } from './components/layers/PortLayer';
import { FWLayer } from './components/layers/FWLayer';
import { NICLayer } from './components/layers/NICLayer';
import {
  addPort,
  updatePort,
  removePort,
  reorderPorts,
  setEditing,
  commitEditing,
  clearEditing,
} from './stores/portStore';
import {
  toggleNic,
  initializeNics,
} from './stores/nicStore';

function App() {
  const portStore = usePortStore();
  const nicStore = useNicStore();
  const { isCapturing, toggleCapture, resetCapture } = useCaptureControl();

  useEffect(() => {
    if (isCapturing) {
      initializeNics();
    }
  }, [isCapturing]);

  return (
    <div className="min-h-screen bg-background">
      <Header
        isCapturing={isCapturing}
        onToggleCapture={toggleCapture}
        onReset={resetCapture}
      />

      <main>
        <PortLayer
          ports={portStore.ports}
          editingIndex={portStore.editingIndex}
          editingField={portStore.editingField}
          onAddPort={addPort}
          onPortChange={(index, port) => updatePort(index, { port })}
          onLabelChange={(index, label) => updatePort(index, { label })}
          onStartEdit={setEditing}
          onCommitEdit={commitEditing}
          onCancelEdit={clearEditing}
          onRemovePort={removePort}
          onReorderPorts={reorderPorts}
        />

        <FWLayer />

        <NICLayer
          availableNics={nicStore.availableNics}
          attachedNics={nicStore.attachedNics}
          onToggleNic={toggleNic}
        />
      </main>

      <footer className="py-6 px-6 border-t border-border bg-background">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs text-muted-foreground">Scroll up to return to Application Layer</p>
        </div>
      </footer>

    </div>
  );
}

export default App;
