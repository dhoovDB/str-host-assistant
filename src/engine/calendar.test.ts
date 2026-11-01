import { describe, it, expect } from "vitest";
import {
  adhocToBooking,
  buildSchedule,
  describeVisibility,
  findOverlaps,
  parseIcal,
  validateAdhocStay,
} from "./calendar";
import type { Booking } from "../client/types";

const NOW = new Date("2026-06-01T12:00:00Z");

function schedule(ics: string, now: Date): Booking[] {
  return buildSchedule(parseIcal(ics), now);
}

function adhoc(check_in: string, check_out: string): Booking {
  return adhocToBooking({ id: "adhoc-test", check_in, check_out, label: "Test stay" });
}

function vevent(fields: {
  uid?: string;
  start: string;
  end: string;
  summary?: string;
  description?: string;
}): string {
  return [
    "BEGIN:VEVENT",
    `DTSTART;VALUE=DATE:${fields.start}`,
    `DTEND;VALUE=DATE:${fields.end}`,
    `UID:${fields.uid ?? `${fields.start}@airbnb.com`}`,
    `SUMMARY:${fields.summary ?? "Reserved"}`,
    ...(fields.description ? [`DESCRIPTION:${fields.description}`] : []),
    "END:VEVENT",
  ].join("\r\n");
}

function feed(...events: string[]): string {
  return ["BEGIN:VCALENDAR", ...events, "END:VCALENDAR"].join("\r\n");
}

describe("parseIcal + buildSchedule", () => {
  it("returns [] for an empty feed", () => {
    expect(schedule(feed(), NOW)).toEqual([]);
  });

  it("drops a reservation entirely in the past", () => {
    const ics = feed(vevent({ start: "20260501", end: "20260505" }));
    expect(schedule(ics, NOW)).toEqual([]);
  });

  it("drops a reservation starting beyond the 4-week window", () => {
    const ics = feed(vevent({ start: "20260801", end: "20260805" }));
    expect(schedule(ics, NOW)).toEqual([]);
  });

  it("parses a reservation two weeks out as Upcoming", () => {
    const ics = feed(vevent({ start: "20260615", end: "20260618" }));
    const [b, ...rest] = schedule(ics, NOW);
    expect(rest).toEqual([]);
    expect(b.checkIn).toBe("2026-06-15");
    expect(b.checkOut).toBe("2026-06-18");
    expect(b.nights).toBe(3);
    expect(b.status).toBe("Upcoming");
    expect(b.sameDayTurnaround).toBe(false);
    expect(b.turnover).toBe("Check-in 3pm Jun 15");
  });

  it("marks a reservation overlapping today as Active", () => {
    const ics = feed(vevent({ start: "20260530", end: "20260603" }));
    const [b] = schedule(ics, NOW);
    expect(b.status).toBe("Active");
    expect(b.turnover).toBe("Check-out 10am Jun 3");
  });

  it("flags only the incoming card on a back-to-back turnover", () => {
    const ics = feed(
      vevent({ start: "20260610", end: "20260614" }),
      vevent({ start: "20260614", end: "20260617" }),
    );
    const [outgoing, incoming] = schedule(ics, NOW);
    expect(outgoing.sameDayTurnaround).toBe(false);
    expect(incoming.sameDayTurnaround).toBe(true);
    expect(incoming.turnover).toBe("10am–3pm Jun 14 (same-day after previous)");
  });

  it("gives an Active outgoing card the tight-window hint", () => {
    const ics = feed(
      vevent({ start: "20260530", end: "20260603" }),
      vevent({ start: "20260603", end: "20260606" }),
    );
    const [outgoing] = schedule(ics, NOW);
    expect(outgoing.sameDayTurnaround).toBe(false);
    expect(outgoing.turnover).toBe("10am–3pm Jun 3 (next guest arrives same day)");
  });

  it("drops host blocks", () => {
    const ics = feed(
      vevent({ start: "20260610", end: "20260612", summary: "Airbnb (Not available)" }),
      vevent({ start: "20260615", end: "20260617", summary: "Blocked" }),
    );
    expect(schedule(ics, NOW)).toEqual([]);
  });

  it("sorts by check-in regardless of feed order", () => {
    const ics = feed(
      vevent({ start: "20260620", end: "20260622" }),
      vevent({ start: "20260610", end: "20260612" }),
    );
    expect(schedule(ics, NOW).map((b) => b.checkIn)).toEqual(["2026-06-10", "2026-06-20"]);
  });

  it("builds the reservation URL from an HM code in the UID", () => {
    const ics = feed(
      vevent({ uid: "airbnb-HM12345@airbnb.com", start: "20260610", end: "20260612" }),
    );
    expect(schedule(ics, NOW)[0].reservationUrl).toBe(
      "https://www.airbnb.com/hosting/reservations/details/HM12345",
    );
  });

  it("falls back to an HM code in DESCRIPTION for a non-HM UID", () => {
    const ics = feed(
      vevent({
        uid: "abc123@airbnb.com",
        start: "20260610",
        end: "20260612",
        description: "Reservation URL: https://www.airbnb.com/hosting/reservations/details/HMABC99",
      }),
    );
    expect(schedule(ics, NOW)[0].reservationUrl).toBe(
      "https://www.airbnb.com/hosting/reservations/details/HMABC99",
    );
  });

  it("falls back to the host calendar when no HM code exists", () => {
    const ics = feed(vevent({ uid: "abc123@airbnb.com", start: "20260610", end: "20260612" }));
    expect(schedule(ics, NOW)[0].reservationUrl).toBe("https://www.airbnb.com/hosting/calendar");
  });

  it("unfolds RFC 5545 continuation lines", () => {
    const ics = feed(
      vevent({ uid: "abc123@airbnb.com", start: "20260610", end: "20260612" }).replace(
        "SUMMARY:Reserved",
        "SUMMARY:Airbnb (Not\r\n  available)",
      ),
    );
    expect(schedule(ics, NOW)).toEqual([]);
  });
});

