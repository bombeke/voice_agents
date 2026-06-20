---
name: LegendState MMKV Web
description: initPersistence in LegendState.ts must skip MMKV setup on web platform
---

`services/storage/LegendState.ts` calls `initPersistence()` from `_layout.tsx`. On web, `ObservablePersistMMKV` must NOT be imported at the top level — it calls `loadLocal` which throws "Local persist is not configured".

**Fix:** 
1. Remove top-level `import { ObservablePersistMMKV }` 
2. `initPersistence()` checks `Platform.OS === 'web'` and returns early (setting `configured = true`)
3. MMKV persist plugin is `require()`d lazily only on native

Also: `expo-crypto`'s `randomUUID` uses `window` which breaks SSR. Replace with a safe inline UUID function that falls back to `Math.random()`.

**Why:** `@legendapp/state/persist-plugins/mmkv` calls into native MMKV internals at import time. `expo-crypto.randomUUID` calls `window.crypto` which is unavailable in Node.js SSR context.

**How to apply:** Any new `syncObservable` calls using MMKV-backed plugins must be inside the `Platform.OS !== 'web'` branch of `initPersistence`.
