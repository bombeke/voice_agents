import { observable } from '@legendapp/state';
import {
  configureObservablePersistence,
  persistObservable
} from '@legendapp/state/persist';
import { ObservablePersistMMKV } from '@legendapp/state/persist-plugins/mmkv';
import { UtilityPole } from './Schema';

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
}

configureObservablePersistence({
  pluginLocal: ObservablePersistMMKV
})

export const poleVisionDB = observable<IPoleVisionDB>({
  poles: [],
  tracks: [],
  agents:[],
  sanitation:[],
  roads: []
});

/*persistObservable(poleVisionDB, {
  local: 'polevision_store',
})*/

// Per collection
persistObservable(poleVisionDB.poles, { local: 'polevision_poles' });
persistObservable(poleVisionDB.tracks, { local: 'polevision_tracks' });



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
