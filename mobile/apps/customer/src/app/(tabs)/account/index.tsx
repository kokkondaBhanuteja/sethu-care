import { useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { deleteAccountMutation } from "@sethu/api-client";
import { useSession } from "@sethu/core";
import { Screen, Text, Button, Card, Avatar, Icon, PressableScale, type IconName } from "@sethu/ui";
import { useTranslation, type SupportedLanguage } from "@sethu/i18n";

import { LanguageSheet } from "@/features/settings/language-sheet";
import { LocationSheet } from "@/features/location";
import { useMyBookings } from "@/features/booking";

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: "English",
  hi: "हिन्दी",
  te: "తెలుగు",
};

// A single grouped-inset menu row (iOS Settings style): leading icon, label, optional value, chevron.
function MenuRow({
  icon,
  label,
  value,
  onPress,
  last,
}: {
  icon: IconName;
  label: string;
  value?: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.98}>
      <View
        className={`flex-row items-center gap-md px-md py-sm ${last ? "" : "border-b border-outline-variant/60"}`}
      >
        <Icon name={icon} tone="primary" size={20} />
        <Text variant="body" className="flex-1">
          {label}
        </Text>
        {value ? (
          <Text variant="caption" tone="muted">
            {value}
          </Text>
        ) : null}
        <Icon name="chevronRight" size={16} tone="muted" />
      </View>
    </PressableScale>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <Card padded={false} className="flex-1 items-center gap-1 py-md">
      <Text variant="headlineSm">{value}</Text>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </Card>
  );
}

export default function Account() {
  const { t, i18n } = useTranslation(["common", "auth"]);
  const router = useRouter();
  const user = useSession((state) => state.user);
  const signOut = useSession((state) => state.signOut);
  const { mutate, isPending } = useMutation(deleteAccountMutation());
  const { data: bookingsData } = useMyBookings();
  const [languageOpen, setLanguageOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);

  const bookingCount = bookingsData?.bookings?.length ?? 0;

  const goToSignIn = async () => {
    await signOut();
    router.replace("/(auth)/sign-in");
  };

  const confirmDelete = () => {
    Alert.alert(t("auth:account.delete"), t("auth:account.deleteConfirm"), [
      { text: t("common:actions.cancel"), style: "cancel" },
      {
        text: t("common:actions.delete"),
        style: "destructive",
        onPress: () => mutate({}, { onSuccess: goToSignIn }),
      },
    ]);
  };

  const currentLanguage =
    (i18n.language as SupportedLanguage) in LANGUAGE_LABELS
      ? (i18n.language as SupportedLanguage)
      : "en";

  const notImplemented = () => Alert.alert(t("common:appName"), t("common:empty.title"));

  return (
    <Screen edges={["bottom"]}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      >
        <View className="gap-lg">
          <Card className="flex-row items-center gap-md">
            <Avatar name={user?.name} size={56} />
            <View className="flex-1">
              <Text variant="label">{user?.name || t("common:account.guest")}</Text>
              <Text variant="caption" tone="muted">
                {t("common:appName")}
              </Text>
            </View>
          </Card>

          {/* Stats */}
          <View className="flex-row gap-sm">
            <Stat value={String(bookingCount)} label={t("common:profile.statBookings")} />
            <Stat value="4.9" label={t("common:profile.statRating")} />
            <Stat value={String(bookingCount)} label={t("common:profile.statReviews")} />
          </View>

          {/* Grouped menu */}
          <Card padded={false} className="overflow-hidden py-1">
            <MenuRow
              icon="location"
              label={t("common:profile.savedAddresses")}
              onPress={() => setLocationOpen(true)}
            />
            <MenuRow
              icon="globe"
              label={t("common:account.language")}
              value={LANGUAGE_LABELS[currentLanguage]}
              onPress={() => setLanguageOpen(true)}
            />
            <MenuRow icon="payment" label={t("common:profile.payments")} onPress={notImplemented} />
            <MenuRow
              icon="bell"
              label={t("common:profile.notifications")}
              onPress={notImplemented}
            />
            <MenuRow icon="shield" label={t("common:profile.help")} onPress={notImplemented} last />
          </Card>

          <View className="gap-md pt-sm">
            <Button
              label={t("common:actions.signOut")}
              variant="secondary"
              icon="logout"
              onPress={goToSignIn}
              fullWidth
            />
            <Button
              label={t("auth:account.delete")}
              variant="destructive"
              icon="delete"
              loading={isPending}
              onPress={confirmDelete}
              fullWidth
            />
          </View>
        </View>
      </ScrollView>

      <LanguageSheet visible={languageOpen} onClose={() => setLanguageOpen(false)} />
      <LocationSheet visible={locationOpen} onClose={() => setLocationOpen(false)} />
    </Screen>
  );
}
