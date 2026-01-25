import { useObserve } from "@legendapp/state/react";
import NetInfo from "@react-native-community/netinfo";
import { useEffect } from "react";
import { queryClient } from "../Api";
import {
  authStore$,
  CRDTPole,
  isOnline$,
  poleVisionDB$,
  remotePoles$,
  resolveCRDTPole,
} from "./LegendState";

export function BackendSyncObserver() {
  /** 🔹 React to auth changes */
  useObserve(() => {
    if (!authStore$.get()) return;
    queryClient.invalidateQueries({ queryKey: ["alkuistore"] });
  });

  /** 🔹 Track network state (non-observable → observable bridge) */
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      isOnline$.set(!!state.isConnected);
    });
    return unsub;
  }, []);

  /** 🔹 React to remote poles + connectivity */
  useObserve(() => {
    if (!isOnline$.get()) return;

    const remote = remotePoles$.get();
    if (!remote) return;

    poleVisionDB$.poles.set((local) => {
      const map = new Map(local.map((p) => [p.pid, p as CRDTPole]));

      for (const rp of remote) {
        const lp = map.get(rp.pid);
        const merged = resolveCRDTPole(lp, rp);

        if (merged?.deleted) {
          map.delete(rp.pid);
        } else if (merged) {
          map.set(rp.pid, merged);
        }
      }

      return Array.from(map.values());
    });
  });

  return null;
}
