# config/ — non-secret configuration

Property identity and behavior knobs that change without code edits. All files here are committed to git. Credentials (iCal URL, Supabase keys, Anthropic API key) live in `.env` instead — see `.env.example`.

## property.json

Property identity. Read on server startup; validation **throws** on misconfig (see `src/config/property.ts`).

| Field | Type | Required | Used by |
|-------|------|----------|---------|
| `propertyName` | string | yes | dashboard header (future), briefing text |
| `cleanerName` | string | yes | briefing's cleaner-coordination mentions |
| `minStay` | int ≥ 1 | optional — defaults to `2` | gaps engine flag threshold |

The Airbnb iCal URL is a credential and lives in the `ICAL_URL` env var, not here. ROADMAP decision log 2026-05-16 explains the why.

## briefing-rules.json

Knobs for how the daily Claude briefing is assembled. Read on server startup; per-field fallback to defaults if invalid — no startup throw, because the briefing should still generate even if you typo a field. See `src/config/briefing-rules.ts`.

| Field | Type | Default | What it does |
|-------|------|---------|--------------|
| `includeTurnovers` | bool | `true` | Briefing mentions today's checkouts / check-ins |
| `includeGaps` | bool | `true` | Briefing lists unbookable gaps in the 4-week window |
| `gapFlagThreshold` | int ≥ 1 | `3` | Briefing-level emphasis threshold; gaps shorter than N nights get extra weight in prose. Independent of property.json `minStay` so prose tuning is separable from the gaps-table flag |
| `tone` | string | `"direct"` | One word, injected as a tone hint in the prompt. Suggested: `direct`, `warm`, `terse` |
| `customRules` | string[] | `[]` | Free-form rules appended to the prompt as bullets. Property-specific exceptions Claude can't infer from the data |

### When the briefing feels wrong

The robotics control loop applied to prose: don't edit the engine, edit the rules.

1. Thumbs-down the bad briefing on the dashboard.
2. After ~2 weeks of votes, query `briefing_feedback` for unhelpful entries.
3. Look at the matching `briefings.context` to see what data Claude saw that day.
4. Adjust this file — raise/lower thresholds, add a `customRules` entry, change tone.
5. Refresh the dashboard; Claude regenerates with the new rules.

The briefing only improves if you actually thumbs-down what's wrong.

### Example `customRules` entries

```json
"customRules": [
  "Flag if cleaner not confirmed within 48 hours of check-in",
  "Mention open maintenance items if any exist",
  "Highlight when a gap of exactly 2 nights appears — those are the most painful losses at our minStay 3",
  "If two same-day turnovers fall in the same week, surface that as a workload warning"
]
```

The cleaner-confirmation rule depends on Supabase checklist state, which goes live in Task 9. The maintenance rule depends on the inventory/maintenance tracker, which is v2/v3 work. Both are listed here as examples of the shape; only add them when the underlying data exists.
