"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { assignmentQueueOptions } from "@sethu/api-client";

import { Button, PageHeader, StatCard } from "@/components/ui";

// Overview — for now, the one live number the console can compute without a dedicated stats
// endpoint: how many bookings are waiting to be assigned. Revenue/CSAT tiles from the design
// reference need aggregate endpoints (a documented follow-up); this stays honest to real data.
export default function OverviewPage() {
  const { data } = useQuery(assignmentQueueOptions());
  const waiting = data?.queue?.length ?? 0;

  return (
    <div>
      <PageHeader title="Overview" subtitle="Operations at a glance" />
      <div className="grid grid-cols-1 gap-lg sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Awaiting assignment"
          value={String(waiting)}
          hint="Bookings needing a technician"
        />
      </div>
      <div className="mt-lg">
        <Link href="/assignments">
          <Button>Go to assignments</Button>
        </Link>
      </div>
    </div>
  );
}
