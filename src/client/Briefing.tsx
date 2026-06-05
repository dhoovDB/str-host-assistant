import { useEffect, useState } from "react";

type Props = {
  id: string;
  text: string;
  onFeedback: (helpful: boolean) => void;
  onNote: (note: string) => void;
};

// localStorage key prefix for the "you already voted on this briefing" marker.
// Keyed by briefing id so each day's briefing gets its own entry. Surviving
// reloads is the whole point — a vote should not reset just because the user
// refreshed the page on the same device. Cross-device voting is intentionally
// still possible (no server-side dedup); for a single-user dashboard this is
// the right tradeoff.
const LS_PREFIX = "briefing-feedback:";

export function Briefing({ id, text, onFeedback, onNote }: Props) {
  const [submitted, setSubmitted] = useState(false);
  // A thumbs-down reveals an optional "what did this miss?" field. In-session
  // only: the vote already persisted on the down-tap, so the note is a
  // best-effort follow-up captured in the moment. We deliberately don't re-show
  // it after a reload (the vote panel is greyed by then) — keeping the one-tap
  // path the default and the note a low-friction extra, never a required step.
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");
  const [noteSent, setNoteSent] = useState(false);

  // localStorage is unavailable on the SSR pass; this effect only runs client-side.
  // Brief flicker is possible between SSR (buttons appear active) and hydration
  // (buttons grey out if already voted). Acceptable for v1 — the briefing panel
  // is not load-bearing and the alternative (suppress SSR) costs more than it saves.
  useEffect(() => {
    try {
      if (localStorage.getItem(LS_PREFIX + id)) setSubmitted(true);
    } catch {
      // localStorage can throw in private-browsing modes or restricted environments —
      // fail closed (button stays active, user can vote, just no persistence).
    }
  }, [id]);

  const handleClick = (helpful: boolean) => {
    if (submitted) return;
    onFeedback(helpful);
    try {
      localStorage.setItem(LS_PREFIX + id, helpful ? "up" : "down");
    } catch {
      // Same swallow as above. The in-memory `submitted` state still prevents
      // a double-click within this page load.
    }
    setSubmitted(true);
    if (!helpful) setShowNote(true); // only a down-vote asks "what did this miss?"
  };

  const handleSendNote = () => {
    const trimmed = note.trim();
    if (!trimmed || noteSent) return;
    onNote(trimmed);
    setNoteSent(true);
  };

  const buttonStyle: React.CSSProperties = {
    background: "var(--color-background-primary)",
    color: submitted ? "var(--color-text-muted)" : "var(--color-text-primary)",
    border: "0.5px solid var(--color-border-tertiary)",
    borderRadius: 6,
    padding: "4px 8px",
    cursor: submitted ? "not-allowed" : "pointer",
    opacity: submitted ? 0.45 : 1,
    fontSize: 14,
    lineHeight: 1,
  };

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
        {text}
      </p>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 8 }}>
        <button
          type="button"
          onClick={() => handleClick(true)}
          disabled={submitted}
          aria-label="Mark briefing helpful"
          title="Helpful"
          style={buttonStyle}
        >
          <i className="ti ti-thumb-up" />
        </button>
        <button
          type="button"
          onClick={() => handleClick(false)}
          disabled={submitted}
          aria-label="Mark briefing not helpful"
          title="Not helpful"
          style={buttonStyle}
        >
          <i className="ti ti-thumb-down" />
        </button>
      </div>

      {showNote && !noteSent && (
        <div style={{ marginTop: 8 }}>
          <label
            htmlFor={"briefing-note-" + id}
            style={{ display: "block", fontSize: 12, color: "var(--color-text-muted)", marginBottom: 4 }}
          >
            What did this miss? <span style={{ opacity: 0.7 }}>(optional)</span>
          </label>
          <textarea
            id={"briefing-note-" + id}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="e.g. didn't flag the cleaner wasn't confirmed yet"
            style={{
              width: "100%",
              boxSizing: "border-box",
              background: "var(--color-background-primary)",
              color: "var(--color-text-primary)",
              border: "0.5px solid var(--color-border-tertiary)",
              borderRadius: 6,
              padding: "6px 8px",
              fontSize: 13,
              lineHeight: 1.5,
              resize: "vertical",
            }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
            <button
              type="button"
              onClick={handleSendNote}
              disabled={!note.trim()}
              style={{
                background: "var(--color-background-primary)",
                color: note.trim() ? "var(--color-text-primary)" : "var(--color-text-muted)",
                border: "0.5px solid var(--color-border-tertiary)",
                borderRadius: 6,
                padding: "4px 10px",
                cursor: note.trim() ? "pointer" : "not-allowed",
                opacity: note.trim() ? 1 : 0.45,
                fontSize: 13,
                lineHeight: 1,
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}

      {noteSent && (
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--color-text-muted)", textAlign: "right" }}>
          Thank you for the feedback!
        </div>
      )}
    </section>
  );
}
