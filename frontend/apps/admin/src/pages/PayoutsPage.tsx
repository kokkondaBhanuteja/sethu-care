import { PayoutsScreen } from "../features/settings/PayoutsScreen";

/**
 * BOX 66. Desktop-only by product rule (spec §1.5) — `SurfaceGuard` renders the "Best on desktop"
 * notice in this route's place on a phone, so this component only ever runs on a wide screen.
 */
export default function PayoutsPage() {
  return <PayoutsScreen />;
}
