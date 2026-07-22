import { Copy } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import type { AppVersion } from "./settings.types";

export interface HelpVersionCardProps {
  version: AppVersion;
  onCopy: () => void;
  /** Desktop gives the block a brand outline — it is what the engineer on the ticket needs first. */
  outlined?: boolean;
}

/**
 * BOX 65 / 104 — the version block, deliberately given real weight (spec §6.33). The first question
 * in any support conversation is "what build are you on?", and reading four values down a phone line
 * at 2am is where the mistakes happen; one button copies all four.
 */
export function HelpVersionCard({ version, onCopy, outlined = false }: HelpVersionCardProps) {
  const { t } = useTranslation("adminSettings");

  const rows = [
    { id: "app", label: t("support.versionApp"), value: version.app },
    { id: "build", label: t("support.versionBuild"), value: version.build },
    { id: "environment", label: t("support.versionEnvironment"), value: version.environment },
    { id: "bundle", label: t("support.versionBundle"), value: version.bundle },
  ];

  return (
    <Card edge={outlined ? "brand" : "none"}>
      <p className="mb-s3 text-pill uppercase tracking-wider text-text-3">{t("support.version")}</p>
      <dl className="flex flex-col gap-s2">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center justify-between gap-s3">
            <dt className="text-label text-text-2">{row.label}</dt>
            <dd className="font-mono text-mono text-text-1">{row.value}</dd>
          </div>
        ))}
      </dl>
      <Button
        variant="outline"
        size="inline"
        block
        iconStart={Copy}
        className="mt-s4"
        onClick={onCopy}
      >
        {t("support.copyVersion")}
      </Button>
    </Card>
  );
}
