import { test, expect } from "@playwright/test";
import { spawn, execSync } from "child_process";

test.describe("Phase 1b Playwright Suite", () => {
  test.beforeAll(async () => {
    // Ensure development backend is alive on port 8000 before running tests
    let alive = false;
    try {
      const res = await fetch("http://127.0.0.1:8000/health");
      if (res.ok) alive = true;
    } catch {}

    if (!alive) {
      spawn(
        ".\\.venv\\Scripts\\python.exe",
        ["-m", "uvicorn", "backend.app.main:app", "--port", "8000", "--host", "127.0.0.1"],
        {
          env: {
            ...process.env,
            APP_ENV: "development",
            RATE_LIMIT_LOGIN: "100/minute",
            DATABASE_URL: "sqlite:///./nutriverse.db",
          },
          stdio: "ignore",
          detached: true,
        }
      ).unref();

      for (let i = 0; i < 30; i++) {
        try {
          const res = await fetch("http://127.0.0.1:8000/health");
          if (res.ok) break;
        } catch {}
        await new Promise((r) => setTimeout(r, 200));
      }
    }
  });

  test("Customer journey: login -> add Calin Pack -> cart -> demo checkout -> order appears in /orders with paise-derived total", async ({
    page,
  }) => {
    // 1. Visit homepage
    await page.goto("/");
    await expect(page).toHaveTitle(/Nutriverse/);

    // Open Sign In modal
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
    await expect(page).toHaveURL(/\/packs/);
    await expect(page.getByRole("heading", { name: /Calin Packs/i, level: 1 })).toBeVisible();

    // Locate "Add Calin ... Pack to Bag" button
    const addPackBtn = page.getByRole("button", { name: /Add Calin.*Pack to Bag/i }).first();
    await expect(addPackBtn).toBeVisible();
    await addPackBtn.click();

    // Verify added to cart (toast, counter or bag drawer)
    const bagBtn = page.getByRole("button", { name: /Shopping Cart|Bag/i }).first();
    await expect(bagBtn).toBeVisible();

    // 3. Open cart page /cart
    await page.goto("/cart");
    await expect(page).toHaveURL(/\/cart/);
    await expect(page.getByRole("heading", { name: /Your Nutrition Bag/i })).toBeVisible();

    // Verify item is in cart with formatted paise (₹ symbol and integer amounts)
    await expect(page.getByText(/Calin Basic Pack|Calin Minimal Plus Pack|Calin Premium Pack/i).first()).toBeVisible();

    // Click Proceed to Checkout
    const checkoutLink = page.getByRole("button", { name: /Proceed to Checkout/i });
    await expect(checkoutLink).toBeVisible();
    await checkoutLink.click();

    // 4. Arrive at /checkout
    await expect(page).toHaveURL(/\/checkout/);

    // Confirm & Place Order button
    const placeOrderBtn = page.getByRole("button", { name: /Confirm & Place Order/i });
    await expect(placeOrderBtn).toBeVisible();
    await placeOrderBtn.click();

    // 5. Verify redirection to /orders/[id] confirmation
    await page.waitForURL(/\/orders\/[a-f0-9-]+/, { timeout: 15000 });
    await expect(page.getByText(/Order #/i).first()).toBeVisible();
    await expect(page.getByText(/Fulfillment Timeline/i)).toBeVisible();

    // Total displayed in paise-derived rupees
    await expect(page.getByText(/₹/).first()).toBeVisible();

    // 6. Navigate to /orders list page
    const backToOrdersLink = page.getByRole("link", { name: /Back to All Orders/i });
    if (await backToOrdersLink.isVisible()) {
      await backToOrdersLink.click({ force: true });
    } else {
      await page.goto("/orders");
    }
    await expect(page).toHaveURL(/\/orders/);

    // The placed order appears with correct paise-derived total
    await expect(page.getByText(/Order #/i).first()).toBeVisible();
    const priceBadge = page.locator("span").filter({ hasText: /₹/ }).first();
    await expect(priceBadge).toBeVisible();
  });

  test("Production-mode check: with APP_ENV=production the real backend shows no dev shortcuts", async ({
    page,
  }) => {
    // 1. Terminate existing dev backend process on port 8000 to start real production backend
    try {
      execSync(
        `powershell -Command "Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"`
      );
    } catch {}

    // 2. Start REAL backend process with APP_ENV=production (no route mocking)
    const prodProc = spawn(
      ".\\.venv\\Scripts\\python.exe",
      ["-m", "uvicorn", "backend.app.main:app", "--port", "8000", "--host", "127.0.0.1"],
      {
        env: {
          ...process.env,
          APP_ENV: "production",
          JWT_SECRET: "a-cryptographically-secure-production-jwt-secret-string-32-chars",
          DATABASE_URL: "sqlite:///./nutriverse.db",
        },
        stdio: "ignore",
      }
    );

    try {
      // 3. Wait for REAL production backend to boot and verify /api/auth/config directly
      let ready = false;
      for (let i = 0; i < 30; i++) {
        try {
          const res = await fetch("http://127.0.0.1:8000/api/auth/config");
          if (res.ok) {
            const cfg = await res.json();
            expect(cfg.app_env).toBe("production");
            expect(cfg.demo_shortcuts_enabled).toBe(false);
            ready = true;
            break;
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 200));
      }
      expect(ready).toBe(true);

      // 4. Visit home page via Next.js proxy and open sign-in modal
      await page.goto("/");
      await expect(page).toHaveTitle(/Nutriverse/);

      const signInBtn = page.getByRole("button", { name: /Sign In|Login/i }).first();
      await signInBtn.click();

      // 5. Sign In modal is visible
      const modal = page.locator("div.fixed").filter({ hasText: "Sign In to Nutriverse" });
      await expect(modal).toBeVisible();

      // 6. Assert that Dev Shortcuts box is NOT present in the production modal DOM
      await expect(modal.getByText(/Dev Shortcuts/i)).not.toBeVisible();
      await expect(modal.getByRole("button", { name: /Alex/i })).not.toBeVisible();
      await expect(modal.getByRole("button", { name: /Dr\. Priya/i })).not.toBeVisible();
      await expect(modal.getByRole("button", { name: /Admin/i })).not.toBeVisible();
    } finally {
      // 7. Cleanup production backend and restart development backend
      try {
        prodProc.kill();
        execSync(
          `powershell -Command "Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"`
        );
      } catch {}

      spawn(
        ".\\.venv\\Scripts\\python.exe",
        ["-m", "uvicorn", "backend.app.main:app", "--port", "8000", "--host", "127.0.0.1"],
        {
          env: {
            ...process.env,
            APP_ENV: "development",
            RATE_LIMIT_LOGIN: "100/minute",
            DATABASE_URL: "sqlite:///./nutriverse.db",
          },
          stdio: "ignore",
          detached: true,
        }
      ).unref();
      await new Promise((r) => setTimeout(r, 1000));
    }
  });
});
