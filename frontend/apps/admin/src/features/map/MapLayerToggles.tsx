import { useTranslation } from "@sethu/i18n";

import { Switch } from "../../components/ui/form/Switch";
import { MAP_LAYER_ORDER, type MapLayer } from "./map.constants";
import { LAYER_KEYS } from "./map.labels";
import type { MapLayerState } from "./map.selectors";

export interface MapLayerTogglesProps {
  layers: MapLayerState;
  onToggle: (layer: MapLayer, isOn: boolean) => void;
  heading?: string;
}

/**
 * The five layers, in the design's order. Escalations-only and the heatmap are off by default
 * because each hides or repaints markers, and a filtered map that looks like a full one is the
 * worst state this screen can be in (BOX 24).
 */
export function MapLayerToggles({ layers, onToggle, heading }: MapLayerTogglesProps) {
  const { t } = useTranslation("adminMap");

  return (
    <section className="flex flex-col gap-s2">
      {heading ? <h3 className="text-pill uppercase text-text-2">{heading}</h3> : null}
      {MAP_LAYER_ORDER.map((layer) => (
        <Switch
          key={layer}
          checked={layers[layer]}
          onCheckedChange={(isOn) => onToggle(layer, isOn)}
          label={t(LAYER_KEYS[layer])}
        />
      ))}
    </section>
  );
}
