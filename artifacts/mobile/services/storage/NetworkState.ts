import { observable } from "@legendapp/state";

/**
 * Whether the device has a connection; BackendSyncObserver keeps it current.
 * Its own module so code that only needs the flag doesn't load the sync layer.
 */
export const isOnline$ = observable(true);

/** On Wi-Fi (or ethernet): photos wait for it when "Photos on Wi-Fi only" is on. */
export const isUnmetered$ = observable(true);
