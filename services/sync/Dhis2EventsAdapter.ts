import { axiosClient } from '../Api';
import { UtilityPole } from '../storage/Schema';
import type { BaseEvent, ImportResult, Operation } from './Types';

/**
 * Converts operation batches into DHIS2 tracker/events import payload,
 * posts to /tracker?importStrategy=CREATE_AND_UPDATE (or /events), and
 * returns the DHIS2 import summary so caller can apply server results.
 *
 * Note: Adjust program/programStage mapping to your project.
 */

export const Dhis2EventsAdapter = {

  async get(): Promise<UtilityPole[]> {
      const res = await axiosClient.get('poles'); // adapt to actual endpoint
      return res.data ?? [];
    },

  // If you prefer full-set writes (not used in op-based flow)
  async set(list: UtilityPole[]) {
    await axiosClient.post('poles/import', { poles: list }); // adapt
  },

  async ingestEventOps(ops: Operation<BaseEvent>[]) : Promise<ImportResult> {
    // Convert ops into DHIS2 "events" array
    // For 'create' and 'update', we will push an event object.
    // For 'delete', use dhis2 DELETE per event id (if server id known).
    const creates: BaseEvent[] = [];
    const updates: BaseEvent[] = [];
    const deletes: { event: string }[] = [];

    for (const op of ops) {
      if (op.kind === 'delete') {
        // Delete requires server id (event). If payload contains server id, use it. else try to skip and mark error.
        const serverId = (op.payload && (op.payload as any).id) ?? null;
        if (serverId) deletes.push({ event: serverId });
        else {
          // no server id, attempt to delete by attribute? skip and continue
          console.warn('Delete op with no server id; will remove locally but cannot call server: ', op);
        }
        continue;
      }

      // Build event shape expected by DHIS2. Keep fields minimal and explicit.
      const base = (op.payload ?? {}) as BaseEvent;
      const eventObj: any = {
        // If it's an update and server id present, send id; for create keep event absent so server creates new.
        event: base.id ?? undefined,
        trackedEntityInstance: base.trackedEntityInstance,
        program: base.program,
        programStage: base.programStage,
        orgUnit: base.orgUnit,
        eventDate: base.eventDate,
        status: base.status ?? 'ACTIVE',
        dataValues: base.dataValues ?? [],
        attributeOptionCombo: base.attributeOptionCombo,
        // Add idempotency reference in "notes" or a dataElement if you use one; otherwise use HTTP Idempotency-Key header
      };

      if (op.kind === 'create') creates.push(eventObj);
      else updates.push(eventObj);
    }

    // Prepare payload for import: DHIS2 supports /tracker/events with { events: [...] }
    // We will send creates and updates together, server will import accordingly.
    const payload = { events: [...creates, ...updates] };

    // Use Idempotency header combining op IDs to help server ignore duplicates (if server supports)
    const idempotencyKey = ops.map(o => o.idempotencyKey ?? o.opId).join(',');

    try {
      // Use the import endpoint: POST /tracker?importStrategy=CREATE_AND_UPDATE
      // Some DHIS2 versions accept POST /tracker/events with body { events: [...] }
      const res = await axiosClient.post('/tracker?importStrategy=CREATE_AND_UPDATE', payload, {
        headers: { 'Idempotency-Key': idempotencyKey },
      });

      const importSummary = res.data?.response?.importSummaries ?? res.data?.importSummary ?? res.data?.response ?? res.data;
      // Many DHIS2 responses include importSummary or response.importSummaries
      return { importSummary, acceptedEventsCount: creates.length + updates.length };
    } catch (err) {
      // rethrow with context
      throw err;
    }
  },

  /** Helper to fetch remote events (pull) */
  async fetchRemoteEvents(params?: Record<string, any>) {
    // Use DHIS2 tracker/events endpoint; include paging params if necessary
    try {
      const res = await axiosClient.get('/tracker/events', { params });
      // Res body format may differ; adapt to your DHIS2 version
      const remoteEvents = res.data?.events ?? res.data;
      return remoteEvents;
    }
    catch(err){
      console.error('Pull data failed', err);
      return []
    }
  }
}