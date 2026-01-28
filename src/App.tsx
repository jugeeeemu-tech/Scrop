import { usePacketStore } from './hooks/usePacketStore';
import { useCaptureControl } from './hooks/useCaptureControl';
import { Header } from './components/layout/Header';
import { PortLayer } from './components/layers/PortLayer';
import { FWLayer } from './components/layers/FWLayer';
import { NICLayer } from './components/layers/NICLayer';
import { DEFAULT_PORTS } from './constants';
import {
  getStreamingPorts,
  getNicDropStreamMode,
  getFwDropStreamMode,
  handleFwToPortComplete,
  handleNicToFwComplete,
  handleIncomingComplete,
  handleDropAnimationComplete,
} from './stores/packetStore';

function App() {
  const store = usePacketStore();
  const { isCapturing, toggleCapture, resetCapture } = useCaptureControl();

  const streamingPorts = getStreamingPorts(store.fwToPortPackets);
  const nicDropStreamMode = getNicDropStreamMode(store.nicDropAnimations);
  const fwDropStreamMode = getFwDropStreamMode(store.fwDropAnimations);

  const onIncomingComplete = (id: string) => handleIncomingComplete(id);
  const onNicToFwComplete = (id: string) => handleNicToFwComplete(id);
  const onFwToPortComplete = (id: string, targetPort: number) => handleFwToPortComplete(id, targetPort);
  const onDropAnimationComplete = (id: string, layer: 'nic' | 'fw') => handleDropAnimationComplete(id, layer);

  return (
    <div className="min-h-screen bg-background">
      <Header
        isCapturing={isCapturing}
        packetCount={store.packetCounter}
        onToggleCapture={toggleCapture}
        onReset={resetCapture}
      />

      <main>
        <PortLayer
          ports={DEFAULT_PORTS}
          deliveredPackets={store.deliveredPackets}
          animatingPackets={store.fwToPortPackets}
          onAnimationComplete={onFwToPortComplete}
          streamingPorts={streamingPorts}
        />

        <FWLayer
          droppedPackets={store.firewallDropped}
          isActive={store.fwActive}
          dropAnimations={store.fwDropAnimations}
          risingPackets={store.nicToFwPackets}
          onDropAnimationComplete={(id) => onDropAnimationComplete(id, 'fw')}
          onRisingComplete={onNicToFwComplete}
          isDropStreamMode={fwDropStreamMode}
        />

        <NICLayer
          droppedPackets={store.nicDropped}
          isActive={store.nicActive}
          dropAnimations={store.nicDropAnimations}
          incomingPackets={store.incomingPackets}
          onDropAnimationComplete={(id) => onDropAnimationComplete(id, 'nic')}
          onIncomingComplete={onIncomingComplete}
          isDropStreamMode={nicDropStreamMode}
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
