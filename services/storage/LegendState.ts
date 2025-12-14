import { observable } from '@legendapp/state';
import {
  configureObservablePersistence,
  persistObservable
} from '@legendapp/state/persist';
import { ObservablePersistMMKV } from '@legendapp/state/persist-plugins/mmkv';
import { randomUUID } from 'expo-crypto';
import { AuthType } from '../Api';
import { Operation } from '../sync/Types';
import { LocalEventRecord } from './EventStore';
import { UtilityPole } from './Schema';

export const STORAGE_OPS_KEY = 'polevision_events_opqueue_v1';

export const STORAGE_EVENTS_KEY = 'polevision_events_store_v1';

export interface TrackPoint {
  lat: number;
  lng: number;
  timestamp?: number;
}

export interface IPoleVisionDB {
  poles: UtilityPole[];
  tracks: TrackPoint[]; 
  agents: any[];
  sanitation: any[];
  roads: any[];
  deviceId: string;
}


let configured = false;

export function initPersistence() {
  if (configured) return;

  configureObservablePersistence({
    pluginLocal: ObservablePersistMMKV,
  });

  configured = true;
}
export const poleVisionDB = observable<IPoleVisionDB>({
  poles: [],
  tracks: [],
  agents:[],
  sanitation:[],
  roads: [],
  deviceId: ''
});

export const poleVisionDBTracks = observable<any>([]);
export const poleVisionDBDeviceId = observable<string>('');

export const opQueue = observable<Operation[]>([]);
export const eventsStore = observable<LocalEventRecord[]>([]);
//@ts-ignore
export const authStore = observable<AuthType>({ kind: "basic" });
//@ts-ignore
persistObservable(authStore, {
  local: "polevision_auth_store",
});

// Per collection
persistObservable(poleVisionDB, { 
  local: {
    name: 'polevision_app_db_v1',
    mmkv: {
      id: "polevision_poles_db"
    }
  }
  // remote
  // PluginLocal
  // PluginRemote
});
persistObservable(poleVisionDBTracks, { 
  local: {
    name: 'polevision_tracks',
    mmkv: {
      id: "polevision_tracks_db"
    }
  } 
});
persistObservable(opQueue, { 
  local: STORAGE_OPS_KEY 
});
persistObservable(eventsStore, { 
  local: STORAGE_EVENTS_KEY 
});

persistObservable(poleVisionDBDeviceId, { 
  local: {
    name: 'polevision_device_meta',
    mmkv: {
      id: "polevision_device_meta_db"
    }
  }
});

if (!poleVisionDBDeviceId.get()) {
  poleVisionDBDeviceId.set(randomUUID());
}

export const clearTrack = () => {
  poleVisionDB.tracks.set([]);
};

export const getPoleVision =()=>{
    return poleVisionDB.poles.get();
} 



// --------- Helper functions ---------
export const setPoleVision = (data: UtilityPole ) => {
  poleVisionDB.poles.set((prev: UtilityPole[]) => [...prev, data]);
};

export const deletePoleVision = (id: string) => {
  poleVisionDB.poles.set(prev => prev.filter(p => p.id !== id));
};

export const addTrackPoint = (point: TrackPoint) => {
  poleVisionDB.tracks.set((prev: TrackPoint[]) => [...prev, point]);
};

export const clearTracks = () => {
  poleVisionDB.tracks.set([]);
};


/*
import { authStore } from "./auth-store";
import { applyAuthConfig } from "./http/applyAuthConfig";

authStore.onChange((auth) => {
  applyAuthConfig(auth);
});
*/