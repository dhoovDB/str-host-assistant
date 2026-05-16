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
import { createBriefing, getBriefingByDate } from "@/db/supabase";

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
  const bookings = await fetchBookings();
  const rawGaps = computeGaps(bookings, propertyConfig.minStay);
  const gaps: Gap[] = rawGaps.map((g) => ({
    dates: `${formatDate(g.startDate)}–${formatDate(g.endDate)}`,
    nights: g.nights,
    price: "—",
    flag: g.flagged ? `Min stay ${propertyConfig.minStay}` : "",
  }));

  const today = new Date().toISOString().slice(0, 10);
  const propertyId = getPropertyId();
  let briefingRow = await getBriefingByDate(propertyId, today);
  if (!briefingRow) {
    const prompt = buildPrompt({
      bookings,
      gaps: rawGaps,
      // Checklist state stays empty until Task 9 wires it from Supabase. The
      // prompt builder gracefully omits the section when state is empty.
      checklistState: {},
      rules: briefingRules,
      propertyName: propertyConfig.propertyName,
      cleanerName: propertyConfig.cleanerName,
      minStay: propertyConfig.minStay,
      today,
    });
    const text = await generateBriefing(prompt);
    const id = await createBriefing({
      propertyId,
      date: today,
      text,
      context: { bookings, gaps: rawGaps },
    });
    briefingRow = {
      id,
      property_id: propertyId,
      date: today,
      text,
      context: { bookings, gaps: rawGaps },
      created_at: new Date().toISOString(),
    };
  }

  return {
    bookings,
    gaps,
    briefing: { id: briefingRow.id, text: briefingRow.text },
  };
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

  const updateChecklist = (id: string, next: Record<ChecklistKey, boolean>) => {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, checklist: next } : b)));
  };

  const updateNotes = (id: string, notes: string) => {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, notes } : b)));
  };

  return (
    <main style={{ minHeight: "100vh", background: "var(--color-background-primary)", padding: "2rem 1rem" }}>
      <h1 className="sr-only">Host Dashboard</h1>
      <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.75rem" }}>
        <Briefing
          id={briefing.id}
          text={briefing.text}
          onFeedback={(helpful) => console.log("briefing feedback:", { id: briefing.id, helpful })}
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
