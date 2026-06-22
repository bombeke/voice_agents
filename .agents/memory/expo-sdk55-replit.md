---
name: Expo SDK 55 Replit patterns
description: Key gotchas and fixes for the Bombeke PoleVision app on Expo SDK 55 in Replit web preview
---

## useNativeDriver on web
Always use `const NATIVE_DRIVER = Platform.OS !== "web"` and pass as `useNativeDriver: NATIVE_DRIVER`. `useNativeDriver: true` throws a console warning on Expo web and falls back to JS automatically.

**Why:** RN for Web doesn't have the native animation module; `useNativeDriver: true` triggers a warning. The constant pattern is clean and reusable.

**How to apply:** Add the constant after imports in any file that uses `Animated` with `useNativeDriver`.

## Login "Page not found" bug
When `API_URL` is undefined, `${undefined}/auth/login` = the string `"undefined/auth/login"`. On web, expo-auth-session treats this as a relative URL and navigates the main window to `/undefined/auth/login`, which expo-router shows as not-found.

**Fix:** Guard `promptLogin` — check `if (!API_URL)` and return early. Also set `authorizationEndpoint` to a safe fallback (`https://localhost/auth/login`) when `API_URL` is unset so the hook always receives a valid URL format.

## API_URL source
The backend URL (`auth1.nataaha.com`) is configured via Replit environment secrets as `EXPO_PUBLIC_API_URL`. There is no `.env` file and no `extra` field in `app.json`. CORS blocks XHR from web preview to the backend — expected for development.

## Shadow styles deprecation on web
RN for Web deprecates `shadow*` props in favour of `boxShadow`. These are warnings only and don't affect functionality. The native shadow props (`shadowColor`, `shadowOffset`, `shadowOpacity`, `shadowRadius`) still render correctly on iOS/Android native builds.
