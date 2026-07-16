"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestOtp, verifyOtp } from "@sethu/api-client";

import { Button, Card } from "@/components/ui";
import { setSessionToken } from "@/lib/session";

// Admin login: phone + OTP. In dev the backend echoes the code (no SMS provider), which we surface
// so a reviewer can sign in. Only ADMIN accounts are allowed through — a non-admin token is
// rejected here rather than failing later on every ops call.
export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("+919000000008");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sendCode = async () => {
    setBusy(true);
    setError(null);
    const { data, error: err } = await requestOtp({ body: { phone } });
    setBusy(false);
    if (err || !data) {
      setError("Couldn't send the code. Check the phone number.");
      return;
    }
    setDevCode(data.dev_code ?? null);
    setStep("code");
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    const { data, error: err } = await verifyOtp({ body: { phone, code } });
    setBusy(false);
    if (err || !data?.token) {
      setError("Invalid or expired code.");
      return;
    }
    if (data.role !== "ADMIN") {
      setError("This account is not an admin.");
      return;
    }
    setSessionToken(data.token);
    router.replace("/");
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-md">
      <Card className="w-full max-w-md">
        <h1 className="font-heading text-headline-md text-primary">SETHU-CARE Admin</h1>
        <p className="mt-1 text-body-md text-on-surface-variant">
          Sign in to the operations console
        </p>

        <div className="mt-lg flex flex-col gap-md">
          {step === "phone" ? (
            <>
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+9190000000008"
                className="rounded-md border border-outline-variant px-md py-sm text-body-md text-on-surface outline-none focus:border-primary"
              />
              <Button onClick={sendCode} disabled={busy}>
                {busy ? "Sending…" : "Send code"}
              </Button>
            </>
          ) : (
            <>
              {devCode ? (
                <p className="rounded-md bg-primary/10 px-md py-sm text-label-md text-primary">
                  Dev code: <span className="font-semibold">{devCode}</span>
                </p>
              ) : null}
              <input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="6-digit code"
                inputMode="numeric"
                maxLength={6}
                className="rounded-md border border-outline-variant px-md py-sm text-body-md text-on-surface outline-none focus:border-primary"
              />
              <Button onClick={verify} disabled={busy || code.length < 6}>
                {busy ? "Verifying…" : "Verify"}
              </Button>
            </>
          )}
          {error ? <p className="text-label-md text-error">{error}</p> : null}
        </div>
      </Card>
    </div>
  );
}
