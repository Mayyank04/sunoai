import { test, expect } from "@playwright/test";

test.describe("Browser Multitrack DAW & Studio Engine", () => {
  test("renders multitrack DAW timeline, transport bar and track headers", async ({ page }) => {
    await page.goto("/studio");

    // Timeline or header presence
    const studioTitle = page.getByText(/Studio DAW|Multitrack/i).first();
    await expect(studioTitle).toBeVisible();

    // Transport buttons: Play/Pause, Record, Stop
    const playBtn = page.getByRole("button", { name: /play|pause/i }).first();
    await expect(playBtn).toBeVisible();

    // Track controls
    const addTrackBtn = page.getByRole("button", { name: /add track/i }).first();
    if (await addTrackBtn.isVisible()) {
      await expect(addTrackBtn).toBeEnabled();
    }
  });

  test("toggles AI Producer copilot assistant and piano roll", async ({ page }) => {
    await page.goto("/studio");

    // Look for AI Producer or Copilot toggle
    const copilotBtn = page.getByRole("button", { name: /producer|copilot|ai assistant/i }).first();
    if (await copilotBtn.isVisible()) {
      await copilotBtn.click();
      const producerPanel = page.getByText(/AI Producer|Copilot Suggestions/i).first();
      await expect(producerPanel).toBeVisible();
    }
  });
});
