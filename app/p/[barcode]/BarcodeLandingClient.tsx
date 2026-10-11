"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  QrCode,
  ScanLine,
  CheckCircle2,
  AlertCircle,
  ShoppingBag,
  Sparkles,
  Flame,
  ShieldCheck,
  Clock,
  LogIn,
  ChefHat,
  Info,
} from "lucide-react";
import { Food, formatPaise, money } from "@/lib/api";
import { useNutriverse } from "@/components/NutriverseProvider";

interface BarcodeLandingProps {
  barcode: string;
  initialFood: Food | null;
}

export default function BarcodeLandingClient({ barcode, initialFood }: BarcodeLandingProps) {
  const { currentUser, handleAddToCart, setAuthModalOpen, allRecipes } = useNutriverse();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const sampleBarcodes = [
    { code: "8901234567890", name: "Sprouted Desi Chickpeas" },
    { code: "8901234567891", name: "Organic Rolled Oats" },
    { code: "8901234567893", name: "Probiotic Greek Yoghurt" },
    { code: "8901234567896", name: "Organic Chia Seeds" },
  ];

  if (!initialFood) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shadow-lg">
          <ScanLine className="w-10 h-10 animate-pulse" />
        </div>

        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100/70 px-3 py-1 rounded-full">
            Unrecognized Barcode
          </span>
          <h1 className="text-2xl font-black text-gray-900 mt-3">
            Barcode Not Found in Nutriverse Catalog
          </h1>
          <p className="text-xs text-gray-600 mt-2">
            No active product matched barcode <span className="font-mono font-bold text-gray-900">{barcode}</span>.
          </p>
        </div>

        <div className="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm space-y-3 text-left">
          <h3 className="text-xs font-bold text-gray-900">Try scanning these demo package codes:</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {sampleBarcodes.map((item) => (
              <Link
                key={item.code}
                href={`/p/${item.code}`}
                className="p-3 rounded-2xl bg-emerald-50/60 hover:bg-emerald-50 border border-emerald-200/70 text-xs text-emerald-950 font-medium flex items-center justify-between transition group"
              >
                <span>{item.name}</span>
                <span className="font-mono text-[10px] text-emerald-700 group-hover:underline">
                  {item.code.slice(-4)}
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className="pt-2">
          <Link
            href="/scanner"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-emerald-800 text-white text-xs font-bold shadow-md hover:bg-emerald-900 transition"
          >
            <ScanLine className="w-4 h-4" /> Open Camera / Optical Scanner
          </Link>
        </div>
      </div>
    );
  }

  const food = initialFood;
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
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 animate-in fade-in">
      {/* Packaging Scan Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 text-white p-6 sm:p-8 rounded-3xl shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-800/80 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-800 flex items-center justify-center text-emerald-300">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 block">
                Physical Package QR Verified
              </span>
              <span className="font-mono text-xs text-white/90">GTIN/EAN: {food.barcode}</span>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 border border-emerald-400/40 text-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Grounded Database Match
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3">
              <span>{food.emoji || "🥗"}</span>
              <span>{food.name}</span>
            </h1>
            <p className="text-xs text-emerald-200 mt-1 max-w-xl">
              {food.description}
            </p>
          </div>

          <div className="text-right sm:self-center">
            <span className="text-[11px] text-emerald-300 block">Single Unit</span>
            <span className="text-2xl font-black text-white">{formatPaise(food.price_paise)}</span>
            <span className="text-[10px] text-emerald-300 block">{food.unit}</span>
          </div>
        </div>
      </div>

      {/* Guest Notice & Authentication Shortcut */}
      {!currentUser && (
        <div className="p-4 bg-amber-50/80 border border-amber-200/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-950">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              Browsing as guest. You can view all nutrition data and prep methods. Sign in to log this food to your daily personal calorie target!
            </span>
          </div>
          <button
            type="button"
            onClick={() => setAuthModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-600 hover:bg-amber-700 text-white font-bold transition shrink-0"
          >
            <LogIn className="w-3.5 h-3.5" /> Sign In
          </button>
        </div>
      )}

      {/* Macronutrient Highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 text-center shadow-sm">
          <span className="text-[10px] uppercase font-bold text-gray-500 block">Energy</span>
          <span className="text-xl font-black text-gray-900 block mt-0.5">{food.calories} kcal</span>
          <span className="text-[10px] text-gray-500">per {food.serving_size}</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 text-center shadow-sm">
          <span className="text-[10px] uppercase font-bold text-emerald-700 block">Protein</span>
          <span className="text-xl font-black text-emerald-900 block mt-0.5">{food.protein_g}g</span>
          <span className="text-[10px] text-emerald-600">lean building blocks</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 text-center shadow-sm">
          <span className="text-[10px] uppercase font-bold text-blue-700 block">Complex Carbs</span>
          <span className="text-xl font-black text-blue-900 block mt-0.5">{food.carbs_g}g</span>
          <span className="text-[10px] text-blue-600">sustained glucose</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 text-center shadow-sm">
          <span className="text-[10px] uppercase font-bold text-amber-700 block">Healthy Fat</span>
          <span className="text-xl font-black text-amber-900 block mt-0.5">{food.fat_g}g</span>
          <span className="text-[10px] text-amber-600">lipids & cell walls</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 text-center shadow-sm">
          <span className="text-[10px] uppercase font-bold text-teal-700 block">Fiber</span>
          <span className="text-xl font-black text-teal-900 block mt-0.5">{food.fibre_g}g</span>
          <span className="text-[10px] text-teal-600">microbiome & gut</span>
        </div>
      </div>

      {/* Preparation Methods from Physical QR */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <Clock className="w-4 h-4 text-emerald-600" /> Optimal Preparation & Bioavailability Methods
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {prepMethods.map((method, idx) => (
            <div
              key={method}
              className="p-4 rounded-2xl bg-emerald-50/40 border border-emerald-100 space-y-1"
            >
              <span className="text-[10px] font-bold uppercase text-emerald-700">
                Method #{idx + 1}
              </span>
              <h4 className="text-xs font-bold text-gray-900">{method}</h4>
              <p className="text-[11px] text-gray-600">
                Preserves vital enzymes and essential micronutrients.
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Micronutrients and Storage */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Object.keys(vitamins).length > 0 && (
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Verified Micronutrients
            </h3>
            <div className="space-y-2">
              {Object.entries(vitamins).map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs py-1 border-b border-gray-50">
                  <span className="text-gray-600 capitalize">{k.replace(/_/g, " ")}:</span>
                  <span className="font-bold text-emerald-900">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-emerald-600" /> Storage & Ingredients
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

      {/* Add to Bag Floating Action */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Order More from Nutriverse</h3>
          <p className="text-xs text-gray-500">
            Delivered fresh within 15–30 minutes in Vijayawada.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center border border-gray-200 rounded-2xl overflow-hidden bg-gray-50">
            <button
              type="button"
              onClick={() => setQty(Math.max(1, qty - 1))}
              className="px-3.5 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100"
            >
              -
            </button>
            <span className="px-3 text-xs font-bold text-gray-900">{qty}</span>
            <button
              type="button"
              onClick={() => setQty(qty + 1)}
              className="px-3.5 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100"
            >
              +
            </button>
          </div>

          <button
            type="button"
            onClick={onAdd}
            className="flex-1 sm:flex-none py-3 px-6 rounded-2xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold shadow-lg transition flex items-center justify-center gap-2"
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
  );
}
