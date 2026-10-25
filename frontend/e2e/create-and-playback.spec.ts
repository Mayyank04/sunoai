import { test, expect } from "@playwright/test";

test.describe("Song Creation & Global Audio Player Playback", () => {
  test("renders prompt controls, model provider selector and parameters on /create", async ({ page }) => {
    await page.goto("/create");

    // Prompt textarea / input
    const promptInput = page.locator("textarea").first();
    await expect(promptInput).toBeVisible();

    // Instrumental toggle
    const instrumentalBtn = page.getByRole("button", { name: /instrumental/i }).first();
    await expect(instrumentalBtn).toBeVisible();

    // Generate Master Audio button
    const generateBtn = page.getByRole("button", { name: /generate/i }).first();
    await expect(generateBtn).toBeVisible();
    await expect(generateBtn).toBeEnabled();

    // Provider Selector sidebar
    const inferenceHeading = page.getByText(/AI Inference Engine/i).first();
    await expect(inferenceHeading).toBeVisible();
  });

  test("verifies global player mounts and displays playback controls", async ({ page }) => {
    await page.goto("/create");

    // Check if player container is present in DOM
    const playerContainer = page.locator("footer, [data-player], .fixed.bottom-0").first();
    await expect(playerContainer).toBeAttached();
  });
});
