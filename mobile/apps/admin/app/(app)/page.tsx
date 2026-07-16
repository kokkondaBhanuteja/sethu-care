"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  assignmentQueueOptions,
  pendingPaymentsOptions,
  cashReconciliationOptions,
} from "@sethu/api-client";

import { Button, PageHeader, StatCard } from "@/components/ui";

// Overview — live operational numbers the console can compute from existing endpoints: bookings
// awaiting a technician, UPI collections awaiting capture, and cash technicians are still holding.
export default function OverviewPage() {
  const queue = useQuery(assignmentQueueOptions());
  const payments = useQuery(pendingPaymentsOptions());
  const cash = useQuery(cashReconciliationOptions());

  const waiting = queue.data?.queue?.length ?? 0;
  const pending = payments.data?.payments?.length ?? 0;
  const outstanding = (cash.data?.reconciliation ?? []).reduce(
    (sum, row) => sum + Number(row.outstanding ?? 0),
    0,
  );

  return (
    <div>
      <PageHeader title="Overview" subtitle="Operations at a glance" />
      <div className="grid grid-cols-1 gap-lg sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Awaiting assignment"
          value={String(waiting)}
          hint="Bookings needing a technician"
        />
        <StatCard
          label="Payments to capture"
          value={String(pending)}
          hint="UPI collections pending"
        />
        <StatCard
          label="Cash outstanding"
          value={`₹${outstanding.toFixed(0)}`}
          hint="Collected, not yet deposited"
        />
      </div>
      <div className="mt-lg flex gap-md">
        <Link href="/assignments">
          <Button>Assignments</Button>
        </Link>
        <Link href="/payments">
          <Button variant="secondary">Payments</Button>
        </Link>
      </div>
    </div>
  );
}
