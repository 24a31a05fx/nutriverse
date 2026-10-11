"use client";

import React from "react";
import { useRouter } from "next/navigation";
import CalinPacksView from "@/components/CalinPacksView";
import { useNutriverse } from "@/components/NutriverseProvider";

export default function PacksClient() {
  const router = useRouter();
  const { currentUser, handleAddPackToCart, setAuthModalOpen } = useNutriverse();

  return (
    <CalinPacksView
      currentUser={currentUser}
      onAddPackToCart={handleAddPackToCart}
      onOpenAuth={() => setAuthModalOpen(true)}
      onRequestNutritionistReviewSuccess={() => {
        alert("Nutritionist review request submitted! You can track nutritionist guidance in your dashboard.");
        router.push("/account");
      }}
    />
  );
}
