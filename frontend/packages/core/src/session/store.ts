import { create } from "zustand";

import { deleteToken, loadPreference, loadToken, savePreference, saveToken } from "./storage";

export type Role = "CUSTOMER" | "TECHNICIAN" | "ADMIN";

export interface SessionUser {
  role: Role;
  name: string;
  /** Server-side account id. Optional so the customer/provider flows that only know a name still fit. */
  id?: string;
  email?: string;
  /** Action ids this account may perform (Admin spec §10.2). Absent means "not scoped" — the admin
   *  console's can() then grants every action, which is the intended single-role v1 behaviour. */
  permissions?: readonly string[];
}

export type SessionStatus = "loading" | "authenticated" | "unauthenticated";

interface SessionState {
  token: string | null;
  user: SessionUser | null;
  status: SessionStatus;
  /** Read the persisted token on app start; sets status to authenticated/unauthenticated. */
  hydrate: () => Promise<void>;
  /** Persist the token + user after a successful OTP verification. */
  signIn: (token: string, user: SessionUser) => Promise<void>;
  /** Clear the token (logout or account deletion). */
  signOut: () => Promise<void>;
}

const USER_KEY = "sethu.user";

/** Narrow a persisted blob back to a SessionUser, discarding anything that no longer fits. */
function parseUser(raw: string | null): SessionUser | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const candidate = parsed as Partial<SessionUser>;
    if (typeof candidate.role !== "string" || typeof candidate.name !== "string") return null;
    return candidate as SessionUser;
  } catch {
    return null;
  }
}

export const useSession = create<SessionState>((set) => ({
  token: null,
  user: null,
  status: "loading",
  hydrate: async () => {
    // The user is restored alongside the token, not just the token. A session with a valid token but
    // no identity is authenticated-but-anonymous: the admin console's `can()` sees a null user and
    // refuses every permission-gated route, so a page refresh would lock an operator out of every
    // destructive action until they signed in again.
    const [token, user] = await Promise.all([loadToken(), loadPreference(USER_KEY)]);
    set({
      token,
      user: token ? parseUser(user) : null,
      status: token ? "authenticated" : "unauthenticated",
    });
  },
  signIn: async (token, user) => {
    await Promise.all([saveToken(token), savePreference(USER_KEY, JSON.stringify(user))]);
    set({ token, user, status: "authenticated" });
  },
  signOut: async () => {
    // A revoked device must retain nothing of operational value (spec §5.6).
    await Promise.all([deleteToken(), savePreference(USER_KEY, "")]);
    set({ token: null, user: null, status: "unauthenticated" });
  },
}));

/** Non-hook accessor so the API client's request interceptor can read the current token. */
export function getSessionToken(): string | null {
  return useSession.getState().token;
}
