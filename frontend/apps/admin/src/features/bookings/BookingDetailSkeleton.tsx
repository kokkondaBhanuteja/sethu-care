import { useTranslation } from "@sethu/i18n";

import { Card } from "../../components/ui/Card";
import { Skeleton } from "../../components/ui/Skeleton";
import { Gutter, Stack } from "../../layouts/Layout";
import { PageMain } from "../../layouts/PageMain";

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
      <Gutter className="py-s4">
        <div role="status" aria-busy aria-label={t("loading.detail")}>
          <Stack>
            <Lines count={3} />
            <Lines count={4} />
            <Lines count={3} />
            <Lines count={6} />
          </Stack>
        </div>
      </Gutter>
    );
  }

  return (
    <PageMain>
      <div
        className="grid grid-cols-1 gap-s5 lg:grid-cols-3"
        role="status"
        aria-busy
        aria-label={t("loading.detail")}
      >
        <Stack>
          <Card>
            <Lines count={3} />
          </Card>
          <Card>
            <Lines count={5} />
          </Card>
        </Stack>
        <Card>
          <Lines count={8} />
        </Card>
        <Stack>
          <Card>
            <Lines count={3} />
          </Card>
          <Card>
            <Lines count={3} />
          </Card>
        </Stack>
      </div>
    </PageMain>
  );
}
