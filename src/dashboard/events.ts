import { EventEmitter } from 'events';
import { Server } from 'socket.io';

export interface ForgeEvent {
  type: string;
  runId: string;
  timestamp: Date;
  data: Record<string, unknown>;
}

const runEvents = new Map<string, ForgeEvent[]>();
const bridgedEvents = [
  'forge:started',
  'phase:started',
  'phase:completed',
  'agent:started',
  'agent:completed',
  'agent:escalated',
  'wave:completed',
  'forge:completed',
  'forge:failed',
];

export function createForgeEmitter(): EventEmitter {
  return new EventEmitter();
}

function storeRunEvent(event: ForgeEvent): void {
  const events = runEvents.get(event.runId) || [];
  events.push(event);

  if (events.length > 100) {
    events.splice(0, events.length - 100);
  }

  runEvents.set(event.runId, events);
}

function toEventData(payload: unknown): Record<string, unknown> {
  if (payload !== null && typeof payload === 'object') {
    return payload as Record<string, unknown>;
  }

  return { value: payload };
}

export function attachSocketBridge(io: Server, emitter: EventEmitter, runId: string): void {
  bridgedEvents.forEach((eventName) => {
    emitter.on(eventName, (payload: unknown) => {
      const event: ForgeEvent = {
        type: eventName,
        runId,
        timestamp: new Date(),
        data: toEventData(payload),
      };

      storeRunEvent(event);
      io.to(runId).emit(eventName, event);
    });
  });
}

export function getRunEvents(runId: string): ForgeEvent[] {
  return runEvents.get(runId) || [];
}
