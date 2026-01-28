import type { AnimatingPacket } from './index';

// Animation phase types
export type PacketAnimationPhase = 'start' | 'rising' | 'delivered';
export type DroppedAnimationPhase = 'start' | 'bouncing' | 'done';

// Packet with animation state
export interface AnimatingPacketWithPhase extends AnimatingPacket {
  phase: PacketAnimationPhase;
  phaseStartTime: number;
}

// Dropped packet with animation state
export interface DroppedPacketWithPhase extends AnimatingPacket {
  phase: DroppedAnimationPhase;
  phaseStartTime: number;
  direction: 'left' | 'right';
}

// Phase transition configuration
export interface PhaseTransition<T extends string> {
  duration: number;
  next: T | 'completed';
}

export const PACKET_PHASE_TRANSITIONS: Record<PacketAnimationPhase, PhaseTransition<PacketAnimationPhase>> = {
  start: { duration: 50, next: 'rising' },
  rising: { duration: 700, next: 'delivered' },
  delivered: { duration: 200, next: 'completed' },
};

export const DROPPED_PHASE_TRANSITIONS: Record<DroppedAnimationPhase, PhaseTransition<DroppedAnimationPhase>> = {
  start: { duration: 50, next: 'bouncing' },
  bouncing: { duration: 750, next: 'done' },
  done: { duration: 500, next: 'completed' },
};
