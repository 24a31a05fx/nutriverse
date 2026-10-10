"use client";

import React from "react";
import { ScannerView } from "@/components/ScannerView";
import { useNutriverse } from "@/components/NutriverseProvider";

export default function ScannerClient() {
  const { setSelectedFood, handleAddToCart } = useNutriverse();

  return (
    <ScannerView
      onSelectFood={(food) => setSelectedFood(food)}
      onAddToCart={(food) => handleAddToCart(food)}
    />
  );
}
