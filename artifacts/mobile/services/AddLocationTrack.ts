import { addTrackPoint } from "@/services/storage/LegendState";
import * as Location from "expo-location";

export const startTrackRecorder = () => {
  return Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: 2000,
      distanceInterval: 2,
    },
    (loc) => {
      addTrackPoint({
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        timestamp: Date.now(),
      });
    }
  );
};
