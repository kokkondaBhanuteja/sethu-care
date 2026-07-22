import { useTranslation } from "@sethu/i18n";

import { Card } from "../../components/ui/Card";
import { Skeleton } from "../../components/ui/Skeleton";

export interface BookingDetailSkeletonProps {
  /** Desktop draws the three record columns; mobile draws the stack. */
  isDesktop: boolean;
}

function Lines({ count }: { count: number }) {
  return (
    <div className="flex flex-col gap-s2">
      {Array.from({ length: count }, (_line, index) => (
        <Skeleton key={index} shape="text" className={index === 0 ? "w-2/3" : "w-full"} />
      ))}
    </div>
  );
}

/** Preserves the section structure so nothing reflows when the record lands (spec §4.10). */
export function BookingDetailSkeleton({ isDesktop }: BookingDetailSkeletonProps) {
  const { t } = useTranslation("adminBookings");

  if (!isDesktop) {
    return (
      <div
        className="flex flex-col gap-s5 px-s4 py-s4"
        role="status"
        aria-busy
        aria-label={t("loading.detail")}
      >
        <Lines count={3} />
        <Lines count={4} />
        <Lines count={3} />
        <Lines count={6} />
      </div>
    );
  }

  return (
    <main
      className="flex-1 overflow-y-auto bg-canvas p-s6"
      role="status"
      aria-busy
      aria-label={t("loading.detail")}
    >
      <div className="grid grid-cols-1 gap-s5 lg:grid-cols-3">
        <div className="flex flex-col gap-s5">
          <Card>
            <Lines count={3} />
          </Card>
          <Card>
            <Lines count={5} />
          </Card>
        </div>
        <Card>
          <Lines count={8} />
        </Card>
        <div className="flex flex-col gap-s5">
          <Card>
            <Lines count={3} />
          </Card>
          <Card>
            <Lines count={3} />
          </Card>
        </div>
      </div>
    </main>
  );
}
