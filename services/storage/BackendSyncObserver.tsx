import { observe } from '@legendapp/state';
import { useValue } from '@legendapp/state/react';
import NetInfo from '@react-native-community/netinfo';
import { useEffect } from 'react';
import { queryClient } from '../Api';
import { authStore$, CRDTPole, poleVisionDB$, remotePoles$, resolveCRDTPole } from './LegendState';

/**
 * BackendSyncObserver is an observer-only component that observes the remote poles
 * and merges them with the local poles in the LegendState. It will resolve any
 * conflicts between the local and remote poles and update the LegendState
 * accordingly.
 *
 * The component will automatically clean up on unmount.
 */


export function BackendSyncObserver() {
  const authApp = useValue(authStore$);
  //const remote = useValue(remotePoles$);

  useEffect(() => {
    const auth = observe(() => {
      if (!authApp) return;
      queryClient.invalidateQueries({ queryKey: ['alkuistore'] });
    });

    return ()=>{
      auth();
    }
  },[authApp]);

  useEffect(() => {
    let online = true;

    const unsubNet = NetInfo.addEventListener((state: any) => {
      online = !!state.isConnected;
    });
    const dispose = observe(() => {
      if(!online) return;
      const remote = remotePoles$.get();
      if (!remote) return;

      poleVisionDB$.poles.set((local) => {
        const map = new Map(
          local.map((p: any) => [p?.id, p as CRDTPole])
        );

        for (const rp of remote) {
          const lp = map.get(rp.id);
          const merged = resolveCRDTPole(lp, rp);

          if (merged?.deleted) {
            map.delete(rp.id);
          } else if (merged) {
            map.set(rp.id, merged);
          }
        }

        return Array.from(map.values());
      });
    });

    return ()=>{
      dispose();
      unsubNet();
    } 
  }, []);

  return null; // observer-only component
}
