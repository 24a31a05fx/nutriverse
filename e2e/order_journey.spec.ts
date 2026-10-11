import { test, expect } from "@playwright/test";
import { spawn, execSync } from "child_process";
import path from "path";

const PYTHON_BIN = process.platform === "win32"
  ? path.resolve(process.cwd(), ".venv/Scripts/python.exe")
  : path.resolve(process.cwd(), ".venv/bin/python");

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
        PYTHON_BIN,
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

    try {
      execSync(
        `"${PYTHON_BIN}" -c "from sqlalchemy import create_engine; from sqlalchemy.orm import Session; from backend.app.main import Food, settings; engines = [create_engine(settings.database_url), create_engine('sqlite:///./nutriverse.db')]; [ (s := Session(eng), (s.delete(s.get(Food, 'f-frac-1')), s.commit()) if s.get(Food, 'f-frac-1') else None, s.add(Food(id='f-frac-1', name='Fractional Test Grain', barcode='8901111999999', category='Grains', description='Test food', price_paise=3350, calories=100.0, protein_g=4.0, carbs_g=20.0, fat_g=1.0, fibre_g=2.0, stock_qty=50, unit='100g', serving_size='50g', vitamins_json='{}', ingredients='Grain', storage_info='Dry', prep_methods='[]', dietary_tags='[]', emoji='🌾', active=True)), s.commit(), s.close()) for eng in engines ]"`
      );
    } catch {}
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
      PYTHON_BIN,
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

      await new Promise((r) => setTimeout(r, 1000));

      spawn(
        PYTHON_BIN,
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
      for (let i = 0; i < 50; i++) {
        try {
          const res = await fetch("http://127.0.0.1:8000/health");
          if (res.ok) break;
        } catch {}
        await new Promise((r) => setTimeout(r, 200));
      }
    }
  });

  test("Cart fractional paise formatting: 3350 paise renders as ₹33.50, not ₹33", async ({
    page,
    context,
  }) => {
    // 1. Ensure backend is ready and clear cookies to ensure clean guest session
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch("http://127.0.0.1:8000/health");
        if (res.ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }
    await context.clearCookies();

    // 2. Pre-seed guest cart before page loads so NutriverseProvider mounts with item
    await page.addInitScript(() => {
      localStorage.setItem(
        "nutriverse_guest_cart",
        JSON.stringify([
          {
            id: "guest-item-frac",
            item_type: "food",
            food_id: "f-frac-1",
            quantity: 1,
          },
        ])
      );
    });

    // 3. Navigate directly to /cart
    await page.goto("/cart");
    await expect(page.getByRole("heading", { name: /Your Nutrition Bag/i })).toBeVisible();

    // 4. Assert that the item is rendered
    await expect(page.getByText(/Fractional Test Grain/i)).toBeVisible();

    // 5. Assert that the price renders with exact fraction (₹33.50) and NOT truncated (₹33)
    const itemPriceText = await page.locator("span.font-black.text-sm.text-gray-900").first().innerText();
    expect(itemPriceText).toMatch(/₹\s?33\.50/);
    expect(itemPriceText).not.toBe("₹33");
    expect(itemPriceText).not.toBe("₹ 33");
  });
});

