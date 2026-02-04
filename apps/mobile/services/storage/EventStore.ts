import type { BaseEvent, Meta } from '../sync/Types';
import { eventsStore$ } from './LegendState';


export type LocalEventRecord = BaseEvent & { meta: Meta };



// helper to upsert by localId
export function upsertEvent(record: LocalEventRecord) {
  eventsStore$.set(prev => {
    const idx = prev.findIndex(r => r.localId === record.localId);
    if (idx >= 0) {
      const copy = [...prev];
      copy[idx] = record;
      return copy;
    }
    return [...prev, record];
  });
}

export function removeEventByLocalId(localId: string) {
  eventsStore$.set(prev => prev.filter(r => r.localId !== localId));
}

export function getEventByLocalId(localId: string) {
  return eventsStore$.get().find(r => r.localId === localId);
}
