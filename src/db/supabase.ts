import { createClient } from "@supabase/supabase-js";
import type { ChecklistKey } from "../client/types";

// Local dev reads from process.env (vite injects from .env at build time).
// Cloudflare Workers production: secrets come from the env binding passed to the
// fetch handler, NOT process.env — wiring deferred to Task 10 / first deploy.
// See ROADMAP decision log 2026-05-11.
const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_KEY ?? "";

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Supabase credentials missing. Set SUPABASE_URL and SUPABASE_KEY in .env (see .env.example).",
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Row types match the SQL schema. Kept in sync by hand — small enough that codegen
// (supabase gen types) is overkill for v1. Revisit if schema gets complex.
export type ChecklistRow = {
  property_id: string;
  booking_id: string;
  step: ChecklistKey;
  completed: boolean;
};

export type BriefingRow = {
  id: string;
  property_id: string;
  date: string;
  text: string;
  context: unknown;
  created_at: string;
};

export type BriefingFeedbackRow = {
  id: string;
  briefing_id: string;
  helpful: boolean;
  submitted_at: string;
};

// --- checklist_state -------------------------------------------------------

// Read all checklist rows for one booking and project them into the UI's state shape.
// Any step not present in the rows defaults to false — a missing row means "not done."
export async function getChecklistState(
  propertyId: string,
  bookingId: string,
): Promise<Record<ChecklistKey, boolean>> {
  const { data, error } = await supabase
    .from("checklist_state")
    .select("step, completed")
    .eq("property_id", propertyId)
    .eq("booking_id", bookingId);
  if (error) throw error;
  return reduceChecklistRows(data ?? []);
}

// Full-state upsert (see ROADMAP decision log 2026-05-11). One click in the UI can
// flip 4 steps via cascade logic, so we upsert all 7 step rows in one call.
export async function upsertChecklist(
  propertyId: string,
  bookingId: string,
  state: Record<ChecklistKey, boolean>,
): Promise<void> {
  const rows = Object.entries(state).map(([step, completed]) => ({
    property_id: propertyId,
    booking_id: bookingId,
    step,
    completed,
  }));
  const { error } = await supabase
    .from("checklist_state")
    .upsert(rows, { onConflict: "property_id,booking_id,step" });
  if (error) throw error;
}

function reduceChecklistRows(
  rows: Array<{ step: string; completed: boolean }>,
): Record<ChecklistKey, boolean> {
  const out: Record<ChecklistKey, boolean> = {
    notified: false,
    confirmed: false,
    reminder: false,
    ready: false,
    checkedIn: false,
    checkedOut: false,
    reviewed: false,
  };
  for (const r of rows) {
    if (r.step in out) out[r.step as ChecklistKey] = r.completed;
  }
  return out;
}

// --- briefings -------------------------------------------------------------

export async function createBriefing(input: {
  propertyId: string;
  date: string;
  text: string;
  context: unknown;
}): Promise<string> {
  const { data, error } = await supabase
    .from("briefings")
    .insert({
      property_id: input.propertyId,
      date: input.date,
      text: input.text,
      context: input.context,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

// Look up an existing briefing for a specific date — used by the daily-cache
// pattern in the route loader so we don't burn a Claude API call per page load.
export async function getBriefingByDate(
  propertyId: string,
  date: string,
): Promise<BriefingRow | null> {
  const { data, error } = await supabase
    .from("briefings")
    .select("*")
    .eq("property_id", propertyId)
    .eq("date", date)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getRecentBriefings(
  propertyId: string,
  limit = 30,
): Promise<BriefingRow[]> {
  const { data, error } = await supabase
    .from("briefings")
    .select("*")
    .eq("property_id", propertyId)
    .order("date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

// --- briefing_feedback -----------------------------------------------------

export async function recordFeedback(briefingId: string, helpful: boolean): Promise<void> {
  const { error } = await supabase
    .from("briefing_feedback")
    .insert({ briefing_id: briefingId, helpful });
  if (error) throw error;
}

// The 2-week review query: returns briefings that received a thumbs-down vote.
// Output drives the human-in-the-loop tuning of briefing-rules.json (Task 6 / 7).
export async function getUnhelpfulBriefings(propertyId: string): Promise<BriefingRow[]> {
  const { data, error } = await supabase
    .from("briefings")
    .select("*, briefing_feedback!inner(helpful)")
    .eq("property_id", propertyId)
    .eq("briefing_feedback.helpful", false);
  if (error) throw error;
  return data ?? [];
}
