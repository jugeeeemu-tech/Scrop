import { Header } from './components/layout/Header';
import { ScrollContainer } from './components/layout/ScrollContainer';
import { PortLayer } from './components/layers/PortLayer';
import { FWLayer } from './components/layers/FWLayer';
import { NICLayer } from './components/layers/NICLayer';
import {
  mockPorts,
  getPortLayerPackets,
  getFWLayerPackets,
  getNICLayerPackets,
} from './data/mockData';

function App() {
  const portPackets = getPortLayerPackets();
  const fwPackets = getFWLayerPackets();
  const nicPackets = getNICLayerPackets();

  return (
    <ScrollContainer>
      <Header />
      <main>
        <PortLayer ports={mockPorts} packets={portPackets} />
        <FWLayer packets={fwPackets} />
        <NICLayer packets={nicPackets} />
      </main>
    </ScrollContainer>
  );
}

export default App;
