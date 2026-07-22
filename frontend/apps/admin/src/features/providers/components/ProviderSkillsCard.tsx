import { Check, Clock, Wrench } from "lucide-react";
import { useTranslation } from "@sethu/i18n";
import { CardContent, CardHeader, IconChip } from "@sethu/ui-web";

import { Card } from "../../../components/ui/Card";
import { Pill } from "../../../components/ui/Pill";
import { formatDate } from "../../../lib/format";
import type { ProviderSkill } from "../providers.types";
import { SectionLabel } from "./SectionLabel";

export interface ProviderSkillsCardProps {
  skills: readonly ProviderSkill[];
  /** Mobile renders the group without the card chrome, under a section divider instead. */
  bare?: boolean;
}

/** Certified skills read green; a pending certification is amber — claimed, not yet earned. */
export function ProviderSkillsCard({ skills, bare = false }: ProviderSkillsCardProps) {
  const { t } = useTranslation("adminProviders");

  const pills = (
    <div className="flex flex-wrap gap-2">
      {skills.map((skill) => (
        <Pill
          key={skill.name}
          tone={skill.isPending ? "warning" : "success"}
          icon={skill.isPending ? Clock : Check}
        >
          {skill.isPending || !skill.certifiedTo
            ? t("profile.skillPending", { name: skill.name })
            : t("profile.skillCertified", {
                name: skill.name,
                date: formatDate(skill.certifiedTo),
              })}
        </Pill>
      ))}
    </div>
  );

  if (bare) {
    return (
      <div className="px-s4 py-s4">
        <SectionLabel className="mb-s3">{t("profile.skills")}</SectionLabel>
        {pills}
      </div>
    );
  }

  return (
    <Card density="flush">
      <CardHeader
        icon={
          <IconChip accent="purple" look="soft">
            <Wrench aria-hidden />
          </IconChip>
        }
      >
        {t("profile.skills")}
      </CardHeader>
      <CardContent>{pills}</CardContent>
    </Card>
  );
}
