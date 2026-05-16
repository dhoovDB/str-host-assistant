import rawConfig from "../../config/property.json";

export type PropertyConfig = {
  propertyName: string;
  cleanerName: string;
  minStay: number;
};

// JSON validation runs at module load. If the config is invalid, the throw
// propagates out of the import — on Cloudflare Workers the isolate fails to
// boot, and the first request returns 500. Safe to run anywhere (server or
// client) because it only touches the imported JSON, not env.
function validate(raw: unknown): PropertyConfig {
  if (!raw || typeof raw !== "object") {
    throw new Error("config/property.json must be a JSON object");
  }
  const c = raw as Record<string, unknown>;
  if (typeof c.propertyName !== "string") {
    throw new Error("config/property.json: propertyName must be a string");
  }
  if (typeof c.cleanerName !== "string") {
    throw new Error("config/property.json: cleanerName must be a string");
  }
  let minStay = 2;
  if (c.minStay !== undefined) {
    if (typeof c.minStay !== "number" || !Number.isInteger(c.minStay) || c.minStay < 1) {
      console.error(
        `config/property.json: minStay must be a positive integer, got ${JSON.stringify(c.minStay)} — using default of 2`,
      );
    } else {
      minStay = c.minStay;
    }
  }
  return {
    propertyName: c.propertyName,
    cleanerName: c.cleanerName,
    minStay,
  };
}

// Lazy env loaders. Must be called only from server-only modules
// (src/api/*, src/db/*, src/server/*). Eager evaluation would throw on the
// client, because Vite serves this module to the browser via the route tree
// chain and process.env.* is undefined there. See CLAUDE.md "Env reads must
// be lazy" + ROADMAP decision log 2026-05-16.

export function getIcalUrl(): string {
  const url = process.env.ICAL_URL ?? "";
  if (url.trim() === "") {
    throw new Error(
      "ICAL_URL missing. Set it in .env (local) or via `wrangler secret put ICAL_URL` (production). See .env.example.",
    );
  }
  return url;
}

export function getAnthropicApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY ?? "";
  if (key.trim() === "") {
    throw new Error(
      "ANTHROPIC_API_KEY missing. Set it in .env (local) or via `wrangler secret put ANTHROPIC_API_KEY` (production). See .env.example.",
    );
  }
  return key;
}

export function getPropertyId(): string {
  const id = process.env.PROPERTY_ID ?? "";
  if (id.trim() === "") {
    throw new Error(
      "PROPERTY_ID missing. Set it in .env (local) or via `wrangler secret put PROPERTY_ID` (production). See .env.example.",
    );
  }
  return id;
}

export const propertyConfig: PropertyConfig = validate(rawConfig);
