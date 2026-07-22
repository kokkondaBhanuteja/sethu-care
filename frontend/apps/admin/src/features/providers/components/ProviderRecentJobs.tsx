import { Ban, CheckCircle2, ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { useTranslation } from "@sethu/i18n";

import { DataTable, type DataTableColumn } from "../../../components/ui/DataTable";
import { Icon } from "../../../components/ui/Icon";
import { Panel } from "../../../components/ui/Panel";
import { Pill } from "../../../components/ui/Pill";
import { formatDate, formatMoney } from "../../../lib/format";
import { ROUTES } from "../../../routes/routes.constants";
import type { ProviderJob } from "../providers.types";
import { RatingValue } from "./Rating";
import { SectionLabel } from "./SectionLabel";

export interface ProviderRecentJobsProps {
  jobs: readonly ProviderJob[];
}

/** Desktop: the last ten bookings as a table an ops manager scans down the Rating column. */
export function ProviderRecentJobsTable({ jobs }: ProviderRecentJobsProps) {
  const { t } = useTranslation("adminProviders");

  const columns: readonly DataTableColumn<ProviderJob>[] = [
    { id: "booking", header: t("profile.jobBooking"), render: (job) => job.bookingId },
    { id: "service", header: t("profile.jobService"), render: (job) => job.service },
    {
      id: "date",
      header: t("profile.jobDate"),
      render: (job) => <span className="whitespace-nowrap text-text-2">{formatDate(job.at)}</span>,
    },
    { id: "state", header: t("profile.jobState"), render: (job) => <JobStatePill job={job} /> },
    {
      id: "rating",
      header: t("profile.jobRating"),
      render: (job) =>
        job.rating === null ? (
          <span className="text-text-3">—</span>
        ) : (
          <RatingValue value={job.rating} tight />
        ),
    },
    {
      id: "amount",
      header: t("profile.jobAmount"),
      numeric: true,
      render: (job) => formatMoney(job.amountPaise),
    },
  ];

  return (
    <Panel title={t("profile.recentJobs")}>
      <DataTable
        caption={t("profile.recentJobsCaption")}
        columns={columns}
        rows={jobs}
        rowKey={(job) => job.bookingId}
        density="dense"
      />
    </Panel>
  );
}

/** Mobile: the same bookings as tappable rows. */
export function ProviderRecentJobsList({ jobs }: ProviderRecentJobsProps) {
  const { t } = useTranslation("adminProviders");

  return (
    <div className="py-s4">
      <SectionLabel className="mb-s2 px-s4">{t("profile.recentJobs")}</SectionLabel>
      {jobs.map((job) => (
        <Link
          key={job.bookingId}
          to={ROUTES.bookingDetail(job.bookingId.replace("#", ""))}
          className="flex h-row-48 items-center gap-s2 border-b border-border-subtle px-s4"
        >
          <span className="grow truncate text-label text-text-1">
            <span className="font-mono">{job.bookingId}</span> · {job.service}
          </span>
          <JobStatePill job={job} />
          {job.rating === null ? (
            <span className="flex-none text-caption text-text-3">—</span>
          ) : (
            <RatingValue value={job.rating} tight className="flex-none text-caption" />
          )}
          <Icon glyph={ChevronRight} className="flex-none text-text-3" />
        </Link>
      ))}
    </div>
  );
}

function JobStatePill({ job }: { job: ProviderJob }) {
  const { t } = useTranslation("adminProviders");

  return job.isCancelled ? (
    <Pill tone="neutral" icon={Ban}>
      {t("profile.jobCancelled")}
    </Pill>
  ) : (
    <Pill tone="success" icon={CheckCircle2}>
      {t("profile.jobCompleted")}
    </Pill>
  );
}
