"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Truck,
  Leaf,
  Layers,
  Activity,
  Heart,
  BookOpen,
  ShoppingBag,
  Zap,
  Info,
  Filter,
} from "lucide-react";
import { CATALOG_PRODUCTS, CatalogProduct } from "@/src/data/catalog";
import { ProductCard } from "@/components/ProductCard";
import { formatPaise } from "@/lib/api";
import {
  FibreIcon,
  VitaminsIcon,
  ProteinIcon,
  HealthyFatsIcon,
  MineralsIcon,
  CarbohydratesIcon,
} from "@/components/design-system";

interface StorefrontViewProps {
  onNavigateTab: (tab: string) => void;
  onOpenOnboarding: () => void;
  onAddToCart: (product: CatalogProduct, unit: string, qty: number) => void;
  onOpenDetail: (product: CatalogProduct) => void;
  cartItems?: Array<{ id: string; quantity: number; food_id?: string }>;
  cartTotalPaise?: number;
  onOpenCart?: () => void;
  searchFilter?: string;
}

const CATEGORIES = [
  { id: "all", label: "All products", icon: "🛒" },
  { id: "fresh_produce", label: "Fresh produce", icon: "🥬" },
  { id: "dal_pulses", label: "Dal and pulses", icon: "🥣" },
  { id: "rice_grains", label: "Rice and grains", icon: "🌾" },
  { id: "fruits", label: "Fruits", icon: "🍈" },
  { id: "vegetables", label: "Vegetables", icon: "🥔" },
  { id: "dairy_probiotics", label: "Dairy & Probiotics", icon: "🥛" },
  { id: "protein_rich", label: "Protein-rich foods", icon: "🌱" },
  { id: "vitamins_minerals", label: "Vitamins & minerals", icon: "🫐" },
  { id: "healthy_fats", label: "Healthy fats", icon: "🥑" },
  { id: "everyday_essentials", label: "Everyday essentials", icon: "✨" },
];

