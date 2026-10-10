import { test, expect } from "@playwright/test";

test.describe("Nutriverse Phase 1a Smoke Tests", () => {
  test("Guest can browse storefront without auto-login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Nutriverse/);

    // Verify unauthenticated state: Sign In button is present in header, not automatically Alex
    const signInBtn = page.getByRole("button", { name: /Sign In|Login/i }).first();
    await expect(signInBtn).toBeVisible();

    // Verify key sections are present
    await expect(page.getByText(/Don't Just Eat. Understand Your Nutrition/i)).toBeVisible();
    await expect(page.getByText(/Nutrition-First Grocery/i).first()).toBeVisible();
  });

  test("Guest can explore whole-food catalog on /explore", async ({ page }) => {
    await page.goto("/explore");
    await expect(page).toHaveTitle(/Food Explorer/);

    // Verify food catalog items render
    await expect(page.getByText(/Food Explorer/i).first()).toBeVisible();
    await expect(page.getByText(/Sprouted Desi Chickpeas|Organic Rolled Oats|Probiotic Greek Yoghurt/i).first()).toBeVisible();
  });

  test("Guest can view Calin Pack tiers on /packs", async ({ page }) => {
    await page.goto("/packs");
    await expect(page).toHaveTitle(/Calin Packs/);

    // Verify the three tiers exist
    await expect(page.getByText(/Basic Pack/i).first()).toBeVisible();
    await expect(page.getByText(/Minimal Plus/i).first()).toBeVisible();
    await expect(page.getByText(/Premium/i).first()).toBeVisible();
  });

  test("Public packaging QR landing /p/[barcode] works unauthenticated", async ({ page }) => {
    // Chickpeas barcode
    await page.goto("/p/8901234567890");

    // Verify packaging QR verified badge
    await expect(page.getByText(/Physical Package QR Verified/i)).toBeVisible();
    await expect(page.getByText(/Sprouted Chickpeas/i).first()).toBeVisible();
    await expect(page.getByText(/kcal/i).first()).toBeVisible();
    await expect(page.getByText(/protein/i).first()).toBeVisible();

    // Verify guest prompt is shown
    await expect(page.getByText(/Browsing as guest/i)).toBeVisible();
  });

  test("Scanner route /scanner loads camera and manual lookup", async ({ page }) => {
    await page.goto("/scanner");
    await expect(page).toHaveTitle(/Barcode Scanner/);
    await expect(page.getByText(/Instant Nutrition Scanner/i).first()).toBeVisible();
    await expect(page.getByText(/Scan Any Food Barcode or QR Code/i)).toBeVisible();
  });

  test("Sign In modal displays Dev Shortcuts and supports 1-click test login in development", async ({ page }) => {
    await page.goto("/");

    // Click Sign In button in header
    const signInBtn = page.getByRole("button", { name: /Sign In|Login/i }).first();
    await signInBtn.click();

    // Verify AuthModal is open
    await expect(page.getByText(/Sign In to Nutriverse/i)).toBeVisible();

    // Verify Dev Shortcuts box is visible because APP_ENV=development
    await expect(page.getByText(/Dev Shortcuts/i)).toBeVisible();

    // Click Alex (Customer)
    const alexBtn = page.getByRole("button", { name: /Alex/i }).first();
    await alexBtn.click();

    // Verify user is now authenticated as Alex in the header
    await expect(page.getByText("Alex").first()).toBeVisible();
  });
});
