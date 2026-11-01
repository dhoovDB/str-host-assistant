import { parseIcal } from "../engine/calendar.ts";
import type { Booking } from "../client/types";

// fetchBookings is server-only by convention. The caller supplies the iCal URL,
// a credential, so this module stays free of the JSON-backed property config:
// scripts/adhoc-stay.ts imports it under plain Node, which needs the explicit
// .ts extension above and can't load that config without an import attribute.
export async function fetchBookings(url: string): Promise<Booking[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `iCal fetch failed: ${response.status} ${response.statusText}`,
    );
  }
  const text = await response.text();
  return parseIcal(text);
}
