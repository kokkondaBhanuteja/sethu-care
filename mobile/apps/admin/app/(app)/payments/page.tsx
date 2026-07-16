"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  pendingPaymentsOptions,
  pendingPaymentsQueryKey,
  capturePaymentMutation,
} from "@sethu/api-client";

import { Button, Card, EmptyRow, PageHeader, StatusPill } from "@/components/ui";

// UPI collections awaiting capture. In production the payment provider's webhook captures these;
// here an admin confirms one by hand, which books REVENUE against the order and drops it off the
// queue. (A collection appears once a booking is completed with the UPI method.)
export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(pendingPaymentsOptions());
  const payments = data?.payments ?? [];

  const capture = useMutation({
    ...capturePaymentMutation(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: pendingPaymentsQueryKey() });
    },
  });

  return (
    <div>
      <PageHeader title="Payments" subtitle="UPI collections awaiting capture" />

      <Card className="overflow-x-auto p-0">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-outline-variant text-label-sm uppercase tracking-wide text-on-surface-variant">
              <th className="px-lg py-md font-medium">Reference</th>
              <th className="px-lg py-md font-medium">Amount</th>
              <th className="px-lg py-md font-medium">Status</th>
              <th className="px-lg py-md font-medium">Opened</th>
              <th className="px-lg py-md font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <EmptyRow
                colSpan={5}
                message={isLoading ? "Loading…" : "No payments awaiting capture."}
              />
            ) : (
              payments.map((payment, index) => (
                <tr
                  key={payment.reference ?? index}
                  className="border-b border-outline-variant/50 text-body-md"
                >
                  <td className="px-lg py-md font-mono text-label-md">{payment.reference}</td>
                  <td className="px-lg py-md">₹{payment.amount}</td>
                  <td className="px-lg py-md">
                    <StatusPill label={payment.status ?? ""} tone="warning" />
                  </td>
                  <td className="px-lg py-md text-on-surface-variant">
                    {payment.created_at ? new Date(payment.created_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-lg py-md text-right">
                    <Button
                      disabled={capture.isPending || !payment.reference}
                      onClick={() =>
                        payment.reference &&
                        capture.mutate({ path: { reference: payment.reference } })
                      }
                    >
                      Mark captured
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
