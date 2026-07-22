/**
 * Open product defects the suite currently fails on — never weakened to go green, per
 * `e2e/CLAUDE.md`. Each affected test carries one of these as its mark:
 *
 * - `test.fail(true, <defect>)` where the defect makes an assertion fail;
 * - `test.fixme(true, <defect>)` where the defect makes the test TIME OUT (an unreachable button
 *   is waited on forever, and Playwright reports a timed-out "should fail" test as a plain
 *   failure, so `test.fail` cannot express it).
 *
 * Delete the entry (and its marks) when the fix lands — a fixed `test.fail` flips to "expected to
 * fail but passed", and un-fixme'd tests simply run again.
 *
 * Both defects were introduced by the P3 migration onto @sethu/ui-web Radix overlays.
 */
export const KNOWN_DEFECTS = {
  /**
   * `components/ui/Modal.tsx` lost the pinned-footer / scrolling-body anatomy in the move to
   * ui-web's DialogContent, which centres the panel with no max-height and no scroll region. Any
   * tall flow (cancel booking, refund, suspend provider) overflows the 1440x900 viewport in BOTH
   * directions, so the footer commit button ("Continue…") sits below the viewport and can never be
   * reached — by a pointer or by scrolling, because nothing scrolls. CancelBooking.desktop.tsx
   * still documents the intended behaviour: "Header and footer are pinned; only the body scrolls,
   * because a destructive commit button that can scroll out of reach is how people cancel the
   * wrong booking."
   */
  modalFooterUnreachable:
    "Modal lost its pinned footer + scrolling body in the ui-web migration: tall flows overflow " +
    "the viewport with no scroll region, so the commit button is unreachable. See " +
    "e2e/support/knownDefects.ts.",

  /**
   * The console opens every Radix Dialog/Sheet as a controlled root with no DialogTrigger, and the
   * deleted `useFocusTrap` was what returned focus to the opener. Radix only restores focus to its
   * own Trigger element, so on close (Escape) focus now falls to <body> instead of the control
   * that opened the overlay — a WCAG 2.4.3 regression for keyboard operators. The Modal/Drawer
   * adapters need `onCloseAutoFocus` wiring back to the invoker.
   */
  overlayFocusNotReturned:
    "Focus is not returned to the control that opened the overlay: controlled Radix dialogs have " +
    "no Trigger and no onCloseAutoFocus wiring, so Escape drops focus on <body>. See " +
    "e2e/support/knownDefects.ts.",
} as const;
