import type { ReactNode } from "react";

import { useIsDesktop } from "../hooks/useBreakpoint";

/** The three pre-auth frames the design draws (desktop BOX 51/52/58, mobile BOX 79/83/92). */
export const AUTH_FRAMES = {
  /** Desktop: 55% flat brand panel beside a 360px column. Mobile: the same content, stacked. */
  split: "split",
  /** Dead-centre column with a build stamp at the foot — splash and forced update. */
  centred: "centred",
  /** Scrim + centred card over the screen the admin walked away from — biometric unlock. */
  lock: "lock",
} as const;

export type AuthFrame = (typeof AUTH_FRAMES)[keyof typeof AUTH_FRAMES];

export interface AuthLayoutProps {
  frame?: AuthFrame;
  /** Desktop brand-panel copy. Passed in so the strings stay in the feature's i18n namespace. */
  panel?: { wordmark: string; headline: string; tagline: string };
  /** Brand mark + wordmark block. Omitted on pushed screens, which show `header` instead. */
  brand?: { wordmark: string; subtitle?: string };
  /** Mobile pushed-screen header (back chevron + title). Sits outside the scroll region. */
  header?: ReactNode;
  /** Pinned above the scroll region: a condition that disables the form must not scroll away. */
  banner?: ReactNode;
  /** Pinned to the foot of the frame — the provisioning note, the build stamp. */
  footer?: ReactNode;
  /** `lock` only: the escape hatch drawn on the scrim below the card. */
  below?: ReactNode;
  children: ReactNode;
}

/**
 * The pre-auth shell. No sidebar and no tab bar in any frame: the navigation chrome does not exist
 * until there is a session to hang it on. Splash, login and two-factor share the identical 55% flat
 * brand panel on desktop, so password → code reads as one door rather than two (design BOX 52/55).
 */
export function AuthLayout({
  frame = AUTH_FRAMES.split,
  panel,
  brand,
  header,
  banner,
  footer,
  below,
  children,
}: AuthLayoutProps) {
  const isDesktop = useIsDesktop();

  if (frame === AUTH_FRAMES.lock) {
    return (
      <div className="screen">
        {/* The blurred dashboard the design draws behind the lock has to come from the shell
            rendering this over the live route, not from a pre-auth route reaching into another
            feature. The scrim alone still keeps every name, number and amount illegible. */}
        <div className="scrim" />
        <div className="overlay overlay--center flex-col gap-s5">
          <div className="modal-card">{children}</div>
          {below}
        </div>
      </div>
    );
  }

  if (frame === AUTH_FRAMES.centred) {
    return (
      <div className={isDesktop ? "app flex-col" : "screen"}>
        <div className="grow gut flex flex-col items-center justify-center">
          {brand ? <AuthBrand {...brand} /> : null}
          {children}
        </div>
        {footer ? <div className="flex-none pb-s6 text-center">{footer}</div> : null}
      </div>
    );
  }

  if (isDesktop) {
    return (
      <div className="app">
        {panel ? <AuthPanel {...panel} /> : null}
        <div className="auth-split__side">
          <div className="auth-split__col">
            <div className="w-full">
              {banner}
              {children}
              {footer}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      {banner}
      {header}
      <div className="screen__scroll gut flex flex-col">
        {brand ? (
          // 96px of air above the mark, tightened to 80px when a pinned banner already took some.
          // Children stay direct flex items so a bottom-anchored row can still use `mt-auto`.
          <div className={banner ? "pt-20 pb-s8" : "pt-24 pb-s8"}>
            <AuthBrand {...brand} />
          </div>
        ) : null}
        {children}
      </div>
      {footer ? <div className="gut flex-none pb-s6">{footer}</div> : null}
    </div>
  );
}

/**
 * The 55% panel is FLAT brand blue — no photograph, illustration, gradient or pattern. This is the
 * front door of a tool opened 200 times a week, and only a flat field survives that repetition.
 */
function AuthPanel({ wordmark, headline, tagline }: NonNullable<AuthLayoutProps["panel"]>) {
  return (
    <div className="auth-split__panel">
      <div className="t-kpi c-onbrand">{wordmark}</div>
      <div>
        <div className="t-section c-onbrand w-medium">{headline}</div>
        <div className="t-body auth-split__tagline mt-s1">{tagline}</div>
      </div>
    </div>
  );
}

function AuthBrand({ wordmark, subtitle }: NonNullable<AuthLayoutProps["brand"]>) {
  return (
    <>
      <span className="brandmark">
        {/*
          Placeholder mark: a bridge arch over its deck line — "setu" is Sanskrit for bridge. Drawn
          geometrically rather than illustrated so it survives at 32px. The real logo replaces the
          glyph inside the square, never the geometry around it.
        */}
        <svg className="icon icon--20" viewBox="0 0 24 24" aria-hidden strokeWidth={2}>
          <path d="M3 15a9 9 0 0 1 18 0" />
          <path d="M2 19h20" />
        </svg>
      </span>
      <h1 className="t-title c-1 mt-s3 mb-0">{wordmark}</h1>
      {subtitle ? <div className="t-label c-2 mt-s1 tracking-wider">{subtitle}</div> : null}
    </>
  );
}
