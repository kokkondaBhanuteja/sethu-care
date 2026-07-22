import { useTranslation } from "@sethu/i18n";

import { Segmented } from "../../components/ui/Segmented";
import {
  REDISPATCH_RADII,
  REDISPATCH_RADIUS_ORDER,
  type RedispatchRadiusId,
} from "./booking-actions.constants";

export interface RedispatchRadiusFieldProps {
  value: RedispatchRadiusId;
  baseRadiusKm: number;
  onValueChange: (radiusId: RedispatchRadiusId) => void;
}

/** The radius segments plus the long-ETA caution that belongs to the city-wide choice alone. */
export function RedispatchRadiusField({
  value,
  baseRadiusKm,
  onValueChange,
}: RedispatchRadiusFieldProps) {
  const { t } = useTranslation("adminBookingActions");

  return (
    <div className="flex flex-col gap-s2">
      <Segmented
        tall
        label={t("redispatch.radiusLabel")}
        value={value}
        onValueChange={onValueChange}
        options={REDISPATCH_RADIUS_ORDER.map((radiusId) => ({
          value: radiusId,
          label: t(`redispatch.radius.${radiusId}`, {
            km: radiusKmFor(radiusId, baseRadiusKm),
          }),
        }))}
      />
      {/* A consequence of the city-wide choice, so it appears only with that choice — exactly
          like the relax-skill warning next to its toggle. Unconditional, it was noise. */}
      {value === REDISPATCH_RADII.cityWide ? (
        <p className="text-caption text-warning">{t("redispatch.cityWideWarning")}</p>
      ) : null}
    </div>
  );
}

function radiusKmFor(radiusId: RedispatchRadiusId, baseRadiusKm: number): string {
  if (radiusId === REDISPATCH_RADII.plus50) return (baseRadiusKm * 1.5).toFixed(1);
  if (radiusId === REDISPATCH_RADII.plus100) return (baseRadiusKm * 2).toFixed(1);
  return baseRadiusKm.toFixed(1);
}
