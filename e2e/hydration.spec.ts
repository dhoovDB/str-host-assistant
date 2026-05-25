import { test, expect } from "@playwright/test";

// Guards the hydration failure mode from ROADMAP decision log 2026-05-16: SSR
// rendered the page fine, but client hydration silently failed, so clicking a
// checklist step did nothing. tsc, the dev server, and SSR all reported clean —
// it was caught only when a human clicked a checkbox and nothing happened.
//
// The toggle is a client-side optimistic update (Index.updateChecklist in
// src/routes/index.tsx), so it fires independently of persistence — in
// DEMO_MODE the write is a no-op but the UI still flips.
//
// Runs against DEMO_MODE fixtures (src/demo/fixtures.ts): the third booking
// ("demo-upcoming") ships an all-empty checklist, so its "Notified" step starts
// incomplete (ti-circle) and a click flips it complete (ti-check).
test("checklist step toggles after hydration", async ({ page }) => {
  await page.goto("/");

  // The third card's first cleaner step. Three cards render in fixture order
  // (active, turnaround, upcoming); nth(2) is the empty-checklist upcoming one.
  const notified = page.getByRole("button", { name: "Notified" }).nth(2);
  const icon = notified.locator("i");

  // SSR baseline: the server rendered this step incomplete.
  await expect(icon).toHaveClass(/ti-circle/);

  // The hydration proof. The button is in the SSR HTML immediately, so a single
  // click can land before React attaches the handler — that race would flake.
  // Poll instead: while unhydrated the click is a harmless no-op (icon stays
  // ti-circle, safe to retry); the first click that registers flips it to
  // ti-check and we stop. If hydration never attaches the handler (the
  // 2026-05-16 failure), every click stays a no-op and this times out — red.
  await expect(async () => {
    await notified.click();
    await expect(icon).toHaveClass(/ti-check/, { timeout: 1000 });
  }).toPass({ timeout: 15000 });
});
