import { create } from "zustand";

import { deleteToken, loadToken, saveToken } from "./storage";

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

export const useSession = create<SessionState>((set) => ({
  token: null,
  user: null,
  status: "loading",
  hydrate: async () => {
    const token = await loadToken();
    set({ token, status: token ? "authenticated" : "unauthenticated" });
  },
  signIn: async (token, user) => {
    await saveToken(token);
    set({ token, user, status: "authenticated" });
  },
  signOut: async () => {
    await deleteToken();
    set({ token: null, user: null, status: "unauthenticated" });
  },
}));

/** Non-hook accessor so the API client's request interceptor can read the current token. */
export function getSessionToken(): string | null {
  return useSession.getState().token;
}
