"use client";

import { useSyncExternalStore } from "react";
import { api, ApiError, type ApiUser, type OrganizerProfile } from "@/lib/api";
import { getLang } from "@/lib/i18n";
import { applyLanguage } from "./language";

/**
 * The signed-in BiletFlow account, shared by every component.
 *
 * Tokens stay in httpOnly cookies; this store only knows the profile the
 * backend returns for /users/me, the organizer profile (if any) and the
 * events this person works on (owner, manager or staff).
 */
export type StaffEvent = { id: string; title: string; my_role: string };

export type Session =
  | { status: "loading" }
  | { status: "signed-out" }
  | {
      status: "signed-in";
      user: ApiUser;
      organizer: OrganizerProfile | null;
      staffEvents: StaffEvent[];
    };

let snapshot: Session = { status: "loading" };
let started = false;
let pending: Promise<void> | null = null;
let revision = 0;
let authMutations: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

async function optional<T>(load: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await load();
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) return fallback;
    throw error;
  }
}

function invalidateLoads() {
  revision += 1;
  pending = null;
  return revision;
}

function mutateAuth(action: () => Promise<void>) {
  const mutation = authMutations.then(action);
  authMutations = mutation.then(() => {}, () => {});
  return mutation;
}

async function load(requestRevision: number) {
  try {
    const user = await api.users.me();
    if (requestRevision !== revision) return;
    // The profile decides the language on every device
    if (user.preferred_language !== getLang()) applyLanguage(user.preferred_language);
    const [organizer, staffEvents] = await Promise.all([
      optional(() => api.organizers.me(), null),
      optional(() => api.request<StaffEvent[]>("/events/mine"), []),
    ]);
    if (requestRevision !== revision) return;
    snapshot = { status: "signed-in", user, organizer, staffEvents };
  } catch (error) {
    if (requestRevision !== revision) return;
    // Network trouble keeps the last known state; 401 means signed out
    if (!(error instanceof ApiError) || error.status === 401 || snapshot.status === "loading")
      snapshot = { status: "signed-out" };
  }
  emit();
}

/** Reload the session from the backend (after sign-in, profile changes…). */
export function refreshSession() {
  if (!pending) {
    const request: Promise<void> = load(revision).finally(() => {
      if (pending === request) pending = null;
    });
    pending = request;
  }
  return pending;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!started) {
    started = true;
    void refreshSession();
  }
  return () => listeners.delete(listener);
}

const serverSnapshot: Session = { status: "loading" };

/** The latest session, for code outside React rendering (after sign-in). */
export const currentSession = () => snapshot;

export async function signIn(email: string, password: string) {
  const requestRevision = invalidateLoads();
  await mutateAuth(() => api.auth.signIn(email, password));
  if (requestRevision !== revision) return;
  invalidateLoads();
  await refreshSession();
}

export async function signOut() {
  const requestRevision = invalidateLoads();
  try {
    await mutateAuth(() => api.auth.signOut());
  } finally {
    if (requestRevision === revision) {
      invalidateLoads();
      snapshot = { status: "signed-out" };
      emit();
    }
  }
}

export function useSession() {
  const session = useSyncExternalStore(subscribe, () => snapshot, () => serverSnapshot);
  const user = session.status === "signed-in" ? session.user : null;
  return {
    session,
    ready: session.status !== "loading",
    user,
    organizer: session.status === "signed-in" ? session.organizer : null,
    staffEvents: session.status === "signed-in" ? session.staffEvents : [],
    isAdmin: user?.is_platform_admin === true,
  };
}
