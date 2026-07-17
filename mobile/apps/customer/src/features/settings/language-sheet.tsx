import { View } from "react-native";
import { usePreferences } from "@sethu/core";
import { Sheet, Text, Icon, PressableScale } from "@sethu/ui";
import { useTranslation, supportedLanguages, type SupportedLanguage } from "@sethu/i18n";

const LANGUAGE_LABELS: Record<SupportedLanguage, { native: string; english: string }> = {
  en: { native: "English", english: "English" },
  hi: { native: "हिन्दी", english: "Hindi" },
  te: { native: "తెలుగు", english: "Telugu" },
};

// The language picker: a bottom sheet listing the shipped languages with the active one checked.
// Choosing one switches i18n live and persists it to preferences so it survives restarts.
export interface LanguageSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function LanguageSheet({ visible, onClose }: LanguageSheetProps) {
  const { t, i18n } = useTranslation("common");
  const setLanguage = usePreferences((state) => state.setLanguage);
  const current = i18n.language as SupportedLanguage;

  const choose = (language: SupportedLanguage) => {
    void i18n.changeLanguage(language);
    setLanguage(language);
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t("account.language")}>
      <View className="gap-sm px-mobile-margin pb-md pt-xs">
        {supportedLanguages.map((language) => {
          const isSelected = current === language;
          return (
            <PressableScale
              key={language}
              onPress={() => choose(language)}
              accessibilityLabel={LANGUAGE_LABELS[language].english}
            >
              <View
                className={`flex-row items-center gap-md rounded-card border p-md ${
                  isSelected ? "border-primary bg-primary-container/40" : "border-outline-variant"
                }`}
              >
                <Icon name="globe" tone={isSelected ? "primary" : "muted"} />
                <View className="flex-1">
                  <Text variant="label">{LANGUAGE_LABELS[language].native}</Text>
                  <Text variant="caption" tone="muted">
                    {LANGUAGE_LABELS[language].english}
                  </Text>
                </View>
                {isSelected ? <Icon name="checkCircle" tone="primary" weight="fill" /> : null}
              </View>
            </PressableScale>
          );
        })}
      </View>
    </Sheet>
  );
}
