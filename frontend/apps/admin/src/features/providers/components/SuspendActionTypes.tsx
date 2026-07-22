import { Ban, Clock, RotateCcw } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Pill } from "../../../components/ui/Pill";
import { Segmented } from "../../../components/ui/Segmented";
import { cx } from "../../../lib/cx";
import { SUSPEND_ACTION_ORDER, SUSPEND_DURATIONS } from "../providers.constants";
import { SUSPEND_ACTION_TYPES, type SuspendActionType } from "../suspend.types";

const COPY = {
  [SUSPEND_ACTION_TYPES.forceOffline]: {
    title: "suspend.typeForceOffline",
    detail: "suspend.typeForceOfflineDetail",
    exit: "suspend.typeForceOfflineExit",
  },
  [SUSPEND_ACTION_TYPES.suspend]: {
    title: "suspend.typeSuspend",
    detail: "suspend.typeSuspendDetail",
    exit: "suspend.typeSuspendExit",
  },
  [SUSPEND_ACTION_TYPES.block]: {
    title: "suspend.typeBlock",
    detail: "suspend.typeBlockDetail",
    exit: "suspend.typeBlockExit",
  },
} as const;

const EXIT_TONE = {
  [SUSPEND_ACTION_TYPES.forceOffline]: "success",
  [SUSPEND_ACTION_TYPES.suspend]: "warning",
  [SUSPEND_ACTION_TYPES.block]: "danger",
} as const;

const EXIT_ICON = {
  [SUSPEND_ACTION_TYPES.forceOffline]: RotateCcw,
  [SUSPEND_ACTION_TYPES.suspend]: Clock,
  [SUSPEND_ACTION_TYPES.block]: Ban,
} as const;

export interface SuspendActionTypesProps {
  value: SuspendActionType;
  onValueChange: (value: SuspendActionType) => void;
  durationDays: number;
  onDurationChange: (days: number) => void;
  /** Desktop lays the three cards side by side; mobile stacks them. */
  layout: "row" | "stack";
}

/**
 * Three cards, not a dropdown. The difference between them is REVERSIBILITY, and that only reads
 * when the three exit routes are side by side — so each card states its own way back as a chip.
 */
export function SuspendActionTypes({
  value,
  onValueChange,
  durationDays,
  onDurationChange,
  layout,
}: SuspendActionTypesProps) {
  const { t } = useTranslation("adminProviders");

  return (
    <fieldset className={cx("grid gap-s3", layout === "row" ? "grid-cols-3" : "grid-cols-1")}>
      <legend className="sr-only">{t("suspend.actionTypeLegend")}</legend>

      {SUSPEND_ACTION_ORDER.map((actionType) => {
        const isSelected = actionType === value;
        return (
          <div
            key={actionType}
            className={cx(
              "flex flex-col rounded-card border bg-canvas p-s3",
              isSelected ? "border-danger bg-bg-danger" : "border-border-subtle",
            )}
          >
            <label className="flex cursor-pointer items-start gap-s2">
              <input
                type="radio"
                name="suspend-action-type"
                className="sr-only"
                checked={isSelected}
                onChange={() => onValueChange(actionType)}
              />
              <span
                aria-hidden
                className={cx(
                  "mt-s1 size-s4 flex-none rounded-full border-2",
                  isSelected ? "border-danger bg-danger" : "border-border-strong",
                )}
              />
              <span className="grow">
                <span className={cx("block text-emph", isSelected ? "text-danger" : "text-text-1")}>
                  {t(COPY[actionType].title)}
                </span>
                <span className="mt-s1 block text-label text-text-2">
                  {t(COPY[actionType].detail)}
                </span>
                <Pill tone={EXIT_TONE[actionType]} icon={EXIT_ICON[actionType]} className="mt-s2">
                  {t(COPY[actionType].exit)}
                </Pill>
              </span>
            </label>

            {/* Duration belongs to the selected card and is meaningless for the other two, so it
                sits inside it — outside the label, so the segmented control is its own control. */}
            {isSelected && actionType === SUSPEND_ACTION_TYPES.suspend ? (
              <Segmented
                label={t("suspend.durationLabel")}
                className="mt-s3"
                value={String(durationDays)}
                onValueChange={(next) => onDurationChange(Number(next))}
                // Compact "1d / 3d / 7d / 30d": the full words overflowed this card at 1440 and
                // bled into the neighbouring action card. The group label still says "length".
                options={SUSPEND_DURATIONS.map((days) => ({
                  value: String(days),
                  label: t("suspend.durationDaysShort", { count: days }),
                }))}
              />
            ) : null}
          </div>
        );
      })}
    </fieldset>
  );
}
