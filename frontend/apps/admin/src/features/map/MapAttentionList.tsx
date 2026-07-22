import { Link } from "react-router";
import { BellRing, ChevronRight, UserX } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Card, CardList } from "../../components/ui/Card";
import { Icon } from "../../components/ui/Icon";
import { formatAge } from "../../lib/format";
import { ROUTES } from "../../routes/routes.constants";
import { ATTENTION_REASON_KEYS } from "./map.labels";
import { ATTENTION_REASONS } from "./map.types";
import type { MapAttentionItem } from "./map.types";

export interface MapAttentionListProps {
  items: readonly MapAttentionItem[];
  zoneNameOf: (zoneId: string) => string;
}

/**
 * The two rows the dock and the sheet both lead with. They are links, not marker shortcuts: the
 * bookings that need a human have to be reachable without touching the canvas at all (BOX 24).
 */
export function MapAttentionList({ items, zoneNameOf }: MapAttentionListProps) {
  const { t } = useTranslation("adminMap");

  if (items.length === 0) return null;

  return (
    <section className="flex flex-col gap-s2">
      <h3 className="text-pill uppercase text-danger">
        {t("attention.heading", { count: items.length })}
      </h3>

      <CardList>
        {items.map((item) => (
          <Link key={item.id} to={ROUTES.bookingDetail(item.bookingRef)} className="block">
            <Card edge="danger" density="tight">
              <span className="flex items-center gap-s2">
                <Icon
                  glyph={item.reason === ATTENTION_REASONS.escalated ? BellRing : UserX}
                  className="text-danger"
                />
                <span className="grow min-w-0 flex flex-col">
                  <span className="text-label text-text-1 truncate">
                    <span className="font-mono">#{item.bookingRef}</span> ·{" "}
                    {t(ATTENTION_REASON_KEYS[item.reason])}
                  </span>
                  <span className="text-caption text-text-3">
                    {t("attention.meta", {
                      zone: zoneNameOf(item.zoneId),
                      age: formatAge(item.waitingSince),
                    })}
                  </span>
                </span>
                <Icon glyph={ChevronRight} className="text-text-3" />
              </span>
            </Card>
          </Link>
        ))}
      </CardList>
    </section>
  );
}
