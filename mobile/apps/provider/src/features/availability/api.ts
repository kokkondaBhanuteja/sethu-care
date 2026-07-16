import { useMutation } from "@tanstack/react-query";
import { setAvailabilityMutation } from "@sethu/api-client";

// Toggle the technician's online status (the provider app's online/offline switch). Online + not on
// leave puts them in the dispatch pool the backend's candidate ranking draws from.
export function useSetAvailability() {
  return useMutation(setAvailabilityMutation());
}
