import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey } from "../config/property";

// Server-only — never import from client code paths. The lazy key read keeps
// this module safe to be in the bundler's module graph (per CLAUDE.md "Env
// reads must be lazy"); the SDK client itself is also lazy so a module-load
// import doesn't construct it.

let cachedClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!cachedClient) {
    cachedClient = new Anthropic({ apiKey: getAnthropicApiKey() });
  }
  return cachedClient;
}

// One Claude call per briefing. Defaults match the project's profile:
//   - claude-opus-4-7: highest-quality model; ~$0.006 per briefing at this prompt size
//   - adaptive thinking + effort "medium": the briefing is short summarization,
//     not deep reasoning — adaptive lets the model decide if any thinking is
//     warranted; medium effort keeps it from over-deliberating
//   - max_tokens 2048: comfortably above a 2-3 sentence briefing while leaving
//     room for adaptive thinking tokens
export async function generateBriefing(prompt: string): Promise<string> {
  const client = getClient();
  const response = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 2048,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    messages: [{ role: "user", content: prompt }],
  });

  const textParts: string[] = [];
  for (const block of response.content) {
    if (block.type === "text") textParts.push(block.text);
  }
  if (textParts.length === 0) {
    throw new Error("Claude returned no text content");
  }
  return textParts.join("\n").trim();
}
