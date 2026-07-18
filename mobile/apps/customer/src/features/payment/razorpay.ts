import RazorpayCheckout from "react-native-razorpay";

import { RAZORPAY_KEY_ID } from "@/lib/config";

// Thin wrapper over the Razorpay Checkout SDK. Opens the native test-mode checkout for the given
// amount and resolves with the razorpay_payment_id on success (rejects on cancel/failure). In the
// production flow you'd pass a server-created `orderId`; the test/simulation flow works amount-only.
export interface RazorpayPayParams {
  amountPaise: number;
  description: string;
  name?: string;
  contact?: string;
  /** Server-created order id, when the backend order endpoint exists. */
  orderId?: string;
}

/** True once EXPO_PUBLIC_RAZORPAY_KEY_ID is set — otherwise checkout can't open. */
export function isRazorpayConfigured(): boolean {
  return RAZORPAY_KEY_ID.length > 0;
}

export async function openRazorpayCheckout(params: RazorpayPayParams): Promise<string> {
  const result = await RazorpayCheckout.open({
    key: RAZORPAY_KEY_ID,
    amount: params.amountPaise,
    currency: "INR",
    name: "SETHU-CARE",
    description: params.description,
    order_id: params.orderId,
    prefill: { name: params.name, contact: params.contact },
    theme: { color: "#1D4ED8" },
  });
  return result.razorpay_payment_id;
}
