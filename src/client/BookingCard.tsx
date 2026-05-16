import { useEffect, useRef, useState } from "react";
import type { Booking, ChecklistKey } from "./types";
import { Checklist } from "./Checklist";
import { formatDate } from "./dates";

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

export function BookingCard({ booking, onChecklistChange, onNotesChange }: { booking: Booking; onChecklistChange: (next: Record<ChecklistKey, boolean>) => void; onNotesChange: (notes: string) => void }) {
  const [savedStatus, setSavedStatus] = useState<"saved" | "saving">("saved");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleNotesChange = (notes: string) => {
    onNotesChange(notes);
    setSavedStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setSavedStatus("saved"), 800);
  };

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const isSaving = savedStatus === "saving";

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
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text-primary)", display: "flex", alignItems: "center", gap: 6 }}>
          {booking.sameDayTurnaround && (
            <span title="Same-day turnaround" aria-label="Same-day turnaround alert">🚨</span>
          )}
          {/* Guest name / guest count hidden in v1 — Airbnb's iCal feed does not
              expose names or party size. Restore this line when the Airbnb API
              integration lands (v2+) or remove permanently if not pursued.
              Original: {booking.guestName} · {booking.guests} {booking.guests === 1 ? "guest" : "guests"} */}
        </div>
        <StatusBadge status={booking.status} />
      </div>
      <div style={{ fontSize: 13, color: "var(--color-text-primary)", marginTop: 4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span>{booking.nights} {booking.nights === 1 ? "night" : "nights"} · {formatDate(booking.checkIn)} → {formatDate(booking.checkOut)}</span>
        <a
          href={booking.reservationUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 12, color: "var(--color-teal)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3, fontWeight: 600 }}
        >
          View on Airbnb <i className="ti ti-external-link" style={{ fontSize: 12 }} />
        </a>
      </div>
      <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 4 }}>
        Turnover window: {booking.turnover}
      </div>
      {booking.sameDayTurnaround && (
        <div style={{ fontSize: 12, color: "var(--color-warning)", marginTop: 4, fontWeight: 600 }}>
          Same-day turnaround — 10am–3pm cleaning window
        </div>
      )}
      <Checklist state={booking.checklist} onChange={onChecklistChange} />
      <div style={{ marginTop: 12 }}>
        <label style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, color: "var(--color-text-muted)" }}>
          Notes
          <i
            className={isSaving ? "ti ti-loader-2" : "ti ti-check"}
            style={{
              marginLeft: 6,
              fontSize: 12,
              color: "var(--color-text-muted)",
              display: "inline-block",
              animation: isSaving ? "spin 1s linear infinite" : undefined,
            }}
            aria-label={isSaving ? "Saving" : "Saved"}
            title={isSaving ? "Saving…" : "Saved"}
          />
        </label>
        <textarea
          value={booking.notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="Add a note for this reservation…"
          rows={2}
          style={{
            display: "block",
            width: "100%",
            marginTop: 4,
            padding: "8px 10px",
            fontSize: 13,
            fontFamily: "inherit",
            color: "var(--color-text-primary)",
            background: "var(--color-background-secondary)",
            border: "0.5px solid var(--color-border-tertiary)",
            borderRadius: 8,
            resize: "vertical",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>
    </div>
  );
}
