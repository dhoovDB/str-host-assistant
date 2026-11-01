export type ChecklistKey =
  | "notified"
  | "confirmed"
  | "reminder"
  | "ready"
  | "checkedIn"
  | "checkedOut"
  | "reviewed";

export type Booking = {
  id: string;
  source: "airbnb" | "adhoc";
  // Short host-entered name for an ad hoc stay. Airbnb's feed carries no equivalent.
  label?: string;
  guestName: string;
  guests: number;
  reservationUrl: string;
  // ISO date-only, e.g. "2026-05-10". Format for display via formatDate().
  checkIn: string;
  checkOut: string;
  nights: number;
  turnover: string;
  status: "Active" | "Upcoming";
  checklist: Record<ChecklistKey, boolean>;
  sameDayTurnaround?: boolean;
  notes: string;
};

// An off-platform stay as stored in the adhoc_stays table.
export type AdhocStay = {
  id: string;
  check_in: string;
  check_out: string;
  label: string;
};

export type Gap = {
  dates: string;
  nights: number;
  price: string;
  flag: string;
};
