# CLAUDE.md

Infrastructure Asset Capture app: field teams photograph infrastructure, pin it to a GPS fix under 4 m, and confirm the AI-generated condition record. It works offline first. Spec: `design/design-doc.md`. Mockups: `design/ui-screens.html`, `design/screens/*.png`.

## Stack
- pnpm monorepo (`pnpm-workspace.yaml`, packages in `artifacts/*`). The app is `artifacts/mobile`. Use **pnpm only**.
- Expo SDK 55 (dev client, not Expo Go, for native modules), React Native 0.83, React 19.2.
- expo-router (file-based, entry `expo-router/entry`), TypeScript strict, alias `@/*` → `artifacts/mobile/*`.
- Camera: react-native-vision-camera 5 (+ location/resizer/skia plugins). ML: react-native-executorch (`.pte`).
- Storage: MMKV for small hot state (auth, flags, config, last sync); expo-sqlite / Legend State for durable data (observations, event queue, sync log).
- Maps: @maplibre/maplibre-react-native. Styling: uniwind (Tailwind v4) only; no tamagui, no react-native-paper, no `StyleSheet.create`. Data: @tanstack/react-query, axios.
- Native versions are pinned in root `resolutions` and in workspace `overrides`. Don't bump them casually.

## Folder conventions (`artifacts/mobile`)
- `app/`: routes only. Route groups: `(auth)`, `(tabs)`, `(admin)`. Every group has a `_layout.tsx`.
- `components/`: reusable UI (`components/ui` for primitives, plus feature folders `camera/`, `forms/`, `auth/`, `agents/`).
- `views/`: larger composed screen pieces used by routes.
- `hooks/`: `useXxx` hooks (camera, GPS gate, detection, MMKV).
- `services/`: API, auth, `storage/` (stores, op queue), `sync/` (sync manager, merge strategies).
- `providers/`: React context providers. `constants/`: colors, config, enums. `types/`: shared TS types.
- `helpers/`: pure utilities. `plugins/` and `app.plugin.js`: Expo config plugins. `android/`: generated native project.

## Naming rules
- Components, providers, services, stores: PascalCase files and exports (`CaptureButton.tsx`, `SyncManagerEvents.ts`).
- Hooks: `useCamelCase.ts(x)`, one hook per file. Platform variants: `.ios.tsx`, `.web.ts`.
- Route files: lowercase/kebab (`login.tsx`, `settings.tsx`). Groups go in `(parens)`.
- Types/interfaces: PascalCase, no `I` prefix. Constants: `UPPER_SNAKE` for true constants, camelCase for config objects.
- Asset categories use these keys: `energy`, `water`, `telecom`, `roads`.

## Design tokens (from `design/ui-screens.html`)
Light, high-contrast theme for sunlight use. Tokens live in `global.css` (`@theme`, used as classes like `bg-surface`, `text-text-muted`, `rounded-button`, `font-heading`) and are mirrored in `constants/Colors.ts` for non-style props (icon `color`, Skia, MapLibre). Don't use hex values inline.

| Token | Value | Use |
|---|---|---|
| background | `#F4F2EC` | App canvas (warm off-white) |
| surface | `#FFFFFF` | Cards, inputs |
| surfaceMuted | `#ECE9E0` | Row dividers, subtle fills |
| text | `#1A1D1B` | Primary text; also the dark "Accept" button |
| textMuted | `#55594F` | Secondary text, labels |
| border | `#DAD6CA` | Card borders, separators |
| borderStrong | `#C9C4B6` | Inputs, secondary buttons |
| primary | `#0F5E51` | Primary buttons, links, active tab (pressed `#0A4439`) |
| primarySoft | `#DDEBE6` | Active tab pill, icon buttons |
| accent | `#F5C04A` | Detection boxes, focus ring, badges |
| success | `#1E6B3A` on `#DDEEE2` (chip text `#143F24`) | Synced, AI high |
| warning | `#8A4205` / `#9A5B00` on `#FBEBD6` (chip text `#5A2B03`) | Pending, AI medium, "please check" |
| danger | `#A3261B` on `#F8DCD8` (chip text `#7A1C13`) | Flagged, AI low, reject |

Category colours (solid / tile bg / tile border):
- Energy & Power `#9A5B00` / `#F6E9D2` / `#E8D3AE`
- Water & Sanitation `#1B5E91` / `#DCE9F4` / `#BCD3E8`
- Telecom `#5A3F8F` / `#E7E0F2` / `#D0C4E6`
- Roads & Drainage `#6A4A2E` / `#EDE3D8` / `#D9C8B5`

Confidence colours: high → success, medium → warning, low → danger. Every AI attribute shows its source and confidence ("AI · high", "GIS", "User").

