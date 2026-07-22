import { useMemo } from "react";
import { useNavigate, useParams } from "react-router";

import { ADMIN_ACTIONS } from "../../../lib/permissions/actions";
import { useCan } from "../../../lib/permissions/usePermission";
import { ROUTES } from "../../../routes/routes.constants";
import { useRestoreProviderMutation } from "../mutations/useProviderActions";
import { useProviderProfileQuery } from "../queries/providers.queries";
import { DOCUMENT_STATES, PROVIDER_STATUSES } from "../providers.types";
import type { ProviderDocument, ProviderProfile } from "../providers.types";

export interface ProviderProfileScreen {
  readonly providerId: string;
  readonly query: ReturnType<typeof useProviderProfileQuery>;
  readonly expiredDocument: ProviderDocument | undefined;
  readonly canSuspend: boolean;
  readonly canForceOffline: boolean;
  readonly restore: () => void;
  readonly isRestoring: boolean;
  readonly canRestore: boolean;
  readonly openSuspendFlow: () => void;
}

/**
 * Everything both profile shells need, decided once (spec §2.1 anti-drift rule).
 *
 * The action set is derived from the record, not from the layout: an offboarded provider has
 * nobody left to call or suspend, and an already-suspended one is offered Restore instead of a
 * second suspension (BOX 39 / M63).
 */
export function useProviderProfile(): ProviderProfileScreen {
  const { providerId = "" } = useParams<{ providerId: string }>();
  const navigate = useNavigate();
  const query = useProviderProfileQuery(providerId);
  const profile = query.data ?? null;

  const canSuspend = useCan(ADMIN_ACTIONS.suspendProvider);
  const canForceOffline = useCan(ADMIN_ACTIONS.forceProviderOffline);
  const restoreMutation = useRestoreProviderMutation(providerId, profile?.name ?? providerId);

  const expiredDocument = useMemo(
    () => profile?.documents.find((document) => document.state === DOCUMENT_STATES.expired),
    [profile],
  );

  const isOffboarded = profile?.status === PROVIDER_STATUSES.offboarded;
  const isSuspended = Boolean(profile?.suspension);

  return {
    providerId,
    query,
    expiredDocument,
    canSuspend: canSuspend && !isOffboarded && !isSuspended,
    canForceOffline: canForceOffline && !isOffboarded && !isSuspended,
    canRestore: restoreMutation.canAct && isSuspended && !isOffboarded,
    restore: restoreMutation.restore,
    isRestoring: restoreMutation.isPending,
    openSuspendFlow: () => void navigate(ROUTES.providerSuspend(providerId)),
  };
}

/** True when the record is historical: no actions, dimmed body, undimmed explanation (M68). */
export function isOffboardedProfile(profile: ProviderProfile): boolean {
  return profile.status === PROVIDER_STATUSES.offboarded;
}
