import { useState } from 'react';
import { Header } from './components/layout/Header';
import { PortLayer } from './components/layers/PortLayer';
import { FWLayer } from './components/layers/FWLayer';
import { NICLayer } from './components/layers/NICLayer';
import { usePacketAnimation } from './hooks';
import { DEFAULT_PORTS } from './constants';

function App() {
  const [isCapturing, setIsCapturing] = useState(true);

  const {
    packetCounter,
    deliveredPackets,
    firewallDropped,
    nicDropped,
    incomingPackets,
    nicToFwPackets,
    fwToPortPackets,
    nicDropAnimations,
    fwDropAnimations,
    nicActive,
    fwActive,
    streamingPorts,
    nicDropStreamMode,
    fwDropStreamMode,
    handleIncomingComplete,
    handleNicToFwComplete,
    handleFwToPortComplete,
    handleDropAnimationComplete,
    clearAll,
  } = usePacketAnimation({ isCapturing, ports: DEFAULT_PORTS });

  return (
    <div className="min-h-screen bg-background">
      <Header
        isCapturing={isCapturing}
        packetCount={packetCounter}
        onToggleCapture={() => setIsCapturing(!isCapturing)}
        onReset={clearAll}
      />

      <main>
        {/* Application Layer - Ports/Mailboxes */}
        <PortLayer
          ports={DEFAULT_PORTS}
          deliveredPackets={deliveredPackets}
          animatingPackets={fwToPortPackets}
          onAnimationComplete={handleFwToPortComplete}
          streamingPorts={streamingPorts}
        />

        {/* Firewall Layer */}
        <FWLayer
          droppedPackets={firewallDropped}
          isActive={fwActive}
          dropAnimations={fwDropAnimations}
          risingPackets={nicToFwPackets}
          onDropAnimationComplete={(id) => handleDropAnimationComplete(id, 'fw')}
          onRisingComplete={handleNicToFwComplete}
          isDropStreamMode={fwDropStreamMode}
        />

        {/* NIC Layer */}
        <NICLayer
          droppedPackets={nicDropped}
          isActive={nicActive}
          dropAnimations={nicDropAnimations}
          incomingPackets={incomingPackets}
          onDropAnimationComplete={(id) => handleDropAnimationComplete(id, 'nic')}
          onIncomingComplete={handleIncomingComplete}
          isDropStreamMode={nicDropStreamMode}
        />
      </main>

      {/* Footer */}
      <footer className="py-6 px-6 border-t border-border bg-background">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs text-muted-foreground">Scroll up to return to Application Layer</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
