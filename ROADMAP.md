# STR Host Assistant — Roadmap

## What this builds toward

Self-managed short-term rental hosts shouldn't have to choose between running their property like a small business and burning out on the coordination overhead. This dashboard exists so a host can start each day knowing which bookings need action and where revenue is leaking — without holding the whole operation in their head.

Each phase tightens that loop. v1 surfaces the daily picture and flags unbookable gaps before they cost a booking. v4 absorbs cleaner scheduling and maintenance tracking, so the operations loop runs through the system instead of through the host's working memory.

---

## v1: Dashboard with Daily Briefing — ✅ SHIPPED (2026-05-22)

**Goal:** A host opens the dashboard once a day and walks away in under a minute knowing what needs their attention, what to confirm with their cleaner, and where revenue is leaking.

**Done when:** A host can replace their daily cross-referencing across Airbnb, their calendar, and their own head with a single 60-second glance at this dashboard — and trusts the result enough to actually stop the cross-referencing.

**v1 close gates (one-off, must both pass before declaring v1 shipped):**
- **Demo To Wife — ✅ PASSED (2026-05-22).** The co-host (the dashboard's actual second user) loaded the live Cloudflare URL on her own phone and used it without coaching — a booming success. It replaced the cross-referencing it was meant to eliminate without needing translation by its author. Hydration/persistence confirmed in the same session (toggle a checklist step → reload → state survives).
- **Screenshot in README — ✅ PASSED (2026-05-22).** A screenshot of the running dashboard — captured from the public demo instance (dummy data, no guest PII, so it's safe in a public repo) — is committed at `docs/dashboard.png` and embedded near the top of `README.md`.

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
  "minStay": 3
}
```
`cleanerName` is consumed by Task 7's prompt builder, `propertyName` for display, `minStay` by Task 4's gaps engine. The iCal URL itself is a credential and lives in `ICAL_URL` env, not in the committed JSON — see decision log 2026-05-16. Treat the committed file as a placeholder template — real values are filled in per deployment. Validate at server startup:
- `propertyName` and `cleanerName` must be strings; log error and refuse to start if missing.
- `minStay` must be a positive integer; log error and use default of `2` if missing or invalid.
- `ICAL_URL` env must be set and non-empty; log error and refuse to start if missing.

For v1, the server reads `PROPERTY_ID` from env (URL-based routing deferred to Task 9). The Supabase anon key is used with permissive RLS — security comes from URL secrecy + hard-to-guess property IDs.

Files: `src/db/supabase.ts`, `src/config/property.ts`, `config/property.json`, `.env.example`, `src/start.ts` (importing the validator triggers startup check)

---

### Task 3: Google Calendar integration (complete)

Fetch 4-week rolling window from Google Calendar. Parse iCal format into booking objects: `{id, checkIn, checkOut, nights, turnaroundWindow, reservationUrl}`.

Turnover window logic: checkout time to check-in time on consecutive bookings. Default: 10am checkout, 3pm check-in (matching the "Standard check-in is 3pm" copy in the dashboard).

Reservation URL extraction: Airbnb iCal UIDs are typically `airbnb-HMXXXXXXXX@airbnb.com` where `HMXXXXXXXX` is the confirmation code. Build `reservationUrl` as `https://www.airbnb.com/hosting/reservations/details/HMXXXXXXXX` so the "View on Airbnb" link on each card opens the specific reservation page. If the UID doesn't match the expected shape, fall back to the host calendar URL (`https://www.airbnb.com/hosting/calendar`) so the link still goes somewhere useful instead of breaking.

Files: `src/api/gcal.ts`, `src/engine/calendar.ts`

---

### Task 4: Gaps engine (complete)

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

### Task 6: Briefing rules config (complete)

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

### Task 7: Claude briefing (complete)

`buildPrompt(bookings, gaps, checklistState, briefingRules)` in `src/engine/briefing.js`. Returns prompt string. No API calls. Reads `briefing-rules.json` and injects rules into the prompt.

Server route `/api/briefing`: loads config, calls `buildPrompt`, calls Claude API, stores the briefing text and the day's context (bookings, gaps, checklist state) in the `briefings` table, returns `{briefingId, text}`.

Files: `src/engine/briefing.js`, `src/api/claude.js`, `src/server/routes.js`

---

### Task 8: Feedback mechanism (complete)

The thumbs up/down buttons already render in `Briefing.tsx` with prop signature `<Briefing id={...} text={...} onFeedback={(helpful: boolean) => void} />`. Wire `onFeedback` to POST `/api/feedback` with `{briefingId, helpful}`. Server writes to the `briefing_feedback` table, linking back to the `briefings` row by id.

After click, both buttons are disabled (greyed out) for that briefing — no toast, no other UI feedback. After 2 weeks, query Supabase for unhelpful briefings (joining `briefings` and `briefing_feedback`) to review the briefing text + context and adjust `briefing-rules.json`.

Files: `src/client/Briefing.tsx`, `src/server/routes.js`

---

### Task 9: Wire everything (complete)

Replace all mocked data with live data:
- Bookings from Google Calendar
- Gaps from gaps engine (input: bookings + `minStay` from config)
- Checklist state from Supabase
- Briefing from Claude

Card display rules:
- Render only the 3 bookings closest to today (sorted by check-in date ascending; an active stay counts as one of the 3). Calendar fetch stays at 4 weeks so the gaps engine still sees the full window — display filtering is a render-time slice, not a fetch-time filter.
- Hide a card when its `reviewed` checklist step is checked OR when ≥7 days have passed since checkout, whichever fires first. Hidden cards retain their data in Supabase — only the render is suppressed.
- Hidden cards are surfaced again by the v2 history view; v1 has no UI to un-hide a card mid-cycle.

Connect checklist toggles to Supabase write. Wire notes textarea to debounced Supabase write — the `saving`/`saved` icon in `BookingCard` already exists with an 800ms timer; replace the timer-based reset with a transition that fires after `supabase.update()` resolves (and surfaces a third `error` state on failure). Confirm secret URL works across two browsers (different devices, same property_id).

Confirm the dashboard works on mobile (test at 375px viewport width). Layout must remain functional on phone screens.

Files: `src/client/App.jsx`, all components

---

### Task 10: Documentation (complete)

README.md fixed where it had drifted from the decision log: layer map no longer claims iCal URL lives in `config/property.json`; local-setup env-var list is complete (`ICAL_URL`, `ANTHROPIC_API_KEY` added, UUID claim for `PROPERTY_ID` dropped); step 4 stops calling the feed Google-Calendar-specific. Screenshot embedded near the top of the README per v1 close gate.

Files: `README.md`, `ROADMAP.md`

---

### Task 11: Deploy to Cloudflare Workers (complete)

First production deploy. The app ships as a single Worker — SSR, server functions, and static assets in one deployment — built by Vite and deployed with `wrangler`. Production secrets (`SUPABASE_URL`, `SUPABASE_KEY`, `ICAL_URL`, `ANTHROPIC_API_KEY`, `PROPERTY_ID`) are set via `wrangler secret put`; Cloudflare injects them into the Worker runtime where `nodejs_compat` exposes them on `process.env`. `.env` stays local-dev only.

Deploy command: `npm run deploy` → `vite build && wrangler deploy -c dist/server/wrangler.json`.

This unblocks the v1 close gate **"Demo To Wife"** — the co-host can load the secret URL from her own phone over cellular, not just a shared same-WiFi address. The deployed `*.workers.dev` URL is the access credential (no login, permissive RLS) and is kept out of the repo.

Files: `wrangler.jsonc`, `package.json`, `README.md`, `.env.example`

---

### Task 12: Public demo instance + mobile checklist fix (complete)

Two things, shipped together off the co-host's 2026-05-22 demo feedback:

**Mobile checklist wrap.** The cleaner-coordination row (4 buttons) overflowed the card on phones — `Ready` hung off the right edge — because the flex row had no wrap and `flex: 1` items can't shrink below their label width. Fixed with `flexWrap: "wrap"` + a `flex: "1 1 120px"` basis: the row collapses to a clean 2×2 on narrow screens and stays one row on desktop.

**Public demo instance (`str-host-dashboard-demo`).** A second Cloudflare Worker running the same codebase on static dummy data — safe to link and screenshot publicly. A `DEMO_MODE` env flag drives it: when set, the route loader returns `src/demo/fixtures.ts` and the persistence server functions no-op, so the demo runs with **zero secrets**. Deployed as a separate worker (not a `/demo` path on the real one) so publishing the demo URL never exposes the real dashboard's base URL. Fixtures cover every feature: same-day turnaround, Active vs Upcoming, mixed checklists, a note, flagged + unflagged gaps. Prerequisite fix folded in: `src/db/supabase.ts` read env eagerly at module load (a latent CLAUDE.md "lazy env" violation) — converted to a lazy `getSupabase()` so the secret-less demo worker can import the route without throwing.

Closes the second v1 close gate once the demo screenshot lands at `docs/dashboard.png`.

Files: `src/config/property.ts`, `src/db/supabase.ts`, `src/demo/fixtures.ts`, `src/routes/index.tsx`, `src/client/Checklist.tsx`, `README.md`, `docs/README.md`

---

## Next — pre-v2 hardening

Not a v2 feature — a safety net for the shipped, live v1. Do this before the v2 feature work begins.

### Hydration smoke test (pulled forward from v2 "Automated tests")

Open `/` in a headless browser (Playwright), click a checklist step, assert the DOM state changed. Catches the bug class where SSR succeeds but client hydration silently fails — e.g. a top-level env read leaking into the client bundle via a type-import chain.

**Why this jumps the queue:** decision log 2026-05-16 is the canonical case — a one-line change in `src/config/property.ts` (`export const icalUrl = validateIcalUrl()`) broke every interactive component on the dashboard while the dev server, type checker, and SSR all reported clean; it was diagnosed only after a user clicked a checkbox and nothing happened. v1 is now deployed and the co-host uses it daily, so a silent hydration regression hits a real user, not just the author. The test is tiny, and the failure mode is invisible to `tsc` and the build — exactly what an automated check is for.

**Done when:** a Playwright smoke test loads `/`, toggles a checklist step, and asserts the DOM changed; it runs locally and fails if hydration breaks. As the first automated test in the repo, this also stands up the Playwright harness.

---

## v2

### PriceLabs Integration via MCP

Use the PriceLabs MCP server (10 tools, community-maintained) instead of building a custom REST API integration. Connect the MCP server to the dashboard backend and call MCP tools directly to fetch nightly prices and min stay settings for gap dates.

Benefits over custom API integration:
- No API client code to write or maintain
- MCP handles authentication and connection management
- Tools are already defined and tested
- Same $1/listing/month API cost applies

Setup:
1. Install the PriceLabs MCP server via npm
2. Configure with PriceLabs API key in env
3. Call MCP tools from server routes (not the gaps engine — keep it pure)
4. Display avg price per gap in the gaps table

Wire this when manually checking PriceLabs for gap pricing becomes a daily bottleneck. The dashboard should work well without pricing data first — confirm the gaps table is useful before adding this layer.

Alternative: If the PriceLabs MCP server is unmaintained or broken when you reach v2, fall back to the REST API integration. Check the server's GitHub repo for recent activity before committing to MCP.

### Inventory Tracker

Checklist of restocking items (toilet paper, coffee, shampoo) that depletes after each turnover. Items below threshold surface automatically in the briefing and in the cleaner message on the booking card.

Explore integration with TIDY for automatic inventory syncing if TIDY supports it.

**Recurring maintenance tasks (co-host request, 2026-05-22 demo).** Alongside consumable restocking, track interval-based maintenance that isn't tied to a single turnover: HVAC air filters, the fridge water filter, periodic deep cleans. These recur on a time/usage cadence rather than depleting per-stay, so they need a "last done → next due" model and should surface in the briefing (and on the cleaner message) when due. Distinct from v4's TIDY maintenance tracking, which handles *reactive* maintenance requests — this is the *predictable, scheduled* kind. Decide up front whether recurring maintenance shares the inventory data model or gets its own table; the cadence/“next due” shape argues for separate.

### History view

Browse past stays, past briefings, past reviewed checklists. Rendered from the same Supabase tables that drive the live dashboard, just queried without the Task 9 lifecycle filter (hidden cards reappear here). Useful for: looking up "when did Sarah K. last stay here," reviewing what the AI briefing said on a past day, auditing whether checklist steps actually got completed.

Coupling with Data Retention: history view shows up to the retention horizon. Beyond that, data is purged and history shows nothing. The two tasks should land in the same release or coordinate the horizon up front.

### Data Retention

Purge old `checklist_state`, `briefings`, and `briefing_feedback` rows after 12 months. Hard delete, not archive. Implement as a scheduled job (Supabase pg_cron or Cloudflare Workers cron trigger).

Constraint: retention window must be longer than the briefing feedback review cadence (currently 2 weeks). 12 months satisfies this comfortably.

Open questions to revisit when this task is actually started:
- Is 12 months still the right horizon? Longer if the user wants more history; shorter if storage costs balloon.
- Hard delete vs archive to cold storage / JSON dump? Decided "delete" up front; worth reconsidering if the data turns out to have long-term analytical value.
- Property-level setting vs global default? Matters once multiple properties share a Supabase project.

### Automated tests

v1 shipped without tests deliberately — the surface was too small to justify the tooling. That argument expires the moment a v2 feature touches the engine. The **hydration smoke test was pulled forward** to "Next — pre-v2 hardening" above, because it guards a production failure mode rather than a v2 feature; the rest below land with the first engine-touching v2 work.

Coverage targets:

- **Engine unit tests — write the harness *before* the first engine change.** Pure functions in `src/engine/` (`parseCalendar`, `computeGaps`, `buildPrompt`) get input-output unit tests. Task 4 already has cases sketched in comments — promote them to a real Vitest file. Trigger: the first v2 feature that modifies the engine (e.g. PriceLabs feeding the gaps table, or recurring-maintenance reshaping the data model). Net first, then change — so regressions surface as you edit.
- **Config validator tests.** Bad JSON shapes throw with the expected message; lazy env loaders return the expected value when env is set and throw with a clear message when not. Fold into the same harness PR once Vitest exists.

Frameworks: Playwright for the smoke test (already stood up by the pre-v2 hardening item), Vitest for unit tests. **Reuse:** banking-empire already runs 88 Vitest tests on the same config-as-data / pure-engine architecture — lift its Vitest setup rather than configuring from scratch; the `tdd-guide` skill matches when you start. Run locally; CI later if we add it.

### URL-based property routing

v1 reads `PROPERTY_ID` from env, which means each property needs its own deployment (or a manual env swap before serving a different property). This is fine for a single property — the deployment URL itself is the secret. It becomes a friction point as soon as a second property comes online.

Replace with a path-based scheme: `/<property_id>` is the property's secret URL. The server reads the property_id from the route param instead of env. RLS policies stay permissive — security still comes from URL secrecy + hard-to-guess IDs (per decision log 2026-05-11), just routed differently rather than per-deployment.

Implementation outline:

- TanStack Router dynamic route `/$propertyId`.
- `getPropertyId()` becomes a function of the route context, not env.
- Existing tables (`briefings`, `checklist_state`, `booking_notes`, `briefing_feedback` via `briefings.property_id`) are already keyed by `property_id` — no schema change needed.
- v1 env-based path can stay as a deprecated fallback for the first property, or get removed once URL-routing is the only entry point.

This was originally scoped into Task 9 (decision log 2026-05-11 noted "URL-in-path scheme is part of wire everything"). It was deferred when Task 9 landed because env-based routing covered the single-property reality and the spec line "Confirm secret URL works across two browsers (different devices, same property_id)" was satisfied by sharing the same deployment URL across devices on the same WiFi. Multi-property routing remained unbuilt and is captured here as the v2 unlock.

### Briefing feedback enhancements

Close the briefing tuning loop end-to-end. Three pieces, all dependent on Task 8 (feedback writes) and the rules snapshot in `briefings.context`:

- **Qualitative thumbs-down input.** After tapping thumbs-down, a short optional text field appears with a "What did this miss?" prompt. Free-form text persists in a new `briefing_feedback.note` column. A 3-word note tells you what to fix; a binary vote tells you something was off. Optional, never required — keeps the one-tap path intact for users who don't want to elaborate.
- **Force-regenerate briefing button.** Today you have to delete the Supabase row manually to see new `briefing-rules.json` apply same-day. A button on the briefing panel regenerates immediately. Closes the "edit a rule, see the result" iteration loop without waiting until tomorrow.
- **Feedback review UI.** A `/feedback` page listing recent briefings alongside their votes, their `context` (bookings + gaps that were in play), and the rules snapshot from the day they generated. Removes the "run SQL in Supabase dashboard" friction from the manual tuning loop.

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

## v6: Claude-powered briefing rule tuning

Close the briefing-quality loop without requiring the host to manually analyze feedback. A scheduled job uses Claude to spot patterns in accumulated thumbs up/down data and suggest changes to `briefing-rules.json`.

Workflow:

- Cron job (weekly cadence to start) queries `briefings` + `briefing_feedback` for the recent window.
- Sends the joined data to Claude with a prompt like "Here are the last N briefings, their thumbs up/down votes, the bookings/gaps context Claude saw at generation time, and the customRules in effect at the time. Suggest specific additions/removals/edits to customRules to address downvote patterns. Cite the briefings that motivate each suggestion."
- Output: a structured suggestion — added/removed/edited rules, each with rationale tied to specific briefings.
- Surfaces in the dashboard for host review. **Never auto-applies.** Host approves, edits, or rejects each suggestion before it lands in `briefing-rules.json`.

Meta: this is the briefing AI tuning its own prompts based on host signal. The host stays as approver, but the analytical work moves off their plate.

Prereqs:

- Task 8 shipped (feedback writes to Supabase).
- v2 "Feedback review UI" probably shipped first, so the host can see raw data before trusting auto-suggestions.
- Enough vote volume to be statistically meaningful (~4+ weeks of daily voting).

Open questions for when this lands:

- Cadence: weekly (course-correct fast) vs monthly (more data per cycle). Start weekly.
- Model: Opus 4.7 — analytical task, intelligence-sensitive.
- Artifact format: a suggested customRules diff against the current file, a markdown report, or both.
- Suggest-only vs auto-apply: suggest-only for v1 of this phase. Auto-apply behind an explicit allowlist later, if ever.

---

## Developer tooling

Cross-cutting workflow improvements that aren't tied to a feature version. Items here often live in other repos or external tools — this section is a reminder surface, not a backlog for code in this repo.

### tanstack-start SKILL.md (in dhoovDB/claude-skills)

Create a `tanstack-start` SKILL.md in `github.com/dhoovDB/claude-skills`. The skill should capture current best practices for TanStack Start: server functions, SSR routing, client/server component boundaries, and Cloudflare Workers deployment patterns. Trigger: any task involving TanStack Start routing, server functions, or SSR behavior.

The work itself happens in the claude-skills repo, not here. This entry exists so the missing skill is visible the next time a TanStack Start task starts — at which point Claude should grep claude-skills for a matching SKILL.md per the global rules.

---

## Decision log

*Project and architectural decisions live here. Changes to this repo's CLAUDE.md are logged in CLAUDE.md, not here.*

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

### 2026-05-16 — iCal URL moved to env; minStay validation added

- **iCal URL is a credential, doesn't belong in committed config.** Airbnb's export URL has a `?t=<token>` query string granting read access to booking history. Anything in `config/property.json` lives in git history forever, even after later deletion. Moved `icalUrl` to `ICAL_URL` in `.env` (local) / `wrangler secret put ICAL_URL` (production).
- **`src/config/property.ts` exports `propertyConfig` (eager JSON validation) and `getIcalUrl()` (lazy env loader).** The env loader is intentionally a function, not a const. The first attempt was eager (`export const icalUrl = validateIcalUrl()`) and broke client hydration: Vite's dev mode serves `start.ts` to the browser via the route tree's `import type` chain, and because `start.ts` imported the env-validated const, every page load tried to read `process.env.ICAL_URL` in the browser and threw "ICAL_URL missing" before React could attach event handlers. Lazy evaluation moves the throw to first call, which only ever happens server-side (Task 3's iCal fetcher).
- **`minStay` validation landed.** Task 2 specced it but the original commit shipped without it; folded in here while the validator was already being restructured. Positive integer, defaults to 2.
- **Trigger.** Real-world: while filling in `property.json` for first deployment, a real Airbnb token briefly sat in the working tree before we caught it. The token has been rotated (read-only iCal, low blast radius — see chat history 2026-05-16).
- **Server-side fail-fast deferred.** With the lazy loader, a missing `ICAL_URL` won't surface until the first iCal fetch runs in Task 3. Acceptable for v1 because nothing in Tasks 1–2 needs the URL. Revisit if we want a startup-time check that survives the client-bundle leak.

### 2026-05-16 — Task 6 validation behavior

- **`briefing-rules.json` falls back to defaults on invalid fields; `property.json` throws.** Asymmetric on purpose: a bad `property.json` means we can't identify the property (whose calendar to fetch, what cleaner to mention) — bail loudly so the misconfig surfaces immediately. A bad `briefing-rules.json` means tuning knobs are wrong — the briefing still generates with sensible defaults, the user sees odd output, edits the rules, and re-tries. Logging is per-field so one typo'd value doesn't silently affect the other knobs.
- **Hand-rolled validation, no zod (still).** Five fields, all primitive types. Per decision log 2026-05-11 we revisit zod if validation gets non-trivial; this is still trivial. Adding a 50KB dep for `typeof x === "boolean"` checks isn't worth it.

### 2026-05-22 — First production deploy (Cloudflare Workers)

- **Deploy the built output, not source.** `npm run deploy` runs `vite build` then `wrangler deploy -c dist/server/wrangler.json`. The `@cloudflare/vite-plugin` emits a generated `dist/server/wrangler.json` whose `main` is the built worker entry (`index.js`, `no_bundle: true`) with assets resolving to `dist/client`. The root `wrangler.jsonc` `main: src/server.ts` is the pre-build source the Vite plugin consumes — deploying the root config directly would bypass the Vite build and ship unbuilt source. Hence the explicit `-c` flag pointing at the generated config.
- **Secrets via `wrangler secret put`, populated onto `process.env` at runtime.** This retires the open worry from decision log 2026-05-16 about whether the lazy `process.env` getters would resolve on Workers. Confirmed live: the SSR'd home page returned a real Claude briefing on first load, which only happens if `getIcalUrl()`, `getAnthropicApiKey()`, `getPropertyId()`, and the Supabase env reads all resolved in the Worker runtime. `nodejs_compat` + compat date 2025-09-24 auto-populates `process.env` from the secrets; no code change was needed.
- **The live URL is a credential and stays out of the repo.** v1 security is URL secrecy + permissive RLS (no login). Committing the `*.workers.dev` address to a public repo would defeat it, so it's shared privately. README documents the deploy *process* with a `<worker-name>.<subdomain>` placeholder, never the real address.
- **Deferred:** custom domain (a `*.workers.dev` URL is enough for the wife demo), and a CI deploy step (deploys are manual `npm run deploy` for now — fine for a single maintainer).

### 2026-05-22 — Public demo instance + supabase.ts made lazy

- **Demo is a separate worker, not a `/demo` path.** In v1 the deployed URL *is* the access credential (URL secrecy + permissive RLS, no login). A `/demo` route on the real worker would force publishing the real base URL — anyone could then hit `/` and see live bookings. So the demo is its own worker (`str-host-dashboard-demo`) with an intentionally unrelated name, so its public URL gives away nothing about the real worker (`rva-fan-stunning`).
- **`DEMO_MODE` env flag drives it, zero secrets.** A lazy `isDemoMode()` getter; when true, the loader returns `src/demo/fixtures.ts` and the checklist/notes/feedback server functions no-op. The demo worker is deployed with `--var DEMO_MODE:true` and no secrets. Confirmed live: the secret-less worker imports the route and serves fixtures without throwing, and a scan of the built bundles found no real secrets inlined (server-side `process.env` is runtime-populated on Workers, not build-inlined — the same fact that lets the real worker read its secrets at runtime).
- **`src/db/supabase.ts` converted from eager to lazy.** It read `SUPABASE_*` and built the client at module load, throwing if absent — a latent version of the 2026-05-16 hydration-incident pattern, and a hard blocker for a secret-less demo worker (importing the route would throw before any DEMO_MODE check). Now a cached `getSupabase()` built on first use, mirroring `src/api/claude.ts`. Behavior-equivalent for the real worker (verified: the real instance still renders its live briefing + bookings after redeploy, exercising a same-day Supabase write), and the "env reads must be lazy" rule is now actually satisfied across the whole data layer.

---

*Last updated: 2026-05-25*
