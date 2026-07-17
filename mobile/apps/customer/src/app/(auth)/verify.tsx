import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { verifyOtpMutation, requestOtpMutation } from "@sethu/api-client";
import { useSession, type Role } from "@sethu/core";
import { Screen, Text, Button, BrandMark } from "@sethu/ui";
import { useTranslation } from "@sethu/i18n";

const RESEND_COOLDOWN = 30;

// Step 2 of login: verify the OTP. Shows a resend countdown and a "change number" escape hatch. On
// success we persist the JWT in the keychain (via the session store) and land on the app.
export default function Verify() {
  const { t } = useTranslation(["auth", "common"]);
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const signIn = useSession((state) => state.signIn);
  const [code, setCode] = useState("");
  const [seconds, setSeconds] = useState(RESEND_COOLDOWN);
  const { mutate, isPending } = useMutation(verifyOtpMutation());
  const resend = useMutation(requestOtpMutation());

  // Resend cooldown ticker.
  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((current) => current - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  const onVerify = () => {
    mutate(
      { body: { phone: phone ?? "", code } },
      {
        onSuccess: async (data) => {
          if (!data.token) return;
          await signIn(data.token, {
            role: (data.role as Role | undefined) ?? "CUSTOMER",
            name: data.name ?? "",
          });
          router.replace("/");
        },
      },
    );
  };

  const onResend = () => {
    if (seconds > 0) return;
    resend.mutate(
      { body: { phone: phone ?? "" } },
      { onSuccess: () => setSeconds(RESEND_COOLDOWN) },
    );
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="gap-lg px-mobile-margin py-2xl">
            <View className="items-center gap-md">
              <BrandMark size={80} icon="phone" />
              <View className="items-center gap-1">
                <Text variant="headline">{t("otp.title")}</Text>
                <Text variant="body" tone="muted" className="text-center">
                  {t("otp.subtitle", { phone })}
                </Text>
                {/* Escape hatch back to the phone-number step. */}
                <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={8}>
                  <Text variant="label" tone="primary" className="pt-1">
                    {t("otp.changeNumber")}
                  </Text>
                </Pressable>
              </View>
            </View>

            <TextInput
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              autoComplete="sms-otp"
              maxLength={6}
              placeholder="••••••"
              accessibilityLabel={t("otp.title")}
              className="rounded-md border border-outline-variant bg-surface-container-lowest px-sm py-sm text-center font-body text-headline-sm tracking-[8px] text-on-surface"
            />

            <Button
              label={t("common:actions.continue")}
              loading={isPending}
              disabled={code.length !== 6}
              onPress={onVerify}
              fullWidth
            />

            {/* Resend countdown / action. */}
            <View className="items-center">
              {seconds > 0 ? (
                <Text variant="caption" tone="muted">
                  {t("otp.resendIn", { seconds })}
                </Text>
              ) : (
                <Pressable onPress={onResend} accessibilityRole="button" hitSlop={8}>
                  <Text variant="label" tone="primary">
                    {resend.isPending ? "…" : t("otp.resend")}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
