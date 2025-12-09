import { observable } from "@legendapp/state";
import {
    observablePersistMMKV,
} from '@legendapp/state/persist-plugins/mmkv';
import { configureSynced, syncObservable } from "@legendapp/state/sync";

const syncMMKVPlugin = configureSynced({
    persist: {
        plugin: observablePersistMMKV({ id: "polevision_db"})
    }
});

export const poleVisionDB = observable({
  poles: [],
  agents:[],
  sanitation:[],
  roads: []
});

syncObservable(poleVisionDB, syncMMKVPlugin({
    persist:{
        name: 'poleVisionStore' 
    }
}));

export const getPoleVision =()=>{
    return poleVisionDB.poles.get();
} 


export const setPoleVision =(data: any)=>{
    return poleVisionDB.poles.set((currentData) => [...currentData, data]);
}