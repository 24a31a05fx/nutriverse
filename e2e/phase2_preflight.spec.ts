import { expect, test } from "@playwright/test";

test("account route signs guests in and serves the member hub to signed-in users", async ({
  page,
}) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(/Sign In to Nutriverse/i)).toBeVisible();

  await page.getByRole("button", { name: /Alex/i }).click();
  await expect(page.getByTitle("Sign Out")).toBeVisible();

  await page.goto("/account");
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText(/Welcome back, Alex Mercer/i)).toBeVisible();
});

test("food detail and barcode routes render the seeded chickpeas product", async ({
  page,
}) => {
  const backendUrl =
    process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8000";
  const foodsResponse = await page.request.get(`${backendUrl}/api/foods`);
  expect(foodsResponse.ok()).toBeTruthy();

  const foods = (await foodsResponse.json()) as Array<{
    id: string;
    barcode: string;
    name: string;
    protein_g: number;
    calories: number;
  }>;
  const chickpeas = foods.find((food) => food.barcode === "8901234567890");
  expect(chickpeas).toBeDefined();
  if (!chickpeas) {
    throw new Error("Seeded chickpeas product is missing from the catalog");
  }

  await page.goto(`/food/${encodeURIComponent(chickpeas.id)}`);
  await expect(page).toHaveTitle(new RegExp(chickpeas.name));
  await expect(page.getByText(chickpeas.name).first()).toBeVisible();
  await expect(
    page.getByText(new RegExp(`${chickpeas.protein_g}g`)).first(),
  ).toBeVisible();

  await page.goto(`/p/${chickpeas.barcode}`);
  await expect(page.getByText(/Physical Package QR Verified/i)).toBeVisible();
  await expect(page.getByText(chickpeas.name).first()).toBeVisible();
  await expect(
    page.getByText(new RegExp(`${chickpeas.calories} kcal`)).first(),
  ).toBeVisible();
});
