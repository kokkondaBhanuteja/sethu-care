// Public surface of the generated API client. Everything under ./generated is produced by
// @hey-api/openapi-ts from the backend contract and is never hand-edited; this file adds the one
// bit of hand-written glue — configuring the base URL and attaching the JWT — and re-exports the
// typed SDK, the DTO types, and the TanStack Query options/mutations for the apps to consume.

export * from "./generated/types.gen";
export * from "./generated/sdk.gen";
export * from "./generated/@tanstack/react-query.gen";
export { client } from "./generated/client.gen";

import { client } from "./generated/client.gen";

export interface ConfigureApiOptions {
  /** Backend base URL, e.g. https://api.sethucare.in — RN has no page origin, so it is explicit. */
  baseUrl: string;
  /** Returns the current JWT (from expo-secure-store), or null when signed out. */
  getToken?: () => string | null | Promise<string | null>;
}

/** Point the generated client at the backend and attach the bearer token to every request.
 *  Called once at app start (and again if the base URL changes between environments). */
export function configureApiClient({ baseUrl, getToken }: ConfigureApiOptions): void {
  client.setConfig({ baseUrl });

  if (getToken) {
    client.interceptors.request.use(async (request) => {
      const token = await getToken();
      if (token) {
        request.headers.set("Authorization", `Bearer ${token}`);
      }
      return request;
    });
  }
}
