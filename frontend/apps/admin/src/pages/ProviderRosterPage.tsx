import { ProviderRosterDesktop } from "../features/providers/ProviderRoster.desktop";
import { ProviderRosterMobile } from "../features/providers/ProviderRoster.mobile";
import { useIsDesktop } from "../hooks/useBreakpoint";

/** Route target for `/providers`. Picks the shell variant; the feature owns everything else. */
export default function ProviderRosterPage() {
  return useIsDesktop() ? <ProviderRosterDesktop /> : <ProviderRosterMobile />;
}
