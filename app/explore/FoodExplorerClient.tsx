"use client";

import React from "react";
import FoodExplorerView from "@/components/FoodExplorerView";
import { useNutriverse } from "@/components/NutriverseProvider";

export default function FoodExplorerClient() {
  const { handleAddToCart } = useNutriverse();

  return <FoodExplorerView onAddToCart={handleAddToCart} />;
}
