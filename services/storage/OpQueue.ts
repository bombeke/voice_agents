import { randomUUID } from 'expo-crypto';
import type { Operation } from '../sync/Types';
import { opQueue } from './LegendState';


export function queueOp(op: Omit<Operation, 'opId' | 'timestamp' | 'attempts'>) {
  const full: Operation = {
    ...op,
    opId: randomUUID(),
    timestamp: new Date().toISOString(),
    attempts: 0,
    idempotencyKey: op.idempotencyKey ?? `op-${op.recordLocalId}-${Date.now()}`,
  };
  opQueue.push(full);
  return full;
}

export function bumpAttempt(opId: string) {
  opQueue.set(prev => prev.map(o => o.opId === opId ? { ...o, attempts: (o.attempts ?? 0) + 1 } : o));
}

export function removeOps(opIds: string[]) {
  opQueue.set(prev => prev.filter(o => !opIds.includes(o.opId)));
}

export function clearOpQueue() { opQueue.set([]); }
