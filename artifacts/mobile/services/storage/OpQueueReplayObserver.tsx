import { useEffect } from 'react';
import { AppState } from 'react-native';
import { isOnline$, opQueue$, replayOpQueue } from './LegendState';

const QUEUE_DEBOUNCE_MS = 750;
const RETRY_BASE_MS = 5_000;
const RETRY_MAX_MS = 5 * 60_000;

/** Exponential backoff with jitter, based on how often the head of the queue has failed. */
const retryDelay = () => {
  const attempts = opQueue$.peek()?.[0]?.attempts ?? 1;
  const backoff = Math.min(RETRY_BASE_MS * 2 ** Math.max(0, attempts - 1), RETRY_MAX_MS);
  return backoff / 2 + Math.random() * (backoff / 2);
};

/**
 * Owns the push side of sync: uploads the offline op queue on startup, as soon
 * as something is queued, on reconnect and on foreground, retrying with backoff.
 */
export function OpQueueReplayObserver() {
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = (delayMs: number) => {
      if (disposed) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, delayMs);
    };

    const run = async () => {
      timer = undefined;
      if (!isOnline$.peek() || !opQueue$.peek()?.length) return;
      try {
        const result = await replayOpQueue();
        if (!result.ok && opQueue$.peek()?.length) schedule(retryDelay());
      } catch (err) {
        console.warn('[sync] op queue replay failed', err);
        schedule(retryDelay());
      }
    };

    const unsubQueue = opQueue$.onChange(() => schedule(QUEUE_DEBOUNCE_MS));
    const unsubOnline = isOnline$.onChange(({ value }) => {
      if (value) schedule(0);
    });
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') schedule(0);
    });

    schedule(0);

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      unsubQueue();
      unsubOnline();
      appState.remove();
    };
  }, []);

  return null;
}