describe("parseIcal", () => {
  it("does not apply the window", () => {
    const ics = feed(vevent({ start: "20200101", end: "20200105" }));
    expect(parseIcal(ics).map((b) => b.checkIn)).toEqual(["2020-01-01"]);
  });

  it("marks reservations as airbnb", () => {
    const ics = feed(vevent({ start: "20260610", end: "20260612" }));
    expect(parseIcal(ics)[0].source).toBe("airbnb");
  });
});

describe("adhocToBooking", () => {
  it("maps a stored stay to a Booking", () => {
    expect(adhoc("2026-11-03", "2026-11-10")).toMatchObject({
      id: "adhoc-test",
      source: "adhoc",
      label: "Test stay",
      reservationUrl: "",
      checkIn: "2026-11-03",
      checkOut: "2026-11-10",
      nights: 7,
      notes: "",
    });
  });

  it("does not share checklist state between stays", () => {
    const first = adhoc("2026-11-03", "2026-11-10");
    first.checklist.notified = true;
    expect(adhoc("2026-11-03", "2026-11-10").checklist.notified).toBe(false);
  });
});

describe("buildSchedule with mixed sources", () => {
  const airbnb = (start: string, end: string) => parseIcal(feed(vevent({ start, end })));

  it("sorts ad hoc stays in among reservations", () => {
    const stays = [
      ...airbnb("20260620", "20260622"),
      adhoc("2026-06-10", "2026-06-15"),
      ...airbnb("20260605", "20260607"),
    ];
    expect(buildSchedule(stays, NOW).map((b) => b.source)).toEqual(["airbnb", "adhoc", "airbnb"]);
  });

  it("flags a same-day turnover from a reservation into an ad hoc stay", () => {
    const stays = [...airbnb("20260605", "20260610"), adhoc("2026-06-10", "2026-06-15")];
    const [, incoming] = buildSchedule(stays, NOW);
    expect(incoming.source).toBe("adhoc");
    expect(incoming.sameDayTurnaround).toBe(true);
  });

  it("flags a same-day turnover from an ad hoc stay into a reservation", () => {
    const stays = [adhoc("2026-06-05", "2026-06-10"), ...airbnb("20260610", "20260615")];
    expect(buildSchedule(stays, NOW)[1].sameDayTurnaround).toBe(true);
  });

  it("marks an ad hoc stay overlapping today as Active", () => {
    expect(buildSchedule([adhoc("2026-05-30", "2026-06-03")], NOW)[0].status).toBe("Active");
  });

  it("applies the 4-week window to ad hoc stays", () => {
    expect(buildSchedule([adhoc("2026-08-01", "2026-08-05")], NOW)).toEqual([]);
    expect(buildSchedule([adhoc("2026-05-01", "2026-05-05")], NOW)).toEqual([]);
  });
});

