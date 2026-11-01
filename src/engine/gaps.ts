import type { Booking } from "../client/types";

// Pure: compute gaps between consecutive bookings.
//
// A gap exists when the next booking's check-in is strictly later than this
// booking's check-out (nights > 0). Back-to-back stays (checkOut === next
// checkIn) yield no gap.
//
// Scope per Task 4 spec: gaps BETWEEN consecutive bookings only — the function
// does not emit "before first booking" or "after last booking" gaps. The
// 4-week window filter happens upstream in buildSchedule; if you have an
// empty stretch at the start or end of the window, it won't appear here.
// Revisit if surfacing those becomes useful daily.

export type BookingGap = {
  /** ISO date — the previous booking's checkOut. */
  startDate: string;
  /** ISO date — the next booking's checkIn. */
  endDate: string;
  /** Count of unbookable nights between the two bookings. */
  nights: number;
  /** True when `nights < minStay` — the gap can't be filled at the current minimum stay. */
  flagged: boolean;
};

export function computeGaps(bookings: Booking[], minStay: number): BookingGap[] {
  if (bookings.length < 2) return [];
  // Defensive sort — the engine layer shouldn't rely on caller correctness
  // even though buildSchedule() does sort. Cheap for the small N here.
  const sorted = [...bookings].sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  const gaps: BookingGap[] = [];
  // Measure from the latest checkout so far, not the previous booking's: an ad
  // hoc stay can overlap a reservation, and one nested inside another must not
  // open a gap that the longer stay still covers.
  let startDate = sorted[0].checkOut;
  for (const { checkIn, checkOut } of sorted.slice(1)) {
    const nights = diffDays(startDate, checkIn);
    if (nights > 0) {
      gaps.push({ startDate, endDate: checkIn, nights, flagged: nights < minStay });
    }
    if (checkOut > startDate) startDate = checkOut;
  }
  return gaps;
}

function diffDays(a: string, b: string): number {
  const ms = Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z");
  return Math.round(ms / (24 * 60 * 60 * 1000));
}
