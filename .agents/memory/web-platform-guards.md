---
name: Web Platform Guards
description: Files that need Platform.OS !== 'web' guards for native-only APIs
---

## PrepareModel.ts
Uses `expo-file-system` (File, Paths) which is not supported on web. Must early-return on web:
```ts
if (Platform.OS === 'web') return '';
```
Use dynamic `await import("expo-file-system")` so bundler doesn't eagerly evaluate on web.

## app/(auth)/login.tsx
`expo-web-browser.warmUpAsync()` and `coolDownAsync()` are not available on web. Guard with:
```ts
if (Platform.OS !== 'web') { warmUpAsync(); }
```

## app/_layout.tsx
`initExecutorch()` from `react-native-executorch` is stubbed on web so it's safe, but the model init path (`prepareAndInitializeModel`) must return quickly on web.

**Why:** These APIs call native modules that don't exist in the browser environment and throw at runtime even when the packages themselves are stubbed.

**How to apply:** When a new "method X is not available on web" error appears, add a `Platform.OS !== 'web'` guard around the offending call.
