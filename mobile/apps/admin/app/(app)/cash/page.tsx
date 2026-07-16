"use client";

import { useQuery } from "@tanstack/react-query";
import { cashReconciliationOptions } from "@sethu/api-client";

import { Card, EmptyRow, PageHeader, StatusPill } from "@/components/ui";

// Cash reconciliation: every technician who has collected cash, and how much of it is still
// outstanding (collected − deposited). Outstanding rows are flagged so ops can chase a deposit.
export default function CashPage() {
  const { data, isLoading } = useQuery(cashReconciliationOptions());
  const rows = data?.reconciliation ?? [];

  return (
    <div>
      <PageHeader
        title="Cash reconciliation"
        subtitle="Cash collected vs deposited, by technician"
      />

      <Card className="overflow-x-auto p-0">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-outline-variant text-label-sm uppercase tracking-wide text-on-surface-variant">
              <th className="px-lg py-md font-medium">Technician</th>
              <th className="px-lg py-md font-medium">Collected</th>
              <th className="px-lg py-md font-medium">Deposited</th>
              <th className="px-lg py-md font-medium">Outstanding</th>
              <th className="px-lg py-md font-medium">Oldest uncleared</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <EmptyRow
                colSpan={5}
                message={isLoading ? "Loading…" : "All clear — no outstanding cash."}
              />
            ) : (
              rows.map((row, index) => {
                const owes = Number(row.outstanding) > 0;
                return (
                  <tr
                    key={row.technician_id ?? index}
                    className="border-b border-outline-variant/50 text-body-md"
                  >
                    <td className="px-lg py-md">{row.name}</td>
                    <td className="px-lg py-md">₹{row.collected}</td>
                    <td className="px-lg py-md">₹{row.deposited}</td>
                    <td className="px-lg py-md">
                      {owes ? (
                        <StatusPill label={`₹${row.outstanding}`} tone="danger" />
                      ) : (
                        <StatusPill label="Settled" tone="success" />
                      )}
                    </td>
                    <td className="px-lg py-md text-on-surface-variant">
                      {row.oldest_collection_at
                        ? new Date(row.oldest_collection_at).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
