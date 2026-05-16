import rawConfig from "../../config/briefing-rules.json";

export type BriefingRules = {
  /** When true, the briefing mentions today's checkouts and check-ins. */
  includeTurnovers: boolean;
  /** When true, the briefing surfaces unbookable gaps in the 4-week window. */
  includeGaps: boolean;
  /** Briefing-level emphasis threshold — gaps shorter than this get extra weight in prose. Independent of property.json `minStay` so prose tuning is separable from the gaps-table flag. */
  gapFlagThreshold: number;
  /** Tone hint passed into the prompt. Suggested: "direct", "warm", "terse". */
  tone: string;
  /** Free-form rules appended to the prompt as bullets. Use for property-specific exceptions. */
  customRules: string[];
};

const DEFAULTS: BriefingRules = {
  includeTurnovers: true,
  includeGaps: true,
  gapFlagThreshold: 3,
  tone: "direct",
  customRules: [],
};

// Per-field fallback to defaults on invalid input. Asymmetric with
// src/config/property.ts (which throws on bad data) by design: a bad
// property.json means we can't identify the property at all — bail loudly.
// A bad briefing-rules.json means tuning knobs are wrong — the briefing still
// generates with sensible defaults, the user sees odd output, edits the
// rules file, and re-tries. See ROADMAP decision log 2026-05-16.
function validate(raw: unknown): BriefingRules {
  if (!raw || typeof raw !== "object") {
    console.error("config/briefing-rules.json: must be a JSON object — using all defaults");
    return { ...DEFAULTS };
  }
  const c = raw as Record<string, unknown>;
  const result: BriefingRules = { ...DEFAULTS };

  if (typeof c.includeTurnovers === "boolean") {
    result.includeTurnovers = c.includeTurnovers;
  } else if (c.includeTurnovers !== undefined) {
    console.error(
      `config/briefing-rules.json: includeTurnovers must be boolean — using default ${DEFAULTS.includeTurnovers}`,
    );
  }

  if (typeof c.includeGaps === "boolean") {
    result.includeGaps = c.includeGaps;
  } else if (c.includeGaps !== undefined) {
    console.error(
      `config/briefing-rules.json: includeGaps must be boolean — using default ${DEFAULTS.includeGaps}`,
    );
  }

  if (
    typeof c.gapFlagThreshold === "number" &&
    Number.isInteger(c.gapFlagThreshold) &&
    c.gapFlagThreshold >= 1
  ) {
    result.gapFlagThreshold = c.gapFlagThreshold;
  } else if (c.gapFlagThreshold !== undefined) {
    console.error(
      `config/briefing-rules.json: gapFlagThreshold must be a positive integer — using default ${DEFAULTS.gapFlagThreshold}`,
    );
  }

  if (typeof c.tone === "string" && c.tone.trim() !== "") {
    result.tone = c.tone;
  } else if (c.tone !== undefined) {
    console.error(
      `config/briefing-rules.json: tone must be a non-empty string — using default "${DEFAULTS.tone}"`,
    );
  }

  if (Array.isArray(c.customRules) && c.customRules.every((r) => typeof r === "string")) {
    result.customRules = c.customRules as string[];
  } else if (c.customRules !== undefined) {
    console.error(
      "config/briefing-rules.json: customRules must be an array of strings — using empty array",
    );
  }

  return result;
}

export const briefingRules: BriefingRules = validate(rawConfig);