export const StorefrontView: React.FC<StorefrontViewProps> = ({
  onNavigateTab,
  onOpenOnboarding,
  onAddToCart,
  onOpenDetail,
  cartItems = [],
  cartTotalPaise = 0,
  onOpenCart,
  searchFilter = "",
}) => {
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Match the delivery threshold used by the cart and order APIs.
  const freeDeliveryThresholdPaise = 80000;
  const remainingForFreeDeliveryPaise = Math.max(0, freeDeliveryThresholdPaise - cartTotalPaise);
  const freeDeliveryProgress = Math.min(100, Math.round((cartTotalPaise / freeDeliveryThresholdPaise) * 100));

  // Map cart items by product ID
  const cartQtyMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of cartItems) {
      const key = item.food_id || item.id;
      map[key] = (map[key] || 0) + item.quantity;
    }
    return map;
  }, [cartItems]);

  // Filter products based on search query and selected category
  const filteredProducts = useMemo(() => {
    let list = CATALOG_PRODUCTS;

    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.localName && p.localName.toLowerCase().includes(q)) ||
          p.category.toLowerCase().includes(q) ||
          p.healthBenefit.toLowerCase().includes(q)
      );
    }

    if (selectedCategory === "all") return list;

    if (selectedCategory === "fresh_produce") {
      return list.filter((p) => ["Fresh produce", "Vegetables", "Fruits"].includes(p.category));
    }
    if (selectedCategory === "vegetables") {
      return list.filter((p) => ["Vegetables", "Fresh produce"].includes(p.category));
    }
    if (selectedCategory === "fruits") {
      return list.filter((p) => ["Fruits"].includes(p.category));
    }
    if (selectedCategory === "dal_pulses") {
      return list.filter((p) => ["Dal and pulses"].includes(p.category));
    }
    if (selectedCategory === "rice_grains") {
      return list.filter((p) => ["Rice and grains"].includes(p.category));
    }
    if (selectedCategory === "dairy_probiotics") {
      return list.filter((p) => ["Dairy & Probiotics"].includes(p.category));
    }
    if (selectedCategory === "protein_rich") {
      return list.filter((p) =>
        p.proteinG >= 5 || ["Dal and pulses", "Dairy & Probiotics"].includes(p.category) || p.nutritionTags.includes("protein_rich")
      );
    }
    if (selectedCategory === "healthy_fats") {
      return list.filter((p) => ["Healthy fats"].includes(p.category) || p.fatG >= 5);
    }
    if (selectedCategory === "vitamins_minerals") {
      return list.filter((p) =>
        ["Fruits", "Vegetables", "Fresh produce"].includes(p.category) || p.nutritionTags.some(t => t.includes("vitamin") || t.includes("mineral") || t.includes("iron"))
      );
    }
    if (selectedCategory === "everyday_essentials") {
      return list.filter((p) => ["Everyday essentials", "Fresh produce", "Dal and pulses", "Rice and grains", "Dairy & Probiotics"].includes(p.category));
    }

    return list;
  }, [selectedCategory, searchFilter]);

  // Split into curated sections when viewing all
  const freshHarvestProducts = useMemo(() => {
    return CATALOG_PRODUCTS.filter((p) =>
      ["Fresh produce", "Vegetables", "Fruits"].includes(p.category)
    );
  }, []);

  const proteinAndStapleProducts = useMemo(() => {
    return CATALOG_PRODUCTS.filter((p) =>
      ["Dal and pulses", "Rice and grains", "Healthy fats", "Everyday essentials", "Dairy & Probiotics"].includes(p.category)
    );
  }, []);

  return (
    <div className="nv-storefront space-y-6 pb-20">
      {/* 1. DELIVERY INCENTIVE BANNER (Reference B) */}
      <section className="nv-delivery-banner bg-gradient-to-r from-[#143e2b] via-[#1a4f37] to-[#143e2b] text-white px-4 py-3 sm:py-3.5 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-amber-300">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold flex items-center gap-1.5">
                <span>Free Delivery on Orders Above ₹800</span>
                {remainingForFreeDeliveryPaise > 0 ? (
                  <span className="text-amber-300 font-normal">
                    • Add {formatPaise(remainingForFreeDeliveryPaise)} more items to your bag
                  </span>
                ) : (
                  <span className="text-emerald-300 font-normal">
                    • Free delivery threshold achieved
                  </span>
                )}
              </p>
              <div className="w-48 sm:w-64 bg-white/20 rounded-full h-1.5 mt-1 overflow-hidden">
                <div
                  className="bg-amber-400 h-full rounded-full transition-all duration-300"
                  style={{ width: `${freeDeliveryProgress}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] text-emerald-200 hidden md:inline">
              Availability: Demo catalog (Vijayawada Pilot)
            </span>
            <button
              type="button"
              onClick={() => onNavigateTab("explorer")}
              className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-amber-950 font-bold text-xs rounded-full transition shadow-xs flex items-center gap-1"
            >
              <span>Shop Groceries</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </section>

      {/* 2. TEN-CATEGORY NAVIGATION STRIP (Reference B) */}
      <section className="nv-category-nav max-w-7xl mx-auto px-4 sm:px-6">
        <div className="overflow-x-auto no-scrollbar py-2 -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex items-center gap-2 sm:gap-3" style={{ minWidth: "max-content" }}>
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold transition whitespace-nowrap cursor-pointer border ${
                    isSelected
                      ? "bg-[#143e2b] text-white border-[#143e2b] shadow-sm"
                      : "bg-white hover:bg-emerald-50/50 text-gray-700 border-gray-200/90 shadow-2xs"
                  }`}
                >
                  <span className="text-base">{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 3. COMPACT VALUE PROPOSITION & QUICK ACCESS CARDS */}
      <section className="nv-storefront-intro max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
          {/* Main Proposition Pill */}
          <div className="nv-value-proposition md:col-span-8 bg-gradient-to-r from-[#faf6ef] via-[#f7f2e7] to-[#f4eee0] border border-[#e8dfcf] rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 bg-[#236b48] text-white text-[10px] font-bold rounded-full uppercase tracking-wider">
                  Nutriverse Sourcing Standard
                </span>
                <span className="text-xs text-gray-500 font-medium">
                  Verified Whole Foods • Zero Ultra-Processed Deceptions
                </span>
              </div>
              <h1 className="font-heading text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                Don&apos;t Just Eat. <span className="text-[#3E4A26]">Understand</span> Your Nutrition.
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed max-w-2xl">
                Choose food by what it offers your body. Every grocery staple is verified against IFCT 2017 and ICMR-NIN nutrition standards with transparent source basis.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-gray-200/70 mt-2">
              <button
                type="button"
                onClick={() => onNavigateTab("explorer")}
                className="px-4 py-2 bg-[#236b48] hover:bg-[#1a5338] text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5"
              >
                <span>Shop Groceries</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab("packs")}
                className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-800 border border-gray-300 font-bold text-xs rounded-xl shadow-2xs transition flex items-center gap-1.5"
              >
                <span>Build a Calin Pack</span>
              </button>
              <button
                type="button"
                onClick={onOpenOnboarding}
                className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold text-xs rounded-xl transition flex items-center gap-1.5"
              >
                <Activity className="w-3.5 h-3.5 text-amber-700" />
                <span>How Nutriverse Works</span>
              </button>
            </div>
          </div>

          {/* Calin Pack Quick Spotlight */}
          <div className="nv-pack-spotlight md:col-span-4 bg-gradient-to-br from-[#143e2b] to-[#0c281c] text-white rounded-2xl p-4 sm:p-5 flex flex-col justify-between border border-[#1b4d36] shadow-md">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/60">
                  Curated Bundles
                </span>
                <span className="text-[11px] font-mono text-amber-300">From ₹600/wk</span>
              </div>
              <h2 className="text-base font-extrabold text-white mt-2">Calin Synergistic Packs</h2>
              <p className="text-xs text-emerald-100/80 mt-1 leading-relaxed">
                Basic, Minimal Plus, or Premium food packs calibrated to hit your macro & micronutrient targets with nutritionist review.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab("packs")}
              className="mt-3 w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold text-xs rounded-xl shadow-xs transition text-center"
            >
              Explore 3 Pack Tiers →
            </button>
          </div>
        </div>
      </section>

      {/* 3.1 SIX NUTRIENT TILES (Phase 1 & 4 Specification) */}
      <section className="nv-nutrient-families max-w-7xl mx-auto px-4 sm:px-6">
        <div className="bg-white rounded-2xl border border-[#DDD3B8] p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7A45] block">
                Targeted Nutrition
              </span>
              <h2 className="font-heading text-sm sm:text-base font-bold text-[#232A16]">
                Explore Food by Nutrient Family
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab("explorer")}
              className="text-xs font-bold text-[#3E4A26] hover:underline"
            >
              All Nutrients →
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
            {[
              { id: "protein", label: "Protein", sub: "Pulse & Seed", icon: ProteinIcon },
              { id: "fibre", label: "Dietary Fibre", sub: "Whole Millets", icon: FibreIcon },
              { id: "vitamins", label: "Vitamins", sub: "Farm Produce", icon: VitaminsIcon },
              { id: "fats", label: "Healthy Fats", sub: "Cold-Pressed", icon: HealthyFatsIcon },
              { id: "minerals", label: "Minerals", sub: "Iron & Calcium", icon: MineralsIcon },
              { id: "carbs", label: "Complex Carbs", sub: "Slow-Release", icon: CarbohydratesIcon },
            ].map((nut) => {
              const IconComp = nut.icon;
              return (
                <button
                  key={nut.id}
                  type="button"
                  onClick={() => onNavigateTab("explorer")}
                  className="p-3 rounded-[10px] border border-[#DDD3B8] hover:border-[#3E4A26] hover:bg-[#F6F1E4]/50 transition-colors bg-white flex flex-col items-center text-center space-y-1.5 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-[#F6F1E4] border border-[#DDD3B8] flex items-center justify-center text-[#3E4A26]">
                    <IconComp size={18} />
                  </div>
                  <span className="text-xs font-bold text-[#232A16] block">{nut.label}</span>
                  <span className="text-[10px] text-[#6B7A45] block">{nut.sub}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. MAIN GROCERY CATALOG SECTIONS */}
      {selectedCategory !== "all" || searchFilter.trim() ? (
        /* Filtered Catalog Results */
        <section className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
                <span>{searchFilter.trim() ? `Search Results for "${searchFilter}"` : CATEGORIES.find(c => c.id === selectedCategory)?.label}</span>
                <span className="text-xs font-normal text-gray-500">({filteredProducts.length} items)</span>
              </h2>
              <p className="text-xs text-gray-500">All items verified against ICMR-NIN RDA benchmarks</p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className="text-xs font-semibold text-[#236b48] hover:underline"
            >
              View All Categories
            </button>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-gray-200 space-y-3">
              <Info className="w-8 h-8 text-gray-400 mx-auto" />
              <p className="text-sm font-semibold text-gray-700">No products found matching your filter</p>
              <button
                type="button"
                onClick={() => setSelectedCategory("all")}
                className="px-4 py-2 bg-[#236b48] text-white text-xs font-bold rounded-xl"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAddToCart={onAddToCart}
                  onOpenDetail={onOpenDetail}
                  cartQuantity={cartQtyMap[product.id] || 0}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        /* Default Quick-Commerce Sections Matching Reference B */
        <>
          {/* SECTION 1: FRESH HARVEST & KITCHEN PRODUCE */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-1.5">
                  <span>Fresh Harvest & Kitchen Produce</span>
                  <span className="text-xs font-bold text-[#236b48] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                    8–12 mins
                  </span>
                </h2>
                <p className="text-[11px] text-gray-500">
                  Potatoes, onions, garlic, greens & seasonal harvest with verified nutrient profiles
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCategory("fresh_produce")}
                className="text-xs font-bold text-[#236b48] hover:text-[#143e2b] flex items-center gap-1"
              >
                <span>See All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {freshHarvestProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAddToCart={onAddToCart}
                  onOpenDetail={onOpenDetail}
                  cartQuantity={cartQtyMap[product.id] || 0}
                />
              ))}
            </div>
          </section>

          {/* SECTION 2: PROTEIN & MICRONUTRIENT STAPLES */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 space-y-3 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-1.5">
                  <span>Protein, Pulses & Micronutrient Staples</span>
                  <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    High Biological Value
                  </span>
                </h2>
                <p className="text-[11px] text-gray-500">
                  Dals, quinoa, Greek yogurt, chia seeds & cold-pressed oils for sustained energy
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCategory("protein_rich")}
                className="text-xs font-bold text-[#236b48] hover:text-[#143e2b] flex items-center gap-1"
              >
                <span>See All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {proteinAndStapleProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAddToCart={onAddToCart}
                  onOpenDetail={onOpenDetail}
                  cartQuantity={cartQtyMap[product.id] || 0}
                />
              ))}
            </div>
          </section>
        </>
      )}

      {/* 5. CALIN PACKS 3-TIER SHOWCASE */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        <div className="bg-gradient-to-br from-[#143e2b] via-[#103424] to-[#0c281c] text-white rounded-3xl p-6 sm:p-10 shadow-xl space-y-6">
          <div className="max-w-2xl space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-amber-400 text-amber-950 text-[10px] font-extrabold rounded-full uppercase tracking-wider">
                Nutriverse Core Innovation
              </span>
              <span className="text-xs text-emerald-200">Weekly Whole-Food Synergies</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Calin Packs: Designed for Your Biological Baseline
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
              Stop guessing what to buy in grocery aisles. Calin Packs bundle whole foods matched to your Mifflin–St Jeor calorie needs, bioavailable protein requirements, and essential micronutrients.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {/* Basic Pack Card */}
            <div className="bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/15 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase text-emerald-300">Basic Tier</span>
                <h3 className="text-lg font-bold text-white">Calin Basic Pack</h3>
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-emerald-200 block">Indicative price</span>
                  <div className="text-2xl font-black text-white">
                    ₹600 – ₹800 <span className="text-xs text-emerald-200 font-normal">/ week</span>
                  </div>
                </div>
                <p className="text-xs text-gray-200 leading-relaxed">
                  Staple lentils (Moong Dal), rolled oats, baby spinach, potatoes and lemon pairing for foundational daily energy.
                </p>
                <div className="text-[11px] text-emerald-300 font-medium">
                  ✦ Foundational whole-food macro baseline
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab("packs")}
                className="w-full py-2.5 bg-white hover:bg-emerald-50 text-emerald-950 font-bold text-xs rounded-xl transition shadow-xs"
              >
                Customize Basic Pack →
              </button>
            </div>

            {/* Minimal Plus Card (Popular) */}
            <div className="bg-white/15 backdrop-blur-md p-5 rounded-2xl border border-amber-300/40 flex flex-col justify-between space-y-4 relative shadow-lg">
              <span className="absolute -top-3 right-4 bg-amber-400 text-amber-950 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
                Most Popular
              </span>
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase text-amber-300">Minimal Plus Tier</span>
                <h3 className="text-lg font-bold text-white">Calin Minimal Plus</h3>
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-amber-200 block">Indicative price</span>
                  <div className="text-2xl font-black text-white">
                    ₹800 – ₹1,200 <span className="text-xs text-emerald-200 font-normal">/ week</span>
                  </div>
                </div>
                <p className="text-xs text-gray-200 leading-relaxed">
                  Adds high-protein quinoa, organic chia seeds, Greek yogurt probiotics, and antioxidant blueberries.
                </p>
                <div className="text-[11px] text-amber-300 font-medium">
                  ✦ Targeted micronutrient density
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab("packs")}
                className="w-full py-2.5 bg-amber-400 hover:bg-amber-300 text-amber-950 font-bold text-xs rounded-xl transition shadow-xs"
              >
                Customize Minimal Plus →
              </button>
            </div>

            {/* Premium Card */}
            <div className="bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/15 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase text-emerald-300">Premium Tier</span>
                <h3 className="text-lg font-bold text-white">Calin Premium Pack</h3>
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-emerald-200 block">Indicative price</span>
                  <div className="text-2xl font-black text-white">
                    ₹1,500 – ₹1,800 <span className="text-xs text-emerald-200 font-normal">/ week</span>
                  </div>
                </div>
                <p className="text-xs text-gray-200 leading-relaxed">
                  Maximum density with California almonds, cold-pressed oils, fresh paneer, organic tofu, and complete micronutrient diversity.
                </p>
                <div className="text-[11px] text-emerald-300 font-medium">
                  ✦ Broad micronutrient diversity + Nutritionist review
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab("packs")}
                className="w-full py-2.5 bg-white hover:bg-emerald-50 text-emerald-950 font-bold text-xs rounded-xl transition shadow-xs"
              >
                Customize Premium Pack →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 6. HOW NUTRIVERSE WORKS & TRUST NOTES */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-[#236b48]">
              Methodology
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">How Nutriverse Works</h2>
            <p className="text-xs text-gray-500">
              Science-backed nutrition shopping in 4 simple steps
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-[#fbf9f5] border border-gray-100 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
                01
              </div>
              <h3 className="text-sm font-bold text-gray-900">Needs Calculation</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Enter your physical profile to estimate daily calorie and macro targets using Mifflin–St Jeor equations.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#fbf9f5] border border-gray-100 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
                02
              </div>
              <h3 className="text-sm font-bold text-gray-900">Nutrient-First Discovery</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Filter catalog by bioavailable iron, clean protein, potassium, or sulforaphane rather than brand names.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#fbf9f5] border border-gray-100 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
                03
              </div>
              <h3 className="text-sm font-bold text-gray-900">Synergistic Calin Packs</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Get a weekly grocery bundle calibrated to your biological needs, complete with food pairings that maximize absorption.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#fbf9f5] border border-gray-100 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
                04
              </div>
              <h3 className="text-sm font-bold text-gray-900">Nutritionist Guidance</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Request certified nutritionist review. Proposals require explicit customer confirmation before updating your pack.
              </p>
            </div>
          </div>

          {/* Trust Notes */}
          <div className="pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-gray-500">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#236b48] shrink-0 mt-0.5" />
              <span><strong>Verified Data Basis:</strong> Nutrient values sourced from Indian Food Composition Tables (IFCT 2017) and ICMR-NIN 2020 RDA.</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#236b48] shrink-0 mt-0.5" />
              <span><strong>Zero Fabricated Claims:</strong> Unverified micronutrients are explicitly marked as &quot;Not verified&quot;, never invented.</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#236b48] shrink-0 mt-0.5" />
              <span><strong>Professional Review:</strong> Calin Packs provide dietary food estimates, not medical diagnosis or prescriptions.</span>
            </div>
          </div>
        </div>
      </section>

      {/* 7. FLOATING CART SUMMARY PILL (Reference B) */}
      {cartItems.length > 0 && onOpenCart && (
        <div className="fixed bottom-16 md:bottom-6 left-1/2 transform -translate-x-1/2 z-40 animate-in fade-in slide-in-from-bottom-4">
          <button
            type="button"
            onClick={onOpenCart}
            className="flex items-center gap-3 px-5 py-3 bg-[#143e2b] hover:bg-[#0c281c] text-white rounded-full shadow-2xl border border-emerald-600/40 text-xs sm:text-sm font-bold transition transform hover:scale-105 cursor-pointer"
          >
            <div className="flex items-center gap-1.5">
              <ShoppingBag className="w-4 h-4 text-emerald-400" />
              <span>{cartItems.reduce((acc, it) => acc + it.quantity, 0)} items</span>
            </div>
            <span className="text-emerald-300">|</span>
            <span>{formatPaise(cartTotalPaise)}</span>
            <span className="flex items-center gap-1 text-emerald-300 hover:text-white pl-1">
              <span>View Bag</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
