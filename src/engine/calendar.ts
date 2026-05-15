// Pure functions for parsing iCal text into bookings. No fetch, no I/O,
// no Date.now() — callers pass `now` explicitly so tests are deterministic.

export type TurnaroundWindow = { start: string; end: string };

export type ParsedBooking = {
  id: string;
  checkIn: string; // ISO date-only, e.g. "2026-05-10"
  checkOut: string; // ISO date-only; iCal DTEND is non-inclusive (guest leaves on this day)
  nights: number;
  // Window between this booking's checkout time and the NEXT booking's check-in time.
  // null when there is no next booking inside the 4-week window.
  turnaroundWindow: TurnaroundWindow | null;
};

// Default turnover times applied to bare-date iCal events. Airbnb's host export emits
// DATE-only events, so we synthesize times for the turnaround window.
const DEFAULT_CHECKOUT_HOUR = 10;
const DEFAULT_CHECKIN_HOUR = 16;

const FOUR_WEEKS_MS = 28 * 24 * 60 * 60 * 1000;

// Parse an iCal feed into upcoming bookings within a 4-week window of `now`.
// Returns bookings sorted by check-in date, with the turnaround window to the
// next booking populated (or null for the last one in the window).
export function parseCalendar(icalText: string, now: Date): ParsedBooking[] {
  const raw = parseVEvents(icalText);
  const today = startOfLocalDay(now);
  const horizon = new Date(today.getTime() + FOUR_WEEKS_MS);

  const upcoming = raw
    .filter((e) => {
      const start = isoToLocalDate(e.checkIn);
      return start >= today && start <= horizon;
    })
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn));

  return upcoming.map((b, i, arr) => ({
    ...b,
    turnaroundWindow:
      i < arr.length - 1 ? computeTurnaround(b.checkOut, arr[i + 1].checkIn) : null,
  }));
}

// Unit-test-style cases (run mentally against parseCalendar):
// - Empty feed body → returns []
// - Feed with no VEVENT blocks → returns []
// - Single VEVENT inside window → returns one ParsedBooking, turnaroundWindow=null
// - Two back-to-back VEVENTs (checkout = next check-in date) → returns two,
//   first has turnaroundWindow with same date for start.date and end.date
// - VEVENT outside the 4-week window → filtered out
// - VEVENT with missing UID or DTSTART/DTEND → skipped
// - DTSTART after DTEND (zero-or-negative nights) → skipped

type RawEvent = { id: string; checkIn: string; checkOut: string; nights: number };

function parseVEvents(text: string): RawEvent[] {
  // iCal "line folding": continuation lines start with a single space or tab.
  // Unfold before parsing so property regexes match on a single line.
  const unfolded = text.replace(/\r?\n[ \t]/g, "");

  const events: RawEvent[] = [];
  const blocks = unfolded.split(/BEGIN:VEVENT/);
  // First block is the calendar header before any events — skip with i=1.
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const end = block.indexOf("END:VEVENT");
    if (end < 0) continue;
    const body = block.slice(0, end);

    const uid = getProp(body, "UID");
    const dtstart = getProp(body, "DTSTART");
    const dtend = getProp(body, "DTEND");
    if (!uid || !dtstart || !dtend) continue;

    const checkIn = parseICalDate(dtstart);
    const checkOut = parseICalDate(dtend);
    if (!checkIn || !checkOut) continue;

    const nights = daysBetween(checkIn, checkOut);
    if (nights <= 0) continue;

    events.push({ id: uid, checkIn, checkOut, nights });
  }
  return events;
}

// Read a property value from a VEVENT body. Handles parameters like
// "DTSTART;VALUE=DATE:20260510" — returns the part after the colon.
function getProp(body: string, name: string): string | null {
  const re = new RegExp(`^${name}(?:;[^:\\n\\r]*)?:(.*)$`, "m");
  const m = body.match(re);
  return m ? m[1].trim() : null;
}

// Parse an iCal date value: "20260510" or "20260510T140000Z" → "2026-05-10".
// iCal date-only values are timezone-agnostic; timestamp values get truncated to
// their date portion, which is the right behavior for stay-night counting.
function parseICalDate(value: string): string | null {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

// new Date("2026-05-10") parses as UTC midnight, then in local time west of UTC
// the displayed day shifts back one. Build the Date from parts to get local midnight.
function isoToLocalDate(iso: string): Date {
  const [y, mo, d] = iso.split("-").map(Number);
  return new Date(y, mo - 1, d);
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysBetween(startISO: string, endISO: string): number {
  const start = isoToLocalDate(startISO);
  const end = isoToLocalDate(endISO);
  return Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

function computeTurnaround(checkOutISO: string, nextCheckInISO: string): TurnaroundWindow {
  const checkOutHour = String(DEFAULT_CHECKOUT_HOUR).padStart(2, "0");
  const checkInHour = String(DEFAULT_CHECKIN_HOUR).padStart(2, "0");
  return {
    start: `${checkOutISO}T${checkOutHour}:00:00`,
    end: `${nextCheckInISO}T${checkInHour}:00:00`,
  };
}
