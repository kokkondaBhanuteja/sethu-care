import { View, type StyleProp, type ViewStyle } from "react-native";
import { Image, type ImageSource, type ImageStyle } from "expo-image";
import { color } from "@sethu/tokens";

import { Icon, type IconName } from "./Icon";

// A rich-media image with a graceful fallback. Pass `source` (a require() or { uri }) once artwork
// exists; until then a soft solid-colour block (with an optional glyph) stands in — so the Swiggy-
// style image-forward layout looks right before the generated images land. Backed by expo-image
// (cached, fades in). See docs/image-generation-prompts.md for the asset set.
export interface AppImageProps {
  source?: ImageSource | number | null;
  style?: StyleProp<ViewStyle>;
  /** Fallback block colour when there's no source. Defaults to soft blue. */
  placeholderColor?: string;
  /** Optional glyph shown centered on the fallback block. */
  placeholderIcon?: IconName;
  placeholderIconTone?: "primary" | "muted" | "inverse";
}

export function AppImage({
  source,
  style,
  placeholderColor = color.primaryContainer,
  placeholderIcon,
  placeholderIconTone = "primary",
}: AppImageProps) {
  if (source == null) {
    return (
      <View
        style={[{ backgroundColor: placeholderColor }, style]}
        className="items-center justify-center overflow-hidden"
      >
        {placeholderIcon ? (
          <Icon name={placeholderIcon} size={28} tone={placeholderIconTone} />
        ) : null}
      </View>
    );
  }
  return (
    <Image
      source={source}
      style={style as StyleProp<ImageStyle>}
      contentFit="cover"
      transition={250}
    />
  );
}
