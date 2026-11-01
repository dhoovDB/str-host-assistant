import type { AdhocStay, Booking, ChecklistKey } from "../client/types";

// iCal parsing — hand-rolled per decision log 2026-05-13. Airbnb's host export
// uses a small, predictable subset of RFC 5545: date-only DTSTART/DTEND,
// non-recurring events, SUMMARY is "Reserved" for bookings or contains
// "(Not available)" / "Blocked" for host-side blocks. A general iCal library
// would be ~50KB to handle cases we'll never see.

const HM_CODE = /HM[A-Z0-9]+/;
const FOUR_WEEKS_MS = 28 * 24 * 60 * 60 * 1000;
const FALLBACK_RESERVATION_URL = "https://www.airbnb.com/hosting/calendar";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const EMPTY_CHECKLIST: Record<ChecklistKey, boolean> = {
  notified: false,
  confirmed: false,
  reminder: false,
  ready: false,
  checkedIn: false,
  checkedOut: false,
  reviewed: false,
};

/**
 * Parse an Airbnb host iCal export into unwindowed, unannotated Booking objects.
 *
 * Pipeline:
 *   1. Unfold RFC 5545 continuation lines.
 *   2. Split into VEVENT blocks.
 *   3. Drop non-reservation entries (host blocks, "not available").
 *
 * Fields the iCal feed does not carry get safe defaults:
 *   guestName "Guest", guests 1, checklist all-false, notes "".
 * Supabase wiring in Task 9 fills in the real values for checklist/notes.
 * guestName/guests remain placeholders until/unless we add the Airbnb API.
 */
export function parseIcal(icalText: string): Booking[] {
  const unfolded = icalText.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
  const reservations: Booking[] = [];
  for (const block of extractVEvents(unfolded)) {
    const r = parseReservation(block);
    if (r) reservations.push(r);
  }
  return reservations;
}

/**
 * Turn stays from any source into the dashboard's schedule. Merge sources before
 * calling this so turnovers and same-day flags cover all of them.
 *
 * Pipeline:
 *   1. Filter to a 4-week window starting at `now`.
 *   2. Sort by checkIn ascending.
 *   3. Derive sameDayTurnaround / status / turnover from consecutive bookings.
 */
export function buildSchedule(stays: Booking[], now: Date = new Date()): Booking[] {
  const windowed = filterToWindow(stays, now);
  windowed.sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  return annotateTurnover(windowed, now);
}

/**
 * Map a stay from the adhoc_stays table to a Booking. The row's id is already
 * `adhoc-<uuid>`, so checklist_state and booking_notes key off it unchanged.
 */
export function adhocToBooking(stay: AdhocStay): Booking {
  return {
    id: stay.id,
    source: "adhoc",
    guestName: "Guest",
    guests: 1,
    reservationUrl: "",
    checkIn: stay.check_in,
    checkOut: stay.check_out,
    nights: diffDays(stay.check_in, stay.check_out),
    turnover: "",
    status: "Upcoming",
    checklist: { ...EMPTY_CHECKLIST },
    notes: "",
  };
}

/** Everything wrong with a stay about to be saved. Empty means it's valid. */
export function validateAdhocStay(stay: Omit<AdhocStay, "id">): string[] {
  const problems: string[] = [];
  const checkInValid = isRealDate(stay.check_in);
  const checkOutValid = isRealDate(stay.check_out);
  if (!checkInValid) problems.push(`Check-in "${stay.check_in}" is not a real YYYY-MM-DD date.`);
  if (!checkOutValid) problems.push(`Check-out "${stay.check_out}" is not a real YYYY-MM-DD date.`);
  if (checkInValid && checkOutValid && stay.check_out <= stay.check_in) {
    problems.push("Check-out must be after check-in.");
  }
  return problems;
}

/**
 * The stays sharing a night with the given dates. Check-out day isn't a night, so
 * back-to-back stays don't overlap.
 */
export function findOverlaps(
  dates: { checkIn: string; checkOut: string },
  stays: Booking[],
): Booking[] {
  return stays.filter((s) => s.checkIn < dates.checkOut && dates.checkIn < s.checkOut);
}

/** When a stay shows on the dashboard, given the 4-week window in filterToWindow. */
export function describeVisibility(stay: Omit<AdhocStay, "id">, now: Date = new Date()): string {
  const [visible] = filterToWindow([adhocToBooking({ id: "", ...stay })], now);
  if (visible) return "in the dashboard window now";
  if (stay.check_out < now.toISOString().slice(0, 10)) return "in the past, so it won't show";
  const checkInMs = Date.parse(stay.check_in + "T00:00:00Z");
  const from = new Date(checkInMs - FOUR_WEEKS_MS).toISOString().slice(0, 10);
  return `shows on the dashboard from ${from}`;
}

function isRealDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const ms = Date.parse(iso + "T00:00:00Z");
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === iso;
}

function extractVEvents(text: string): string[] {
  const out: string[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const begin = text.indexOf("BEGIN:VEVENT", cursor);
    if (begin === -1) break;
    const end = text.indexOf("END:VEVENT", begin);
    if (end === -1) break;
    out.push(text.slice(begin, end));
    cursor = end + "END:VEVENT".length;
  }
  return out;
}

function getField(block: string, name: string): string | null {
  // Match "NAME:" or "NAME;PARAM=VAL:" at start of line, capture the rest of the line.
  const re = new RegExp(`^${name}(?:;[^:\\n]*)?:(.*)$`, "m");
  const match = block.match(re);
  return match ? match[1].trim() : null;
}

function parseDate(yyyymmdd: string): string {
  const m = yyyymmdd.match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

function diffDays(checkInIso: string, checkOutIso: string): number {
  const a = Date.parse(checkInIso + "T00:00:00Z");
  const b = Date.parse(checkOutIso + "T00:00:00Z");
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

function parseReservation(block: string): Booking | null {
  const summary = getField(block, "SUMMARY") ?? "";
  if (/not available|blocked/i.test(summary)) return null;

  const uid = getField(block, "UID");
  if (!uid) return null;

  const dtstart = getField(block, "DTSTART");
  const dtend = getField(block, "DTEND");
  if (!dtstart || !dtend) return null;

  const checkIn = parseDate(dtstart);
  const checkOut = parseDate(dtend);
  if (!checkIn || !checkOut) return null;
  const nights = diffDays(checkIn, checkOut);
  if (nights <= 0) return null;

  // The HM confirmation code lives in either the UID (e.g.
  // airbnb-HM12345@airbnb.com) or the DESCRIPTION (which embeds the
  // reservation URL). Try UID first, then description; fall back to the
  // host calendar so the link still resolves somewhere useful.
  const description = getField(block, "DESCRIPTION") ?? "";
  const codeMatch = uid.match(HM_CODE) ?? description.match(HM_CODE);
  const reservationUrl = codeMatch
    ? `https://www.airbnb.com/hosting/reservations/details/${codeMatch[0]}`
    : FALLBACK_RESERVATION_URL;

  return {
    id: uid,
    source: "airbnb",
    guestName: "Guest",
    guests: 1,
    reservationUrl,
    checkIn,
    checkOut,
    nights,
    turnover: "",
    status: "Upcoming",
    checklist: { ...EMPTY_CHECKLIST },
    notes: "",
  };
}

function filterToWindow(bookings: Booking[], now: Date): Booking[] {
  const todayIso = now.toISOString().slice(0, 10);
  const horizonIso = new Date(now.getTime() + FOUR_WEEKS_MS).toISOString().slice(0, 10);
  return bookings.filter((b) => b.checkOut >= todayIso && b.checkIn <= horizonIso);
}

function annotateTurnover(sorted: Booking[], now: Date): Booking[] {
  const todayIso = now.toISOString().slice(0, 10);
  return sorted.map((b, i) => {
    const prev = sorted[i - 1];
    const next = sorted[i + 1];
    // sameDayTurnaround flag goes on the INCOMING card per user choice
    // 2026-05-16 — the card whose check-in matches the previous card's
    // check-out. The outgoing relation (next.checkIn === this.checkOut) is
    // still computed and surfaced via the turnover string on Active cards,
    // so the host gets a "tight cleaning window today" hint during the
    // current stay even though the 🚨 lands on the next card.
    const incomingSameDay = prev?.checkOut === b.checkIn;
    const outgoingSameDay = next?.checkIn === b.checkOut;
    const isActive = b.checkIn <= todayIso && todayIso <= b.checkOut;
    const status: Booking["status"] = isActive ? "Active" : "Upcoming";
    const turnover = isActive
      ? outgoingSameDay
        ? `10am–3pm ${formatShortDate(b.checkOut)} (next guest arrives same day)`
        : `Check-out 10am ${formatShortDate(b.checkOut)}`
      : incomingSameDay
        ? `10am–3pm ${formatShortDate(b.checkIn)} (same-day after previous)`
        : `Check-in 3pm ${formatShortDate(b.checkIn)}`;
    return { ...b, status, turnover, sameDayTurnaround: incomingSameDay };
  });
}

function formatShortDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${MONTHS[parseInt(m[2], 10) - 1]} ${parseInt(m[3], 10)}`;
}
