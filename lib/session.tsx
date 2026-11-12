"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, SESSION_EXPIRED_EVENT, type ApiUser, type SignInInput } from "./api";

type State = { status: "loading" | "signed-out" | "signed-in" | "error"; user: ApiUser | null; error: string };
type Session = State & {
  signIn: (input: SignInInput) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => void;
  updateUser: (user: ApiUser) => void;
};

const signedOut: State = { status: "signed-out", user: null, error: "" };
const loading: State = { status: "loading", user: null, error: "" };
const SessionContext = createContext<Session | null>(null);

function stateFor(user: ApiUser | null): State {
  return user ? { status: "signed-in", user, error: "" } : signedOut;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(loading);
  const [attempt, setAttempt] = useState(0);
  const pending = useRef<AbortController | null>(null);
  const changing = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    pending.current = controller;
    api.auth.session({ signal: controller.signal }).then(
      (user) => { if (!controller.signal.aborted) setState(stateFor(user)); },
      (error: unknown) => {
        if (!controller.signal.aborted) setState({ status: "error", user: null, error: error instanceof Error ? error.message : "Could not restore the session." });
      },
    );
    return () => controller.abort();
  }, [attempt]);

  const refresh = useCallback(() => {
    if (changing.current) return;
    pending.current?.abort();
    setState(loading);
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    window.addEventListener(SESSION_EXPIRED_EVENT, refresh);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, refresh);
  }, [refresh]);

  const signIn = useCallback(async (input: SignInInput) => {
    if (changing.current) throw new Error("An account request is already in progress.");
    changing.current = true;
    pending.current?.abort();
    try {
      await api.auth.login(input);
      const user = await api.auth.session();
      if (!user) throw new Error("Could not start a session. Please sign in again.");
      setState(stateFor(user));
    } catch (error) {
      setState((current) => current.status === "loading" ? signedOut : current);
      throw error;
    } finally {
      changing.current = false;
    }
  }, []);

  const signOut = useCallback(async () => {
    if (changing.current) throw new Error("An account request is already in progress.");
    changing.current = true;
    pending.current?.abort();
    try {
      await api.auth.logout();
      setState(signedOut);
    } finally {
      changing.current = false;
    }
  }, []);

  const updateUser = useCallback((user: ApiUser) => {
    setState((current) => current.status === "signed-in" && current.user?.id === user.id ? stateFor(user) : current);
  }, []);

  const session = useMemo(() => ({ ...state, signIn, signOut, refresh, updateUser }), [state, signIn, signOut, refresh, updateUser]);
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("SessionProvider is missing.");
  return session;
}
