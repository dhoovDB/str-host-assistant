import type { ChecklistKey } from "./types";

const cleanerSteps: { key: ChecklistKey; label: string }[] = [
  { key: "notified", label: "Notified" },
  { key: "confirmed", label: "Confirmed" },
  { key: "reminder", label: "Reminder" },
  { key: "ready", label: "Ready" },
];

const guestSteps: { key: ChecklistKey; label: string }[] = [
  { key: "checkedIn", label: "Checked In" },
  { key: "checkedOut", label: "Checked Out" },
  { key: "reviewed", label: "Reviewed" },
];

function ChecklistStep({ label, complete, onClick }: { label: string; complete: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        // grow to fill, but a 120px basis makes a too-tight row wrap (2×2 on
        // phones) instead of overflowing the card. 120px keeps the longest
        // labels ("Reminder", "Checked Out") from truncating. See ROADMAP
        // Task 12 / the 2026-05-22 mobile-wrap fix.
        flex: "1 1 120px",
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

// Sequential cascade: clicking step N checks/unchecks it plus everything
// before/after it in the same row. Treats each row as a progress bar where
// you can't be at step N without having passed steps 1..N-1.
function cascade(
  rowKeys: ChecklistKey[],
  state: Record<ChecklistKey, boolean>,
  clickedKey: ChecklistKey,
): Record<ChecklistKey, boolean> {
  const idx = rowKeys.indexOf(clickedKey);
  const turningOff = state[clickedKey];
  const next = { ...state };
  if (turningOff) {
    for (let i = idx; i < rowKeys.length; i++) next[rowKeys[i]] = false;
  } else {
    for (let i = 0; i <= idx; i++) next[rowKeys[i]] = true;
  }
  return next;
}

export function Checklist({ state, onChange }: { state: Record<ChecklistKey, boolean>; onChange: (next: Record<ChecklistKey, boolean>) => void }) {
  const cleanerKeys = cleanerSteps.map((s) => s.key);
  const guestKeys = guestSteps.map((s) => s.key);

  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        {cleanerSteps.map((s) => (
          <ChecklistStep
            key={s.key}
            label={s.label}
            complete={state[s.key]}
            onClick={() => onChange(cascade(cleanerKeys, state, s.key))}
          />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
        {guestSteps.map((s) => (
          <ChecklistStep
            key={s.key}
            label={s.label}
            complete={state[s.key]}
            onClick={() => onChange(cascade(guestKeys, state, s.key))}
          />
        ))}
      </div>
    </>
  );
}
