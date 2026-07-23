import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchNotificationSettings, saveNotificationSettings } from "./settings.api";
import { SETTINGS_QUERY_KEYS } from "./settings.constants";
import type { ClockTime, ConfigurableChannel, NotificationSettings } from "./settings.types";

/**
 * Notification preferences (spec §6.30). Server-side, so they follow the admin across devices, with
 * the query cache as the local copy.
 *
 * Every control saves immediately and optimistically. The design shows a switch, and a switch that
 * waits for a round trip before moving reads as broken — but a switch that stays moved after a
 * failed save is a lie about whether an alert will arrive, so the rollback is the important half.
 */
export function useNotificationSettings() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: SETTINGS_QUERY_KEYS.notifications,
    queryFn: ({ signal }) => fetchNotificationSettings(signal),
  });

  const mutation = useMutation({
    // The whole configurable object travels (the contract is a PUT, not a PATCH), built below by
    // merging one control's change over the cached copy.
    mutationFn: (next: NotificationSettings) => saveNotificationSettings(next),
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: SETTINGS_QUERY_KEYS.notifications });
      const previous = queryClient.getQueryData<NotificationSettings>(
        SETTINGS_QUERY_KEYS.notifications,
      );
      if (previous) {
        queryClient.setQueryData<NotificationSettings>(SETTINGS_QUERY_KEYS.notifications, next);
      }
      return { previous };
    },
    // The failure toast is raised centrally by the mutation cache; this only puts the control back.
    onError: (_error, _patch, context) => {
      if (context?.previous) {
        queryClient.setQueryData(SETTINGS_QUERY_KEYS.notifications, context.previous);
      }
    },
    onSettled: (updated) => {
      if (updated) queryClient.setQueryData(SETTINGS_QUERY_KEYS.notifications, updated);
    },
  });

  const current = query.data;

  /** One control's change over the cached copy; no cached copy means nothing to change yet. */
  const save = (patch: Partial<NotificationSettings>) => {
    if (!current) return;
    mutation.mutate({ ...current, ...patch });
  };

  return {
    query,
    toggleChannel: (channel: ConfigurableChannel, enabled: boolean) => {
      if (!current) return;
      save({ channels: { ...current.channels, [channel]: enabled } });
    },
    toggleQuietHours: (enabled: boolean) => {
      if (!current) return;
      save({ quietHours: { ...current.quietHours, enabled } });
    },
    setQuietHour: (edge: "from" | "to", value: ClockTime) => {
      if (!current) return;
      save({ quietHours: { ...current.quietHours, [edge]: value } });
    },
    setDigestTime: (digestTime: ClockTime) => save({ digestTime }),
    toggleVibrate: (vibrate: boolean) => save({ vibrate }),
  };
}
