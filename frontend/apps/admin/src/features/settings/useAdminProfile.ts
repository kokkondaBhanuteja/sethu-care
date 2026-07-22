import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchAdminProfile, saveAdminPreferences } from "./settings.api";
import { SETTINGS_QUERY_KEYS } from "./settings.constants";
import type { AdminPreferences, AdminProfile } from "./settings.types";

/**
 * The admin's own identity and preferences (spec §6.32). Shared by the More menu's identity row and
 * the profile screen, so both surfaces read one cache entry and neither can drift from the other.
 *
 * Preferences save immediately with an optimistic update: the design shows a switch and a segmented
 * control, and a Save button under a switch is a lie about when the change took effect.
 */
export function useAdminProfile() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: SETTINGS_QUERY_KEYS.profile,
    queryFn: ({ signal }) => fetchAdminProfile(signal),
  });

  const mutation = useMutation({
    mutationFn: (preferences: AdminPreferences) => saveAdminPreferences(preferences),
    onMutate: async (preferences) => {
      await queryClient.cancelQueries({ queryKey: SETTINGS_QUERY_KEYS.profile });
      const previous = queryClient.getQueryData<AdminProfile>(SETTINGS_QUERY_KEYS.profile);
      if (previous) {
        queryClient.setQueryData<AdminProfile>(SETTINGS_QUERY_KEYS.profile, {
          ...previous,
          preferences,
        });
      }
      return { previous };
    },
    // The failure toast is raised once, centrally, by the mutation cache; this only puts the
    // control back where it was so the screen never claims a preference that did not save.
    onError: (_error, _preferences, context) => {
      if (context?.previous) {
        queryClient.setQueryData(SETTINGS_QUERY_KEYS.profile, context.previous);
      }
    },
    onSettled: (updated) => {
      if (updated) queryClient.setQueryData(SETTINGS_QUERY_KEYS.profile, updated);
    },
  });

  return {
    query,
    savePreferences: (preferences: AdminPreferences) => mutation.mutate(preferences),
    isSaving: mutation.isPending,
  };
}
