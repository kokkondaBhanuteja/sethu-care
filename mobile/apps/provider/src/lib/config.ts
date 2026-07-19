// App runtime config. In Phase 2 this reads EXPO_PUBLIC_* env per build profile; for the shell it
// points at the local backend. 127.0.0.1 works on iOS simulator; the Android emulator and real
// devices can't reach the host loopback, so use the ngrok tunnel to the backend (:8090).
export const API_BASE_URL = "https://climatologically-grindable-wilhelmina.ngrok-free.dev";
