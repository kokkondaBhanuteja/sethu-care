import { useSyncExternalStore } from "react";

// Tailwind's xl breakpoint — a physical viewport width, so px is correct here (standards §6.3).
// Must stay in step with the `xl:` classes on BookingsListDesktop's master–detail grid.
const SIDE_PREVIEW_MIN_WIDTH_PX = 1280;
const SIDE_PREVIEW_QUERY = `(min-width: ${SIDE_PREVIEW_MIN_WIDTH_PX}px)`;

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(SIDE_PREVIEW_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(SIDE_PREVIEW_QUERY).matches;
}

function getServerSnapshot(): boolean {
  return true;
}

/**
 * Whether the bookings list has room for the permanent preview column. The audit measured the
 * two-thirds table clipped at every desktop width below 1280 — below that, the preview collapses
 * into BookingPreviewDrawer and the queue takes the full canvas.
 */
export function useHasSidePreview(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
