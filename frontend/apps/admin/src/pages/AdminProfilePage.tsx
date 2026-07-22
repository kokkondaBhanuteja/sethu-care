import { AdminProfileDesktop } from "../features/settings/AdminProfile.desktop";
import { AdminProfileMobile } from "../features/settings/AdminProfile.mobile";
import { useIsDesktop } from "../hooks/useBreakpoint";

/** BOX 64 on desktop, BOX 103 on mobile. */
export default function AdminProfilePage() {
  return useIsDesktop() ? <AdminProfileDesktop /> : <AdminProfileMobile />;
}
