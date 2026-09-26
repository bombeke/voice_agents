import { openAsync } from "@op-engineering/op-sqlite";
import type { Database } from "./Database";
import { createProxyDatabase } from "./ProxyDatabase";

export interface OpenOptions {
  name: string;
  /** Ignored: SQLCipher isn't available on web. */
  encryptionKey?: string;
}

/**
 * Web: op-sqlite's wasm backend (OPFS; needs COOP/COEP headers). It is
 * async-only and has no reactive queries or encryption, so it goes through
 * the proxy database.
 */
export async function openDatabase({ name }: OpenOptions): Promise<Database> {
  const raw = await openAsync({ name });
  return createProxyDatabase({
    async query(sql, params) {
      const res = await raw.executeRaw(sql, params as never);
      return res.rawRows ?? [];
    },
    async queryObjects(sql, params) {
      return (await raw.execute(sql, params as never)).rows ?? [];
    },
    async run(sql, params) {
      await raw.execute(sql, params as never);
    },
    async close() {
      await raw.closeAsync();
    },
  });
}

export const rawKey = (hex: string) => `x'${hex}'`;
