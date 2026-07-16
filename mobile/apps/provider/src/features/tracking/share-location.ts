import { useEffect } from "react";
import * as Location from "expo-location";
import { updateLocation } from "@sethu/api-client";

// While `active` (the technician is travelling to / at a job), share the device location with the
// backend every few seconds so the customer can watch them approach on the live map. Requests
// permission once, watches position, and stops on unmount or when inactive. Fire-and-forget: a
// failed ping is not worth interrupting the job over — the next one will land.
export function useShareLocation(active: boolean) {
  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;

    void (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted || cancelled) return;
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 10_000, distanceInterval: 25 },
        (position) => {
          void updateLocation({
            body: { lat: position.coords.latitude, lng: position.coords.longitude },
          });
        },
      );
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [active]);
}
