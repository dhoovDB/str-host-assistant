import type { Booking } from "../client/types";

// Pure: compute gaps between consecutive bookings.
//
// A gap exists when the next booking's check-in is strictly later than this
// booking's check-out (nights > 0). Back-to-back stays (checkOut === next
// checkIn) yield no gap.
//
// Scope per Task 4 spec: gaps BETWEEN consecutive bookings only — the function
// does not emit "before first booking" or "after last booking" gaps. The
// 4-week window filter happens upstream in parseCalendar; if you have an
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
  // even though parseCalendar() does sort. Cheap for the small N here.
  const sorted = [...bookings].sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  const gaps: BookingGap[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const startDate = sorted[i].checkOut;
    const endDate = sorted[i + 1].checkIn;
    const nights = diffDays(startDate, endDate);
    if (nights <= 0) continue;
    gaps.push({ startDate, endDate, nights, flagged: nights < minStay });
  }
  return gaps;
}

function diffDays(a: string, b: string): number {
  const ms = Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z");
  return Math.round(ms / (24 * 60 * 60 * 1000));
}
