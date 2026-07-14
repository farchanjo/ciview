import { useEffect, useState, useSyncExternalStore } from "react";
import type { Store } from "../../state/createStore.ts";

export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/** Subscribe to multiple stores and force re-render. */
export function useStores(...stores: Store<unknown>[]): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const unsubs = stores.map((s) => s.subscribe(() => setN((x) => x + 1)));
    return () => unsubs.forEach((u) => u());
  }, stores);
  return n;
}
