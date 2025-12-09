import { observable } from '@legendapp/state';
import {
    configureObservablePersistence,
    persistObservable
} from '@legendapp/state/persist';
import { ObservablePersistMMKV } from '@legendapp/state/persist-plugins/mmkv';

configureObservablePersistence({
  // Use AsyncStorage in React Native
  pluginLocal: ObservablePersistMMKV
})


export const poleVisionDB = observable({
  poles: [],
  agents:[],
  sanitation:[],
  roads: []
});

persistObservable(poleVisionDB, {
  local: 'polevision_store',
})
/*
syncObservable(
    poleVisionDB, 
    syncMMKVPlugin({
        persist: {
            name: 'poleVisionStore',
            plugin: observablePersistMMKV({ 
                id: "polevision_db"
            })
        }
    })
);
*/
/*
const messages$ = observable(syncedQuery({
    poles: [],
  queryClient,
  query: {
    queryKey: ['messages'],
    queryFn: async () => {
      return fetch('https://myurl/messages').then((v) => v.json())
    },
  },
  mutation: {
    mutationFn: async (variables) => {
      return fetch(
        'https://myurl/messages',
        { body: JSON.stringify(variables), method: 'POST' }
      )
    },
  },
  // Persist locally
  persist: {
    plugin: observablePersistMMKV({ id : 'polevision_db'}),
    name: 'messages',
    retrySync: true // Retry sync after reload
  },
  changesSince: 'last-sync' // Sync only diffs
}))
  */

export const getPoleVision =()=>{
    return poleVisionDB.poles.get();
} 


export const setPoleVision =(data: any)=>{
    return poleVisionDB.poles.set(data);
}

export const deletePoleVision = (id: string) => {
    poleVisionDB.poles.set(prevPoles => 
        prevPoles.filter((data: any) => data.id !== id)
    );
};
