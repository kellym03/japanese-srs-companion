"use client";

import { useState, useEffect } from "react";

export function usePersistentState<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void, boolean] {
  const [state, setState] = useState<T>(initialValue);
  const [isHydrated, setIsHydrated] = useState<boolean>(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) {
        setState(JSON.parse(stored));
      }
    } catch {
      // Ignore JSON parse / localStorage errors
    } finally {
      setIsHydrated(true);
    }
  }, [key]);

  // Save to localStorage on change
  const setPersistentState = (value: T | ((val: T) => T)) => {
    setState((prev) => {
      const nextValue = typeof value === "function" ? (value as (val: T) => T)(prev) : value;
      try {
        if (nextValue === null || nextValue === undefined) {
          localStorage.removeItem(key);
        } else {
          localStorage.setItem(key, JSON.stringify(nextValue));
        }
      } catch {
        // Ignore localStorage quota or private mode errors
      }
      return nextValue;
    });
  };

  return [state, setPersistentState, isHydrated];
}
