# ROADMAP

## What this builds toward

A self-managed host tool that reduces coordination friction and catches revenue leaks before they cost you bookings. v1 is a dashboard that answers "what needs my attention today." v4 is a fully integrated operations platform with TIDY job automation.

---

## v1: Dashboard with Daily Briefing (current focus)

**Goal:** Open the dashboard and immediately know what's happening and what action is needed today. Show 4 weeks of upcoming bookings, surface unbookable gaps, track cleaner coordination progress.

**Done when:** A host can open the dashboard, read the briefing, see which bookings need cleaner confirmation, and identify revenue leaks from unbookable gaps — all in under 60 seconds.

---

### Task 1: Lovable UI shell (complete)

Full dashboard layout with mocked data. Briefing panel, booking cards with three-step checklist, gaps table. Checklist tap-to-toggle behavior included.

Files: `src/client/Briefing.tsx`, `src/client/BookingCard.tsx`, `src/client/Checklist.tsx`, `src/client/GapsTable.tsx`, `src/client/types.ts`, `src/routes/index.tsx`

---

### Task 2: Supabase and property config setup (~1 hour)

Three tables:
- `checklist_state`: columns `property_id`, `booking_id`, `step` (notified/confirmed/reminder/ready/checkedIn/checkedOut/reviewed), `completed` (boolean). Steps split into two groups in the UI: cleaner coordination (notified/confirmed/reminder/ready) and guest stay (checkedIn/checkedOut/reviewed).
- `briefings`: columns `id`, `property_id`, `date`, `text`, `context` (jsonb — bookings, gaps, checklist state captured at briefing generation time).
- `briefing_feedback`: columns `briefing_id` (fk → briefings), `helpful` (boolean), `submitted_at`. Anchored to the briefing so each vote is attached to the exact state the AI saw.

Secret URL scheme: property_id in the URL path. Row-level security filters all queries by property_id. Anyone with the URL can read and write.

Create `.env.example` with `SUPABASE_URL`, `SUPABASE_KEY`, `PROPERTY_ID`.

Create `config/property.json` to hold non-secret property identity. Schema:
```json
{
  "propertyName": "Mountain Loft #1",
  "cleanerName": "Maria",
  "icalUrl": "https://calendar.google.com/calendar/ical/.../basic.ics",
  "minStay": 3
}
```
`icalUrl` will be consumed by Task 3, `cleanerName` by Task 7's prompt builder, `propertyName` for display, `minStay` by Task 4's gaps engine. Treat the committed file as a placeholder template — real values are filled in per deployment. Validate schema on server startup:
- `icalUrl` is required and must be non-empty; log error and refuse to start if missing or empty.
- `minStay` must be a positive integer; log error and use default of `2` if missing or invalid.

For v1, the server reads `PROPERTY_ID` from env (URL-based routing deferred to Task 9). The Supabase anon key is used with permissive RLS — security comes from URL secrecy + hard-to-guess property IDs.

Files: `src/db/supabase.ts`, `src/config/property.ts`, `config/property.json`, `.env.example`, `src/start.ts` (importing the validator triggers startup check)

---

### Task 3: Google Calendar integration (~1.5 hours)

Fetch 4-week rolling window from Google Calendar. Parse iCal format into booking objects: `{id, checkIn, checkOut, nights, turnaroundWindow}`.

Turnover window logic: checkout time to check-in time on consecutive bookings. Default: 10am checkout, 4pm check-in.

Files: `src/api/gcal.ts`, `src/engine/calendar.ts`

---

### Task 4: Gaps engine (~1 hour)

Pure function `computeGaps(bookings, minStay)`. Inputs: sorted array of bookings, and the property's minimum stay. Output: array of gaps `{startDate, endDate, nights, flagged}`, where `flagged = gap.nights < minStay`.

Note: `minStay` comes from `config/property.json`, not an external API. The caller reads the config and passes it in — keeps `computeGaps` pure.

Unit test cases inline as comments:
- Back-to-back bookings (no gap)
- Single-night gap (flagged when `minStay > 1`)
- Multi-night gap below minStay (flagged)
- Multi-night gap at or above minStay (not flagged)
- Multiple gaps in the window with mixed flags

Files: `src/engine/gaps.js`

---

### Task 5: Deferred to v2 (see v2 roadmap below)

---

### Task 6: Briefing rules config (~1 hour)

