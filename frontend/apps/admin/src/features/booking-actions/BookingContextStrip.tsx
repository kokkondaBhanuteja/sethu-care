export interface BookingContextStripProps {
  /** One line: the service, the area and how long it has been unresolved. */
  text: string;
}

/**
 * The neutral strip under a mobile action screen's header. The operator arrived here from a queue,
 * possibly two taps ago; this keeps what they are solving on screen so they never go back to check.
 *
 * Deliberately not a `Banner`: a Banner always carries a severity tone, and this strip is context,
 * not a condition. If the design system grows a `neutral` Banner tone, this collapses into it.
 */
export function BookingContextStrip({ text }: BookingContextStripProps) {
  return (
    <div className="flex-none border-b border-border-subtle bg-canvas px-s4 py-s2">
      <span className="text-label text-text-2">{text}</span>
    </div>
  );
}
