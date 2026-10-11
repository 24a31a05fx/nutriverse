import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import BarcodeLandingClient from "./BarcodeLandingClient";
import { Food } from "@/lib/api";

const BACKEND_INTERNAL_URL = process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8000";

async function getFoodByBarcode(barcode: string): Promise<Food | null> {
  try {
    const res = await fetch(`${BACKEND_INTERNAL_URL}/api/foods/barcode/${encodeURIComponent(barcode)}`, {
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
