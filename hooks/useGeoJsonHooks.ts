import { useEffect, useMemo, useState } from "react";

import { useMMKVStorage } from "@/components/MmkvContext";
import { useUtilityStorePoles } from "@/providers/UtilityStoreProvider";
import { getGeoTags } from "@/services/storage/Storage";
import { nanoid } from "nanoid";

export function usePhotoGeoJSON() {
  const { poles, isLoading } = useUtilityStorePoles();
  const [photos, setPhotos] = useState<any[]>([]);

  useEffect(() => {
    if (!Array.isArray(poles)) return;
    setPhotos(prev => {
      const same =
        prev.length === poles.length &&
        prev.every((p, i) => p.id === poles[i].id);

      return same ? prev : poles;
    });
    
  }, [poles]);

   const geojson = useMemo(() => {
    return toGeoJSON(photos);
  }, [photos]);
  console.log("Photos:",photos,"poles:",poles, "Loading:",isLoading)
  return geojson;
}


export function toGeoJSON(docs: any[]) {
  return {
    type: "FeatureCollection",
    features: docs?.map((doc: any) => ({
      type: "Feature",
      properties: {
        id: doc.id,
        uri: doc.uri
      },
      geometry: {
        type: "Point",
        coordinates: [doc.longitude, doc.latitude]
      }
    }))
  };
}

export async function saveGeoPhoto(db: any, { uri, lat, lng }: any) {
  const id = nanoid();
  const storage = useMMKVStorage();
  if(storage){
    // store inside MMKV fast lookups or offline cache
    storage.set(`photo:${id}`, JSON.stringify({ uri, lat, lng }));

    // store in RxDB for sync + map rendering
    await db.photos.insert({
      id,
      uri,
      latitude: lat,
      longitude: lng,
      createdAt: new Date().toISOString()
    });
  }
}


export function geoTagsToGeoJSON() {
  const tags = getGeoTags();

  return {
    type: "FeatureCollection",
    features: tags.map((t: any, index: number) => ({
      type: "Feature",
      id: index,
      properties: {
        created: t.created,
        uri: t.uri,
      },
      geometry: {
        type: "Point",
        coordinates: [t.longitude, t.latitude],
      },
    })),
  };
}
