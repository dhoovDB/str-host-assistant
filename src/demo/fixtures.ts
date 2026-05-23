import type { Booking, Gap } from "../client/types";

// Static demo data for the DEMO_MODE instance (str-host-dashboard-demo). No real
// bookings, no PII — safe to screenshot and link publicly. Dates are fixed around
// the 2026-05-22 demo build so the same-day-turnaround and gap scenarios read
// coherently together. See ROADMAP Task 12 + decision log 2026-05-22.

const HOST_CALENDAR_URL = "https://www.airbnb.com/hosting/calendar";

export const demoBookings: Booking[] = [
  {
    // Active stay, currently in-house. Shows the green "Active" badge and a
    // completed cleaner row with the guest-stay row mid-progress (checked in).
    id: "demo-active",
    guestName: "Demo Guest",
    guests: 2,
    reservationUrl: HOST_CALENDAR_URL,
    checkIn: "2026-05-20",
    checkOut: "2026-05-24",
    nights: 4,
    turnover: "Checks out May 24, 10am",
    status: "Active",
    sameDayTurnaround: false,
    checklist: {
      notified: true,
      confirmed: true,
      reminder: true,
      ready: true,
      checkedIn: true,
      checkedOut: false,
      reviewed: false,
    },
    notes: "Returning guest — knows the place. Left a welcome bottle.",
  },
  {
    // Same-day turnaround: checks in May 24, the day the stay above checks out.
    // Drives the 🚨 alert and the "10am–3pm cleaning window" warning. Cleaner
    // notified + confirmed, but reminder/ready still pending.
    id: "demo-turnaround",
    guestName: "Demo Guest",
    guests: 4,
    reservationUrl: HOST_CALENDAR_URL,
    checkIn: "2026-05-24",
    checkOut: "2026-05-27",
    nights: 3,
    turnover: "Same-day after May 24 checkout — 10am–3pm window",
    status: "Upcoming",
    sameDayTurnaround: true,
    checklist: {
      notified: true,
      confirmed: true,
      reminder: false,
      ready: false,
      checkedIn: false,
      checkedOut: false,
      reviewed: false,
    },
    notes: "",
  },
  {
    // Normal upcoming stay, nothing actioned yet — shows an empty checklist.
    id: "demo-upcoming",
    guestName: "Demo Guest",
    guests: 3,
    reservationUrl: HOST_CALENDAR_URL,
    checkIn: "2026-05-30",
    checkOut: "2026-06-02",
    nights: 3,
    turnover: "Checks in May 30, 3pm",
    status: "Upcoming",
    sameDayTurnaround: false,
    checklist: {
      notified: false,
      confirmed: false,
      reminder: false,
      ready: false,
      checkedIn: false,
      checkedOut: false,
      reviewed: false,
    },
    notes: "",
  },
];

export const demoGaps: Gap[] = [
  // 3-night gap == min stay → bookable, not flagged.
  { dates: "May 27 – May 30", nights: 3, price: "—", flag: "" },
  // 2-night gap < min stay 3 → flagged as unbookable revenue leak.
  { dates: "Jun 2 – Jun 4", nights: 2, price: "—", flag: "Min stay 3" },
];

export const demoBriefing: { id: string; text: string } = {
  id: "demo-briefing",
  text:
    "Same-day turnaround on May 24: the current guest checks out at 10am and the next arrives at 3pm — confirm the cleaner is locked for that window. The May 30 stay still needs the cleaner notified. And a 2-night gap (Jun 2–4) sits below your 3-night minimum, so it likely won't book as-is; worth dropping the minimum for those dates.",
};
