import { syncState } from '@legendapp/state';
import NetInfo from '@react-native-community/netinfo';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { remotePoles$, replayOpQueue } from './LegendState';

export function OpQueueReplayObserver() {
  const replayingRef = useRef(false);
  const onlineRef = useRef(true);

  const status$ = syncState(remotePoles$ as any);

  useEffect(() => {
    const unsubNet = NetInfo.addEventListener(state => {
      onlineRef.current = !!state.isConnected;
    });

    const sub = AppState.addEventListener('change', async state => {
      if (state !== 'active' || !onlineRef.current) return;
      if (replayingRef.current) return;

      replayingRef.current = true;
      try {
        await replayOpQueue(status$);
      } 
      finally {
        replayingRef.current = false;
      }
    });

    return () => {
      sub.remove();
      unsubNet();
    };
  }, []);

  return null;
}