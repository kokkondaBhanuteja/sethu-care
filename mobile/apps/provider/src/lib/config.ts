// App runtime config. In Phase 2 this reads EXPO_PUBLIC_* env per build profile; for the shell it
// points at the local backend. 127.0.0.1 works on iOS simulator; use the LAN IP on a device.
export const API_BASE_URL = "http://127.0.0.1:8090";
