"use client";

import { useQuery } from "@tanstack/react-query";
import { listTechniciansOptions } from "@sethu/api-client";

import { Card, EmptyRow, PageHeader, StatusPill } from "@/components/ui";

// Employees — every technician with their availability status and current job load, plus the
// ranking signals (rating, acceptance rate) the auto-assignment ladder uses.
export default function EmployeesPage() {
  const { data, isLoading } = useQuery(listTechniciansOptions());
  const technicians = data?.technicians ?? [];

  return (
    <div>
      <PageHeader title="Employees" subtitle="Technicians, status, and load" />

      <Card className="overflow-x-auto p-0">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-outline-variant text-label-sm uppercase tracking-wide text-on-surface-variant">
              <th className="px-lg py-md font-medium">Technician</th>
              <th className="px-lg py-md font-medium">City</th>
              <th className="px-lg py-md font-medium">Status</th>
              <th className="px-lg py-md font-medium">Rating</th>
              <th className="px-lg py-md font-medium">Acceptance</th>
              <th className="px-lg py-md font-medium">Load</th>
            </tr>
          </thead>
          <tbody>
            {technicians.length === 0 ? (
              <EmptyRow colSpan={6} message={isLoading ? "Loading…" : "No technicians yet."} />
            ) : (
              technicians.map((technician, index) => {
                const status: { label: string; tone: "success" | "warning" | "neutral" } =
                  technician.on_leave
                    ? { label: "On leave", tone: "warning" }
                    : technician.is_online
                      ? { label: "Online", tone: "success" }
                      : { label: "Offline", tone: "neutral" };
                return (
                  <tr
                    key={technician.technician_id ?? index}
                    className="border-b border-outline-variant/50 text-body-md"
                  >
                    <td className="px-lg py-md">{technician.name}</td>
                    <td className="px-lg py-md text-on-surface-variant">{technician.city}</td>
                    <td className="px-lg py-md">
                      <StatusPill label={status.label} tone={status.tone} />
                    </td>
                    <td className="px-lg py-md">{(technician.rating ?? 0).toFixed(1)}★</td>
                    <td className="px-lg py-md">
                      {Math.round((technician.acceptance_rate ?? 0) * 100)}%
                    </td>
                    <td className="px-lg py-md text-on-surface-variant">
                      {technician.active_jobs}/{technician.max_concurrent_jobs}
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
