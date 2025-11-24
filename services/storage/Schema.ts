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
