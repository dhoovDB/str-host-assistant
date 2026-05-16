import { getIcalUrl } from "../config/property";
import { parseCalendar } from "../engine/calendar";
import type { Booking } from "../client/types";

// fetchBookings is server-only by convention. It reads ICAL_URL via
// getIcalUrl(), which throws when env is missing. Never import this from
// client code paths — the env throw will break hydration (CLAUDE.md
// "Env reads must be lazy"; canonical incident: decision log 2026-05-16).
export async function fetchBookings(): Promise<Booking[]> {
  const url = getIcalUrl();
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `iCal fetch failed: ${response.status} ${response.statusText}`,
    );
  }
  const text = await response.text();
  return parseCalendar(text);
}
