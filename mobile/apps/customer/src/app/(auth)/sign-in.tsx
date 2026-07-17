import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { requestOtpMutation } from "@sethu/api-client";
import { Screen, Text, Button, Illustration, TextField } from "@sethu/ui";
import { useTranslation } from "@sethu/i18n";

// Step 1 of login: the customer enters their phone number and we request an OTP. On success we
// move to the verify screen, passing the phone along. The content lives in a ScrollView so the
// input stays visible above the on-screen keyboard.
export default function SignIn() {
  const { t } = useTranslation("auth");
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const { mutate, isPending } = useMutation(requestOtpMutation());

  const onSend = () => {
    mutate(
      { body: { phone } },
      { onSuccess: () => router.push({ pathname: "/(auth)/verify", params: { phone } }) },
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
              <Illustration name="welcome" size={160} />
              <View className="items-center gap-1">
                <Text variant="headline">{t("signIn.title")}</Text>
                <Text variant="body" tone="muted" className="text-center">
                  {t("signIn.subtitle")}
                </Text>
              </View>
            </View>
            <TextField
              label={t("signIn.phoneLabel")}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
              placeholder="+919000000001"
            />
            <Button label={t("signIn.sendOtp")} loading={isPending} onPress={onSend} fullWidth />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
