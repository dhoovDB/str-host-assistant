import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

const tablerCss = "https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Host Dashboard" },
      { name: "description", content: "Daily briefing, upcoming bookings, and pricing gaps for short-term rental hosts." },
    ],
    links: [{ rel: "stylesheet", href: tablerCss }],
  }),
  component: Index,
});

type ChecklistKey = "notified" | "confirmed" | "done";

type Booking = {
  id: number;
  checkIn: string;
  checkOut: string;
  nights: number;
  turnover: string;
  status: "Active" | "Upcoming";
  checklist: Record<ChecklistKey, boolean>;
};

type Gap = {
  dates: string;
  nights: number;
  price: string;
  flag: string;
};

const initialBookings: Booking[] = [
  { id: 1, checkIn: "May 10", checkOut: "May 12", nights: 2, turnover: "10am–4pm May 12", status: "Active", checklist: { notified: true, confirmed: true, done: false } },
  { id: 2, checkIn: "May 13", checkOut: "May 17", nights: 4, turnover: "10am–4pm May 17", status: "Upcoming", checklist: { notified: true, confirmed: false, done: false } },
];

const gaps: Gap[] = [
  { dates: "May 12–13", nights: 1, price: "$145", flag: "Min stay 3" },
  { dates: "May 17–19", nights: 2, price: "$162", flag: "Min stay 3" },
];

function Briefing() {
  return (
    <section
      style={{
        background: "var(--color-background-secondary)",
        borderLeft: "3px solid var(--color-teal)",
        borderTopRightRadius: "var(--border-radius-lg)",
        borderBottomRightRadius: "var(--border-radius-lg)",
        padding: "1rem 1.25rem",
      }}
    >
      <div style={{ fontSize: 12, textTransform: "uppercase", color: "var(--color-teal)", letterSpacing: "0.06em", fontWeight: 600 }}>
        Today's briefing
      </div>
      <p style={{ fontSize: 14, color: "var(--color-text-primary)", marginTop: 6, lineHeight: 1.55 }}>
        One active stay checking out today at noon. Cleaner is confirmed for the 10am–4pm window. Next guest arrives May 13 — message them tonight to share door code and parking notes.
      </p>
    </section>
  );
}

function StatusBadge({ status }: { status: Booking["status"] }) {
  const isActive = status === "Active";
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 999,
        background: isActive ? "var(--color-status-green-bg)" : "var(--color-status-blue-bg)",
        color: isActive ? "var(--color-status-green-fg)" : "var(--color-status-blue-fg)",
      }}
    >
      {status}
    </span>
  );
}

function ChecklistStep({ label, complete, onClick }: { label: string; complete: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: "8px 10px",
        border: "none",
        cursor: "pointer",
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 500,
        background: complete ? "var(--color-status-green-bg)" : "var(--color-step-incomplete-bg)",
        color: complete ? "var(--color-status-green-fg)" : "var(--color-step-incomplete-fg)",
      }}
    >
      <i className={complete ? "ti ti-check" : "ti ti-circle"} style={{ fontSize: 14 }} />
      <span>{label}</span>
    </button>
  );
}

function BookingCard({ booking, onToggle }: { booking: Booking; onToggle: (key: ChecklistKey) => void }) {
  const steps: { key: ChecklistKey; label: string }[] = [
    { key: "notified", label: "Notified" },
    { key: "confirmed", label: "Confirmed" },
    { key: "done", label: "Done" },
  ];
  return (
    <div
      style={{
        background: "var(--color-background-primary)",
        border: "0.5px solid var(--color-border-tertiary)",
        borderRadius: "var(--border-radius-lg)",
        padding: "1rem 1.25rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text-primary)" }}>
          {booking.checkIn} → {booking.checkOut}
        </div>
        <StatusBadge status={booking.status} />
      </div>
      <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 4 }}>
        {booking.nights} nights · Turnover window: {booking.turnover}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        {steps.map((s) => (
          <ChecklistStep
            key={s.key}
            label={s.label}
            complete={booking.checklist[s.key]}
            onClick={() => onToggle(s.key)}
          />
        ))}
      </div>
    </div>
  );
}

function GapsTable({ rows }: { rows: Gap[] }) {
  const cell: React.CSSProperties = {
    padding: "10px 12px",
    fontSize: 13,
    color: "var(--color-text-primary)",
    borderTop: "0.5px solid var(--color-border-tertiary)",
    textAlign: "left",
  };
  const head: React.CSSProperties = {
    padding: "10px 12px",
    fontSize: 12,
    color: "var(--color-text-muted)",
    textAlign: "left",
    fontWeight: 600,
  };
  return (
    <div
      style={{
        background: "var(--color-background-primary)",
        border: "0.5px solid var(--color-border-tertiary)",
        borderRadius: "var(--border-radius-lg)",
        overflow: "hidden",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={head}>Dates</th>
            <th style={head}>Nights</th>
            <th style={head}>Avg price</th>
            <th style={head}>Flag</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((g) => (
            <tr key={g.dates}>
              <td style={cell}>{g.dates}</td>
              <td style={cell}>{g.nights}</td>
              <td style={cell}>{g.price}</td>
              <td style={{ ...cell, color: g.nights < 3 ? "var(--color-warning)" : "var(--color-text-muted)", fontWeight: g.nights < 3 ? 600 : 400 }}>
                {g.flag}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: 13, textTransform: "uppercase", color: "var(--color-text-muted)", letterSpacing: "0.06em", fontWeight: 600, margin: "0 0 10px" }}>
      {children}
    </h2>
  );
}

function Index() {
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);

  const toggle = (id: number, key: ChecklistKey) => {
    setBookings((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, checklist: { ...b.checklist, [key]: !b.checklist[key] } } : b,
      ),
    );
  };

  return (
    <main style={{ minHeight: "100vh", background: "var(--color-background-primary)", padding: "2rem 1rem" }}>
      <h1 className="sr-only">Host Dashboard</h1>
      <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.75rem" }}>
        <Briefing />

        <section>
          <SectionHeader>Upcoming bookings</SectionHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {bookings.map((b) => (
              <BookingCard key={b.id} booking={b} onToggle={(k) => toggle(b.id, k)} />
            ))}
          </div>
        </section>

        <section>
          <SectionHeader>Gaps and pricing</SectionHeader>
          <GapsTable rows={gaps} />
        </section>
      </div>
    </main>
  );
}
