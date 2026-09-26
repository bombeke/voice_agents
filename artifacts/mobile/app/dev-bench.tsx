import { devMocks } from "@/mocks";

/**
 * Dev-only: the on-device storage benchmark, `mobile://dev-bench?n=50000`.
 * Only in `start:mock` builds; `devMocks` is null in every other bundle.
 */
export default function DevBenchScreen() {
  const Bench = devMocks?.BenchView;
  return Bench ? <Bench /> : null;
}
