// App runtime config. Points at the local backend. 127.0.0.1 works on the iOS simulator; use the
// Mac's LAN IP on a physical device. Port 8090 here because 8080 is taken by another project on
// this machine — change to 8080 (the backend default) on a clean setup, or wire EXPO_PUBLIC_API_URL.
export const API_BASE_URL = "http://127.0.0.1:8090";
