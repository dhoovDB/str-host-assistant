-- Handy Supabase queries for the STR Host Assistant.
--
-- Run these in the Supabase SQL editor (admin / service role, so they bypass
-- the permissive RLS the app uses). The primary use is the briefing feedback
-- review loop — the manual "sense" step described in CLAUDE.md and the ROADMAP
-- "live v1 briefing tuning" section: find downvoted briefings, read the note +
-- the context the AI actually saw, spot a pattern, then edit
-- config/briefing-rules.json.
--
-- Tables:
--   briefings          id, property_id, text, context (jsonb), created_at
--   briefing_feedback  id, briefing_id (fk → briefings), helpful, submitted_at, note
--
-- `context` is the snapshot captured at generation time: { bookings, gaps,
-- rules }. It is the ground truth for "what did the model see vs. what did it
-- say" — diagnose mislabels from here before assuming the engine is wrong.


-- 1. All non-positive feedback, newest first.
--    `is not true` catches both explicit downvotes (false) and any null.
select id, briefing_id, helpful, submitted_at, note
from briefing_feedback
where helpful is not true
order by submitted_at desc;


-- 2. The briefings behind that feedback, with the context the AI saw.
--    Use this to compare the stored text against the bookings/gaps/rules in
--    `context` for every briefing that got a thumbs-down.
select id, text, created_at, context
from briefings
where id in (
    select distinct briefing_id
    from briefing_feedback
    where helpful is not true
);


-- 3. Full feedback review in one row per vote: the note next to the briefing
--    text and the context (bookings + gaps + rules snapshot) that produced it.
select
    f.submitted_at,
    f.helpful,
    f.note,
    b.id as briefing_id,
    b.created_at,
    b.text,
    b.context
from briefing_feedback f
join briefings b on b.id = f.briefing_id
where f.helpful is not true
order by f.submitted_at desc;


-- 4. Feedback tally — gauge whether there is enough volume to tune on yet.
select
    count(*) filter (where helpful is true)     as helpful,
    count(*) filter (where helpful is not true) as not_helpful,
    count(*)                                     as total
from briefing_feedback;


-- 5. Recent briefings — spot-check what the dashboard has been saying.
select id, created_at, text
from briefings
order by created_at desc
limit 20;


-- 6. Briefings whose text mentions the same-day / turnover language — spot-check
--    the mislabel class addressed by the 2026-06-28 briefing-rules guardrail.
select id, created_at, text
from briefings
where text ilike '%same-day%'
   or text ilike '%turnover%'
   or text ilike '%turnaround%'
order by created_at desc;
