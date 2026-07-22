import { useIsDesktop } from "../hooks/useBreakpoint";
import { NeedsAttentionFeedDesktop } from "../features/dashboard/NeedsAttentionFeed.desktop";
import { NeedsAttentionFeedMobile } from "../features/dashboard/NeedsAttentionFeed.mobile";

/**
 * `/live/attention` — the complete, prioritised queue behind the dashboard's top-of-queue preview
 * (spec §6.6). Both variants read the same `useNeedsAttention()` hook.
 */
export default function NeedsAttentionPage() {
  return useIsDesktop() ? <NeedsAttentionFeedDesktop /> : <NeedsAttentionFeedMobile />;
}
