import { AlertTriangle, WifiOff, Lock, SearchX } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { API_ERROR_CODES, type ApiError } from "../../lib/http/apiError";
import { Button } from "./Button";
import { EmptyState } from "./EmptyState";

export interface ErrorStateProps {
  error: ApiError;
  /** Omitted for non-retryable failures, so the console never offers a button that cannot work. */
  onRetry?: () => void;
  grow?: boolean;
}

/**
 * The one place a failed read is rendered. It picks its icon and copy from the normalised error
 * code, so every screen fails the same way and no screen invents its own wording.
 */
export function ErrorState({ error, onRetry, grow = false }: ErrorStateProps) {
  const { t } = useTranslation("adminShell");
  const presentation = presentationFor(error);

  return (
    <EmptyState
      icon={presentation.icon}
      title={t(presentation.titleKey)}
      body={error.message}
      grow={grow}
      actions={
        error.retryable && onRetry ? (
          <Button variant="outline" size="secondary" block onClick={onRetry}>
            {t("state.retry")}
          </Button>
        ) : undefined
      }
    />
  );
}

type TitleKey =
  "state.errorOffline" | "state.errorForbidden" | "state.errorNotFound" | "state.errorGeneric";

function presentationFor(error: ApiError): { icon: typeof AlertTriangle; titleKey: TitleKey } {
  switch (error.code) {
    case API_ERROR_CODES.network:
    case API_ERROR_CODES.timeout:
      return { icon: WifiOff, titleKey: "state.errorOffline" };
    case API_ERROR_CODES.forbidden:
    case API_ERROR_CODES.unauthorized:
      return { icon: Lock, titleKey: "state.errorForbidden" };
    case API_ERROR_CODES.notFound:
      return { icon: SearchX, titleKey: "state.errorNotFound" };
    default:
      return { icon: AlertTriangle, titleKey: "state.errorGeneric" };
  }
}
