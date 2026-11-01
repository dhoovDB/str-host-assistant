import { describe, it, expect } from "vitest";
import { parseCalendar } from "./calendar";

const NOW = new Date("2026-06-01T12:00:00Z");

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

describe("parseCalendar", () => {
  it("returns [] for an empty feed", () => {
    expect(parseCalendar(feed(), NOW)).toEqual([]);
  });

  it("drops a reservation entirely in the past", () => {
    const ics = feed(vevent({ start: "20260501", end: "20260505" }));
    expect(parseCalendar(ics, NOW)).toEqual([]);
  });

  it("drops a reservation starting beyond the 4-week window", () => {
    const ics = feed(vevent({ start: "20260801", end: "20260805" }));
    expect(parseCalendar(ics, NOW)).toEqual([]);
  });

  it("parses a reservation two weeks out as Upcoming", () => {
    const ics = feed(vevent({ start: "20260615", end: "20260618" }));
    const [b, ...rest] = parseCalendar(ics, NOW);
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
    const [b] = parseCalendar(ics, NOW);
    expect(b.status).toBe("Active");
    expect(b.turnover).toBe("Check-out 10am Jun 3");
  });

  it("flags only the incoming card on a back-to-back turnover", () => {
    const ics = feed(
      vevent({ start: "20260610", end: "20260614" }),
      vevent({ start: "20260614", end: "20260617" }),
    );
    const [outgoing, incoming] = parseCalendar(ics, NOW);
    expect(outgoing.sameDayTurnaround).toBe(false);
    expect(incoming.sameDayTurnaround).toBe(true);
    expect(incoming.turnover).toBe("10am–3pm Jun 14 (same-day after previous)");
  });

  it("gives an Active outgoing card the tight-window hint", () => {
    const ics = feed(
      vevent({ start: "20260530", end: "20260603" }),
      vevent({ start: "20260603", end: "20260606" }),
    );
    const [outgoing] = parseCalendar(ics, NOW);
    expect(outgoing.sameDayTurnaround).toBe(false);
    expect(outgoing.turnover).toBe("10am–3pm Jun 3 (next guest arrives same day)");
  });

  it("drops host blocks", () => {
    const ics = feed(
      vevent({ start: "20260610", end: "20260612", summary: "Airbnb (Not available)" }),
      vevent({ start: "20260615", end: "20260617", summary: "Blocked" }),
    );
    expect(parseCalendar(ics, NOW)).toEqual([]);
  });

  it("sorts by check-in regardless of feed order", () => {
    const ics = feed(
      vevent({ start: "20260620", end: "20260622" }),
      vevent({ start: "20260610", end: "20260612" }),
    );
    expect(parseCalendar(ics, NOW).map((b) => b.checkIn)).toEqual(["2026-06-10", "2026-06-20"]);
  });

  it("builds the reservation URL from an HM code in the UID", () => {
    const ics = feed(
      vevent({ uid: "airbnb-HM12345@airbnb.com", start: "20260610", end: "20260612" }),
    );
    expect(parseCalendar(ics, NOW)[0].reservationUrl).toBe(
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
    expect(parseCalendar(ics, NOW)[0].reservationUrl).toBe(
      "https://www.airbnb.com/hosting/reservations/details/HMABC99",
    );
  });

  it("falls back to the host calendar when no HM code exists", () => {
    const ics = feed(vevent({ uid: "abc123@airbnb.com", start: "20260610", end: "20260612" }));
    expect(parseCalendar(ics, NOW)[0].reservationUrl).toBe(
      "https://www.airbnb.com/hosting/calendar",
    );
  });

  it("unfolds RFC 5545 continuation lines", () => {
    const ics = feed(
      vevent({ uid: "abc123@airbnb.com", start: "20260610", end: "20260612" }).replace(
        "SUMMARY:Reserved",
        "SUMMARY:Airbnb (Not\r\n  available)",
      ),
    );
    expect(parseCalendar(ics, NOW)).toEqual([]);
  });
});
