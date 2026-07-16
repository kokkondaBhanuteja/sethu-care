import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Screen, Text, Button, StatusPill, TextField } from "@sethu/ui";
import { useTranslation } from "@sethu/i18n";

import { useMyJobs, useTransitionJob } from "@/features/jobs";
import { useBookingPayment, useDepositCash } from "@/features/payment";

const PAYMENT_METHODS = ["UPI", "CASH", "ONLINE"] as const;

// Build a transition body with only the fields that apply — VERIFY_START carries the code,
// VERIFY_COMPLETION carries code + payment_method, everything else is a bare action. (Spreading
// conditionals keeps undefined keys out, which exactOptionalPropertyTypes requires.)
function transitionBody(action: string, code?: string, method?: string) {
  return {
    action,
    ...(code ? { code } : {}),
    ...(method ? { payment_method: method } : {}),
  };
}

// A single job's lifecycle for the technician: travel → arrive → start (OTP) → work done →
// complete (OTP + how the customer paid) → collect. The allowed actions come from the backend, so
// only the legal next steps ever render; the OTP-gated ones reveal an inline code entry.
export default function JobDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookingId = id ?? "";
  const { t } = useTranslation(["jobs", "common"]);

  const { data } = useMyJobs();
  const found = (data?.jobs ?? []).find((job) => job.booking_id === bookingId);
  // Keep the last-seen job so the info panel survives once a completed job drops off the list.
  const [snapshot, setSnapshot] = useState<typeof found>(undefined);
  useEffect(() => {
    if (found) setSnapshot(found);
  }, [found]);
  const info = found ?? snapshot;

  const transition = useTransitionJob();
  const deposit = useDepositCash();

  // The live state/actions: seeded from the job, then advanced by each transition's response.
  const [liveState, setLiveState] = useState<string | null>(null);
  const [liveActions, setLiveActions] = useState<string[] | null>(null);
  const state = liveState ?? info?.state ?? "";
  const actions = liveActions ?? info?.allowed_actions ?? [];

  // Inline entry mode for the OTP-gated actions, plus the code and the collected payment method.
  const [mode, setMode] = useState<"idle" | "start" | "complete">("idle");
  const [code, setCode] = useState("");
  const [method, setMethod] = useState<string>("UPI");
  const [chosenMethod, setChosenMethod] = useState<string | null>(null);

  const completed = state === "COMPLETED";
  const upiLike = chosenMethod === "UPI" || chosenMethod === "ONLINE";
  const payment = useBookingPayment(bookingId, completed && upiLike);

  const apply = (action: string, codeArg?: string, methodArg?: string) =>
    transition.mutate(
      { path: { id: bookingId }, body: transitionBody(action, codeArg, methodArg) },
      {
        onSuccess: (result) => {
          setLiveState(result.state ?? null);
          setLiveActions(result.allowed_actions ?? []);
          setMode("idle");
          setCode("");
          if (action === "VERIFY_COMPLETION" && methodArg) setChosenMethod(methodArg);
        },
      },
    );

  const codeValid = /^\d{6}$/.test(code);

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-md px-mobile-margin pt-md pb-2xl">
          <View className="flex-row items-center justify-between">
            <Text variant="headline">{info?.service_name ?? t("jobs:detail.service")}</Text>
            {state ? <StatusPill label={state} tone={completed ? "success" : "active"} /> : null}
          </View>

          {/* Customer + address card */}
          <View className="gap-1 rounded-card border border-outline-variant bg-surface-container-lowest p-md">
            <Text variant="caption" tone="muted">
              {t("jobs:detail.customer")}
            </Text>
            <Text variant="label">{info?.customer_name ?? ""}</Text>
            <Text variant="caption" tone="muted" className="pt-sm">
              {t("jobs:detail.address")}
            </Text>
            <Text variant="body">
              {[info?.line1, info?.city, info?.pincode].filter(Boolean).join(", ")}
            </Text>
            {info?.quoted_total ? (
              <Text variant="label" tone="primary" className="pt-sm">
                {t("jobs:detail.total", { amount: `₹${info.quoted_total}` })}
              </Text>
            ) : null}
            <View className="flex-row gap-sm pt-sm">
              {info?.customer_phone ? (
                <Button
                  label={t("jobs:detail.call")}
                  variant="secondary"
                  size="sm"
                  onPress={() => void Linking.openURL(`tel:${info.customer_phone}`).catch(() => {})}
                />
              ) : null}
              {info?.line1 ? (
                <Button
                  label={t("jobs:detail.navigate")}
                  variant="ghost"
                  size="sm"
                  onPress={() =>
                    void Linking.openURL(
                      `http://maps.apple.com/?q=${encodeURIComponent(
                        [info.line1, info.city, info.pincode].filter(Boolean).join(", "),
                      )}`,
                    ).catch(() => {})
                  }
                />
              ) : null}
            </View>
          </View>

          {/* Start-job OTP entry */}
          {mode === "start" ? (
            <View className="gap-sm rounded-card border border-outline-variant p-md">
              <Text variant="label">{t("jobs:otp.startTitle")}</Text>
              <Text variant="caption" tone="muted">
                {t("jobs:otp.startHint")}
              </Text>
              <TextField
                label={t("jobs:otp.codeLabel")}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="000000"
              />
              <Button
                label={t("jobs:otp.verifyStart")}
                loading={transition.isPending}
                disabled={!codeValid}
                onPress={() => apply("VERIFY_START", code)}
                fullWidth
              />
            </View>
          ) : null}

          {/* Completion: how the customer paid + OTP entry */}
          {mode === "complete" ? (
            <View className="gap-sm rounded-card border border-outline-variant p-md">
              <Text variant="label">{t("jobs:payment.methodTitle")}</Text>
              <View className="flex-row gap-sm">
                {PAYMENT_METHODS.map((option) => (
                  <Pressable
                    key={option}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: method === option }}
                    onPress={() => setMethod(option)}
                    className={`rounded-full border px-md py-sm ${
                      method === option ? "border-primary bg-primary/10" : "border-outline-variant"
                    }`}
                  >
                    <Text variant="label" tone={method === option ? "primary" : "default"}>
                      {t(`jobs:payment.${option.toLowerCase() as "upi" | "cash" | "online"}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text variant="label" className="pt-sm">
                {t("jobs:otp.completionTitle")}
              </Text>
              <TextField
                label={t("jobs:otp.codeLabel")}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="000000"
              />
              <Button
                label={t("jobs:otp.verifyComplete")}
                loading={transition.isPending}
                disabled={!codeValid}
                onPress={() => apply("VERIFY_COMPLETION", code, method)}
                fullWidth
              />
            </View>
          ) : null}

          {/* Post-completion collection: UPI link to open, or cash to deposit */}
          {completed && chosenMethod === "CASH" ? (
            <View className="gap-sm rounded-card border border-outline-variant p-md">
              <Text variant="label">{t("jobs:payment.cashHeld")}</Text>
              {deposit.isSuccess ? (
                <StatusPill label={t("jobs:payment.deposited")} tone="success" />
              ) : (
                <Button
                  label={t("jobs:payment.deposit")}
                  loading={deposit.isPending}
                  onPress={() => deposit.mutate({ body: { booking_id: bookingId } })}
                  fullWidth
                />
              )}
            </View>
          ) : null}

          {completed && upiLike ? (
            <View className="gap-sm rounded-card border border-outline-variant p-md">
              <Text variant="label">{t("jobs:payment.collectTitle")}</Text>
              {payment.data?.status === "CAPTURED" ? (
                <StatusPill label={t("jobs:payment.paid")} tone="success" />
              ) : (
                <>
                  {payment.data?.amount ? (
                    <Text variant="body">
                      {t("jobs:payment.amount", { amount: `₹${payment.data.amount}` })}
                    </Text>
                  ) : null}
                  {payment.data?.reference ? (
                    <Text variant="caption" tone="muted">
                      {t("jobs:payment.reference", { reference: payment.data.reference })}
                    </Text>
                  ) : null}
                  {payment.data?.upi_link ? (
                    <Button
                      label={t("jobs:payment.openUpi")}
                      onPress={() =>
                        payment.data?.upi_link &&
                        void Linking.openURL(payment.data.upi_link).catch(() => {})
                      }
                      fullWidth
                    />
                  ) : null}
                </>
              )}
            </View>
          ) : null}

          {/* Lifecycle actions (only the legal next steps render) */}
          {mode === "idle" && !completed ? (
            <View className="gap-sm">
              {actions.includes("DEPART") ? (
                <Button
                  label={t("jobs:actions.depart")}
                  loading={transition.isPending}
                  onPress={() => apply("DEPART")}
                  fullWidth
                />
              ) : null}
              {actions.includes("ARRIVE") ? (
                <Button
                  label={t("jobs:actions.arrive")}
                  loading={transition.isPending}
                  onPress={() => apply("ARRIVE")}
                  fullWidth
                />
              ) : null}
              {actions.includes("VERIFY_START") ? (
                <Button
                  label={t("jobs:actions.verifyStart")}
                  onPress={() => setMode("start")}
                  fullWidth
                />
              ) : null}
              {actions.includes("REQUEST_COMPLETION") ? (
                <Button
                  label={t("jobs:actions.requestCompletion")}
                  loading={transition.isPending}
                  onPress={() => apply("REQUEST_COMPLETION")}
                  fullWidth
                />
              ) : null}
              {actions.includes("VERIFY_COMPLETION") ? (
                <Button
                  label={t("jobs:actions.verifyCompletion")}
                  onPress={() => setMode("complete")}
                  fullWidth
                />
              ) : null}
              {actions.includes("CANCEL") ? (
                <Button
                  label={t("jobs:actions.cancel")}
                  variant="secondary"
                  loading={transition.isPending}
                  onPress={() => apply("CANCEL")}
                  fullWidth
                />
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}
