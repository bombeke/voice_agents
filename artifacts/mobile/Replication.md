# How to replicate and sync data

1) Start the sync manager on app init:

import { EventSyncManager } from '@/services/sync/SyncManagerEvents';

const trackerSync = new EventSyncManager({
  actorId: `device:${DeviceInfo.getUniqueId()}`, // or user id
  batchSize: 20,
  intervalMs: 30_000,
  mergeStrategy: 'FieldLevel', // or 'LWW' or 'ServerWins'
});

const stopSync = trackerSync.startAuto();
// Keep stopSync to stop on app exit

2) Creating an event locally (example):

import { eventsStore } from '@/services/storage/eventsStore';
import { queueOp } from '@/services/storage/opQueue';
import { v4 as uuidv4 } from 'uuid';

function createLocalEvent(payload) {
  const localId = uuidv4();
  const now = new Date().toISOString();
  const rec = {
    localId,
    program: payload.program,
    programStage: payload.programStage,
    orgUnit: payload.orgUnit,
    eventDate: payload.eventDate ?? now,
    status: payload.status ?? 'ACTIVE',
    dataValues: payload.dataValues ?? [],
    meta: { localId, updatedAt: now, actor: 'device:abc-123', status: 'PENDING' }
  };
  eventsStore.set(prev => [...prev, rec]);
  queueOp({ kind: 'create', recordLocalId: localId, payload: rec, actor: 'device:abc-123' });
}

3) Update event:

function patchEvent(localId, patch) {
  const now = new Date().toISOString();
  eventsStore.set(prev => prev.map(r => r.localId === localId ? { ...r, ...patch, meta: { ...(r.meta || {}), updatedAt: now } } : r));
  queueOp({ kind: 'update', recordLocalId: localId, payload: patch, actor: 'device:abc-123' });
}

4) Delete:

function deleteEvent(localId) {
  // Optionally mark as deleted locally, or remove immediately
  eventsStore.set(prev => prev.filter(r => r.localId !== localId));
  queueOp({ kind: 'delete', recordLocalId: localId, payload: { id: /* server id if known */ '' }, actor: 'device:abc-123' });
}

5) Import summary mapping:
- The code attempts a best-effort: after successful ingest, it sets local meta.status = SYNCED.
- If the DHIS2 response contains mappings of local temporary ids -> server event ids, add logic in ingestEventOps to extract them and update the local eventsStore (set `meta.id = serverEventId`).
