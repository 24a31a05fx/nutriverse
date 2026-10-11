import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import FoodDetailClient from "./FoodDetailClient";
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
  return CATALOG_PRODUCTS.map((p) => ({ id: p.id }));
}

async function getFood(id: string): Promise<Food | null> {
  try {
    const res = await fetch(`${BACKEND_INTERNAL_URL}/api/foods/${id}`, {
      cache: "no-store",
    });
    if (res.ok) {
      return (await res.json()) as Food;
    }
  } catch {
    // fallback
  }
  const found = CATALOG_PRODUCTS.find((p) => p.id === id);
  return found ? catalogProductToFood(found) : null;
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const food = await getFood(params.id);
  if (!food) {
    return { title: "Product Not Found — Nutriverse" };
  }
  return {
    title: `${food.name} (${food.protein_g}g Protein, ${food.calories} kcal) — Nutriverse`,
    description: food.description,
  };
}

export default async function FoodPage({
  params,
}: {
  params: { id: string };
}) {
  const food = await getFood(params.id);
  if (!food) {
    notFound();
  }

  return (
    <AppShell activeTabOverride="explorer">
      <FoodDetailClient food={food} />
    </AppShell>
  );
}
