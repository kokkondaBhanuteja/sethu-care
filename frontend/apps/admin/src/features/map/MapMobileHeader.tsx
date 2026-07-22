import { ChevronLeft, Layers, LocateFixed } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { MapFabButton } from "./MapFabButton";

export interface MapMobileHeaderProps {
  onBack: () => void;
  onOpenLayers: () => void;
  onRecentre: () => void;
}

/**
 * The floating header from BOX 41: a back FAB, the title pill and the two map controls, all over a
 * transparent bar so the canvas runs to the top edge. A pushed screen, so the title is the page's
 * only h1.
 */
export function MapMobileHeader({ onBack, onOpenLayers, onRecentre }: MapMobileHeaderProps) {
  const { t } = useTranslation("adminMap");
  const { t: tShell } = useTranslation("adminShell");

  return (
    <header className="absolute inset-x-0 top-0 z-20 flex items-center gap-s3 px-s4 py-s2 min-h-row-56">
      <MapFabButton glyph={ChevronLeft} label={tShell("actions.back")} onClick={onBack} />
      <h1 className="map-title-pill">{t("title")}</h1>
      <div className="ml-auto flex items-center gap-s2">
        <MapFabButton glyph={Layers} label={t("layers.open")} onClick={onOpenLayers} />
        <MapFabButton glyph={LocateFixed} label={t("controls.recentre")} onClick={onRecentre} />
      </div>
    </header>
  );
}
