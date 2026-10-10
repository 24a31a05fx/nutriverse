import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import FoodDetailClient from "./FoodDetailClient";
import { Food } from "@/lib/api";

const BACKEND_INTERNAL_URL = process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8000";

async function getFood(id: string): Promise<Food | null> {
  try {
    const res = await fetch(`${BACKEND_INTERNAL_URL}/api/foods/${id}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as Food;
  } catch {
    return null;
  }
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
