// react-native-razorpay ships no types; declare the slice of the API we use.
declare module "react-native-razorpay" {
  export interface RazorpayOptions {
    /** Public Key ID (rzp_test_… in test mode). */
    key: string;
    /** Amount in the smallest currency unit (paise for INR). */
    amount: number;
    currency?: string;
    name?: string;
    description?: string;
    image?: string;
    /** Server-created order id (production flow). Optional in the amount-only test flow. */
    order_id?: string;
    prefill?: { email?: string; contact?: string; name?: string };
    theme?: { color?: string };
    notes?: Record<string, string>;
  }

  export interface RazorpaySuccess {
    razorpay_payment_id: string;
    razorpay_order_id?: string;
    razorpay_signature?: string;
  }

  export interface RazorpayError {
    code: number;
    description: string;
  }

  const RazorpayCheckout: {
    open(options: RazorpayOptions): Promise<RazorpaySuccess>;
  };
  export default RazorpayCheckout;
}
