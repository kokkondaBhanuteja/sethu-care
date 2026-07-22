import { TriangleAlert } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Card } from "../../components/ui/Card";
import { Icon } from "../../components/ui/Icon";
import { Segmented } from "../../components/ui/Segmented";
import { Switch } from "../../components/ui/form/Switch";
import { formatMoney } from "../../lib/format";
import { RedispatchIncentiveField } from "./RedispatchIncentiveField";
import { REDISPATCH_RADII, REDISPATCH_RADIUS_ORDER } from "./booking-actions.constants";
import type { RedispatchContext } from "./booking-actions.types";
import type { RedispatchState, RedispatchValues } from "./useRedispatch";

export interface RedispatchFormProps {
  context: RedispatchContext;
  state: RedispatchState;
}

/**
 * The body both shells share. Previous rounds sit ABOVE the controls: radius and incentive are only
 * legible after 3.0, 4.5 and 6.0 km have all come back empty.
 */
export function RedispatchForm({ context, state }: RedispatchFormProps) {
  const { t } = useTranslation("adminBookingActions");
  const { form } = state.form;
  const values = form.watch();
  const baseRadiusKm = context.rounds[0]?.radiusKm ?? 3;

  function setRadius(radiusId: RedispatchValues["radiusId"]) {
    form.setValue("radiusId", radiusId);
    state.markDirty();
  }

  function setToggle(
    field: "relaxSkillMatch" | "includeDecliners" | "priorityBoost",
    next: boolean,
  ) {
    form.setValue(field, next);
    state.markDirty();
  }

  function setIncentive(rupees: number) {
    form.setValue("incentiveRupees", rupees);
    state.markDirty();
  }

  return (
    <div className="flex flex-col gap-s5">
      <p className="text-label text-text-2">{t("redispatch.explainer")}</p>

      <Card tone="surface" density="tight">
        <p className="text-pill text-text-3">{t("redispatch.previousRounds")}</p>
        <ul className="mt-s2 flex flex-col gap-s1">
          {context.rounds.map((round) => (
            <li key={round.round} className="text-label text-text-1">
              {t("redispatch.roundLine", {
                round: round.round,
                radius: round.radiusKm.toFixed(1),
                contacted: round.contacted,
                declined: round.declined,
              })}
            </li>
          ))}
        </ul>
      </Card>

      <div className="flex flex-col gap-s2">
        <Segmented
          tall
          label={t("redispatch.radiusLabel")}
          value={values.radiusId}
          onValueChange={setRadius}
          options={REDISPATCH_RADIUS_ORDER.map((radiusId) => ({
            value: radiusId,
            label: t(`redispatch.radius.${radiusId}`, {
              km: radiusKmFor(radiusId, baseRadiusKm),
            }),
          }))}
        />
        <p className="text-caption text-warning">{t("redispatch.cityWideWarning")}</p>
      </div>

      <div className="flex flex-col">
        <Switch
          checked={values.relaxSkillMatch}
          onCheckedChange={(next) => setToggle("relaxSkillMatch", next)}
          label={t("redispatch.relaxSkill")}
          description={t("redispatch.relaxSkillHint")}
        />
        {/* Attached to the toggle, not hoisted to the top: it is a consequence of this one switch. */}
        {values.relaxSkillMatch ? (
          <Card tone="warning" density="tight" className="mb-s2 flex items-start gap-s2">
            <Icon glyph={TriangleAlert} size="sm" className="text-warning" />
            <span className="text-caption text-warning">{t("redispatch.relaxSkillWarning")}</span>
          </Card>
        ) : null}

        <Switch
          checked={values.includeDecliners}
          onCheckedChange={(next) => setToggle("includeDecliners", next)}
          label={t("redispatch.includeDecliners")}
          description={t("redispatch.includeDeclinersHint", { count: context.declinedCount })}
        />
        <Switch
          checked={values.priorityBoost}
          onCheckedChange={(next) => setToggle("priorityBoost", next)}
          label={t("redispatch.priorityBoost")}
          description={t("redispatch.priorityBoostHint")}
        />
      </div>

      <RedispatchIncentiveField
        value={values.incentiveRupees}
        capPaise={context.incentiveCapPaise}
        onValueChange={setIncentive}
        capLabel={t("redispatch.incentiveCap", { cap: formatMoney(context.incentiveCapPaise) })}
      />
    </div>
  );
}

function radiusKmFor(radiusId: string, baseRadiusKm: number): string {
  if (radiusId === REDISPATCH_RADII.plus50) return (baseRadiusKm * 1.5).toFixed(1);
  if (radiusId === REDISPATCH_RADII.plus100) return (baseRadiusKm * 2).toFixed(1);
  return baseRadiusKm.toFixed(1);
}
