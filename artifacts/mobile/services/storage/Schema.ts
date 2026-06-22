
export const utilityPoleSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 36,
      format: "uuid"
    },
    latitude: {
      type: 'number',
    },
    longitude: {
      type: 'number',
    },
    timestamp: {
      type: 'number',
    },
    imageUri: {
      type: 'string',
    },
    detectionConfidence: {
      type: 'number',
    },
    synced: {
      type: 'boolean',
    },
    dhis2Id: {
      type: 'string',
    },
  },
  //required: ['id', 'latitude', 'longitude', 'timestamp', 'synced'],
  //indexes: ['timestamp', 'synced'],
};


export const photoSchema = {
  title: "photo schema",
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string" },
    uri: { type: "string" },
    latitude: { type: "number" },
    longitude: { type: "number" },
    createdAt: { type: "string", format: "date-time" }
  },
  required: ["id", "uri", "latitude", "longitude", "createdAt"]
};
