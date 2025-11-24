import { useEffect, useState } from "react";

import { useMMKVStorage } from "@/components/MmkvContext";
import { getGeoTags } from "@/services/storage/Storage";
import { nanoid } from "nanoid";

export function usePhotoGeoJSON(db: any) {
  const [geojson, setGeojson] = useState({ type: "FeatureCollection", features: [] });

  useEffect(() => {
    if(db?.photos && Array.isArray(db?.photos)){
      const sub = db?.photos?.find().$.subscribe((docs: any) => {
          if (docs) setGeojson(toGeoJSON(docs as any));
        });

      return () => sub.unsubscribe();
    }
  }, [db]);

  return geojson;
}

export function toGeoJSON(docs: any) {
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