Create `config/briefing-rules.json` schema:
```json
{
  "includeTurnovers": true,
  "includeGaps": true,
  "gapFlagThreshold": 3,
  "tone": "direct",
  "customRules": [
    "Flag if cleaner not confirmed within 48 hours of check-in",
    "Mention open maintenance items if any exist"
  ]
}
```

Validate schema on server startup. Log error and use defaults if invalid.

Create `config/README.md` explaining every field and what happens if one is missing.

Files: `config/briefing-rules.json`, `config/README.md`

---

### Task 7: Claude briefing (~1.5 hours)

`buildPrompt(bookings, gaps, checklistState, briefingRules)` in `src/engine/briefing.js`. Returns prompt string. No API calls. Reads `briefing-rules.json` and injects rules into the prompt.

Server route `/api/briefing`: loads config, calls `buildPrompt`, calls Claude API, stores the briefing text and the day's context (bookings, gaps, checklist state) in the `briefings` table, returns `{briefingId, text}`.

Files: `src/engine/briefing.js`, `src/api/claude.js`, `src/server/routes.js`

---

### Task 8: Feedback mechanism (~1 hour)

The thumbs up/down buttons already render in `Briefing.tsx` with prop signature `<Briefing id={...} text={...} onFeedback={(helpful: boolean) => void} />`. Wire `onFeedback` to POST `/api/feedback` with `{briefingId, helpful}`. Server writes to the `briefing_feedback` table, linking back to the `briefings` row by id.

After click, both buttons are disabled (greyed out) for that briefing — no toast, no other UI feedback. After 2 weeks, query Supabase for unhelpful briefings (joining `briefings` and `briefing_feedback`) to review the briefing text + context and adjust `briefing-rules.json`.

Files: `src/client/Briefing.tsx`, `src/server/routes.js`

---

### Task 9: Wire everything (~2 hours)

Replace all mocked data with live data:
- Bookings from Google Calendar
- Gaps from gaps engine (input: bookings + `minStay` from config)
- Checklist state from Supabase
- Briefing from Claude

Connect checklist toggles to Supabase write. Wire notes textarea to debounced Supabase write — the `saving`/`saved` icon in `BookingCard` already exists with an 800ms timer; replace the timer-based reset with a transition that fires after `supabase.update()` resolves (and surfaces a third `error` state on failure). Confirm secret URL works across two browsers (different devices, same property_id).

Confirm the dashboard works on mobile (test at 375px viewport width). Layout must remain functional on phone screens.

Files: `src/client/App.jsx`, all components

---

### Task 10: Documentation (~1 hour)

CLAUDE.md (done), ROADMAP.md (this file), README.md.

README covers:
- What it is (one sentence)
- How to run locally (install, env vars, `npm run dev`)
- How to configure `config/property.json` and `config/briefing-rules.json`
- Screenshot of the dashboard
- No marketing copy

Files: `README.md`

---

## v2

### PriceLabs Integration

Fetch nightly prices for gap dates and display avg price per gap. Costs $1/listing/month. Wire this when manually checking PriceLabs becomes a daily bottleneck.

### Inventory Tracker

Checklist of restocking items (toilet paper, coffee, shampoo) that depletes after each turnover. Items below threshold surface automatically in the briefing and in the cleaner message on the booking card.

Explore integration with TIDY for automatic inventory syncing if TIDY supports it.

---

## v3: TIDY Integration (Cleaner Coordination)

Replace manual cleaner checklist with TIDY job scheduling. The dashboard pulls job status from TIDY's API instead of storing it in Supabase.

Checklist becomes:
- Job created (TIDY)
- Job assigned (TIDY)
- Job completed (TIDY)

The briefing surfaces TIDY job issues: unassigned jobs, late completions, cleaner no-shows.

Reference: https://www.tidy.com/blog/claude-code-str-property-management

---

## v4: TIDY Integration (Maintenance Tracking)

TIDY handles maintenance requests. Instead of a local maintenance log, surface open TIDY maintenance jobs in the briefing and booking cards.

The gaps table flags properties with open maintenance that might prevent bookings.

---

## v5: Write-back to PriceLabs

Allow min stay adjustments directly from the gaps table. Click "Drop to 2 nights" on a gap row, dashboard writes back to PriceLabs API.

This is the first write operation to an external system. Requires confirmation dialog and human approval before executing.

---

## Decision log

A short record of architectural choices that aren't obvious from the code. Add entries when the choice resolves a real fork in the road — skip the routine.

