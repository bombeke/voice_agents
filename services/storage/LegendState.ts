import { observable, syncState } from '@legendapp/state';
import { ObservablePersistMMKV } from '@legendapp/state/persist-plugins/mmkv';
import { configureSynced, syncObservable } from '@legendapp/state/sync';
import { syncedQuery } from '@legendapp/state/sync-plugins/tanstack-query';
import { randomUUID } from 'expo-crypto';
import { AuthType, axiosClient, queryClient } from '../Api';
import { Operation } from '../sync/Types';
import { LocalEventRecord } from './EventStore';

export const STORAGE_OPS_KEY = 'polevision_events_opqueue_v1';

export const STORAGE_EVENTS_KEY = 'polevision_events_store_v1';

export interface TrackPoint {
  lat: number;
  lng: number;
  timestamp?: number;
}

export interface IPoleVisionDB {
  poles: CRDTPole[];
  tracks: TrackPoint[]; 
  agents: any[];
  sanitation: any[];
  roads: any[];
  deviceId: string;
}
export interface RemotePole extends UtilityPole {
  updatedAt?: string;
  deleted?: boolean;
}
export interface SyncMeta {
  updatedAt: string;
  deviceId: string;
  deleted?: boolean;
}

export interface UtilityPole {
  id: string;
  latitude: number;
  longitude: number;
  timestamp: number;
  imageUri?: string;
  detectionConfidence?: number;
  synced: boolean;
  dhis2Id?: string;
  vc: VectorClock;
}

export type SyncedPole = UtilityPole & SyncMeta;

export interface AuditEvent {
  type: string;
  payload: any;
  ts: number;
}
export type VectorClock = Record<string, number>; // deviceId -> counter
export interface CRDTPole extends UtilityPole {
  vc: VectorClock;
  deleted?: boolean;
}


let configured = false;


export const poleVisionDB$ = observable<IPoleVisionDB>({
  poles: [],
  tracks: [],
  agents:[],
  sanitation:[],
  roads: [],
  deviceId: ''
});

export const poleVisionDBTracks$ = observable<any>([]);
export const poleVisionDBDeviceId$ = observable<string>('');

export const opQueue$ = observable<Operation[]>([]);
export const eventsStore$ = observable<LocalEventRecord[]>([]);
//@ts-ignore
export const authStore$ = observable<AuthType>({ kind: "basic" });

if (!poleVisionDBDeviceId$.get()) {
  poleVisionDBDeviceId$.set(randomUUID());
}

export function initPersistence() {
  if (configured) return;

  const syncPlugin = configureSynced({
    persist:{
      plugin: ObservablePersistMMKV,
    }
  });

  syncObservable(authStore$, syncPlugin({
    persist:{
      name: "polevision_auth_store",
    }
  }));

  // Per collection
  syncObservable(poleVisionDB$, syncPlugin({ 
    persist: {
      name: 'polevision_app_db_v1',
      mmkv: {
        id: "polevision_poles_db"
      }
    }
    // remote
    // PluginLocal
    // PluginRemote
  }));
  syncObservable(poleVisionDBTracks$, syncPlugin({ 
    persist: {
      name: 'polevision_tracks',
      mmkv: {
        id: "polevision_tracks_db"
      }
    } 
  }));
  
  syncObservable(opQueue$, syncPlugin({ 
    persist:{
      name: STORAGE_OPS_KEY 
    }
  }));

  syncObservable(eventsStore$, { 
    persist: {
      name: STORAGE_EVENTS_KEY
    } 
  });

  syncObservable(poleVisionDBDeviceId$, syncPlugin({ 
    persist: {
      name: 'polevision_device_meta',
      mmkv: {
        id: "polevision_device_meta_db",
      }
    }
  }))

  configured = true;
}

export const remotePoles$ = observable(
  syncedQuery<SyncedPole[]>({
    queryClient,

    query: {
      queryKey: ['metadata'],
      queryFn: async () => {
        console.log("Fetching poles");
        const res = await axiosClient.get('/metadata');
        if (res.status !== 200) {
          console.log('Failed to fetch poles');
          return [];
        }
        return res.data;
      },
    },
  })
);

