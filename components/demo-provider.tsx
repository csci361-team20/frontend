"use client";

import { useSyncExternalStore } from "react";
import { initialState, migrateDemoState, type DemoState } from "@/lib/demo-data";

const KEY = "biletflow-demo-v1";
const LEGACY_KEY = "ticketelo-demo-v1";
let snapshot = initialState;
let loaded = false;
let storageError = "";
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

function readStorage() {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (raw) {
      snapshot = migrateDemoState(JSON.parse(raw));
      localStorage.setItem(KEY, JSON.stringify(snapshot));
    }
  } catch {
    storageError =
      "Browser storage is unavailable. Changes will last for this visit only.";
  }
  loaded = true;
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!loaded) {
    readStorage();
    emit();
  }
  const sync = (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) {
      snapshot = initialState;
      readStorage();
      emit();
    }
  };
  window.addEventListener("storage", sync);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", sync);
  };
}
export function useDemo() {
  const state = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => initialState,
  );
  const ready = useSyncExternalStore(
    subscribe,
    () => loaded,
    () => false,
  );
  const update = (fn: (state: DemoState) => DemoState) => {
    if (!loaded) readStorage();
    const next = fn(snapshot);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      storageError =
        "Browser storage is full or unavailable. This change will last for this visit only.";
    }
    snapshot = next;
    emit();
  };
  return {
    state,
    ready,
    user: state.profiles.find((p) => p.id === state.currentUserId),
    update,
    storageError,
  };
}
