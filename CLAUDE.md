# STR Host Assistant — Developer Guide

A daily-briefing dashboard for self-managed short-term rental hosts. Open it and immediately know what's happening and what action is needed today. Built for sharing — host and co-host use the same URL and see the same state.

## Before you do anything

Run `/globalrules` now. It contains the delegation rules, approval gates, status reporting format, commit discipline, and architecture principles that govern every session. The rest of this file assumes those rules are active.

**Run `/codereview` before every commit that completes task work** — and commit only after it's clean or the findings are addressed. This is a hard gate; a passing `tsc`/build is not a substitute. A non-blocking `PreToolUse` reminder hook in `.claude/settings.local.json` nudges this at commit time, but the gate is this rule, not the hook.

---

## Architecture rules

**Config is data, not code.**

Property-specific values live in `config/property.json`: property name, cleaner name, minimum stay. The iCal URL is a credential and lives in the `ICAL_URL` env var, not in the committed JSON. Briefing behavior lives in `config/briefing-rules.json`. Engine functions take config as arguments — they do not import config directly.

**Engine functions are pure.**

`parseCalendar`, `computeGaps`, and `buildPrompt` take inputs and return outputs. No API calls, no file reads, no state mutation. API calls are isolated in `src/api/`. Database writes are isolated in `src/db/`.

**API keys never touch the browser.**

All external API calls go through server-side routes. The frontend sends requests. The server loads config, calls the API, and returns results.

**State lives in Supabase, not localStorage.**

Checklist state and briefing feedback are stored in Supabase so the dashboard works across devices and users.

**The briefing prompt is configurable.**

The prompt is assembled by a pure function from `briefing-rules.json`. When a briefing feels wrong, edit the config file, not the engine.

**Env reads must be lazy.**

Access to `process.env.X` lives inside a function body, never at module top level. Expose secrets as named functions — e.g. `getIcalUrl()` in `src/config/property.ts`. Canonical incident: decision log 2026-05-16.

**Styling: inline styles with dashboard tokens.**

Components in `src/client/` use inline `style={{}}` with tokens from `src/styles.css`. Do not bulk-scaffold shadcn/ui or migrate to Tailwind. Add shadcn primitives one at a time via `npx shadcn add <name>` only when genuinely needed.

**Record non-obvious architectural decisions in the ROADMAP decision log.**

---

## Working style additions (STR-specific)

**Confirm behavior changes before editing.** Restate the proposed logic including inferred edge cases, and wait for explicit go-ahead. Mechanical edits (renames, type updates, doc fixes) proceed without a confirmation step.

**Explain before process management actions.** Before killing or restarting background processes, explain what the process is and what happens if you act — then wait for confirmation.

**Surface adjacent considerations during planning.** When the user is brainstorming, proactively flag natural follow-ons, hidden dependencies, and implications. Phrase as candidate items, not decisions.

---

## Verification

Before reporting a task as done, exercise it in the browser when changes touch React components, routes, styles, the server entry, config loaders, or anything imported by them. SSR/hydration breaks silently. Dev-server boot and `tsc` do not tell you the dashboard works — open the URL and click something.

When asking the user to validate visually, provide a numbered checklist of exactly what to confirm. Do not say "try it and see."

---

## Layer map

```
config/property.json            ← property name, cleaner name, min stay
config/briefing-rules.json      ← briefing behavior (thresholds, tone)
src/config/                     ← typed loaders that validate config/*.json
src/engine/calendar.ts          ← parse iCal feed into bookings (pure)
src/engine/gaps.ts              ← compute open gaps between bookings (pure)
src/engine/briefing.ts          ← buildPrompt from config + state (pure)
src/api/claude.ts               ← Claude API call, isolated
src/api/gcal.ts                 ← Google Calendar fetch, isolated
src/db/supabase.ts              ← checklist + feedback read/write
src/server/routes.ts            ← API routes
src/client/                     ← React components
```

## What not to do

- Do not hardcode property details, cleaner names, or flag thresholds in engine functions.
- Do not call external APIs from the browser.
- Do not mix prompt assembly with the Claude API call in the same function.
- Do not store state in localStorage.
- Do not add v2 features to v1 files. Add a TODO comment and stop.

---

## Feedback mechanism

Thumbs up/down on the briefing panel POSTs to `/api/feedback` with `{briefingId, helpful}`. Both buttons disable after one vote. After 2 weeks, query Supabase for unhelpful briefings, look for patterns, and edit `briefing-rules.json` to fix them.

This is the robotics control loop pattern applied to a dashboard: sense → log outcome → adjust parameters → repeat.

---

## Why this architecture matters beyond this project

This architecture mirrors how production robotics software is structured: parameters live in data files, control logic is pure and testable, and I/O is isolated at the boundary. These are not arbitrary conventions, they are the same patterns used in robot fleet management systems where a bug in the wrong layer causes a physical consequence, not just a failed test.

The briefing feedback loop follows the same shape as a robotics control loop: sense the environment, log the outcome, adjust the parameters, redeploy. The domain is different. The pattern is identical.