export const syncPoleToServer = async (pole: SyncedPole) => {
  console.log("POLE STARTED SYNCING")
  if(pole.deleted){
    console.log("DELETING POLE")
    const deleteRes = await axiosClient.delete(`/metadata/${pole.id}`);
    if (deleteRes.status !== 200) {
      console.log('Failed to sync pole');
      return null;
    } 
    return deleteRes.data;
  }
  else{
    const res = await axiosClient.put(
      pole?.id?`/metadata/${pole?.id}`:`/metadata`,
      pole,
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
    if (res.status !== 200) {
      console.log('Failed to sync pole');
      return null;
    } 
    return res.data;
  }
}



/*observe(() => {
  const remote = remotePoles$.get();
  if (!remote?.length) return;

  poleVisionDB$.poles.set((local) => {
    const map = new Map(local.map(p => [p.id, p]));

    for (const pole of remote) {
      if (!pole.deleted) {
        map.set(pole.id, pole);
      }
    }

    return Array.from(map.values());
  });
});
*/
/*observe(() => {
  const remote = remotePoles$.get();
  if (!remote?.length) return;

  poleVisionDB$.poles.set((local) => {
    const map = new Map(local.map(p => [p.id, p as SyncedPole]));

    for (const rp of remote) {
      const lp = map.get(rp.id);
      const resolved = resolveConflict(lp, rp);
      
      if (resolved?.deleted) {
        map.delete(rp.id);
      } 
      else if (resolved) {
        map.set(rp.id, resolved);
      }
    }

    return Array.from(map.values());
  });
});
*/


export const getPoleVision =()=>{
    return poleVisionDB$.poles.get();
} 

// --------- Helper functions ---------

//const remotePolesStatus$ = syncState(remotePoles$);

export const setPoleVision = (data: UtilityPole) => {
  const deviceId = poleVisionDBDeviceId$.get();
  const synced: SyncedPole & CRDTPole = {
    ...data,
    updatedAt: new Date().toISOString(),
    deviceId,
    vc: bumpVC(data?.vc ?? {}, deviceId),
  };

  // Update local state
  poleVisionDB$.poles.set(prev => [...prev.filter(p => p.id !== data.id), synced]);

  // Enqueue op for offline retry
  enqueuePoleOp(synced);

  // Audit trail
  eventsStore$.set((e: any) => [
    ...e,
    { type: 'POLE_UPSERT', payload: synced, ts: Date.now() },
  ]);
  console.log("POLE ADDED")
};

export const deletePoleVision = (id: string) => {
  const deviceId = poleVisionDBDeviceId$.get();
  const deletedPole: Partial<SyncedPole & CRDTPole> = {
    id,
    deleted: true,
    updatedAt: new Date().toISOString(),
    deviceId,
  };

  // Update local state
  poleVisionDB$.poles.set(prev => prev.filter(p => p.id !== id));

  // Enqueue op for offline retry
  enqueuePoleOp(deletedPole as SyncedPole);

  // Audit trail
  eventsStore$.set((e: any) => [
    ...e,
    { type: 'POLE_DELETE', payload: deletedPole, ts: Date.now() },
  ]);
};

export const addTrackPoint = (point: TrackPoint) => {
  poleVisionDB$.tracks.set((prev: TrackPoint[]) => [...prev, point]);
};

export const clearTracks = () => {
  poleVisionDB$.tracks.set([]);
};


/*
import { authStore } from "./auth-store";
import { applyAuthConfig } from "./http/applyAuthConfig";

authStore.onChange((auth) => {
  applyAuthConfig(auth);
});
*/

export const resolveConflict =(
  local?: SyncedPole,
  remote?: SyncedPole
): SyncedPole | undefined =>{
  if (!local) return remote;
  if (!remote) return local;

  const lt = new Date(local.updatedAt).getTime();
  const rt = new Date(remote.updatedAt).getTime();

  if (lt > rt) return local;
  if (rt > lt) return remote;

  // tie-breaker
  return local.deviceId > remote.deviceId ? local : remote;
}

export const enqueuePoleOp =(pole: SyncedPole) => {
  opQueue$.set((q: any) => [
    ...q,
    {
      id: randomUUID(),
      type: 'SYNC_POLE',
      payload: pole,
      retries: 0,
      createdAt: Date.now(),
    },
  ]);
}

export const upsertPole = (pole: UtilityPole) => {
  const deviceId = poleVisionDBDeviceId$.get();
  const synced: SyncedPole & CRDTPole = {
    ...pole,
    updatedAt: new Date().toISOString(),
    deviceId: poleVisionDBDeviceId$.get(),
    vc: bumpVC(pole?.vc ?? {}, deviceId),
  };

  poleVisionDB$.poles.set(prev =>
    [...prev.filter((p: any) => p?.id !== pole?.id), synced]
  );

  enqueuePoleOp(synced);

  eventsStore$.set((e: any) => [
    ...e,
    { type: 'POLE_UPSERT', payload: synced, ts: Date.now() },
  ]);
};

export const deletePole = (id: string) => {
  const deleted: SyncedPole = {
    id,
    deleted: true,
    updatedAt: new Date().toISOString(),
    deviceId: poleVisionDBDeviceId$.get(),
  } as any;

  poleVisionDB$.poles.set(prev => prev.filter((p: any) => p?.id !== id));
  enqueuePoleOp(deleted);

  eventsStore$.set((e: any) => [
    ...e,
    { type: 'POLE_DELETE', payload: deleted, ts: Date.now() },
  ]);
};

export const replayOpQueue = async (status$: ReturnType<typeof syncState>) => {
  const queue: any = opQueue$.get();

  for (const op of queue) {
    try {
     // poleVisionDB$.poles.set(prev => [...prev.filter(p => p.id !== op.payload.id), op.payload]);
      await syncPoleToServer(op.payload);
      await status$.sync();
      opQueue$.set((q: any) => q.filter((o: any) => o?.id !== op?.id));
    } 
    catch (err) {
      // Increment retry count
      opQueue$.set(q =>
        q.map((o: any) => (o?.id === op?.id ? { ...o, retries: (o?.retries ?? 0) + 1 } : o))
      );
      break; // stop on first failure
    }
  }
};

export const bumpVC =(vc: VectorClock, deviceId: string): VectorClock => {
  return {
    ...vc,
    [deviceId]: (vc[deviceId] ?? 0) + 1,
  };
}

export type VCRelation = 'BEFORE' | 'AFTER' | 'CONCURRENT' | 'EQUAL';

export const compareVC =(a: VectorClock, b: VectorClock): VCRelation => {
  let gt = false, lt = false;

  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);

  for (const k of keys) {
    const av = a[k] ?? 0;
    const bv = b[k] ?? 0;
    if (av > bv) gt = true;
    if (av < bv) lt = true;
  }

  if (gt && lt) return 'CONCURRENT';
  if (gt) return 'AFTER';
  if (lt) return 'BEFORE';
  return 'EQUAL';
}

export const mergeConcurrent =(a: CRDTPole, b: CRDTPole): CRDTPole => {
  return {
    ...a,
    ...b,
    // deterministic tie-break
    //name: a.name > b.name ? a.name : b.name,
    //height: Math.max(a.height ?? 0, b.height ?? 0),
    vc: mergeVC(a.vc, b.vc),
    deleted: a.deleted || b.deleted,
  };
}

export const mergeVC =(a: VectorClock, b: VectorClock): VectorClock => {
  const merged: VectorClock = {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);

  for (const k of keys) {
    merged[k] = Math.max(a[k] ?? 0, b[k] ?? 0);
  }

  return merged;
}

export const  resolveCRDTPole =(
  local?: CRDTPole,
  remote?: CRDTPole
): CRDTPole | undefined => {
  if (!local) return remote;
  if (!remote) return local;

  const rel = compareVC(local.vc, remote.vc);

  if (rel === 'AFTER') return local;
  if (rel === 'BEFORE') return remote;
  if (rel === 'EQUAL') return local;

  // CONCURRENT
  return mergeConcurrent(local, remote);
}
