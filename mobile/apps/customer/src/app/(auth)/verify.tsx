import { useState } from "react";
import { KeyboardAvoidingView, Platform, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { verifyOtpMutation } from "@sethu/api-client";
import { useSession, type Role } from "@sethu/core";
import { Screen, Text, Button, BrandMark } from "@sethu/ui";
import { useTranslation } from "@sethu/i18n";

// Step 2 of login: verify the OTP. On success we persist the JWT in the keychain (via the session
// store) and land on the app; the auth gate then keeps us in.
export default function Verify() {
  const { t } = useTranslation(["auth", "common"]);
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const signIn = useSession((state) => state.signIn);
  const [code, setCode] = useState("");
  const { mutate, isPending } = useMutation(verifyOtpMutation());

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

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <View className="flex-1 justify-center gap-lg px-mobile-margin">
          <View className="items-center gap-md">
            <BrandMark size={80} icon="phone" />
            <View className="items-center gap-1">
              <Text variant="headline">{t("otp.title")}</Text>
              <Text variant="body" tone="muted" className="text-center">
                {t("otp.subtitle", { phone })}
              </Text>
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
            onPress={onVerify}
            fullWidth
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
