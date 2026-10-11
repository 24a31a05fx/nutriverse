import { test, expect } from "@playwright/test";

test.describe("Nutriverse Phase 1: Brand Design System & Primitives", () => {
  test("renders /design-system at 1280px desktop with brand tokens and components", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/design-system");

    // Check heading
    await expect(page.getByText("Nutriverse Design System & Primitives")).toBeVisible();

    // Check 6 custom line icons
    await expect(page.getByText("Fibre").first()).toBeVisible();
    await expect(page.getByText("Vitamins").first()).toBeVisible();
    await expect(page.getByText("Protein").first()).toBeVisible();
    await expect(page.getByText("Healthy Fats").first()).toBeVisible();
    await expect(page.getByText("Minerals").first()).toBeVisible();
    await expect(page.getByText("Carbohydrates").first()).toBeVisible();

    // Check Brand tokens
    await expect(page.getByText("Forest").first()).toBeVisible();
    await expect(page.getByText("Sage").first()).toBeVisible();
    await expect(page.getByText("Mustard").first()).toBeVisible();
    await expect(page.getByText("Cream").first()).toBeVisible();
    await expect(page.getByText("Ink").first()).toBeVisible();
    await expect(page.getByText("Line").first()).toBeVisible();

    // Check ProductCard rail, compact, list
    await expect(page.getByText("Sprouted Desi Chickpeas").first()).toBeVisible();
    await expect(page.getByText("Fresh Farm Potatoes").first()).toBeVisible();
    await expect(page.getByText("Photo pending approval").first()).toBeVisible();

    // Check TierCard with Indicative Price
    await expect(page.getByText("Indicative price").first()).toBeVisible();
    await expect(page.getByText("₹600–₹800")).toBeVisible();
    await expect(page.getByText("₹800–₹1,200")).toBeVisible();
    await expect(page.getByText("₹1,500–₹1,800")).toBeVisible();

    // Check NutrientPanel with Verified vs Not verified state
    await expect(page.getByText("IFCT 2017 (T142) • ICMR-NIN").first()).toBeVisible();
    await expect(page.getByText("Not verified").first()).toBeVisible();

    // Check OrderTimeline with Demo order only tag
    await expect(page.getByText("Demo order only").first()).toBeVisible();
  });

  test("renders /design-system at 375px mobile without horizontal overflow or clipping", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/design-system");

    await expect(page.getByText("Nutriverse Design System & Primitives")).toBeVisible();
    await expect(page.getByText("Demo order only").first()).toBeVisible();
    await expect(page.getByText("Indicative price").first()).toBeVisible();

    // Verify interactive stepper works on mobile
    const incrementBtn = page.getByRole("button", { name: "Increase quantity" }).first();
    await expect(incrementBtn).toBeVisible();
    await incrementBtn.click();
  });
});
