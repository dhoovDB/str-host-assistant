import type { Booking, ChecklistKey } from "../client/types";
import type { BookingGap } from "./gaps";
import type { BriefingRules } from "../config/briefing-rules";

// Pure: assemble the prompt sent to Claude for the daily briefing.
//
// The prompt is the single point of leverage between "the data we have" and
// "what Claude says." Tuning happens in two places:
//   - Structural changes (what data to include, formatting) live here.
//   - Behavioral changes (tone, custom rules) live in config/briefing-rules.json
//     and flow in via the `rules` argument.
//
// When a briefing feels wrong, the feedback loop (thumbs-down → review
// briefing_feedback after 2 weeks → adjust rules) is the intended fix path.
// Edit this engine only when the data the briefing CAN see is wrong.
//
// Test cases (inline per ROADMAP — promote to real tests in v2):
//   - Empty bookings + empty gaps → still produces a coherent prompt
//   - rules.includeTurnovers=false → booking section omitted
//   - rules.includeGaps=false → gap section omitted
//   - rules.gapFlagThreshold=2, gap with nights=1 → "[PROMPT EMPHASIS]" present
//   - rules.customRules with 3 entries → all 3 appear under "Custom rules"
//   - Booking with sameDayTurnaround=true → mentioned in booking line

export type BuildPromptInput = {
  bookings: Booking[];
  gaps: BookingGap[];
  /** Per-booking checklist state. Empty record means "no data yet" (Task 9 wires this from Supabase). */
  checklistState: Record<string, Record<ChecklistKey, boolean>>;
  rules: BriefingRules;
  propertyName: string;
  cleanerName: string;
  minStay: number;
  /** ISO date string, e.g. "2026-05-16". */
  today: string;
};

export function buildPrompt(input: BuildPromptInput): string {
  const { bookings, gaps, checklistState, rules, propertyName, cleanerName, minStay, today } = input;
  const lines: string[] = [];

  lines.push("You are a daily briefing assistant for a short-term rental host.");
  lines.push("");
  lines.push(`Today is ${today}.`);
  lines.push(`Property: ${propertyName}`);
  lines.push(`Cleaner: ${cleanerName}`);
  lines.push(`Minimum stay: ${minStay} nights`);
  lines.push("");

  if (rules.includeTurnovers) {
    if (bookings.length === 0) {
      lines.push("Bookings in the 4-week window: none.");
    } else {
      lines.push(`Bookings in the 4-week window (${bookings.length} total):`);
      for (const b of bookings) {
        const sameDayNote = b.sameDayTurnaround ? ", same-day arrival (previous guest leaves the same day)" : "";
        lines.push(`- ${b.checkIn} → ${b.checkOut}, ${b.nights} nights, status ${b.status}${sameDayNote}`);
      }
    }
    lines.push("");
  }

  if (rules.includeGaps) {
    if (gaps.length === 0) {
      lines.push("Unbookable gaps in window: none.");
    } else {
      lines.push("Unbookable gaps in window:");
      for (const g of gaps) {
        const emphasis = g.nights < rules.gapFlagThreshold ? " [BRIEFING EMPHASIS — call this out]" : "";
        const flag = g.flagged ? " (below min stay)" : "";
        const nightWord = g.nights === 1 ? "night" : "nights";
        lines.push(`- ${g.startDate}–${g.endDate}, ${g.nights} ${nightWord}${flag}${emphasis}`);
      }
    }
    lines.push("");
  }

  const checklistIds = Object.keys(checklistState);
  if (checklistIds.length > 0) {
    lines.push("Checklist progress (per booking):");
    for (const id of checklistIds) {
      const state = checklistState[id];
      const completed = (Object.entries(state) as [ChecklistKey, boolean][])
        .filter(([, done]) => done)
        .map(([step]) => step)
        .join(", ") || "none";
      lines.push(`- ${id}: ${completed}`);
    }
    lines.push("");
  }

  lines.push(`Tone: ${rules.tone}`);

  if (rules.customRules.length > 0) {
    lines.push("");
    lines.push("Custom rules to follow:");
    for (const r of rules.customRules) {
      lines.push(`- ${r}`);
    }
  }

  lines.push("");
  lines.push("Task: write a 2-3 sentence daily briefing for the host. Focus on what needs ACTION today.");
  lines.push("Skip restating dates and stats that are already visible on the dashboard.");
  lines.push("Be concrete and direct. Do not start with 'Here is your briefing' or similar preamble.");

  return lines.join("\n");
}
