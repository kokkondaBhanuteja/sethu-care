import { useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { requestOtpMutation } from "@sethu/api-client";
import { Screen, Text, Button, TextField } from "@sethu/ui";
import { useTranslation } from "@sethu/i18n";

// Step 1 of login: the technician enters their phone number and we request an OTP. The field shows a
// fixed +91 prefix and takes only the 10 local digits; we build the E.164 number the backend expects.
export default function SignIn() {
  const { t } = useTranslation("auth");
  const router = useRouter();
  const [localDigits, setLocalDigits] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const { mutate, isPending } = useMutation(requestOtpMutation());

  const onChange = (next: string) => {
    setLocalDigits(next.replace(/\D/g, "").slice(0, 10));
    if (error) setError(undefined);
  };

  const onSend = () => {
    if (localDigits.length !== 10) {
      setError(t("signIn.invalidPhone"));
      return;
    }
    const phone = `+91${localDigits}`;
    mutate(
      { body: { phone } },
      {
        onSuccess: () => router.push({ pathname: "/(auth)/verify", params: { phone } }),
        onError: () => setError(t("signIn.sendFailed")),
      },
    );
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <View className="flex-1 justify-center gap-md px-mobile-margin">
          <Text variant="headline">{t("signIn.title")}</Text>
          <Text variant="body" tone="muted">
            {t("signIn.subtitle")}
          </Text>
          <TextField
            label={t("signIn.phoneLabel")}
            prefix="+91"
            value={localDigits}
            onChangeText={onChange}
            error={error}
            keyboardType="number-pad"
            autoComplete="tel"
            maxLength={10}
            placeholder="90000 00001"
          />
          <Button
            label={t("signIn.sendOtp")}
            loading={isPending}
            disabled={localDigits.length !== 10}
            onPress={onSend}
            fullWidth
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