### 2026-05-11 — Task 2 scoping

- **Config loaders live in `src/config/`.** Holds `property.ts` now, `briefing-rules.ts` later in Task 6. Why: separates "load + validate config" from db/server/engine layers, and makes the "config is data, not code" rule visible in the layer map.
- **Supabase checklist helper is full-state upsert, not per-step.** `upsertChecklist(propertyId, bookingId, fullState)` writes all rows for a booking at once. Why: matches the cascade UI's output shape (one click can flip 4 steps); avoids batch primitives.
- **URL-based property routing deferred to Task 9.** Task 2 reads `PROPERTY_ID` from env so local dev works against one property. URL-in-path scheme (`/<property_id>`) is part of "wire everything," not infra setup.
- **Hand-rolled validation for `property.json`; no zod re-add.** Three fields, one required non-empty. Adding a 50KB dep for this is overkill. Revisit if `briefing-rules.json` validation gets non-trivial in Task 6.
- **Cloudflare production secrets deferred.** `.env.example` covers local dev only. Production env vars get set via `wrangler secret put` or the Cloudflare dashboard, handled in Task 10 (deploy docs) or first deploy.
- **Permissive RLS on Supabase tables.** Anon key + `using (true)` policies — security comes from URL secrecy + hard-to-guess property IDs, not from RLS scoping. Why: matches the "no login for v1" architecture. Revisit if v2 adds auth.
- **`.js` → `.ts` in CLAUDE.md layer map.** Project is TypeScript end-to-end; the original `.js` references were inconsistencies from the initial scaffold. Updated the whole layer map at once.

### 2026-05-13 — iCal parsing hand-rolled, no library

- **What iCal is.** iCal (also called ICS) is the text-based standard for exchanging calendar data — the format Google Calendar, Apple Calendar, and Airbnb all export. Each event ("VEVENT") is a few lines: a unique ID, a start date, an end date, a summary, and sometimes a description. Hosts download this file regularly to sync bookings into other tools; the dashboard does the same.
- **The choice.** Use a library like `ical.js` (Mozilla's parser, ~50KB, covers the full spec including recurring events and time zones) versus writing ~80 lines of code that handle only what Airbnb actually emits.
- **Chose hand-roll.** Airbnb's host export is consistent and simple: each VEVENT has UID, DTSTART, DTEND, and a SUMMARY of "Reserved." No recurring events, no time-zone wrangling (dates are date-only). The 80 lines of parsing live in `src/engine/calendar.ts` and are easier to read, debug, and change when an Airbnb format quirk shows up than the equivalent calls into a generic library. Adding a 50KB dependency for parsing we can spell out ourselves is dependency cost that doesn't pay back yet.
- **Upgrade path.** If we ever need full iCal-spec support — recurring events, time-zone-aware times, multi-attendee invites — switch to `ical.js`. Until then, hand-rolled wins on transparency.

### 2026-05-13 — PriceLabs deferred to v2

- **Gaps shown without pricing in v1.** The gaps table flags unbookable nights (gap length < min stay) based on `minStay` from `property.json`. No external pricing API. Why: the core insight is "you have a 2-night gap but 3-night minimum" — that's lost revenue regardless of the nightly rate. Knowing the gap exists is 80% of the value. Adding PriceLabs ($1/month API cost) before confirming the gaps table is actually useful daily is premature optimization. Wire PriceLabs in v2 if manually checking prices becomes a bottleneck.
- **`minStay` lives in config, not fetched.** The property's minimum stay requirement is set once and changes infrequently. Treating it as config (committed, versioned) rather than live API data is the right tradeoff for v1. If min stay becomes dynamic (weekday vs weekend), revisit in v2.

### 2026-05-15 — Real property config split from committed template

- **What changed.** `config/property.json` is now gitignored. The committed file is `config/property.example.json` with the same schema and placeholder values. On a fresh checkout, copy the example to `config/property.json` and fill in real values before running.
- **Why split.** Previously the same file was both "schema/template that lives in git" and "the file the validator reads at runtime with real values like the iCal URL." That asks the user to remember "edit locally, don't commit" — a fragile guarantee that depends on discipline rather than mechanism. Splitting them encodes the rule in git itself: the tracked file is the template, the runtime file is local-only.
- **Same pattern as `.env`.** `.env.example` is committed; `.env` is gitignored. Property config now matches that established pattern, so contributors familiar with one find the other obvious.
