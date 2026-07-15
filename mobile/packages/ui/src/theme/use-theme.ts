import { useColorScheme } from "react-native";
import { themes, type SemanticColors, type ThemeName } from "@sethu/tokens";

/** The active theme (following the OS colour scheme) and its semantic colours. Use this only
 *  when a raw colour value is needed (e.g. passing to a gradient or a native prop); prefer
 *  NativeWind classes (`bg-background`, `text-on-surface`) everywhere else. */
export function useTheme(): { name: ThemeName; colors: SemanticColors } {
  const scheme = useColorScheme();
  const name: ThemeName = scheme === "dark" ? "dark" : "light";
  return { name, colors: themes[name] };
}
