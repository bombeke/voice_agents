import type { BaseEvent } from './Types';

/** LWW by meta.updatedAt */
export function mergeLWW(local: (BaseEvent & any) | undefined, remote: (BaseEvent & any) | undefined) {
  if (!local) return { merged: remote, shouldPushLocal: false };
  if (!remote) return { merged: local, shouldPushLocal: true };
  const l = new Date(local.meta?.updatedAt ?? 0).getTime();
  const r = new Date(remote?.lastUpdated ?? remote.meta?.serverUpdatedAt ?? remote.meta?.updatedAt ?? 0).getTime();
  if (r > l) return { merged: { ...remote, meta: { ...local.meta, serverUpdatedAt: remote.lastUpdated ?? remote.meta?.updatedAt } }, shouldPushLocal: false };
  return { merged: local, shouldPushLocal: true };
}

/** ServerWins: always prefer remote if present */
export function mergeServerWins(local: (BaseEvent & any) | undefined, remote: (BaseEvent & any) | undefined) {
  if (!remote) return { merged: local, shouldPushLocal: !!local };
  return { merged: { ...remote, meta: { ...(local?.meta ?? {}), serverUpdatedAt: remote.lastUpdated ?? remote.meta?.updatedAt } }, shouldPushLocal: false };
}

/** Field-level merge using meta.fieldTimestamps on local and `dataValues` timestamps on remote (if available).
 * For simplicity we compare top-level fields and dataValues by dataElement id.
 */
export function mergeFieldLevel(local: (BaseEvent & any) | undefined, remote: (BaseEvent & any) | undefined) {
  if (!local) return { merged: remote, shouldPushLocal: false };
  if (!remote) return { merged: local, shouldPushLocal: true };

  const merged: any = { ...local };
  // Merge top-level simple fields (orgUnit, status, eventDate)
  const fields = ['orgUnit', 'status', 'eventDate', 'programStage'];
  const localFT = (local.meta?.fieldTimestamps) ?? {};
  const remoteFT = (remote.meta?.fieldTimestamps) ?? {}; // remote might not provide these; remote.lastUpdated fallback used per field

  for (const f of fields) {
    const lt = localFT[f] ? new Date(localFT[f]).getTime() : 0;
    // remote may not have per-field timestamps; fallback to overall lastUpdated
    const rt = remoteFT[f] ? new Date(remoteFT[f]).getTime() : new Date(remote.lastUpdated ?? 0).getTime();
    merged[f] = rt > lt ? remote[f] : local[f];
  }

  // Merge dataValues by dataElement — prefer value with newest timestamp if available
  const dvMap: Record<string, { value: any; ts: number }> = {};
  for (const dv of local.dataValues ?? []) dvMap[dv.dataElement] = { value: dv.value, ts: local.meta?.fieldTimestamps?.[`dv:${dv.dataElement}`] ? new Date(local.meta.fieldTimestamps[`dv:${dv.dataElement}`]).getTime() : new Date(local.meta?.updatedAt ?? 0).getTime() };
  for (const dv of remote.dataValues ?? []) {
    const rts = remote.meta?.fieldTimestamps?.[`dv:${dv.dataElement}`] ? new Date(remote.meta.fieldTimestamps[`dv:${dv.dataElement}`]).getTime() : new Date(remote.lastUpdated ?? 0).getTime();
    const existing = dvMap[dv.dataElement];
    if (!existing || rts > existing.ts) dvMap[dv.dataElement] = { value: dv.value, ts: rts };
  }
  merged.dataValues = Object.entries(dvMap).map(([de, v]) => ({ dataElement: de, value: v.value }));

  // update merged.meta.updatedAt to newest known
  merged.meta = { ...(merged.meta ?? {}), updatedAt: new Date(Math.max(new Date(local.meta?.updatedAt ?? 0).getTime(), new Date(remote.lastUpdated ?? 0).getTime())).toISOString(), serverUpdatedAt: remote.lastUpdated ?? remote.meta?.updatedAt };

  return { merged, shouldPushLocal: false };
}
