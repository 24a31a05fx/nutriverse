"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  UtensilsCrossed,
  Clock,
  Flame,
  ChefHat,
  ShoppingBag,
  CheckCircle2,
  ChevronLeft,
  Sparkles,
} from "lucide-react";
import { Recipe, Food, money } from "@/lib/api";
import { useNutriverse } from "@/components/NutriverseProvider";

export default function RecipeDetailClient({ recipe }: { recipe: Recipe }) {
  const { allFoods, handleAddMultipleToCart } = useNutriverse();
  const [added, setAdded] = useState(false);

  const ingredients: Array<{ name: string; qty: string; unit: string }> = JSON.parse(
    recipe.ingredients_json || "[]"
  );

  const matchedFoodsToAdd: Array<{ food: Food; quantity: number }> = [];
  ingredients.forEach((ing) => {
    const match = allFoods.find(
      (f) =>
        f.name.toLowerCase().includes(ing.name.toLowerCase()) ||
        ing.name.toLowerCase().includes(f.name.toLowerCase())
    );
    if (match) {
      matchedFoodsToAdd.push({ food: match, quantity: 1 });
    }
  });

  const handleAddAll = async () => {
    if (matchedFoodsToAdd.length > 0) {
      await handleAddMultipleToCart(matchedFoodsToAdd);
      setAdded(true);
      setTimeout(() => setAdded(false), 2500);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 animate-in fade-in">
      <Link
        href="/recipes"
        className="inline-flex items-center gap-2 text-xs font-bold text-emerald-800 hover:text-emerald-950 transition"
      >
        <ChevronLeft className="w-4 h-4" /> Back to All Bio-Recipes
      </Link>

      {/* Hero Card */}
      <div className="bg-gradient-to-br from-emerald-950 to-teal-900 text-white p-8 rounded-3xl shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="text-5xl">{recipe.emoji || "🍲"}</span>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-900/60 px-3 py-1 rounded-full border border-emerald-700">
                {recipe.prep_method} Method
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-white mt-1.5">{recipe.name}</h1>
            </div>
          </div>

          <div className="flex items-center gap-4 text-center">
            <div className="p-3 bg-emerald-900/50 rounded-2xl border border-emerald-800">
              <span className="text-[10px] text-emerald-300 block">Prep Time</span>
              <span className="text-lg font-black text-white">{recipe.prep_time_mins}m</span>
            </div>
            <div className="p-3 bg-emerald-900/50 rounded-2xl border border-emerald-800">
              <span className="text-[10px] text-emerald-300 block">Servings</span>
              <span className="text-lg font-black text-white">{recipe.servings}</span>
            </div>
            <div className="p-3 bg-emerald-900/50 rounded-2xl border border-emerald-800">
              <span className="text-[10px] text-emerald-300 block">Protein</span>
              <span className="text-lg font-black text-white">{recipe.protein_g}g</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-emerald-100 max-w-2xl leading-relaxed">
          {recipe.description}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Ingredients & Add all to bag */}
        <div className="md:col-span-5 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <UtensilsCrossed className="w-4 h-4 text-emerald-600" /> Ingredients ({ingredients.length})
            </h2>
            <span className="text-[11px] text-emerald-700 font-semibold">
              {matchedFoodsToAdd.length} in store
            </span>
          </div>

          <div className="space-y-2">
            {ingredients.map((ing, idx) => {
              const inStore = allFoods.find((f) =>
                f.name.toLowerCase().includes(ing.name.toLowerCase())
              );
              return (
                <div
                  key={idx}
                  className="p-3 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-gray-900 block">{ing.name}</span>
                    {inStore && (
                      <Link
                        href={`/food/${inStore.id}`}
                        className="text-[10px] text-emerald-700 hover:underline font-semibold block"
                      >
                        Available in store ({money(inStore.price_inr)})
                      </Link>
                    )}
                  </div>
                  <span className="text-[11px] font-bold text-gray-600 bg-white px-2 py-0.5 rounded-lg border border-gray-200">
                    {ing.qty} {ing.unit}
                  </span>
                </div>
              );
            })}
          </div>

          {matchedFoodsToAdd.length > 0 && (
            <button
              type="button"
              onClick={handleAddAll}
              className="w-full py-3 px-5 rounded-2xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold shadow-md transition flex items-center justify-center gap-2"
            >
              {added ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" /> Added to Bag
                </>
              ) : (
                <>
                  <ShoppingBag className="w-4 h-4" /> Add All {matchedFoodsToAdd.length} Ingredients to Bag
                </>
              )}
            </button>
          )}
        </div>

        {/* Step-by-Step Instructions */}
        <div className="md:col-span-7 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <ChefHat className="w-4 h-4 text-emerald-600" /> Nutrient-Preserving Instructions
          </h2>

          <div className="prose prose-xs text-xs text-gray-700 leading-relaxed whitespace-pre-line space-y-2">
            {recipe.instructions}
          </div>

          <div className="p-4 bg-emerald-50/70 border border-emerald-200/70 rounded-2xl text-xs text-emerald-950 space-y-1">
            <span className="font-bold block flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-700" /> Bioavailability Principle
            </span>
            <p className="text-[11px] text-emerald-800 leading-relaxed">
              This recipe applies low-temperature steaming and water-soluble soaking to retain cellular antioxidants and reduce anti-nutrients (phytates).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
