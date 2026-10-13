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
    await expect(page.getByText(/Sprouted (?:Desi )?Chickpeas|Organic Rolled Oats|Probiotic Greek Yoghurt/i).first()).toBeVisible();
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

  test("Real user registration, logout, and credential login flow", async ({ page }) => {
    const timestamp = Date.now();
    const testEmail = `user_${timestamp}@nutriverse.test`;
    const testPassword = "SecurePassword123!";

    await page.goto("/");

    // 1. Open AuthModal
    const openAuthBtn = page.getByRole("button", { name: /Sign In|Login/i }).first();
    await openAuthBtn.click();
    await expect(page.getByText(/Sign In to Nutriverse/i)).toBeVisible();

    // 2. Switch to Register mode
    await page.getByRole("button", { name: /Create an account/i }).click();
    await expect(page.getByText(/Create Member Account/i)).toBeVisible();

    // 3. Fill registration inputs
    await page.getByPlaceholder(/Maya Sharma/i).fill("Test User");
    await page.getByPlaceholder(/name@example.com/i).fill(testEmail);
    await page.getByPlaceholder(/••••••••/).fill(testPassword);

    // 4. Submit registration
    await page.getByRole("button", { name: /Create Account/i }).click();

    // 5. Verify successful registration & login in header
    await expect(page.getByText("Test").first()).toBeVisible();

    // 6. Logout
    const signOutBtn = page.getByTitle("Sign Out");
    await signOutBtn.click();
    await expect(page.getByRole("button", { name: /Sign In|Login/i }).first()).toBeVisible();

    // 7. Login again with email and password (not dev shortcut)
    await page.getByRole("button", { name: /Sign In|Login/i }).first().click();
    await expect(page.getByText(/Sign In to Nutriverse/i)).toBeVisible();
    await page.getByPlaceholder(/name@example.com/i).fill(testEmail);
    await page.getByPlaceholder(/••••••••/).fill(testPassword);
    await page.locator("form").getByRole("button", { name: /Sign In/i }).click();

    // 8. Verify user is authenticated again
    await expect(page.getByText("Test").first()).toBeVisible();
  });

  test("Guest clicking Checkout is redirected to sign-in and returns to checkout after login", async ({ page }) => {
    // Navigate to food explorer
    await page.goto("/explore");

    // Add first item to cart (guest add opens bag drawer)
    const addBtn = page.getByRole("button", { name: /^Add$/i }).first();
    await addBtn.click();

    // Click Proceed to Checkout in drawer
    const checkoutBtn = page.getByRole("button", { name: /Proceed to Checkout/i });
    await expect(checkoutBtn).toBeVisible();
    await checkoutBtn.click();

    // Verify redirected to /checkout with sign-in prompt/modal
    await expect(page).toHaveURL(/\/checkout/);
    await expect(page.getByText(/Sign In Required for Checkout|Sign In to Nutriverse/i).first()).toBeVisible();

    // Sign in using Alex credentials / quick login
    if (await page.getByRole("button", { name: /Alex/i }).isVisible()) {
      await page.getByRole("button", { name: /Alex/i }).click();
    } else {
      await page.getByPlaceholder(/name@example.com/i).fill("alex@nutriverse.local");
      await page.getByPlaceholder(/••••••••/).fill("Customer123!");
      await page.locator("form").getByRole("button", { name: /Sign In/i }).click();
    }

    // Verify returned to checkout page with checkout form displayed
    await expect(page).toHaveURL(/\/checkout/);
    await expect(page.getByText(/Recipient Name|Review & Place Order|Delivery Address/i).first()).toBeVisible();
  });

  test("Normal user visiting /admin is denied in UI and direct API call", async ({ page }) => {
    await page.goto("/");

    // Sign in as Alex (Customer role)
    const signInBtn = page.getByRole("button", { name: /Sign In|Login/i }).first();
    await signInBtn.click();
    await page.getByRole("button", { name: /Alex/i }).click();

    // Ensure AuthModal closes and header renders authenticated session
    await expect(page.getByText(/Sign In to Nutriverse/i)).not.toBeVisible();
    await expect(page.getByTitle("Sign Out")).toBeVisible();

    // 1. Visit /admin in browser -> UI denial
    await page.goto("/admin");
    await expect(page.getByText(/Access Denied \(Role: user\)/i)).toBeVisible();
    await expect(page.getByText(/Your account does not hold Administrator privileges/i)).toBeVisible();

    // 2. Direct API call with customer session cookie -> 403 Forbidden
    const apiResult = await page.evaluate(async () => {
      const res = await fetch("/api/admin/stats");
      const data = await res.json().catch(() => null);
      return { status: res.status, data };
    });

    expect(apiResult.status).toBe(403);
    expect(JSON.stringify(apiResult.data)).toContain("Access denied");
  });
});
