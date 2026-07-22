import { HelpSupportDesktop } from "../features/settings/HelpSupport.desktop";
import { HelpSupportMobile } from "../features/settings/HelpSupport.mobile";
import { useIsDesktop } from "../hooks/useBreakpoint";

/** BOX 65 on desktop, BOX 104 on mobile. */
export default function HelpSupportPage() {
  return useIsDesktop() ? <HelpSupportDesktop /> : <HelpSupportMobile />;
}
