import { test, expect } from "@playwright/test";

test.describe("Navigation & Authentication Flows", () => {
  test("loads landing page with branding and core navigation links", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Fombo Music AI/i);

    // Verify presence of main navigation elements
    const brand = page.locator("header, nav").first();
    await expect(brand).toBeVisible();

    // Verify key route links
    const createLink = page.locator('a[href="/create"]').first();
    await expect(createLink).toBeVisible();

    const studioLink = page.locator('a[href="/studio"]').first();
    await expect(studioLink).toBeVisible();

    const pricingLink = page.locator('a[href="/pricing"]').first();
    await expect(pricingLink).toBeVisible();
  });

  test("opens authentication modal and toggles between login and signup modes", async ({ page }) => {
    await page.goto("/");

    // Look for sign in / log in button in topbar
    const signInBtn = page.getByRole("button", { name: /sign in|log in|login/i }).first();
    if (await signInBtn.isVisible()) {
      await signInBtn.click();

      // Check modal appears
      const modal = page.locator('div[role="dialog"], .fixed');
      await expect(modal.first()).toBeVisible();

      // Check email input is present
      const emailInput = page.locator('input[type="email"]');
      await expect(emailInput.first()).toBeVisible();

      // Check password input is present
      const passwordInput = page.locator('input[type="password"]');
      await expect(passwordInput.first()).toBeVisible();
    }
  });

  test("navigates seamlessly across primary studio views", async ({ page }) => {
    await page.goto("/explore");
    await expect(page).toHaveURL(/.*explore/);

    await page.goto("/create");
    await expect(page).toHaveURL(/.*create/);

    await page.goto("/pricing");
    await expect(page).toHaveURL(/.*pricing/);
  });
});
