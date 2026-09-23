import type { DevMocks } from "./types";

/**
 * What `@/mocks` resolves to unless EXPO_PUBLIC_API_MOCKING=enabled (see
 * metro.config.js), so the fake server never reaches a release bundle.
 */
export const devMocks: DevMocks | null = null;
