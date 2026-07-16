"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  assignmentQueueOptions,
  assignmentQueueQueryKey,
  bookingCandidatesOptions,
  assignBookingMutation,
} from "@sethu/api-client";

import { Button, Card, EmptyRow, PageHeader, StatusPill } from "@/components/ui";

// The assignment queue: unassigned bookings on the left, and — when one is picked — its ranked
// candidate technicians in a panel, each assignable in one click. On assign the booking leaves the
// queue (invalidated), matching the backend advancing it out of SEARCHING.
export default function AssignmentsPage() {
  const { data, isLoading } = useQuery(assignmentQueueOptions());
  const queue = data?.queue ?? [];
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div>
      <PageHeader title="Assignments" subtitle="Bookings waiting for a technician" />

      <Card className="overflow-x-auto p-0">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-outline-variant text-label-sm uppercase tracking-wide text-on-surface-variant">
              <th className="px-lg py-md font-medium">Service</th>
              <th className="px-lg py-md font-medium">Customer</th>
              <th className="px-lg py-md font-medium">City</th>
              <th className="px-lg py-md font-medium">Total</th>
              <th className="px-lg py-md font-medium">Status</th>
              <th className="px-lg py-md font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {queue.length === 0 ? (
              <EmptyRow
                colSpan={6}
                message={isLoading ? "Loading…" : "Nothing waiting — every booking is assigned."}
              />
            ) : (
              queue.map((entry, index) => (
                <tr
                  key={entry.booking_id ?? index}
                  className="border-b border-outline-variant/50 text-body-md"
                >
                  <td className="px-lg py-md">{entry.service_name}</td>
                  <td className="px-lg py-md">{entry.customer_name || "—"}</td>
                  <td className="px-lg py-md text-on-surface-variant">{entry.city}</td>
                  <td className="px-lg py-md">₹{entry.quoted_total}</td>
                  <td className="px-lg py-md">
                    <StatusPill label={entry.state ?? ""} tone="warning" />
                  </td>
                  <td className="px-lg py-md text-right">
                    <Button
                      variant="secondary"
                      onClick={() => setSelected(entry.booking_id ?? null)}
                    >
                      Find technician
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {selected ? <CandidatesModal bookingId={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function CandidatesModal({ bookingId, onClose }: { bookingId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(bookingCandidatesOptions({ path: { id: bookingId } }));
  const candidates = data?.candidates ?? [];

  const assign = useMutation({
    ...assignBookingMutation(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: assignmentQueueQueryKey() });
      onClose();
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/30 p-md"
      onClick={onClose}
    >
      <div className="w-full max-w-2xl" onClick={(event) => event.stopPropagation()}>
        <Card className="max-h-[80vh] overflow-y-auto">
          <div className="mb-md flex items-center justify-between">
            <h2 className="font-heading text-headline-sm text-on-surface">Eligible technicians</h2>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>

          {candidates.length === 0 ? (
            <p className="py-lg text-center text-body-md text-on-surface-variant">
              {isLoading
                ? "Loading…"
                : "No eligible technician right now (city, skill, shift, or capacity)."}
            </p>
          ) : (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-outline-variant text-label-sm uppercase tracking-wide text-on-surface-variant">
                  <th className="py-sm font-medium">Technician</th>
                  <th className="py-sm font-medium">Rating</th>
                  <th className="py-sm font-medium">Accept.</th>
                  <th className="py-sm font-medium">Load</th>
                  <th className="py-sm font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((candidate, index) => (
                  <tr
                    key={candidate.technician_id ?? index}
                    className="border-b border-outline-variant/50 text-body-md"
                  >
                    <td className="py-md">{candidate.name}</td>
                    <td className="py-md">{candidate.rating?.toFixed(1) ?? "—"}★</td>
                    <td className="py-md">{Math.round((candidate.acceptance_rate ?? 0) * 100)}%</td>
                    <td className="py-md text-on-surface-variant">
                      {candidate.active_jobs}/{candidate.max_concurrent_jobs}
                    </td>
                    <td className="py-md text-right">
                      <Button
                        disabled={assign.isPending || !candidate.technician_id}
                        onClick={() =>
                          candidate.technician_id &&
                          assign.mutate({
                            path: { id: bookingId },
                            body: { technician_id: candidate.technician_id },
                          })
                        }
                      >
                        Assign
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
