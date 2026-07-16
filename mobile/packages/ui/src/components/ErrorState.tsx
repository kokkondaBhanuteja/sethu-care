import { View } from "react-native";

import { Text } from "./Text";
import { Button } from "./Button";
import { Icon } from "./Icon";

// A failed-to-load placeholder with an optional retry. Pass both onRetry and retryLabel to show the
// button. Graceful failure states are an Apple review requirement, not an afterthought.
export interface ErrorStateProps {
  title: string;
  retryLabel?: string;
  onRetry?: () => void;
}

export function ErrorState({ title, retryLabel, onRetry }: ErrorStateProps) {
  return (
    <View className="flex-1 items-center justify-center gap-md py-2xl">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-error-container">
        <Icon name="alert" size={28} tone="error" />
      </View>
      <Text variant="label" tone="error" className="text-center">
        {title}
      </Text>
      {onRetry && retryLabel ? (
        <Button label={retryLabel} variant="secondary" size="sm" icon="refresh" onPress={onRetry} />
      ) : null}
    </View>
  );
}
