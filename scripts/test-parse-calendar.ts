// One-off verification for Task 3. Fetches the configured iCal feed via the
// real gcal.ts module and parses it via calendar.ts, then prints the parsed
// bookings as JSON. Delete this file after Task 3 is verified.
//
// Run from the project root:
//   npx tsx scripts/test-parse-calendar.ts

import { fetchCalendarFeed } from "../src/api/gcal";
import { parseCalendar } from "../src/engine/calendar";

async function main() {
  console.log("Fetching iCal feed via fetchCalendarFeed()...");
  const text = await fetchCalendarFeed();
  console.log(`Got ${text.length} bytes\n`);

  const bookings = parseCalendar(text, new Date());
  console.log(`Parsed ${bookings.length} upcoming bookings in 4-week window:\n`);
  console.log(JSON.stringify(bookings, null, 2));
}

main().catch((err) => {
  console.error("Error:", err.message ?? err);
  process.exit(1);
});
