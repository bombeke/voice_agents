import { replicateWebRTC } from "rxdb/plugins/replication-webrtc";

import { API_URL } from "@/constants/Config";
import { replicateRxCollection } from "rxdb/plugins/replication";

export function setupSync(db: any) {
  replicateWebRTC({
    collection: db.photos,
    topic: "geo-photos-sync",
    password: "optional-secret"
  });
}


export function setupClickHouseSync(db: any) {
  const collection = db.photos;

  replicateRxCollection({
    collection,
    replicationIdentifier: "photos-sync",
    live: true,
    retryTime: 5000,
    pull: {
      async handler(lastCheckpoint:any) {
        const since = lastCheckpoint?.updatedAt || "1970-01-01T00:00:00.000";
        const res = await fetch(`${API_URL}/photos/changes?since=${since}`);
        const data = await res.json();
        const newCheckpoint = data.length ? data[data.length - 1] : lastCheckpoint;
        return { documents: data, checkpoint: newCheckpoint };
      }
    },
    push: {
      async handler(docs: any) {
        await fetch(`${API_URL}/photos/bulk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(docs)
        });
        return []; // no conflicts
      }
    }
  });
}
