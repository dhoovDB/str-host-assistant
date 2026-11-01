import { describe, it, expect } from "vitest";
import { computeGaps } from "./gaps";
import type { Booking } from "../client/types";

function stay(checkIn: string, checkOut: string): Booking {
  return { checkIn, checkOut } as Booking;
}

describe("computeGaps", () => {
  it("returns [] for no bookings", () => {
    expect(computeGaps([], 3)).toEqual([]);
  });

  it("returns [] for one booking", () => {
    expect(computeGaps([stay("2026-06-01", "2026-06-05")], 3)).toEqual([]);
  });

  it("returns [] for back-to-back stays", () => {
    const bookings = [stay("2026-06-01", "2026-06-05"), stay("2026-06-05", "2026-06-08")];
    expect(computeGaps(bookings, 3)).toEqual([]);
  });

  it("flags a single-night gap below min stay", () => {
    const bookings = [stay("2026-06-01", "2026-06-05"), stay("2026-06-06", "2026-06-08")];
    expect(computeGaps(bookings, 3)).toEqual([
      { startDate: "2026-06-05", endDate: "2026-06-06", nights: 1, flagged: true },
    ]);
  });

  it("flags a multi-night gap below min stay", () => {
    const bookings = [stay("2026-06-01", "2026-06-05"), stay("2026-06-07", "2026-06-09")];
    expect(computeGaps(bookings, 3)[0]).toMatchObject({ nights: 2, flagged: true });
  });

  it("does not flag a gap at min stay", () => {
    const bookings = [stay("2026-06-01", "2026-06-05"), stay("2026-06-08", "2026-06-10")];
    expect(computeGaps(bookings, 3)[0]).toMatchObject({ nights: 3, flagged: false });
  });

  it("emits every gap with its own flag across three bookings", () => {
    const bookings = [
      stay("2026-06-01", "2026-06-05"),
      stay("2026-06-06", "2026-06-08"),
      stay("2026-06-12", "2026-06-14"),
    ];
    expect(computeGaps(bookings, 3).map((g) => [g.nights, g.flagged])).toEqual([
      [1, true],
      [4, false],
    ]);
  });

  it("handles unsorted input", () => {
    const bookings = [stay("2026-06-08", "2026-06-10"), stay("2026-06-01", "2026-06-05")];
    expect(computeGaps(bookings, 3)).toEqual([
      { startDate: "2026-06-05", endDate: "2026-06-08", nights: 3, flagged: false },
    ]);
  });

  it("does not open a false gap around a stay nested inside another", () => {
    const bookings = [
      stay("2026-06-01", "2026-06-10"),
      stay("2026-06-03", "2026-06-05"),
      stay("2026-06-12", "2026-06-15"),
    ];
    expect(computeGaps(bookings, 3)).toEqual([
      { startDate: "2026-06-10", endDate: "2026-06-12", nights: 2, flagged: true },
    ]);
  });

  it("measures from the later checkout when stays partly overlap", () => {
    const bookings = [
      stay("2026-06-01", "2026-06-05"),
      stay("2026-06-04", "2026-06-08"),
      stay("2026-06-11", "2026-06-13"),
    ];
    expect(computeGaps(bookings, 3)).toEqual([
      { startDate: "2026-06-08", endDate: "2026-06-11", nights: 3, flagged: false },
    ]);
  });

  it("closes a gap filled by an ad hoc stay", () => {
    const withoutStay = [stay("2026-06-01", "2026-06-05"), stay("2026-06-12", "2026-06-14")];
    expect(computeGaps(withoutStay, 3)).toHaveLength(1);
    expect(computeGaps([...withoutStay, stay("2026-06-05", "2026-06-12")], 3)).toEqual([]);
  });
});
