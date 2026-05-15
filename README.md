# str-assistant-dashboard

A daily-briefing dashboard for self-managed short-term rental hosts. One URL per property, one question answered: what needs my attention today?

## What it does

Pulls 4 weeks of upcoming bookings from a Google Calendar iCal feed, computes unbookable gaps against PriceLabs min-stay rules, generates a daily briefing via the Claude API, and tracks cleaner coordination per booking. Built to be shared — host and co-host hit the same secret URL and see the same state across devices.

## Current state

v1 in progress. See [ROADMAP.md](./ROADMAP.md) for the full task list and current task.

## How development is run

This project is built under the **4D framework**: Delegation, Description, Discernment, Diligence. In practice the framework shows up in three places in the repo:

- [CLAUDE.md](./CLAUDE.md) — architectural rules that any change has to respect: config-as-data, pure engine functions, isolated I/O at the boundaries, styling conventions, and a working-style rule for AI-assisted edits.
- [ROADMAP.md](./ROADMAP.md) — task list with explicit prerequisites and a **Decision log** section that records architectural choices when they resolve a real fork in the road (not as routine documentation).
- A `/dailytask` skill in my Claude Code setup operationalizes Discernment and Diligence — selecting the next task given priorities and prerequisites, then executing it with quality controls.

## Architecture

Config-driven engine, pure functions, I/O isolated at the boundaries. See [CLAUDE.md](./CLAUDE.md) for the full contract.

```
config/property.json            ← property name, cleaner name, iCal URL
config/briefing-rules.json      ← briefing behavior (thresholds, tone)
src/config/                     ← typed loaders that validate config/*.json
src/engine/                     ← pure functions: parse calendar, compute gaps, build prompt
src/api/                        ← external API calls (Claude, Google Calendar, PriceLabs)
src/db/supabase.ts              ← reads/writes for checklists, briefings, feedback
src/server/                     ← server-side routes
src/client/                     ← React components (inline styles + CSS variables, no CSS framework)
```

Stack: TanStack Start (React + SSR on Cloudflare Workers), Supabase (Postgres + RLS), Vite, TypeScript end-to-end.

## Local setup

1. Clone and install:
   ```
   git clone https://github.com/dhoovDB/str-assistant-dashboard
   cd str-assistant-dashboard
   npm install
   ```
2. Create a Supabase project, then run the schema SQL from [ROADMAP Task 2](./ROADMAP.md#task-2-supabase-and-property-config-setup-1-hour).
3. Copy `.env.example` to `.env` and fill in `SUPABASE_URL`, `SUPABASE_KEY`, and a `PROPERTY_ID` (UUID).
4. Copy `config/property.example.json` to `config/property.json`, then edit it with your property name, cleaner name, and Google Calendar iCal feed URL. (`config/property.json` is gitignored — your real values stay local.)
5. `npm run dev` — the config validator refuses to start if `config/property.json` is invalid.
