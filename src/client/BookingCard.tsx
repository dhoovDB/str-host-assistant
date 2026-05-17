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

type SaveStatus = "saved" | "saving" | "error";

export function BookingCard({
  booking,
  onChecklistChange,
  onNotesChange,
}: {
  booking: Booking;
  onChecklistChange: (next: Record<ChecklistKey, boolean>) => void;
  onNotesChange: (notes: string) => Promise<void>;
}) {
  // Local textarea state so typing is responsive — parent state only updates
  // after the debounce fires. If `booking.notes` changes externally (cross-
  // device update visible on next refresh), the effect below resyncs.
  const [localNotes, setLocalNotes] = useState(booking.notes);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Save-generation counter prevents "saved → saving → saved" flicker when
  // typing fast: only the latest save's resolution updates the visible
  // status. Older in-flight awaits are ignored.
  const saveGen = useRef(0);

  useEffect(() => {
    setLocalNotes(booking.notes);
  }, [booking.notes]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const handleNotesChange = (notes: string) => {
    setLocalNotes(notes);
    setSaveStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    const myGen = ++saveGen.current;
    timer.current = setTimeout(async () => {
      try {
        await onNotesChange(notes);
        if (saveGen.current === myGen) setSaveStatus("saved");
      } catch (err) {
        console.error("Notes write failed:", err);
        if (saveGen.current === myGen) setSaveStatus("error");
      }
    }, 1000);
  };

  const iconClass =
    saveStatus === "saving"
      ? "ti ti-loader-2"
      : saveStatus === "error"
        ? "ti ti-alert-triangle"
        : "ti ti-check";
  const iconColor =
    saveStatus === "error" ? "var(--color-warning)" : "var(--color-text-muted)";
  const iconLabel =
    saveStatus === "saving" ? "Saving" : saveStatus === "error" ? "Save failed" : "Saved";
  const iconTitle =
    saveStatus === "saving"
      ? "Saving…"
      : saveStatus === "error"
        ? "Save failed. Keep typing to retry."
        : "Saved";

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
            className={iconClass}
            style={{
              marginLeft: 6,
              fontSize: 12,
              color: iconColor,
              display: "inline-block",
              animation: saveStatus === "saving" ? "spin 1s linear infinite" : undefined,
            }}
            aria-label={iconLabel}
            title={iconTitle}
          />
        </label>
        <textarea
          value={localNotes}
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
