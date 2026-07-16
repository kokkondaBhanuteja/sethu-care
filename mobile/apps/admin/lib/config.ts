// The backend the console talks to. Overridable per environment via NEXT_PUBLIC_API_BASE_URL;
// defaults to the local API (the RN apps and the admin all share :8090 locally).
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8090";
