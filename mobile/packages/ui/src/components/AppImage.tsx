import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Image, type ImageSource, type ImageStyle } from "expo-image";
import { color } from "@sethu/tokens";

import { Icon, type IconName } from "./Icon";

// A rich-media image on a coloured surface. The background always paints, so a transparent asset
// (e.g. a clay service icon) sits on the soft-blue tile, and a missing `source` shows an optional
// glyph placeholder — the Swiggy-style layout looks right before/after the art lands. Backed by
// expo-image (cached, fades in). `contentFit="contain"` for icons, "cover" for photos.
// See docs/image-generation-prompts.md for the asset set.
export interface AppImageProps {
  source?: ImageSource | number | null;
  style?: StyleProp<ViewStyle>;
  /** Surface colour behind the image / for the fallback block. Defaults to soft blue. */
  placeholderColor?: string;
  /** Glyph shown when there's no source. */
  placeholderIcon?: IconName;
  placeholderIconTone?: "primary" | "muted" | "inverse";
  contentFit?: "cover" | "contain";
}

export function AppImage({
  source,
  style,
  placeholderColor = color.primaryContainer,
  placeholderIcon,
  placeholderIconTone = "primary",
  contentFit = "cover",
}: AppImageProps) {
  return (
    <View
      style={[{ backgroundColor: placeholderColor }, style]}
      className="items-center justify-center overflow-hidden"
    >
      {source != null ? (
        <Image
          source={source}
          style={StyleSheet.absoluteFill as StyleProp<ImageStyle>}
          contentFit={contentFit}
          transition={250}
        />
      ) : placeholderIcon ? (
        <Icon name={placeholderIcon} size={28} tone={placeholderIconTone} />
      ) : null}
    </View>
  );
}
