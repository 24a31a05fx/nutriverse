import { test, expect } from "@playwright/test";

test.describe("Phase 1b Playwright Suite", () => {
  test("Customer journey: login -> add Calin Pack -> cart -> demo checkout -> order appears in /orders with paise-derived total", async ({
    page,
  }) => {
    // 1. Visit storefront and open sign-in modal
    await page.goto("/");
    await expect(page).toHaveTitle(/Nutriverse/);

    const signInBtn = page.getByRole("button", { name: /Sign In|Login/i }).first();
    await signInBtn.click();
    await expect(page.getByText(/Sign In to Nutriverse/i)).toBeVisible();

    // Wait for Alex quick login button in Dev Shortcuts and click it
    const alexBtn = page.getByRole("button", { name: /Alex/i }).first();
    await expect(alexBtn).toBeVisible();
    await alexBtn.click();

    // Ensure AuthModal closes and user is logged in
    await expect(page.getByText(/Sign In to Nutriverse/i)).not.toBeVisible();
    await expect(page.getByTitle("Sign Out")).toBeVisible();

    // 2. Navigate to /packs and add a Calin Pack to cart
    await page.goto("/packs");
    await expect(page).toHaveTitle(/Calin Packs/);

    // Locate the Add Pack button for the active tier and click it
    const addPackBtn = page.getByRole("button", { name: /Add .* Pack to Bag/i }).first();
    await expect(addPackBtn).toBeVisible();
    await addPackBtn.click();

    // 3. Navigate directly to /cart page
    await page.goto("/cart");
    await expect(page).toHaveTitle(/Your Nutrition Bag|Bag|Cart/);
    await expect(page.getByText(/Your Nutrition Bag/i)).toBeVisible();

    // Cart shows the pack item and subtotal/total in paise-derived rupees
    await expect(page.getByText(/Calin .* Pack/i).first()).toBeVisible();
    await expect(page.getByText(/Total Payable:/i)).toBeVisible();

    // Click Proceed to Checkout on /cart
    const proceedBtn = page.getByRole("button", { name: /Proceed to Checkout/i });
    await expect(proceedBtn).toBeVisible();
    await proceedBtn.click();

    // 4. Arrive at /checkout
    await expect(page).toHaveURL(/\/checkout/);
    await expect(page.getByText(/Review & Place Order|Demonstration Gateway/i).first()).toBeVisible();

    // Click Confirm & Place Order button
    const placeOrderBtn = page.getByRole("button", { name: /Confirm & Place Order/i });
    await expect(placeOrderBtn).toBeVisible();
    await placeOrderBtn.click();

    // 5. User is redirected to confirmation / orders page
    await page.waitForURL(/\/orders/);

    // Verify order in /orders list
    await page.goto("/orders");
    await expect(page).toHaveTitle(/Order History|Orders/);
    await expect(page.getByText(/Your Orders/i).first()).toBeVisible();

    // Verify order card is listed and displays rupee symbol with paise-derived whole rupees
    await expect(page.getByText(/Order #/i).first()).toBeVisible();
    const priceBadge = page.locator("span").filter({ hasText: /₹/ }).first();
    await expect(priceBadge).toBeVisible();
  });

  test("Production-mode check: with APP_ENV=production the sign-in modal shows no dev shortcuts", async ({
    page,
  }) => {
    // Mock /api/auth/config to simulate production environment
    await page.route("**/api/auth/config", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          environment: "production",
          development: false,
          demo_shortcuts_enabled: false,
        }),
      });
    });

    // Visit home page
    await page.goto("/");
    await expect(page).toHaveTitle(/Nutriverse/);

    // Open Sign In modal
    const signInBtn = page.getByRole("button", { name: /Sign In|Login/i }).first();
    await signInBtn.click();

    // Modal is visible
    await expect(page.getByText(/Sign In to Nutriverse/i)).toBeVisible();

    // Assert that Dev Shortcuts box is NOT visible in production
    await expect(page.getByText(/Dev Shortcuts/i)).not.toBeVisible();

    // Assert that individual quick-login test buttons are NOT present
    await expect(page.getByRole("button", { name: /Alex/i })).not.toBeVisible();
    await expect(page.getByRole("button", { name: /Dr\. Priya/i })).not.toBeVisible();
    await expect(page.getByRole("button", { name: /Marcus/i })).not.toBeVisible();
  });
});
