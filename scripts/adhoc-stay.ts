// Manage off-platform stays in the adhoc_stays table. This is the only way to
// enter one: the dashboard has no form (ROADMAP decision log 2026-11-01). The
// /adhocstay slash command is the runbook that drives it. Run from the repo root:
//
//   node --env-file=.env scripts/adhoc-stay.ts add --check-in 2026-11-03 --check-out 2026-11-10
//   node --env-file=.env scripts/adhoc-stay.ts list
//   node --env-file=.env scripts/adhoc-stay.ts update <id> [--check-in ...] [--check-out ...]
//   node --env-file=.env scripts/adhoc-stay.ts delete <id>
//
// Output stays ASCII: the Windows console mangles anything else.

import { parseArgs } from "node:util";
import { fetchBookings } from "../src/api/gcal.ts";
import {
  createAdhocStay,
  deleteAdhocStay,
  getAdhocStays,
  updateAdhocStay,
} from "../src/db/supabase.ts";
import {
  adhocToBooking,
  describeVisibility,
  findOverlaps,
  validateAdhocStay,
} from "../src/engine/calendar.ts";
import type { AdhocStay } from "../src/client/types";

const USAGE = `Usage:
  add --check-in YYYY-MM-DD --check-out YYYY-MM-DD
  list
  update <id> [--check-in YYYY-MM-DD] [--check-out YYYY-MM-DD]
  delete <id>`;

function nightsBetween(stay: Omit<AdhocStay, "id">): number {
  return adhocToBooking({ id: "", ...stay }).nights;
}

function describe(stay: AdhocStay): string {
  const nights = nightsBetween(stay);
  return [
    `${stay.check_in} to ${stay.check_out} (${nights} ${nights === 1 ? "night" : "nights"})`,
    `  id: ${stay.id}`,
    `  ${describeVisibility(stay)}`,
  ].join("\n");
}

function getPropertyId(): string {
  const propertyId = process.env.PROPERTY_ID;
  if (!propertyId) throw new Error("PROPERTY_ID is missing. Run with --env-file=.env.");
  return propertyId;
}

function assertValid(stay: Omit<AdhocStay, "id">): void {
  const problems = validateAdhocStay(stay);
  if (problems.length > 0) throw new Error(problems.join("\n"));
}

// Warns and never blocks, per ROADMAP: an overlap is the host's call. A feed
// outage shouldn't stop an entry either, so it's reported as an unchecked warning.
async function warnOnOverlaps(
  stay: Omit<AdhocStay, "id">,
  otherAdhocStays: AdhocStay[],
): Promise<void> {
  const dates = { checkIn: stay.check_in, checkOut: stay.check_out };
  const others = otherAdhocStays.map(adhocToBooking);
  const url = process.env.ICAL_URL;
  try {
    if (!url) throw new Error("ICAL_URL is missing");
    others.push(...(await fetchBookings(url)));
  } catch (err) {
    console.log(`WARNING: could not check against Airbnb reservations (${String(err)}).`);
  }
  for (const other of findOverlaps(dates, others)) {
    const source = other.source === "adhoc" ? "ad hoc stay" : "Airbnb reservation";
    console.log(`WARNING: overlaps ${source}, ${other.checkIn} to ${other.checkOut}.`);
  }
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      "check-in": { type: "string" },
      "check-out": { type: "string" },
    },
  });
  const [command, id] = positionals;
  const propertyId = getPropertyId();

  switch (command) {
    case "add": {
      const stay = {
        check_in: values["check-in"] ?? "",
        check_out: values["check-out"] ?? "",
      };
      assertValid(stay);
      await warnOnOverlaps(stay, await getAdhocStays(propertyId));
      console.log(`Added ${describe(await createAdhocStay(propertyId, stay))}`);
      return;
    }
    case "list": {
      const stays = await getAdhocStays(propertyId);
      if (stays.length === 0) console.log("No ad hoc stays.");
      for (const stay of stays) console.log(describe(stay));
      return;
    }
    case "update": {
      if (!id) throw new Error(USAGE);
      const stays = await getAdhocStays(propertyId);
      const current = stays.find((s) => s.id === id);
      if (!current) throw new Error(`No ad hoc stay with id ${id}.`);
      const stay = {
        check_in: values["check-in"] ?? current.check_in,
        check_out: values["check-out"] ?? current.check_out,
      };
      assertValid(stay);
      await warnOnOverlaps(
        stay,
        stays.filter((s) => s.id !== id),
      );
      const updated = await updateAdhocStay(propertyId, id, stay);
      if (!updated) throw new Error(`No ad hoc stay with id ${id}.`);
      console.log(`Updated ${describe(updated)}`);
      return;
    }
    case "delete": {
      if (!id) throw new Error(USAGE);
      if (!(await deleteAdhocStay(propertyId, id))) {
        throw new Error(`No ad hoc stay with id ${id}.`);
      }
      console.log(`Deleted ${id}, with its checklist and notes. Past briefings keep their text.`);
      return;
    }
    default:
      throw new Error(USAGE);
  }
}

main().catch((err: unknown) => {
  // Supabase errors are plain objects with a message, not Error instances.
  const message = (err as { message?: string }).message ?? String(err);
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
});
