import { test, expect } from "@playwright/test";

const VIEWPORTS = [
  { name: "Mobile (375x812)", width: 375, height: 812 },
  { name: "Mobile (390x844)", width: 390, height: 844 },
  { name: "Tablet (768x1024)", width: 768, height: 1024 },
  { name: "Desktop (1366x768)", width: 1366, height: 768 },
  { name: "Large Desktop (1920x1080)", width: 1920, height: 1080 },
];

test.describe("Nutriverse Responsive Layout & UI Integrity", () => {
  for (const vp of VIEWPORTS) {
    test(`renders Storefront and core pages without horizontal overflow at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      const routes = ["/", "/explore", "/packs", "/scanner", "/design-system"];
      for (const route of routes) {
        await page.goto(route);
        await page.waitForLoadState("domcontentloaded");

        // Verify no unexpected horizontal scroll bar
        const hasHorizontalOverflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > window.innerWidth + 2;
        });
        expect(hasHorizontalOverflow, `Horizontal overflow detected on ${route} at ${vp.name}`).toBe(false);

        // Verify header navigation exists and has positive dimensions
        const header = page.locator("header").first();
        if (await header.isVisible()) {
          const box = await header.boundingBox();
          expect(box).not.toBeNull();
          expect(box!.width).toBeGreaterThan(0);
          expect(box!.height).toBeGreaterThan(0);
        }
      }
    });
  }

  test("Login & Authentication layout has distinct non-overlapping bounding boxes", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Open Auth modal
    const signInBtn = page.getByRole("button", { name: /sign in/i }).first();
    await expect(signInBtn).toBeVisible();
    await signInBtn.click();

    // Verify modal elements are visible
    const modal = page.locator(".modal-dialog");
    await expect(modal).toBeVisible();

    const emailInput = modal.locator("input[type='email']");
    const passwordInput = modal.locator("input[type='password']");
    const submitBtn = modal.locator("button[type='submit']");

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitBtn).toBeVisible();

    // Measure bounding boxes to ensure vertical stacking without overlapping
    const emailBox = await emailInput.boundingBox();
    const passBox = await passwordInput.boundingBox();
    const submitBox = await submitBtn.boundingBox();

    expect(emailBox).not.toBeNull();
    expect(passBox).not.toBeNull();
    expect(submitBox).not.toBeNull();

    // Password input must start below email input
    expect(passBox!.y).toBeGreaterThanOrEqual(emailBox!.y + emailBox!.height - 2);

    // Submit button must start below password input
    expect(submitBox!.y).toBeGreaterThanOrEqual(passBox!.y + passBox!.height - 2);

    // Verify submit button has background color and readable text
    const submitBg = await submitBtn.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(submitBg).not.toBe("rgba(0, 0, 0, 0)");
    expect(submitBg).not.toBe("transparent");

    // Verify typing works cleanly without layout disruption
    await emailInput.fill("test.responsive@nutriverse.in");
    await passwordInput.fill("SafePassword123!");
    expect(await emailInput.inputValue()).toBe("test.responsive@nutriverse.in");
    expect(await passwordInput.inputValue()).toBe("SafePassword123!");
  });

  test("Registration tab renders properly with clean role selector and fields", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Open Auth modal and switch to Create Account
    const signInBtn = page.getByRole("button", { name: /^sign in$/i }).first();
    await signInBtn.click();

    const modal = page.locator(".modal-dialog");
    await expect(modal).toBeVisible();

    const createTab = modal.getByRole("button", { name: /create an account/i });
    await expect(createTab).toBeVisible();
    await createTab.click();

    const nameInput = modal.locator("input[placeholder*='Maya Sharma' i], input[type='text']").first();
    const emailInput = modal.locator("input[type='email']");
    const passwordInput = modal.locator("input[type='password']");
    const createBtn = modal.locator("button[type='submit']");

    await expect(nameInput).toBeVisible();
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(createBtn).toBeVisible();

    const nameBox = await nameInput.boundingBox();
    const emailBox = await emailInput.boundingBox();
    const passBox = await passwordInput.boundingBox();
    const createBox = await createBtn.boundingBox();

    expect(emailBox!.y).toBeGreaterThanOrEqual(nameBox!.y + nameBox!.height - 2);
    expect(passBox!.y).toBeGreaterThanOrEqual(emailBox!.y + emailBox!.height - 2);
    expect(createBox!.y).toBeGreaterThanOrEqual(passBox!.y + passBox!.height - 2);
  });

  test("Product cards and nutrition details maintain container bounds on /explore", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/explore");
    await page.waitForLoadState("domcontentloaded");

    // Wait for at least one product card to render
    const productCard = page.locator("article, [data-testid='product-card'], .card, a[href^='/food/']").first();
    await expect(productCard).toBeVisible();

    const cardBox = await productCard.boundingBox();
    expect(cardBox).not.toBeNull();
    expect(cardBox!.width).toBeGreaterThan(100);
    expect(cardBox!.height).toBeGreaterThan(100);
  });

  test("No uncaught console errors occur during multi-page navigation", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("pageerror", (err) => consoleErrors.push(err.message));

    await page.goto("/");
    await page.goto("/explore");
    await page.goto("/packs");
    await page.goto("/design-system");

    expect(consoleErrors).toEqual([]);
  });
});
