# CLAUDE.md

Read this before selecting or executing any task in this repo.

## What this repo is

A host dashboard for short-term rentals. Open it and immediately know what's happening and what action is needed today. Built for sharing — you and a co-host both use the same URL and see the same state.

## Architecture rules

**Config is data, not code.**

Property-specific values live in `config/property.json`: property name, cleaner name, minimum stay. The iCal URL is a credential and lives in the `ICAL_URL` env var, not in the committed JSON (see ROADMAP decision log 2026-05-16). Briefing behavior lives in `config/briefing-rules.json`: what to include, what thresholds trigger flags, tone. Engine functions take config as arguments. They do not import config directly.

**Engine functions are pure.**

`parseCalendar`, `computeGaps`, and `buildPrompt` take inputs and return outputs. No API calls, no file reads, no state mutation. API calls are isolated in `src/api/`. Database writes are isolated in `src/db/`. Keep these layers separate.

**The API keys never touch the browser.**

All external API calls (Claude, Google Calendar) go through server-side routes. The frontend sends requests. The server loads config, calls the API, and returns results.

**State lives in Supabase, not localStorage.**

Checklist state and briefing feedback are stored in Supabase so the dashboard works across devices and users. The secret URL identifies which property's data to load. No login required for v1.

**The briefing prompt is configurable.**

The prompt is assembled by a pure function from `briefing-rules.json`. This makes it testable and adjustable without touching code. When a briefing feels wrong, you edit the config file, not the engine.

**Styling: inline styles with dashboard tokens.**

Components in `src/client/` use inline `style={{}}` with the dashboard tokens defined in `src/styles.css` (`--color-background-primary`, `--color-text-primary`, `--color-teal`, `--color-warning`, etc.). Do not bulk-scaffold shadcn/ui or migrate the dashboard to tailwind utility classes. If a complex primitive is needed (dialog, dropdown, command palette), add it explicitly via `npx shadcn add <name>` one component at a time and adapt it to the dashboard tokens. The shadcn token block in `styles.css` and the `.dark` block are kept only for the 404/error pages in `__root.tsx` — do not extend that system for new dashboard components.

**Env reads must be lazy.**

Access to `process.env.X` (or any env state) lives inside a function body, never at module top level. Expose secrets as named functions — e.g. `getIcalUrl()` in `src/config/property.ts` — and call them only from server-only files (`src/api/`, `src/db/`, `src/server/`). Reason: Vite's dev mode can serve server modules to the browser via type-import chains, and a top-level env read throws in the client (where `process.env` is undefined) before React can hydrate, leaving the page non-interactive. JSON validation at module top level is fine because the imported JSON travels with the module; env state does not. Canonical incident: ROADMAP decision log 2026-05-16.

**Record non-obvious architectural decisions in the ROADMAP decision log.**

When a choice resolves a real fork in the road — where the trade-offs aren't obvious from the code alone — add an entry to the Decision log section of `ROADMAP.md` with the choice, the why, and the date. Skip the routine; record what someone reading the code six months later would want to know.

## Working style

**Confirm behavior changes before editing.** When the user describes a new behavior or UX rule, restate the proposed logic — including the edge cases you inferred — and wait for explicit go-ahead before changing code. Do not auto-implement on the assumption that "the logic is obvious"; small UX differences matter and are cheap to clarify in advance. A soft "going to implement unless you say otherwise" does not count as a confirmation step.

Mechanical edits (renames, type updates, doc fixes, file moves the user has named) proceed without an extra confirmation step. The pause-and-confirm rule applies specifically to behavior changes — anything that changes what the user sees or how the app responds.

**Explain before process management actions.** Before killing, restarting, or cleaning up background processes (dev servers, daemons, anything started with `run_in_background`), explain what the process is, where it's running, what happens if you act, and what happens if you don't — then wait for confirmation. Same pause-and-confirm shape as the behavior-change rule, applied to actions that affect running processes on the user's machine.

**Feedback and planning mode.** Phrases like "add this to the roadmap," "for the backlog," "I'm thinking about," "FYI," "note that," "consider X" signal planning input, not a directive. Acknowledge in one sentence, note the input where appropriate (memory, ROADMAP planning, decision log), and wait. Only act when you hear an explicit instruction to proceed — see the approval-phrasing rule below.

**Surface adjacent considerations during planning.** When the user is brainstorming or capturing roadmap items, proactively flag adjacent things they haven't raised yet — natural follow-ons, hidden dependencies, implications their stated change makes likely. Phrase as candidate items, not decisions ("worth flagging: you'll probably want X"). The goal is to make implicit scope visible at the planning stage when it's cheap to accept or reject, not to expand scope unilaterally. Example: a data-retention proposal implies the need for a history view; flagging it during planning surfaced a real item the literal request wouldn't have produced.

