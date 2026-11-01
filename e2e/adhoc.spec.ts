import { test, expect } from "@playwright/test";

// The ad hoc card against DEMO_MODE fixtures (src/demo/fixtures.ts): three Airbnb
// stays plus one ad hoc stay. Asserts the card's distinguishing marks and that
// its checklist is wired up like any other card's.
test("ad hoc stay renders as a tagged card with no Airbnb link", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Ad hoc", { exact: true })).toHaveCount(1);
  await expect(page.getByText("4 nights · Jun 4 → Jun 8")).toBeVisible();

  // Four cards, but only the three Airbnb stays link out.
  await expect(page.getByRole("button", { name: "Notified" })).toHaveCount(4);
  await expect(page.getByRole("link", { name: "View on Airbnb" })).toHaveCount(3);

  // The fourth card's "Confirmed" step starts incomplete. Poll the click for the
  // same reason as hydration.spec.ts: it can land before React attaches.
  const confirmed = page.getByRole("button", { name: "Confirmed" }).nth(3);
  const icon = confirmed.locator("i");
  await expect(icon).toHaveClass(/ti-circle/);
  await expect(async () => {
    await confirmed.click();
    await expect(icon).toHaveClass(/ti-check/, { timeout: 1000 });
  }).toPass({ timeout: 15000 });
});
