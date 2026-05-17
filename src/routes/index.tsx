import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Briefing } from "@/client/Briefing";
import { BookingCard } from "@/client/BookingCard";
import { GapsTable } from "@/client/GapsTable";
import type { Booking, ChecklistKey, Gap } from "@/client/types";
import { formatDate } from "@/client/dates";
import { fetchBookings } from "@/api/gcal";
import { generateBriefing } from "@/api/claude";
import { computeGaps } from "@/engine/gaps";
import { buildPrompt } from "@/engine/briefing";
import { propertyConfig, getPropertyId } from "@/config/property";
import { briefingRules } from "@/config/briefing-rules";
import {
  createBriefing,
  getBriefingByDate,
  recordFeedback,
  getChecklistState,
  upsertChecklist,
  getBookingNote,
  upsertBookingNote,
} from "@/db/supabase";

const tablerCss = "https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css";

// Server function: runs only on the SSR/server path. fetchBookings(),
// generateBriefing(), and the supabase helpers all read env via lazy
// getters — never import this from client code paths. See CLAUDE.md
// "Env reads must be lazy" + ROADMAP decision log 2026-05-16.
//
// Briefings are cached daily in Supabase keyed by (property_id, date).
// First page load of the day generates + stores; subsequent loads read
// the cached row. Worst case (race during cache miss) is two duplicate
// inserts for the same day — acceptable for v1 single-user dashboard;
// the briefings table can grow a UNIQUE(property_id, date) constraint
// if it becomes an issue.
const loadDashboardData = createServerFn({ method: "GET" }).handler(async () => {
  const rawBookings = await fetchBookings();
  const propertyId = getPropertyId();

  // Hydrate each booking with its Supabase-persisted checklist state and notes.
  // Parallel per-booking fetches — for ~4 bookings this is ~8 round trips, fine
  // for v1. If the booking count grows, switch to batch queries (one IN-clause
  // call for all bookings instead of N×2 calls).
  const enrichedBookings = await Promise.all(
    rawBookings.map(async (b) => {
      const [checklist, notes] = await Promise.all([
        getChecklistState(propertyId, b.id),
        getBookingNote(propertyId, b.id),
      ]);
      return { ...b, checklist, notes };
    }),
  );

  const rawGaps = computeGaps(rawBookings, propertyConfig.minStay);
  const gaps: Gap[] = rawGaps.map((g) => ({
    dates: `${formatDate(g.startDate)}–${formatDate(g.endDate)}`,
    nights: g.nights,
    price: "—",
    flag: g.flagged ? `Min stay ${propertyConfig.minStay}` : "",
  }));

  // Build the per-booking checklist map for buildPrompt (separate parameter from
  // the bookings list so the engine layer doesn't depend on the hydrated shape).
  const checklistByBookingId: Record<string, Record<ChecklistKey, boolean>> = {};
  for (const b of enrichedBookings) {
    checklistByBookingId[b.id] = b.checklist;
  }

  const today = new Date().toISOString().slice(0, 10);
  let briefingRow = await getBriefingByDate(propertyId, today);
  if (!briefingRow) {
    const prompt = buildPrompt({
      bookings: rawBookings,
      gaps: rawGaps,
      checklistState: checklistByBookingId,
      rules: briefingRules,
      propertyName: propertyConfig.propertyName,
      cleanerName: propertyConfig.cleanerName,
      minStay: propertyConfig.minStay,
      today,
    });
    const text = await generateBriefing(prompt);
    // Capture the rules in effect at generation time alongside the data. When the
    // v2 feedback-review UI / v6 auto-tuner queries old briefings, they need to
    // know which rules produced each one — a thumbs-down briefing generated under
    // an old rule set is a different signal than one under the current rules.
    const context = { bookings: rawBookings, gaps: rawGaps, rules: briefingRules };
    const id = await createBriefing({
      propertyId,
      date: today,
      text,
      context,
    });
    briefingRow = {
      id,
      property_id: propertyId,
      date: today,
      text,
      context,
      created_at: new Date().toISOString(),
    };
  }

  // Card display rules per ROADMAP Task 9:
  // - Hide if the booking's `reviewed` step is checked.
  // - Hide if ≥7 days have passed since checkout. (Forward-compat — given
  //   parseCalendar's current `checkOut >= today` filter, nothing in
  //   enrichedBookings is ever past checkout today, so this branch is dead
  //   code at v1. Kept so the rule survives a future fetch-window widening.)
  // - Sort by check-in ascending (already done by parseCalendar).
  // - Take the first 3 surviving bookings.
  // Gaps engine sees all rawBookings (full window) — display filtering is a
  // render-time slice, not a fetch-time filter (ROADMAP decision 2026-05-16).
  const todayMs = Date.parse(today + "T00:00:00Z");
  const displayedBookings = enrichedBookings
    .filter((b) => {
      if (b.checklist.reviewed) return false;
      const daysPostCheckout =
        (todayMs - Date.parse(b.checkOut + "T00:00:00Z")) / (24 * 60 * 60 * 1000);
      return daysPostCheckout < 7;
    })
    .slice(0, 3);

  return {
    bookings: displayedBookings,
    gaps,
    briefing: { id: briefingRow.id, text: briefingRow.text },
  };
});

