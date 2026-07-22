import { ProviderProfileDesktop } from "../features/providers/ProviderProfile.desktop";
import { ProviderProfileMobile } from "../features/providers/ProviderProfile.mobile";
import { useIsDesktop } from "../hooks/useBreakpoint";

/** Route target for `/providers/:providerId`. The feature reads the param and owns the record. */
export default function ProviderProfilePage() {
  return useIsDesktop() ? <ProviderProfileDesktop /> : <ProviderProfileMobile />;
}
