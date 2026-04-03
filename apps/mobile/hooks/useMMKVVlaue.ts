import { useMMKVStorage } from "@/components/MmkvContext";
import { useEffect, useState } from "react";

export function useMMKVValue<T = string>(
  key: string,
  defaultValue?: T
) {
  const storage = useMMKVStorage();
  const [value, setValue] = useState<T>( defaultValue as T);

  useEffect(() => {
    if(storage) {
      const v = storage.getString(key) as T;
      setValue(v ?? defaultValue!);
      const unsub = storage.addOnValueChangedListener((changedKey) => {
        if (changedKey === key) {
          const v = storage.getString(key) as T;
          setValue(v ?? defaultValue!);
        }
      });

      return () => unsub.remove();
    }
  }, [key, storage, defaultValue]);

  return [
    value, 
    (v: T) => {
        if(!storage) return;
        storage.set(key, v as any)
      }
    ] as const;
}