**Batch feedback before acting.** When multiple pieces of feedback or items land in succession, accumulate them. Before doing anything, summarize what you heard as a numbered list and ask "ready to proceed with all of these?" Wait for confirmation before touching any file.

**Approval phrasing is specific.** "Sounds good," "OK," "yeah," "interesting" — not approval. "Go ahead," "commit it," "make those changes," "do it," "approved" — approval. When in doubt, ask one clarifying question rather than guess.

## Verification

Before reporting a task as done, exercise it in the browser when changes touch React components, routes, styles, the server entry (`start.ts`, `server.ts`), config loaders (`src/config/`), or anything imported by them. SSR/hydration breaks silently — the server can return 200 OK with valid HTML while the client fails to attach React event handlers, leaving the page non-interactive. Dev-server boot and `tsc` tell you the code compiles; they do not tell you the dashboard works. Open the URL, click something, type something. ROADMAP decision log 2026-05-16 documents the canonical example: a config-layer change broke every interactive component on the page while the dev server reported no errors.

**When asking the user to validate visually, provide a numbered checklist of exactly what to confirm** — e.g. "click a checklist step → should toggle green," "type in notes → spinner appears for ~800ms, then settles back to the check icon," "thumbs up/down on briefing → grey out after one click." Do not say "try it and see." List the specific observable behaviors the change should produce so the user can match expectations to reality and report mismatches fast. A vague ask gets a vague answer; a checklist gets a useful one.

## Status reporting

Every task summary ends with this block — no exceptions:

```
---
WRITTEN TO DISK: [list every file created, modified, or deleted, including memory files]
ROADMAP.md UPDATED: [yes — what changed / no changes needed / NOT YET — must do before commit]
GIT STATUS: [untracked / modified, not staged / staged, not committed / committed on <branch> / pushed to <branch> / pushed to main / merged to main]
PR STATUS: [n/a / draft #N opened / ready #N opened / merged #N / closed without merge]
NEXT STEP: [one sentence — what needs to happen next, and who acts]
---
```

**Reporting Structure:**

- Never use the word "done" or "complete" without this block immediately following it.
- Never assume a file was written unless the Write/Edit tool ran and returned no error in this session.
- Never assume a commit happened unless `git commit` ran and returned a hash in this session.
- Never assume a push happened unless `git push` ran successfully in this session.
- Never assume a PR exists unless `gh pr create` ran or `gh pr view` confirmed it in this session.
- If asked "is this on GitHub?" — yes only if push ran successfully in this session, or `gh` confirmed it.
- If the session was interrupted or a date-change system reminder fired, run `git status` and `gh pr list` before reporting state.

## Definition of done

A task is "done" only when its Status Reporting block can honestly say:

- **WRITTEN TO DISK:** the files exist
- **GIT STATUS:** committed and pushed (on a branch, or merged to `main`)
- **PR STATUS:** ready and merged, OR direct-to-main pushed
- **NEXT STEP:** clean handoff with no outstanding work for this task

Tasks with unverified code, unmerged WIP, or pending human review are **in progress**, not done. Do not claim a task is done while flagging "verification later" — if verification is the remaining step, the task is still in progress and the NEXT STEP line says so explicitly.

## Git commit practices

**One logical change per commit.** Each commit should be a coherent unit you could describe in one sentence. If two changes need two sentences in the commit message, they belong in two commits. Size is a weak signal — a 500-line refactor that does one thing is fine; a 50-line commit that mixes a bug fix and an unrelated rename is two commits. `git bisect` finds the commit that introduced a bug — mixed commits hide the cause. A surgical revert undoes one change without losing unrelated work — bundled commits force all-or-nothing. `git log` should explain what happened, not list "various updates."

**Never commit without explicit approval.** Same approval rule as feature scope (see Working style). "Sounds good" is not approval. "Commit it" or "push to main" is.

**Update ROADMAP.md before committing** when the work resolves a roadmap task, completes verification, or makes a non-obvious architectural decision. The Status Reporting block's `ROADMAP.md UPDATED` line catches this — answer that line honestly before committing.

**Voice.** Commit messages get a slightly warmer tone than neutral but keep subject lines terse and searchable. PR bodies get full personality — informal voice, jokes, emoji-led headers (🚧 🗂️ ✅), small ASCII diagrams where they help. Keep CLAUDE.md, the decision log, and code comments neutral so they read consistently across sessions.

## Layer map

```
config/property.json            ← property name, cleaner name, min stay (iCal URL lives in ICAL_URL env)
config/briefing-rules.json      ← what to include, flag thresholds, tone
src/config/                     ← typed loaders that read + validate config/*.json
src/engine/calendar.ts          ← parse iCal feed into bookings (pure)
src/engine/gaps.ts              ← compute open gaps between bookings (pure)
src/engine/briefing.ts          ← buildPrompt from config + state (pure)
src/api/claude.ts               ← Claude API call, isolated
src/api/gcal.ts                 ← Google Calendar fetch, isolated
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
