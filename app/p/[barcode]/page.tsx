import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import BarcodeLandingClient from "./BarcodeLandingClient";
import { Food } from "@/lib/api";
import { CATALOG_PRODUCTS, CatalogProduct } from "@/src/data/catalog";

const BACKEND_INTERNAL_URL = process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8000";

function catalogProductToFood(p: CatalogProduct): Food {
  return {
    id: p.id,
    name: p.name,
    barcode: p.barcode,
    category: p.category,
    nutrition_tags: JSON.stringify(p.nutritionTags || []),
    description: p.description,
    price_paise: p.pricePaise,
    unit: p.unit,
    serving_size: p.servingSize,
    stock_qty: p.stockQty,
    calories: p.calories,
    protein_g: p.proteinG,
    carbs_g: p.carbsG,
    fat_g: p.fatG,
    fibre_g: p.fibreG,
    vitamins_json: "{}",
    ingredients: p.name,
    storage_info: "Store in cool, dry place.",
    prep_methods: JSON.stringify([]),
    dietary_tags: JSON.stringify(p.dietaryTags || []),
    emoji: "🥗",
    active: true,
  };
}

export async function generateStaticParams() {
  return CATALOG_PRODUCTS.filter((p) => Boolean(p.barcode)).map((p) => ({
    barcode: p.barcode,
  }));
}

async function getFoodByBarcode(barcode: string): Promise<Food | null> {
  try {
    const res = await fetch(`${BACKEND_INTERNAL_URL}/api/foods/barcode/${encodeURIComponent(barcode)}`, {
      cache: "no-store",
    });
    if (res.ok) {
      return (await res.json()) as Food;
    }
  } catch {
    // fallback
  }
  const found = CATALOG_PRODUCTS.find((p) => p.barcode === barcode);
  return found ? catalogProductToFood(found) : null;
}

export async function generateMetadata({
  params,
}: {
  params: { barcode: string };
}): Promise<Metadata> {
  const food = await getFoodByBarcode(params.barcode);
  if (!food) {
    return { title: `Barcode ${params.barcode} — Nutriverse Scanner` };
  }
  return {
    title: `Physical Scan: ${food.name} (Barcode ${food.barcode}) — Nutriverse`,
    description: `Complete nutritional intelligence for ${food.name}. ${food.calories} kcal, ${food.protein_g}g protein. Scanned from verified packaging.`,
  };
}

export default async function BarcodePage({
  params,
}: {
  params: { barcode: string };
}) {
  const food = await getFoodByBarcode(params.barcode);

  return (
    <AppShell activeTabOverride="scanner">
      <BarcodeLandingClient barcode={params.barcode} initialFood={food} />
    </AppShell>
  );
}
