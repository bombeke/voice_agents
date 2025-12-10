import { useEffect, useState } from "react";

import { useMMKVStorage } from "@/components/MmkvContext";
import { useUtilityStorePoles } from "@/providers/UtilityStoreProvider";
import { getGeoTags } from "@/services/storage/Storage";
import { nanoid } from "nanoid";

export function usePhotoGeoJSON(db: any) {
  //const [data, setData] = useMMKVValue('photos',[]);
  const { poles } = useUtilityStorePoles();
  const [photos,setPhotos] = useState<any[]>([]);
  const [geojson, setGeojson] = useState({ type: "FeatureCollection", features: [] });
  console.log("POLES:",poles)
 
  useEffect(()=>{
    if(poles && Array.isArray(poles)){
      setPhotos((prevPoles)=>[...prevPoles,...poles]);
    }
  },[poles]);

  useEffect(() => {

    if(photos && Array.isArray(photos)){
      /*const sub = photos?.find().$.subscribe((docs: any) => {
          if (docs) setGeojson(toGeoJSON(docs as any));
        });

      return () => sub.unsubscribe();
      */
     setGeojson(toGeoJSON(photos as any))
    }
  }, [photos]);

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
