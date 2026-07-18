import { type ReactNode } from "react";
import { Modal, Pressable, View } from "react-native";
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "./Text";
import { Icon } from "./Icon";
import { PressableScale } from "./PressableScale";

// A bottom sheet: a dimmed backdrop with a rounded panel that slides up from the bottom edge. Tapping
// the backdrop or the close button dismisses it. The panel is safe-area aware and caps at ~85% height
// so long lists scroll inside it. Used for the language and location pickers — the Swiggy/Uber pattern.
export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function Sheet({ visible, onClose, title, children }: SheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View className="flex-1 justify-end">
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(180)}
          className="absolute inset-0"
        >
          <Pressable
            className="flex-1 bg-inverse-surface/40"
            onPress={onClose}
            accessibilityLabel={title}
          />
        </Animated.View>
        <Animated.View
          entering={SlideInDown.duration(280)}
          exiting={SlideOutDown.duration(220)}
          className="rounded-t-3xl bg-surface-container-lowest"
          style={{ paddingBottom: Math.max(insets.bottom, 16), maxHeight: "85%" }}
        >
          <View className="items-center pt-sm">
            <View className="h-1 w-10 rounded-full bg-outline-variant" />
          </View>
          {title ? (
            <View className="flex-row items-center justify-between px-mobile-margin pb-sm pt-md">
              <Text variant="headlineSm">{title}</Text>
              <PressableScale onPress={onClose} accessibilityLabel="Close">
                <View className="h-9 w-9 items-center justify-center rounded-full bg-surface-container-high">
                  <Icon name="close" size={18} tone="muted" />
                </View>
              </PressableScale>
            </View>
          ) : null}
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}
