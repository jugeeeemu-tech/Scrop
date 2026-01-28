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

  const streamingPorts = getStreamingPorts();
  const nicDropStreamMode = getNicDropStreamMode();
  const fwDropStreamMode = getFwDropStreamMode();

  return (
    <div className="min-h-screen bg-background">
      <Header
        isCapturing={isCapturing}
        packetCount={store.packetCounter}
        onToggleCapture={toggleCapture}
        onReset={resetCapture}
        error={store.error}
      />

      <main>
        <PortLayer
          ports={DEFAULT_PORTS}
          deliveredPackets={store.deliveredPackets}
          animatingPackets={store.fwToPortPackets}
          onAnimationComplete={handleFwToPortComplete}
          streamingPorts={streamingPorts}
        />

        <FWLayer
          droppedPackets={store.firewallDropped}
          isActive={store.fwActive}
          dropAnimations={store.fwDropAnimations}
          risingPackets={store.nicToFwPackets}
          onDropAnimationComplete={(id) => handleDropAnimationComplete(id, 'fw')}
          onRisingComplete={handleNicToFwComplete}
          isDropStreamMode={fwDropStreamMode}
        />

        <NICLayer
          droppedPackets={store.nicDropped}
          isActive={store.nicActive}
          dropAnimations={store.nicDropAnimations}
          incomingPackets={store.incomingPackets}
          onDropAnimationComplete={(id) => handleDropAnimationComplete(id, 'nic')}
          onIncomingComplete={handleIncomingComplete}
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