describe("validateAdhocStay", () => {
  const valid = { check_in: "2026-11-03", check_out: "2026-11-10", label: "Test stay" };

  it("accepts a valid stay", () => {
    expect(validateAdhocStay(valid)).toEqual([]);
  });

  it("rejects a check-out on or before check-in", () => {
    expect(validateAdhocStay({ ...valid, check_out: "2026-11-03" })).toEqual([
      "Check-out must be after check-in.",
    ]);
    expect(validateAdhocStay({ ...valid, check_out: "2026-11-01" })).toHaveLength(1);
  });

  it("rejects malformed dates", () => {
    expect(validateAdhocStay({ ...valid, check_in: "Nov 3" })[0]).toContain("not a real");
    expect(validateAdhocStay({ ...valid, check_in: "" })[0]).toContain("not a real");
  });

  it("rejects dates that don't exist", () => {
    expect(validateAdhocStay({ ...valid, check_in: "2026-02-30" })[0]).toContain("not a real");
    expect(validateAdhocStay({ ...valid, check_out: "2026-13-01" })[0]).toContain("not a real");
  });

  it("rejects a blank label", () => {
    expect(validateAdhocStay({ ...valid, label: "   " })).toEqual(["Label must not be empty."]);
  });

  it("reports every problem at once", () => {
    expect(validateAdhocStay({ check_in: "x", check_out: "y", label: "" })).toHaveLength(3);
  });
});

describe("findOverlaps", () => {
  const dates = { checkIn: "2026-06-10", checkOut: "2026-06-15" };

  it("does not treat back-to-back stays as overlapping", () => {
    const stays = [adhoc("2026-06-05", "2026-06-10"), adhoc("2026-06-15", "2026-06-20")];
    expect(findOverlaps(dates, stays)).toEqual([]);
  });

  it("finds partial overlaps on either side", () => {
    const before = adhoc("2026-06-08", "2026-06-11");
    const after = adhoc("2026-06-14", "2026-06-18");
    expect(findOverlaps(dates, [before, after])).toEqual([before, after]);
  });

  it("finds stays nested in either direction", () => {
    const inside = adhoc("2026-06-11", "2026-06-12");
    const around = adhoc("2026-06-01", "2026-06-30");
    expect(findOverlaps(dates, [inside, around])).toEqual([inside, around]);
  });

  it("ignores stays that don't touch", () => {
    expect(findOverlaps(dates, [adhoc("2026-07-01", "2026-07-05")])).toEqual([]);
  });
});

describe("describeVisibility", () => {
  const stay = (check_in: string, check_out: string) => ({ check_in, check_out, label: "Test" });

  it("reports a stay inside the window", () => {
    expect(describeVisibility(stay("2026-06-10", "2026-06-15"), NOW)).toBe(
      "in the dashboard window now",
    );
  });

  it("gives the first date a later stay shows", () => {
    expect(describeVisibility(stay("2026-08-01", "2026-08-05"), NOW)).toBe(
      "shows on the dashboard from 2026-07-04",
    );
  });

  it("reports a stay in the past", () => {
    expect(describeVisibility(stay("2026-05-01", "2026-05-05"), NOW)).toBe(
      "in the past, so it won't show",
    );
  });
});
