import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

export function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback; // storage blocked or corrupt JSON: fall back to defaults
  }
}

export function writeStorage<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode / quota): progress is simply not persisted */
  }
}

export function useLocalStorage<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => readStorage(key, initial));
  useEffect(() => writeStorage(key, value), [key, value]);
  return [value, setValue];
}
