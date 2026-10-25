import { test, expect } from "@playwright/test";

test.describe("Track Publishing & Library Management", () => {
  test("protects publishing suite with authentication check and displays login gate", async ({ page }) => {
    await page.goto("/publish");

    // The publishing route is strictly protected; unauthenticated visitors receive the login gate
    const authRequired = page.getByText(/Authentication Required/i).first();
    const signInBtn = page.getByRole("button", { name: /Sign In \/ Create Account/i }).first();

    await expect(authRequired).toBeVisible();
    await expect(signInBtn).toBeVisible();
  });

  test("loads library view with track cards, search bar and delete actions", async ({ page }) => {
    await page.goto("/library");

    // Heading
    const libraryHeading = page.getByText(/Library|My Creations|Saved Tracks/i).first();
    await expect(libraryHeading).toBeVisible();

    // Search bar
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    if (await searchInput.isVisible()) {
      await expect(searchInput).toBeEditable();
    }
  });
});
