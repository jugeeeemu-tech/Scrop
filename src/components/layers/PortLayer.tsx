import { Mailbox } from '../port/Mailbox';
import { AnimatedPacket } from '../packet/AnimatedPacket';
import { PacketStream } from '../packet/PacketStream';
import { ScrollHint } from '../common/ScrollHint';
import { useRef, useState, useEffect, useCallback } from 'react';

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
  streamingPorts?: number[];
}

export function PortLayer({ ports, deliveredPackets, animatingPackets, onAnimationComplete, streamingPorts = [] }: PortLayerProps) {
  const mailboxRefs = useRef<(HTMLDivElement | null)[]>([]);
  const animationZoneRef = useRef<HTMLDivElement>(null);
  const [mailboxPositions, setMailboxPositions] = useState<number[]>([]);

  const updateMailboxPositions = useCallback(() => {
    if (!animationZoneRef.current) return;

    const zoneRect = animationZoneRef.current.getBoundingClientRect();
    const positions = mailboxRefs.current.map((ref) => {
      if (!ref) return 0;
      const rect = ref.getBoundingClientRect();
      // Calculate mailbox center X relative to animation zone's left edge
      return rect.left + rect.width / 2 - zoneRect.left;
    });
    setMailboxPositions(positions);
  }, []);

  useEffect(() => {
    updateMailboxPositions();

    window.addEventListener('resize', updateMailboxPositions);
    return () => window.removeEventListener('resize', updateMailboxPositions);
  }, [updateMailboxPositions, ports.length]);

  return (
    <section className="min-h-screen pt-20 pb-8 px-6 flex flex-col">
      <div className="flex-1 flex flex-col justify-center max-w-4xl mx-auto w-full">
        {/* Mailboxes */}
        <div className="flex flex-wrap justify-center gap-6 md:gap-10 mb-8">
          {ports.map((portInfo, index) => (
            <Mailbox
              key={portInfo.port}
              ref={(el) => {
                mailboxRefs.current[index] = el;
              }}
              port={portInfo.port}
              label={portInfo.label}
              packets={deliveredPackets[index] || []}
              isActive={animatingPackets.some((p) => p.targetPort === index)}
            />
          ))}
        </div>

        {/* Animation zone - packets rising from below */}
        <div ref={animationZoneRef} className="relative h-32">
          {/* Stream mode for high-traffic ports */}
          {streamingPorts.map((portIndex) => (
            <PacketStream
              key={`stream-${portIndex}`}
              targetX={mailboxPositions[portIndex] || 0}
            />
          ))}
          {/* Individual packet animations for normal traffic */}
          {animatingPackets
            .filter((packet) => !streamingPorts.includes(packet.targetPort || 0))
            .map((packet) => (
              <AnimatedPacket
                key={packet.id}
                id={packet.id}
                targetX={mailboxPositions[packet.targetPort || 0] || 0}
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
