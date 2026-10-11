"use client";

import React from "react";
import RecipesView from "@/components/RecipesView";
import { useNutriverse } from "@/components/NutriverseProvider";

export default function RecipesClient() {
  const { allFoods, handleAddMultipleToCart } = useNutriverse();

  return (
    <RecipesView
      allFoods={allFoods}
      onAddMultipleToCart={handleAddMultipleToCart}
    />
  );
}
