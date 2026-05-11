# CLAUDE.md

Read this before selecting or executing any task in this repo.

## What this repo is

A host dashboard for short-term rentals. Open it and immediately know what's happening and what action is needed today. Built for sharing — you and a co-host both use the same URL and see the same state.

## Architecture rules

**Config is data, not code.**

Property-specific values live in `config/property.json`: property name, cleaner name, iCal URL. Briefing behavior lives in `config/briefing-rules.json`: what to include, what thresholds trigger flags, tone. Engine functions take config as arguments. They do not import config directly.

**Engine functions are pure.**

`parseCalendar`, `computeGaps`, and `buildPrompt` take inputs and return outputs. No API calls, no file reads, no state mutation. API calls are isolated in `src/api/`. Database writes are isolated in `src/db/`. Keep these layers separate.

**The API keys never touch the browser.**

All external API calls (Claude, Google Calendar, PriceLabs) go through server-side routes. The frontend sends requests. The server loads config, calls the API, and returns results.

**State lives in Supabase, not localStorage.**

Checklist state and briefing feedback are stored in Supabase so the dashboard works across devices and users. The secret URL identifies which property's data to load. No login required for v1.

**The briefing prompt is configurable.**

The prompt is assembled by a pure function from `briefing-rules.json`. This makes it testable and adjustable without touching code. When a briefing feels wrong, you edit the config file, not the engine.

**Styling: inline styles with dashboard tokens.**

Components in `src/client/` use inline `style={{}}` with the dashboard tokens defined in `src/styles.css` (`--color-background-primary`, `--color-text-primary`, `--color-teal`, `--color-warning`, etc.). Do not bulk-scaffold shadcn/ui or migrate the dashboard to tailwind utility classes. If a complex primitive is needed (dialog, dropdown, command palette), add it explicitly via `npx shadcn add <name>` one component at a time and adapt it to the dashboard tokens. The shadcn token block in `styles.css` and the `.dark` block are kept only for the 404/error pages in `__root.tsx` — do not extend that system for new dashboard components.

**Record non-obvious architectural decisions in the ROADMAP decision log.**

When a choice resolves a real fork in the road — where the trade-offs aren't obvious from the code alone — add an entry to the Decision log section of `ROADMAP.md` with the choice, the why, and the date. Skip the routine; record what someone reading the code six months later would want to know.

## Working style

**Confirm behavior changes before editing.** When the user describes a new behavior or UX rule, restate the proposed logic — including the edge cases you inferred — and wait for explicit go-ahead before changing code. Do not auto-implement on the assumption that "the logic is obvious"; small UX differences matter and are cheap to clarify in advance. A soft "going to implement unless you say otherwise" does not count as a confirmation step.

Mechanical edits (renames, type updates, doc fixes, file moves the user has named) proceed without an extra confirmation step. The pause-and-confirm rule applies specifically to behavior changes — anything that changes what the user sees or how the app responds.

**Explain before process management actions.** Before killing, restarting, or cleaning up background processes (dev servers, daemons, anything started with `run_in_background`), explain what the process is, where it's running, what happens if you act, and what happens if you don't — then wait for confirmation. Same pause-and-confirm shape as the behavior-change rule, applied to actions that affect running processes on the user's machine.

## Layer map

```
config/property.json            ← property name, cleaner name, iCal URL
config/briefing-rules.json      ← what to include, flag thresholds, tone
src/config/                     ← typed loaders that read + validate config/*.json
src/engine/calendar.ts          ← parse iCal feed into bookings (pure)
src/engine/gaps.ts              ← compute open gaps between bookings (pure)
src/engine/briefing.ts          ← buildPrompt from config + state (pure)
src/api/claude.ts               ← Claude API call, isolated
src/api/gcal.ts                 ← Google Calendar fetch, isolated
src/api/pricelabs.ts            ← PriceLabs fetch, isolated
src/db/supabase.ts              ← checklist + feedback read/write
src/server/routes.ts            ← /api/bookings, /api/briefing, /api/checklist, /api/feedback
src/client/                     ← React components: Briefing, BookingCard, Checklist, GapsTable
```

## What not to do

- Do not hardcode property details, cleaner names, or flag thresholds in engine functions.
- Do not call external APIs from the browser.
- Do not mix prompt assembly with the Claude API call in the same function.
- Do not store state in localStorage. Use Supabase.
- Do not add v2 features (inventory tracker, TIDY integration) to v1 files. Add a TODO comment and stop.

## Feedback mechanism

The briefing panel has thumbs up and thumbs down buttons. On click, the frontend POSTs to `/api/feedback` with `{briefingId, helpful}` and both buttons are disabled (greyed out) for that briefing — the user has voted and there is no further UI signal.

When the briefing is generated, the server stores the briefing text and the day's context (bookings, gaps, checklist state) in the `briefings` table. Feedback links back via `briefing_id`, so each vote is anchored to the exact state the AI saw when it wrote the briefing.

**How it works in practice:**

1. You read the briefing and tap thumbs down when it misses something or includes noise.
2. The system logs feedback alongside the briefing text and the day's context.
3. After 2 weeks, query Supabase for unhelpful briefings.
4. Look for patterns — maybe it's flagging 1-night gaps you don't care about, or missing same-day turnovers.
5. Edit `briefing-rules.json` to fix it (e.g. `"gapFlagThreshold": 2`, or add `"alwaysMentionSameDayTurnovers": true`).
6. The briefing gets better.

Without this loop you'd eventually stop reading the briefing because it isn't helpful, but you wouldn't know why or how to fix it. With it, you have data that tells you exactly what to adjust.

This is the robotics control loop pattern applied to a dashboard: sense (read briefing) → log outcome (thumbs up/down) → adjust parameters (edit config) → repeat.

## Robotics PM signal

This architecture mirrors production robotics software: parameters are data files, control logic is pure and testable, I/O is isolated at the boundary. A reviewer who builds robot fleet management software will recognize the pattern.

The feedback loop mirrors how robotics teams tune control parameters — log outcomes, review data, adjust config, redeploy. Same pattern, different domain.
