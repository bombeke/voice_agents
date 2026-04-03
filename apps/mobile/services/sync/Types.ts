import { Dhis2EventsAdapter } from "./Dhis2EventsAdapter";

export type ActorId = string;

export type MergeStrategy = 'LWW' | 'ServerWins' | 'FieldLevel' | MergeFn<any> | ((l: any, r: any) => any);

export type ImportResult = {
  importSummary: any;
  acceptedEventsCount?: number;
};

export type MergeFn<T extends BaseEvent> = (local: T | undefined, remote: T | undefined) => { 
    merged: T | undefined; 
    shouldPushLocal?: boolean 
};


export type SyncOptions<T> = {
  actorId: string;
  batchSize?: number;
  intervalMs?: number;
  mergeStrategy?: MergeStrategy;
  remoteAdapter?: typeof Dhis2EventsAdapter;
};

export type Meta = {
  id?: string; // server id (event id) if available
  localId: string; // local uuid
  updatedAt: string; // ISO on client
  serverUpdatedAt?: string; // ISO from server if present
  version?: number;
  fieldTimestamps?: Record<string, string>; // for field-level merges
  actor?: ActorId;
  status?: 'SYNCED' | 'PENDING' | 'ERROR';
};

export type BaseEvent = {
  id?: string; // server event id (may be absent until server assigns)
  localId?: string; // local identifier we always keep
  program?: string;
  programStage?: string;
  orgUnit?: string;
  eventDate?: string;
  status?: string;      // ACTIVE / COMPLETED etc
  dataValues?: Array<{ dataElement: string; value: any }>;
  [k: string]: any;
};

export type OpKind = 'create' | 'update' | 'delete';

export type Operation<T = BaseEvent> = {
  opId: string;
  kind: OpKind;
  recordLocalId: string; // localId (this identifies record locally)
  payload?: Partial<T>;  // for create/update — shape in local form
  actor: ActorId;
  timestamp: string;     // ISO
  attempts?: number;
  idempotencyKey?: string;
};