// Server functions for Task 9 persistence. Both wrap supabase.ts helpers and
// run server-side (Supabase env reads stay off the client). Called from Index()
// callbacks: checklist toggle is fire-and-forget (no save indicator on the
// buttons themselves), notes write is awaited by BookingCard so its
// saving/saved/error icon reflects the actual write status.
const submitChecklistUpdate = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { bookingId: string; state: Record<ChecklistKey, boolean> }) => data,
  )
  .handler(async ({ data }) => {
    const propertyId = getPropertyId();
    await upsertChecklist(propertyId, data.bookingId, data.state);
  });

const submitNotesUpdate = createServerFn({ method: "POST" })
  .inputValidator((data: { bookingId: string; notes: string }) => data)
  .handler(async ({ data }) => {
    const propertyId = getPropertyId();
    await upsertBookingNote(propertyId, data.bookingId, data.notes);
  });

// Server function for the thumbs vote. Runs only on the server (recordFeedback
// reads Supabase env via the supabase.ts module-load env reads). Called from
// the Briefing component via the onFeedback prop; the response isn't awaited
// — Briefing.tsx already gives optimistic UI via local state + localStorage.
const submitBriefingFeedback = createServerFn({ method: "POST" })
  .inputValidator((data: { briefingId: string; helpful: boolean }) => data)
  .handler(async ({ data }) => {
    await recordFeedback(data.briefingId, data.helpful);
  });

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Host Dashboard" },
      { name: "description", content: "Daily briefing, upcoming bookings, and pricing gaps for short-term rental hosts." },
    ],
    links: [{ rel: "stylesheet", href: tablerCss }],
  }),
  loader: async () => loadDashboardData(),
  component: Index,
});

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: 13, textTransform: "uppercase", color: "var(--color-text-muted)", letterSpacing: "0.06em", fontWeight: 600, margin: "0 0 10px" }}>
      {children}
    </h2>
  );
}

function Index() {
  const { bookings: initialBookings, gaps, briefing } = Route.useLoaderData();
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);

  // Checklist write: optimistic local update + fire-and-forget Supabase write.
  // No save indicator on the buttons themselves; if the write fails, the next
  // page load will show the persisted (older) state and the user can re-toggle.
  const updateChecklist = (id: string, next: Record<ChecklistKey, boolean>) => {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, checklist: next } : b)));
    submitChecklistUpdate({ data: { bookingId: id, state: next } }).catch((err) =>
      console.error("Checklist write failed:", err),
    );
  };

  // Notes write: optimistic local update + awaited Supabase write. BookingCard
  // awaits the returned promise to drive its saving/saved/error icon state.
  const updateNotes = async (id: string, notes: string): Promise<void> => {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, notes } : b)));
    await submitNotesUpdate({ data: { bookingId: id, notes } });
  };

  return (
    <main style={{ minHeight: "100vh", background: "var(--color-background-primary)", padding: "2rem 1rem" }}>
      <h1 className="sr-only">Host Dashboard</h1>
      <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.75rem" }}>
        <Briefing
          id={briefing.id}
          text={briefing.text}
          onFeedback={(helpful) => {
            submitBriefingFeedback({ data: { briefingId: briefing.id, helpful } }).catch(
              (err) => console.error("briefing feedback write failed:", err),
            );
          }}
        />

        <section>
          <SectionHeader>Upcoming bookings</SectionHeader>
          <div style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "0 0 12px", lineHeight: 1.6 }}>
            <div>Standard check-in is 3pm.</div>
            <div style={{ marginTop: 8, fontWeight: 600, color: "var(--color-text-primary)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: 11 }}>Cleaner coordination</div>
            <ul style={{ paddingLeft: 18, margin: "2px 0 0" }}>
              <li><strong style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>Notified</strong>: cleaner has been informed.</li>
              <li><strong style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>Confirmed</strong>: cleaner has agreed.</li>
              <li><strong style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>Reminder</strong>: follow-up sent 1–2 days before with checkout date and window.</li>
              <li><strong style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>Ready</strong>: turnover complete, unit is guest-ready.</li>
            </ul>
            <div style={{ marginTop: 8, fontWeight: 600, color: "var(--color-text-primary)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: 11 }}>Guest stay</div>
            <ul style={{ paddingLeft: 18, margin: "2px 0 0" }}>
              <li><strong style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>Checked In</strong>: confirmed guest has arrived.</li>
              <li><strong style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>Checked Out</strong>: confirmed guest has departed.</li>
              <li><strong style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>Reviewed</strong>: review submitted on the platform.</li>
            </ul>
          </div>
          {bookings.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--color-text-muted)", padding: "12px 0" }}>
              No upcoming bookings in the next 4 weeks.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {bookings.map((b) => (
                <BookingCard key={b.id} booking={b} onChecklistChange={(next) => updateChecklist(b.id, next)} onNotesChange={(n) => updateNotes(b.id, n)} />
              ))}
            </div>
          )}
        </section>

        <section>
          <SectionHeader>Gaps and pricing</SectionHeader>
          <GapsTable rows={gaps} />
        </section>
      </div>
    </main>
  );
}
