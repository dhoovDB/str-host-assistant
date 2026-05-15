import { propertyConfig } from "../config/property";

// Fetches the iCal feed from the configured calendar URL. This is the only place
// the URL is read; parsing happens in src/engine/calendar.ts and is pure.
// Throws on non-2xx or on a response that doesn't look like an iCal feed —
// a 200 with an HTML body usually means the URL is rate-limited or invalidated.
export async function fetchCalendarFeed(): Promise<string> {
  const response = await fetch(propertyConfig.icalUrl);
  if (!response.ok) {
    throw new Error(`iCal fetch failed: ${response.status} ${response.statusText}`);
  }
  const text = await response.text();
  if (!text.startsWith("BEGIN:VCALENDAR")) {
    throw new Error(
      "iCal response does not start with BEGIN:VCALENDAR — calendar feed may be invalid or returning an error page",
    );
  }
  return text;
}
