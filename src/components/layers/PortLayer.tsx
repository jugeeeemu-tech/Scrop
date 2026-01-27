import { Mailbox } from '../port/Mailbox';
import { AnimatedPacket } from '../packet/AnimatedPacket';
import { ScrollHint } from '../common/ScrollHint';

interface MailboxPacket {
  id: string;
  protocol: string;
  size: number;
  source: string;
  destination: string;
  timestamp?: number;
  targetPort?: number;
}

interface PortInfo {
  port: number;
  label: string;
}

interface PortLayerProps {
  ports: PortInfo[];
  deliveredPackets: Record<number, MailboxPacket[]>;
  animatingPackets: MailboxPacket[];
  onAnimationComplete: (packetId: string, targetPort: number) => void;
}

export function PortLayer({ ports, deliveredPackets, animatingPackets, onAnimationComplete }: PortLayerProps) {
  return (
    <section className="min-h-screen pt-20 pb-8 px-6 flex flex-col">
      <div className="flex-1 flex flex-col justify-center max-w-4xl mx-auto w-full">
        {/* Mailboxes */}
        <div className="flex flex-wrap justify-center gap-6 md:gap-10 mb-8">
          {ports.map((portInfo, index) => (
            <Mailbox
              key={portInfo.port}
              port={portInfo.port}
              label={portInfo.label}
              packets={deliveredPackets[index] || []}
              isActive={animatingPackets.some((p) => p.targetPort === index)}
            />
          ))}
        </div>

        {/* Animation zone - packets rising from below */}
        <div className="relative h-32">
          {animatingPackets.map((packet) => (
            <AnimatedPacket
              key={packet.id}
              id={packet.id}
              targetMailboxIndex={packet.targetPort || 0}
              onComplete={() => onAnimationComplete(packet.id, packet.targetPort || 0)}
            />
          ))}
        </div>
      </div>

      {/* Scroll hint */}
      <ScrollHint />
    </section>
  );
}
