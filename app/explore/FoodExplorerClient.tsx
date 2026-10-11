"use client";

import React, { Suspense } from "react";
import FoodExplorerView from "@/components/FoodExplorerView";
import { useNutriverse } from "@/components/NutriverseProvider";
import { useSearchParams } from "next/navigation";

function ExplorerInner() {
  const { handleAddToCart } = useNutriverse();
  const searchParams = useSearchParams();
  const initialCategory = searchParams?.get("category") || undefined;
  const initialNutrient = searchParams?.get("nutrient") || undefined;
  const initialQuery = searchParams?.get("q") || undefined;

  return (
    <FoodExplorerView
      onAddToCart={handleAddToCart}
      initialCategory={initialCategory}
      initialNutrient={initialNutrient}
      initialQuery={initialQuery}
    />
  );
}

export default function FoodExplorerClient() {
  return (
    <Suspense fallback={<div className="container py-8"><p>Loading catalog...</p></div>}>
      <ExplorerInner />
    </Suspense>
  );
}
