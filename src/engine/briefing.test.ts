import { describe, it, expect } from "vitest";
import { buildPrompt, type BuildPromptInput } from "./briefing";
import type { Booking } from "../client/types";

function input(overrides: Partial<BuildPromptInput> = {}): BuildPromptInput {
  return {
    bookings: [],
    gaps: [],
    checklistState: {},
    rules: {
      includeTurnovers: true,
      includeGaps: true,
      gapFlagThreshold: 2,
      tone: "direct",
      customRules: [],
    },
    propertyName: "Test Property",
    cleanerName: "Test Cleaner",
    minStay: 3,
    today: "2026-06-01",
    ...overrides,
  };
}

const BOOKING = {
  id: "b1",
  checkIn: "2026-06-05",
  checkOut: "2026-06-08",
  nights: 3,
  status: "Upcoming",
} as Booking;

describe("buildPrompt", () => {
  it("stays coherent with no bookings and no gaps", () => {
    const prompt = buildPrompt(input());
    expect(prompt).toContain("Today is 2026-06-01.");
    expect(prompt).toContain("Bookings in the 4-week window: none.");
    expect(prompt).toContain("Unbookable gaps in window: none.");
    expect(prompt).toContain("Task: write a 2-3 sentence daily briefing");
  });

  it("lists bookings", () => {
    const prompt = buildPrompt(input({ bookings: [BOOKING] }));
    expect(prompt).toContain("Bookings in the 4-week window (1 total):");
    expect(prompt).toContain("- 2026-06-05 → 2026-06-08, 3 nights, status Upcoming");
  });

  it("omits the booking section when includeTurnovers is false", () => {
    const rules = { ...input().rules, includeTurnovers: false };
    expect(buildPrompt(input({ rules, bookings: [BOOKING] }))).not.toContain(
      "Bookings in the 4-week window",
    );
  });

  it("omits the gap section when includeGaps is false", () => {
    const rules = { ...input().rules, includeGaps: false };
    expect(buildPrompt(input({ rules }))).not.toContain("Unbookable gaps");
  });

  it("emphasizes a gap shorter than gapFlagThreshold", () => {
    const gaps = [{ startDate: "2026-06-08", endDate: "2026-06-09", nights: 1, flagged: true }];
    const prompt = buildPrompt(input({ gaps }));
    expect(prompt).toContain(
      "- 2026-06-08–2026-06-09, 1 night (below min stay) [BRIEFING EMPHASIS",
    );
  });

  it("does not emphasize a gap at gapFlagThreshold", () => {
    const gaps = [{ startDate: "2026-06-08", endDate: "2026-06-10", nights: 2, flagged: true }];
    expect(buildPrompt(input({ gaps }))).not.toContain("BRIEFING EMPHASIS");
  });

  it("includes every custom rule", () => {
    const rules = { ...input().rules, customRules: ["rule one", "rule two", "rule three"] };
    const prompt = buildPrompt(input({ rules }));
    expect(prompt).toContain("Custom rules to follow:");
    for (const r of rules.customRules) expect(prompt).toContain(`- ${r}`);
  });

  it("mentions a same-day arrival on the booking line", () => {
    const prompt = buildPrompt(input({ bookings: [{ ...BOOKING, sameDayTurnaround: true }] }));
    expect(prompt).toContain("same-day arrival (previous guest leaves the same day)");
  });

  it("marks an ad hoc stay as off-platform", () => {
    const bookings = [{ ...BOOKING, source: "adhoc" } as Booking];
    expect(buildPrompt(input({ bookings }))).toContain(", off-platform stay");
  });

  it("does not mark a reservation as off-platform", () => {
    const bookings = [{ ...BOOKING, source: "airbnb" } as Booking];
    expect(buildPrompt(input({ bookings }))).not.toContain("off-platform");
  });

  it("reports completed checklist steps per booking", () => {
    const checklistState = {
      b1: {
        notified: true,
        confirmed: true,
        reminder: false,
        ready: false,
        checkedIn: false,
        checkedOut: false,
        reviewed: false,
      },
    };
    expect(buildPrompt(input({ checklistState }))).toContain("- b1: notified, confirmed");
  });
});
