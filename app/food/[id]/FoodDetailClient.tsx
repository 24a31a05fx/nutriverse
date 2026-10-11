"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  Sparkles,
  Flame,
  Clock,
  ShieldCheck,
  ChevronLeft,
  Share2,
  ChefHat,
  Info,
  CheckCircle2,
} from "lucide-react";
import { Food, formatPaise, money } from "@/lib/api";
import { useNutriverse } from "@/components/NutriverseProvider";

export default function FoodDetailClient({ food }: { food: Food }) {
  const { handleAddToCart, allRecipes } = useNutriverse();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const nutritionTags: string[] = JSON.parse(food.nutrition_tags || "[]");
  const vitamins: Record<string, any> = JSON.parse(food.vitamins_json || "{}");
  const prepMethods: string[] = JSON.parse(food.prep_methods || "[]");
  const dietaryTags: string[] = JSON.parse(food.dietary_tags || "[]");

  const matchingRecipes = allRecipes.filter((r) => {
    try {
      const ing: Array<{ food_name: string }> = JSON.parse(r.ingredients_json || "[]");
      return ing.some((i) => i.food_name?.toLowerCase().includes(food.name.toLowerCase()));
    } catch {
      return false;
    }
  });

  const onAdd = async () => {
    await handleAddToCart(food, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8 animate-in fade-in">
      <Link
        href="/explore"
        className="inline-flex items-center gap-2 text-xs font-bold text-emerald-800 hover:text-emerald-950 transition"
      >
        <ChevronLeft className="w-4 h-4" /> Back to Food Explorer
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Left Column: Emoji visual & core tags */}
        <div className="md:col-span-5 bg-white rounded-3xl border border-gray-100 p-8 shadow-sm text-center space-y-6">
          <div className="w-36 h-36 mx-auto rounded-3xl bg-emerald-50/70 border border-emerald-100 flex items-center justify-center text-7xl shadow-inner">
            {food.emoji || "🥗"}
          </div>

          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
              {food.category}
            </span>
            <h1 className="text-2xl font-black text-gray-900 mt-2">{food.name}</h1>
            <p className="text-xs text-gray-500 mt-1">
              Unit: {food.unit} • Serving Size: {food.serving_size}
            </p>
          </div>

          {food.barcode && (
            <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 text-xs text-gray-600 flex items-center justify-between">
              <span className="font-mono text-[11px]">Barcode: {food.barcode}</span>
              <Link
                href={`/p/${food.barcode}`}
                className="text-[11px] text-emerald-700 font-bold hover:underline"
              >
                View QR Page
              </Link>
            </div>
          )}

          {/* Pricing & Add to Bag */}
          <div className="pt-4 border-t border-gray-100 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">Price per unit</span>
              <span className="text-2xl font-black text-emerald-900">{formatPaise(food.price_paise)}</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center border border-gray-200 rounded-2xl overflow-hidden bg-gray-50">
                <button
                  type="button"
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  className="px-3.5 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 transition"
                >
                  -
                </button>
                <span className="px-3 text-xs font-bold text-gray-900">{qty}</span>
                <button
                  type="button"
                  onClick={() => setQty(qty + 1)}
                  className="px-3.5 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 transition"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                onClick={onAdd}
                className="flex-1 py-3 px-5 rounded-2xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold shadow-lg shadow-emerald-900/20 transition flex items-center justify-center gap-2"
              >
                {added ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" /> Added to Bag
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" /> Add to Bag ({formatPaise(food.price_paise * qty)})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Complete Nutrition Profile & Bioactive Properties */}
        <div className="md:col-span-7 space-y-6">
          {/* Description */}
          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-3">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" /> Nutritional Purpose & Description
            </h2>
            <p className="text-xs text-gray-600 leading-relaxed">{food.description}</p>

            <div className="flex flex-wrap gap-1.5 pt-2">
              {nutritionTags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200/60"
                >
                  {tag.replace("_", " ")}
                </span>
              ))}
              {dietaryTags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-gray-50 text-gray-700 border border-gray-200"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Macronutrients Grid */}
          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-500" /> Macronutrient Density (per {food.serving_size})
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200/70 text-center">
                <span className="text-[10px] uppercase font-bold text-amber-800 block">Calories</span>
                <span className="text-lg font-black text-amber-950 block">{food.calories}</span>
                <span className="text-[9px] text-amber-700">kcal</span>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/70 text-center">
                <span className="text-[10px] uppercase font-bold text-emerald-800 block">Protein</span>
                <span className="text-lg font-black text-emerald-950 block">{food.protein_g}g</span>
                <span className="text-[9px] text-emerald-700">tissue repair</span>
              </div>
              <div className="p-3 rounded-2xl bg-blue-50/70 border border-blue-200/70 text-center">
                <span className="text-[10px] uppercase font-bold text-blue-800 block">Carbs</span>
                <span className="text-lg font-black text-blue-950 block">{food.carbs_g}g</span>
                <span className="text-[9px] text-blue-700">active energy</span>
              </div>
              <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200/70 text-center">
                <span className="text-[10px] uppercase font-bold text-amber-800 block">Healthy Fat</span>
                <span className="text-lg font-black text-amber-950 block">{food.fat_g}g</span>
                <span className="text-[9px] text-amber-700">hormone support</span>
              </div>
              <div className="p-3 rounded-2xl bg-teal-50/70 border border-teal-200/70 text-center">
                <span className="text-[10px] uppercase font-bold text-teal-800 block">Fiber</span>
                <span className="text-lg font-black text-teal-950 block">{food.fibre_g}g</span>
                <span className="text-[9px] text-teal-700">gut microbiome</span>
              </div>
            </div>
          </div>

          {/* Micronutrients & Vitamins Breakdown */}
          {Object.keys(vitamins).length > 0 && (
            <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-3">
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" /> Micronutrient Completeness
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {Object.entries(vitamins).map(([key, val]) => (
                  <div
                    key={key}
                    className="p-3 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-between"
                  >
                    <span className="text-xs font-medium text-gray-700 capitalize">
                      {key.replace(/_/g, " ")}:
                    </span>
                    <span className="text-xs font-bold text-emerald-900">{String(val)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preparation & Storage Guidelines */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-600" /> Recommended Prep Methods
              </h3>
              <ul className="space-y-1.5 pt-1">
                {prepMethods.map((m) => (
                  <li key={m} className="text-xs text-gray-600 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" /> {m}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-emerald-600" /> Storage & Ingredients
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                <strong className="text-gray-900">Storage:</strong> {food.storage_info}
              </p>
              {food.ingredients && (
                <p className="text-xs text-gray-600 leading-relaxed pt-1">
                  <strong className="text-gray-900">Ingredients:</strong> {food.ingredients}
                </p>
              )}
            </div>
          </div>

          {/* Related Bio-Recipes */}
          {matchingRecipes.length > 0 && (
            <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-3">
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <ChefHat className="w-4 h-4 text-emerald-600" /> Recipes Using {food.name}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {matchingRecipes.map((r) => (
                  <Link
                    key={r.id}
                    href={`/recipes/${r.id}`}
                    className="p-3.5 rounded-2xl bg-emerald-50/50 hover:bg-emerald-50 border border-emerald-100 flex items-center gap-3 transition group"
                  >
                    <span className="text-2xl">{r.emoji || "🍲"}</span>
                    <div>
                      <h4 className="text-xs font-bold text-gray-900 group-hover:text-emerald-900">
                        {r.name}
                      </h4>
                      <p className="text-[10px] text-gray-500">
                        {r.prep_time_mins} mins • {r.calories} kcal • {r.prep_method}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
