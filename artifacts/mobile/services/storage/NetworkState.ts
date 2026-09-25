import { observable } from "@legendapp/state";

/**
 * Whether the device has a connection; BackendSyncObserver keeps it current.
 * Its own module so code that only needs the flag doesn't load the sync layer.
 */
export const isOnline$ = observable(true);
