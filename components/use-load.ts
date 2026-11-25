"use client";

import { useCallback, useEffect, useState } from "react";
import { tr } from "@/lib/i18n";

export type Loaded<T> =
  | { status: "loading"; data?: T }
  | { status: "ready"; data: T }
  | { status: "error"; error: Error; httpStatus: number; data?: T };

/**
 * Load data from the backend when `key` changes, cancelling the previous
 * request. Keeps the last data while a new request is on its way, so lists
 * do not flash empty while filters change.
 */
export function useLoad<T>(key: string, load: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<Loaded<T> & { key: string }>({ status: "loading", key });
  const [attempt, setAttempt] = useState(0);

  // Show "loading" (keeping old data) as soon as the key changes
  if (state.key !== key) setState({ status: "loading", data: state.data, key });

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setState({ status: "ready", data, key });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        const failure = error instanceof Error ? error : new Error(tr("Something went wrong."));
        const httpStatus =
          typeof (error as { status?: unknown })?.status === "number"
            ? (error as { status: number }).status
            : 0;
        setState((previous) => ({
          status: "error",
          error: failure,
          httpStatus,
          data: previous.data,
          key,
        }));
      },
    );
    return () => controller.abort();
    // `load` is re-created on each render; `key` says when to reload
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, reload };
}
