import type { ReactNode } from "react";

import { useIsDesktop } from "../hooks/useBreakpoint";
import { MobileAppBar } from "./MobileAppBar";
import { MobileScroll, PageMain } from "./PageMain";
import { Topbar } from "./Topbar";

export interface PageFrameProps {
  /** The page name — the Topbar h1 on desktop, the app-bar title on mobile. */
  title: string;
  /** Mobile shows the standard back chevron; a tab root would pass false. */
  showBack?: boolean;
  children: ReactNode;
}

/**
 * The standard page frame for screens with no bespoke chrome — today the v1.1 placeholders.
 * A bare state component rendered straight into a shell has no Topbar identity on desktop and no
 * app bar (or way back) on mobile (audit W2-3); this frame gives such a page the exact anatomy
 * every real screen composes by hand: Topbar + PageMain, or MobileAppBar + a tab-bar-aware scroll.
 */
export function PageFrame({ title, showBack = true, children }: PageFrameProps) {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return (
      <>
        <Topbar title={title} />
        <PageMain>{children}</PageMain>
      </>
    );
  }

  return (
    <>
      <MobileAppBar title={title} showBack={showBack} />
      <MobileScroll padFor="tabbar">{children}</MobileScroll>
    </>
  );
}
