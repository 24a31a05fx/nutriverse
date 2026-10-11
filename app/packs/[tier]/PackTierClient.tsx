"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Package,
  Sparkles,
  ShoppingBag,
  SlidersHorizontal,
  Flame,
  CheckCircle2,
  ChevronLeft,
  Calendar,
  Check,
} from "lucide-react";
import { CalinPackTier, Food, api, formatPaise, money } from "@/lib/api";
import { useNutriverse } from "@/components/NutriverseProvider";

export default function PackTierClient({ initialTier }: { initialTier: string }) {
  const router = useRouter();
  const { currentUser, handleAddPackToCart, setAuthModalOpen } = useNutriverse();

  const [pack, setPack] = useState<CalinPackTier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    const fetchTier = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api<CalinPackTier>(`/packs/${initialTier}`);
        setPack(data);
      } catch (err: any) {
        setError(err?.message || "Failed to load Calin Pack tier");
      } finally {
        setLoading(false);
      }
    };
    fetchTier();
  }, [initialTier]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-xs text-gray-500">
        Loading Calin Pack configuration...
      </div>
    );
  }

  if (error || !pack) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="text-lg font-bold text-gray-900">Pack Not Found</h2>
        <p className="text-xs text-gray-500">{error || "Invalid Calin Pack tier requested."}</p>
        <Link
          href="/packs"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-800 text-white text-xs font-bold"
        >
          View All Calin Packs
        </Link>
      </div>
    );
  }

  const items: Array<{ food_name: string; qty: string; category?: string }> = JSON.parse(
    pack.items_json || "[]"
  );

  const handleAdd = async () => {
    await handleAddPackToCart(pack.tier, pack.name, {
      tier: pack.tier,
      base_price_paise: pack.base_price_paise,
      items: items.map((i) => i.food_name),
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 animate-in fade-in">
      <Link
        href="/packs"
        className="inline-flex items-center gap-2 text-xs font-bold text-emerald-800 hover:text-emerald-950 transition"
      >
        <ChevronLeft className="w-4 h-4" /> Back to All Calin Packs
      </Link>

      <div className="bg-gradient-to-br from-emerald-950 to-teal-900 text-white p-8 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-900/60 px-3 py-1 rounded-full border border-emerald-700">
            {pack.tier.replace("_", " ").toUpperCase()} TIER
          </span>
          <h1 className="text-3xl font-black text-white">{pack.name}</h1>
          <p className="text-xs text-emerald-200 max-w-lg leading-relaxed">
            {pack.description}
          </p>
          <div className="text-xs text-emerald-300">
            <strong>Target Audience:</strong> {pack.target_audience}
          </div>
        </div>

        <div className="bg-emerald-900/40 p-6 rounded-2xl border border-emerald-800/80 text-center w-full md:w-auto shrink-0 space-y-3">
          <div>
            <span className="text-[10px] text-emerald-300 block">Weekly Package Price</span>
            <span className="text-3xl font-black text-white">{formatPaise(pack.base_price_paise)}</span>
          </div>

          <button
            type="button"
            onClick={handleAdd}
            className="w-full py-3 px-6 rounded-full bg-amber-400 hover:bg-amber-300 text-emerald-950 text-xs font-black shadow-lg transition flex items-center justify-center gap-2"
          >
            {added ? (
              <>
                <CheckCircle2 className="w-4 h-4" /> Added to Bag
              </>
            ) : (
              <>
                <ShoppingBag className="w-4 h-4" /> Add Pack to Bag
              </>
            )}
          </button>
        </div>
      </div>

      {/* Package Contents Grid */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Package className="w-4 h-4 text-emerald-600" /> Default Bundle Foods ({items.length} items)
          </h2>
          <span className="text-xs text-gray-500">
            Max substitutions: <strong>{pack.max_substitutions} items</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {items.map((it, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-between text-xs"
            >
              <div>
                <span className="font-bold text-gray-900 block">{it.food_name}</span>
                {it.category && (
                  <span className="text-[10px] text-gray-500 block">{it.category}</span>
                )}
              </div>
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200/60">
                {it.qty}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
