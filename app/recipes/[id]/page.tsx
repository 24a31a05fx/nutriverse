import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import RecipeDetailClient from "./RecipeDetailClient";
import { Recipe } from "@/lib/api";

const BACKEND_INTERNAL_URL = process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8000";

async function getRecipe(id: string): Promise<Recipe | null> {
  try {
    const res = await fetch(`${BACKEND_INTERNAL_URL}/api/recipes/${id}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as Recipe;
  } catch {
    return null;
  }
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
