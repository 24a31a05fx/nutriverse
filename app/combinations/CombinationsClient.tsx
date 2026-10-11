"use client";

import React from "react";
import CombinationsView from "@/components/CombinationsView";
import { useNutriverse } from "@/components/NutriverseProvider";

export default function CombinationsClient() {
  const { allFoods, handleAddMultipleToCart } = useNutriverse();

  return (
    <CombinationsView
      allFoods={allFoods}
      onAddMultipleToCart={handleAddMultipleToCart}
    />
  );
}