**Radii:** 2 (bars), 4, 8, 10 (small icon tiles), **12** (inputs, list cards, 44 px icon tiles), **14** (buttons, fieldsets), **16** (large cards, category tiles), 22 (pill buttons, round icon buttons); chips use height/2 (13–18).
**Spacing (4-pt-ish):** 2, 4, 6, 8, **10**, **12**, 14, **16**, 20, 24. Screen gutter 16–20. Card padding 14–16. Gap 10 is the default.
**Sizes:** touch targets ≥ 44 px, 48 dp preferred. Buttons and inputs 52 px tall. List rows ≥ 52. Chips 26–28. Bottom actions stay out of top corners.
**Type:** Archivo (600–800) for headings and numbers, letter-spacing -0.01 to -0.02em. IBM Plex Sans (400–700) for body. IBM Plex Mono (400/500) for coordinates, accuracy and IDs.

| Role | Size / weight |
|---|---|
| Display | 30–34 / Archivo 800, line-height 1.05 |
| H1 screen title | 26–28 / Archivo 700 |
| H2 / stat number | 20–24 / Archivo 700 |
| Title | 17–18 / 600 |
| Body | 15–16 / 400, line-height 1.45 |
| Body small | 14 / 400–600 |
| Caption, chip | 12.5–13 / 600 |
| Overline | 12 / 600, uppercase, letter-spacing 0.08em |

## Styling rules
- Style with `className` only. Core RN components accept it directly; wrap third-party ones once with `withUniwind(Component)` (see `views/StatusBarBlurBackground.tsx`).
- Keep `style` only for runtime values: Animated/Reanimated values, computed geometry (detection boxes). Pass them next to `className`.
- Type roles are utilities in `global.css`: `type-display`, `type-h1`, `type-h2`, `type-stat`, `type-title`, `type-body`, `type-body-strong`, `type-body-small`, `type-label`, `type-caption`, `type-chip`, `type-tab`, `type-overline`, `type-mono`.
- Safe areas: use `pt-safe`, `pb-safe-offset-3` and similar. Insets reach uniwind through the `SafeAreaListener` in `app/_layout.tsx`.
- Write class names out in full (`bg-energy-tile`, not `` `bg-${c}-tile` ``) so Tailwind's scanner finds them.
- Primitives: `components/ui/Button.tsx`, `Input.tsx`, `Card.tsx`, `Chip.tsx`, `StatusBadge.tsx`.

## UX rules that matter in code
- Five tabs: Capture, Map, Records, Review (supervisor only), Profile. Capture is a full-screen stack.
- The GPS gate requires horizontal accuracy < 4.0 m for 3 consecutive fixes before capture is enabled.
- Everything must work offline: queue locally, keep the pending-sync badge visible, never lose a record.
- All labels come from externalised strings (i18n-ready).

## Commands (run from repo root)
```bash
pnpm install
pnpm --filter mobile exec tsc --noEmit   # typecheck the app
pnpm lint                                # eslint (expo + prettier) across workspace
pnpm --filter mobile lint                # lint just the app
pnpm test                                # jest (jest-expo) unit tests for the app
pnpm --filter mobile test -- Button      # run matching test files
pnpm --filter mobile test:coverage
pnpm start | pnpm android | pnpm ios | pnpm web
```

## Fake API (dev only)
- `pnpm --filter mobile start:mock` runs the app against the in-app fake auth server in `mocks/` (axios-mock-adapter on `axiosClient`). Test users are in `mocks/fixtures.ts`: any non-empty password works, and `wrong` shows the error state.
- Import it only as `@/mocks`. Metro swaps that for `mocks/stub.ts` (`null`) unless `EXPO_PUBLIC_API_MOCKING=enabled`, and always for `APP_VARIANT=production`. `install()` also throws outside `__DEV__`.
- Never put mock data or credentials in app code. `pnpm --filter mobile check:release-bundle` fails if mock code reaches a production bundle; run it in CI.

## Tests
- Jest via `jest-expo` + `@testing-library/react-native` 14. Config: `artifacts/mobile/jest.config.js` (maps the `@/` alias, allows pnpm's `.pnpm/` paths through `transformIgnorePatterns`), shared mocks in `jest.setup.js`.
- Put tests in a `__tests__/` folder next to the code: `Foo.test.ts(x)`. Never put them under `app/`, because expo-router would treat them as routes.
- Every new component, hook, or service with logic needs a unit test. Query by role, label or text (`getByRole("button", { name })`), not by test IDs or styles.
- RNTL 14 is async: `await render(...)`, `await fireEvent.press(...)`, `await renderHook(...)`.
- Mock native modules per test with `jest.mock` (see `hooks/__tests__/useCaptureAccuracyGate.test.ts` for expo-location). `className` isn't compiled in Jest, so don't assert on styling.
- Animated components: use fake timers and flush them in `act` (see `components/ui/__tests__/Toggle.test.tsx`).
