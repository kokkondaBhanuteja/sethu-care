import { Navigate, Outlet, useLocation } from "react-router";
import { useSession } from "@sethu/core";

import { Spinner } from "../components/ui/Spinner";
import { ROUTES } from "./routes.constants";

/**
 * Gate for every authenticated destination.
 *
 * The unauthenticated redirect carries the attempted location in router state so login can resume
 * it: dumping an operator on the dashboard after sign-in discards the exact reason they opened the
 * app, which is usually a push notification about a booking that is on fire (spec §3.4 rule 1).
 */
export function RequireAuth() {
  const status = useSession((state) => state.status);
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-8">
        <Spinner />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <Navigate to={ROUTES.login} replace state={{ from: location }} />;
  }

  return <Outlet />;
}
