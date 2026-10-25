import { test, expect } from "@playwright/test";

test.describe("Pricing, Multi-Gateway Payments & Entitlements", () => {
  test("displays subscription tier cards, feature comparison, and dual payment gateway selector", async ({ page }) => {
    await page.goto("/pricing");

    // Main headline
    const heading = page.getByText(/Creator Plans|Transparent Pricing|Supercharge/i).first();
    await expect(heading).toBeVisible();

    // Verify Free, Pro and Studio tiers are shown
    const freeTier = page.getByText(/Free Creator|Free/i).first();
    await expect(freeTier).toBeVisible();

    const proTier = page.getByText(/Pro Producer/i).first();
    await expect(proTier).toBeVisible();

    const studioTier = page.getByText(/Studio Master/i).first();
    await expect(studioTier).toBeVisible();

    // Dual gateway selector (Stripe USD vs Razorpay INR)
    const stripeToggle = page.getByRole("button", { name: /stripe|usd/i }).first();
    const razorpayToggle = page.getByRole("button", { name: /razorpay|inr/i }).first();
    await expect(stripeToggle).toBeVisible();
    await expect(razorpayToggle).toBeVisible();

    // Verify statutory disclaimer on commercial rights
    const statutoryNotice = page.getByText(/Commercial Rights.*Disclosure/i).first();
    await expect(statutoryNotice).toBeVisible();
  });
});
