-- str-assistant-dashboard — Supabase schema for v1
--
-- Run this once in the Supabase SQL editor after creating your project.
-- All four tables are required:
--   - checklist_state, briefings, briefing_feedback are specced in
--     ROADMAP Task 2 (the briefing + cleaner-coordination loop).
--   - booking_notes was added in Task 9 for the per-booking notes textarea.
--
-- Security model: permissive RLS (the anon role can read/write everything).
-- The "secret" is the dashboard URL itself, not row-level scoping. See
-- ROADMAP decision log 2026-05-11 for the rationale. Revisit if v2 adds
-- multi-property routing with shared deployments or user auth.

create table if not exists checklist_state (
  property_id text not null,
  booking_id text not null,
  step text not null check (step in (
    'notified', 'confirmed', 'reminder', 'ready',
    'checkedIn', 'checkedOut', 'reviewed'
  )),
  completed boolean not null default false,
  primary key (property_id, booking_id, step)
);

create table if not exists briefings (
  id uuid primary key default gen_random_uuid(),
  property_id text not null,
  date date not null,
  text text not null,
  context jsonb,
  created_at timestamptz not null default now()
);

create table if not exists briefing_feedback (
  id uuid primary key default gen_random_uuid(),
  briefing_id uuid not null references briefings(id) on delete cascade,
  helpful boolean not null,
  submitted_at timestamptz not null default now()
);

create table if not exists booking_notes (
  property_id text not null,
  booking_id text not null,
  notes text not null default '',
  updated_at timestamptz not null default now(),
  primary key (property_id, booking_id)
);

-- RLS: permissive. The anon key can read/write everything. URL secrecy +
-- hard-to-guess property IDs are the security boundary, not table scoping.
alter table checklist_state enable row level security;
alter table briefings enable row level security;
alter table briefing_feedback enable row level security;
alter table booking_notes enable row level security;

-- Note: re-running this file will error on the create-policy lines below
-- because Postgres has no idempotent "create policy if not exists." Either
-- drop the policies first or skip the script after initial setup.
create policy "anon all" on checklist_state for all using (true);
create policy "anon all" on briefings for all using (true);
create policy "anon all" on briefing_feedback for all using (true);
create policy "anon all" on booking_notes for all using (true);
