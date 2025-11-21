import { useMMKVStorage } from "@/components/MmkvContext";
import { useEffect, useState } from "react";

export function useMMKVValue<T = string>(
  key: string,
  defaultValue?: T
) {
  const storage = useMMKVStorage();
  const [value, setValue] = useState<T>(
    storage.getString(key) as T ?? defaultValue as T
  );

  useEffect(() => {
    const unsub = storage.addOnValueChangedListener((changedKey) => {
      if (changedKey === key) {
        const v = storage.getString(key) as T;
        setValue(v ?? defaultValue!);
      }
    });

    return () => unsub.remove();
  }, [key]);

  return [value, (v: T) => storage.set(key, v as any)] as const;
}
