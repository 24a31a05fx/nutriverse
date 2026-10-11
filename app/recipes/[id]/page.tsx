import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import RecipeDetailClient from "./RecipeDetailClient";
import { Recipe } from "@/lib/api";

const BACKEND_INTERNAL_URL = process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8000";

const SEEDED_RECIPES: Recipe[] = [
  {
    id: "f719ab6b-aa29-46fd-8494-3a9541065584",
    name: "Golden Sprouted Chickpea & Spinach Bowl",
    description: "A vibrant high-iron, high-protein bowl pairing sprouted chickpeas with wilted spinach, lemon, and cumin.",
    instructions: "1. Lightly steam sprouted chickpeas for 6 minutes.\n2. In a skillet, warm 1 tsp cold-pressed oil with cumin seeds.\n3. Add baby spinach at the very end (30 seconds) to preserve heat-sensitive Folate and Vitamin C.\n4. Squeeze fresh lemon juice over chickpeas — Vitamin C boosts non-heme iron absorption by up to 300%!\n5. Serve warm with roasted sweet potato wedges.",
    prep_method: "Flash Steam & Warm Toss",
    prep_time_mins: 18,
    servings: 2,
    calories: 380,
    protein_g: 18.5,
    emoji: "🥗",
    ingredients_json: JSON.stringify([
      { name: "Sprouted Chickpeas", qty: "150", unit: "g" },
      { name: "Tender Baby Spinach", qty: "80", unit: "g" },
      { name: "Cold-Pressed Mustard Oil", qty: "10", unit: "ml" },
      { name: "Roasted Sweet Potato", qty: "100", unit: "g" },
    ]),
    active: true,
  },
  {
    id: "c8ac7346-5059-45e3-a9a8-db46c9be1a77",
    name: "Overnight Berry & Chia Protein Jar",
    description: "Slow-digesting prebiotic breakfast packed with soluble beta-glucan, omega-3s, and Greek yoghurt.",
    instructions: "1. In a glass jar, mix rolled oats, chia seeds, and probiotic Greek yoghurt.\n2. Add a splash of water or plant milk and stir well.\n3. Refrigerate overnight (6–8 hours) to activate chia mucilage and soften oat starch.\n4. Top with fresh blueberries and chopped raw almonds before eating.",
    prep_method: "No-Cook Cold Hydration",
    prep_time_mins: 10,
    servings: 1,
    calories: 340,
    protein_g: 21.0,
    emoji: "🫐",
    ingredients_json: JSON.stringify([
      { name: "Organic Rolled Oats", qty: "50", unit: "g" },
      { name: "Probiotic Greek Yoghurt", qty: "150", unit: "g" },
      { name: "Organic Black Chia Seeds", qty: "15", unit: "g" },
      { name: "Wild Blueberries", qty: "40", unit: "g" },
      { name: "Raw California Almonds", qty: "15", unit: "g" },
    ]),
    active: true,
  },
  {
    id: "c69877b9-7c65-48c0-840a-cf8a03ad92b0",
    name: "Warm Quinoa & Steamed Broccoli Power Lunch",
    description: "Complete protein profile combined with natural sulforaphane from lightly steamed broccoli florets.",
    instructions: "1. Rinse white quinoa and simmer in 2x water with a pinch of sea salt for 14 minutes until fluffy.\n2. Steam broccoli florets for exactly 3 to 4 minutes to maximize sulforaphane bioavailability.\n3. Toss together with roasted sweet potato cubes.\n4. Drizzle with cold-pressed oil and roasted almond flakes.",
    prep_method: "Simmer & Steam",
    prep_time_mins: 22,
    servings: 2,
    calories: 420,
    protein_g: 16.0,
    emoji: "🥦",
    ingredients_json: JSON.stringify([
      { name: "Organic White Quinoa", qty: "120", unit: "g" },
      { name: "Fresh Organic Broccoli", qty: "150", unit: "g" },
      { name: "Roasted Sweet Potato", qty: "100", unit: "g" },
      { name: "Raw California Almonds", qty: "20", unit: "g" },
    ]),
    active: true,
  },
];

export async function generateStaticParams() {
  return SEEDED_RECIPES.map((r) => ({ id: r.id }));
}

async function getRecipe(id: string): Promise<Recipe | null> {
  try {
    const res = await fetch(`${BACKEND_INTERNAL_URL}/api/recipes/${id}`, {
      cache: "no-store",
    });
    if (res.ok) {
      return (await res.json()) as Recipe;
    }
  } catch {
    // fallback
  }
  return SEEDED_RECIPES.find((r) => r.id === id) || null;
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const recipe = await getRecipe(params.id);
  if (!recipe) {
    return { title: "Recipe Not Found — Nutriverse" };
  }
  return {
    title: `${recipe.name} (${recipe.prep_time_mins} mins, ${recipe.protein_g}g Protein) — Nutriverse`,
    description: recipe.description,
  };
}

export default async function RecipePage({
  params,
}: {
  params: { id: string };
}) {
  const recipe = await getRecipe(params.id);
  if (!recipe) {
    notFound();
  }

  return (
    <AppShell activeTabOverride="recipes">
      <RecipeDetailClient recipe={recipe} />
    </AppShell>
  );
}
