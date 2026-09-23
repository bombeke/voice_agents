import {
  Accuracy,
  getCurrentPositionAsync,
  getLastKnownPositionAsync,
  requestForegroundPermissionsAsync,
} from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";

export interface Position {
  latitude: number;
  longitude: number;
}

/** A cached fix younger than this is good enough to centre the map. */
const MAX_AGE_MS = 60_000;

async function readPosition(): Promise<Position | null> {
  const { status } = await requestForegroundPermissionsAsync();
  if (status !== "granted") return null;
  const loc =
    (await getLastKnownPositionAsync({ maxAge: MAX_AGE_MS })) ??
    (await getCurrentPositionAsync({ accuracy: Accuracy.Balanced }));
  return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
}

/**
 * The device position for the map: the cached fix when there is a recent
 * one (instant), otherwise one balanced fix. Never blocks the first render;
 * `position` stays null until a fix arrives or when permission is denied.
 */
export function useLastKnownPosition() {
  const [position, setPosition] = useState<Position | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const next = await readPosition();
      if (mounted.current && next) setPosition(next);
      return next;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  return { position, refresh };
}
