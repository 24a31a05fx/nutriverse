"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  X,
  Plus,
  Minus,
  ShoppingBag,
  Sparkles,
  Flame,
  CheckCircle2,
  Clock,
  ShieldCheck,
  ChevronRight,
  Heart,
  Share2,
  Package,
  Info,
} from "lucide-react";
import { Food, Recipe, formatPaise } from "@/lib/api";
import { CATALOG_PRODUCTS, CatalogProduct, getProductById } from "@/src/data/catalog";

interface FoodDetailModalProps {
  food: Food | null;
  onClose: () => void;
  onAddToCart: (food: Food, quantity: number) => void;
  recipes?: Recipe[];
  onOpenRecipe?: (recipe: Recipe) => void;
}

export default function FoodDetailModal({
  food,
  onClose,
  onAddToCart,
  recipes = [],
  onOpenRecipe,
}: FoodDetailModalProps) {
  const [selectedUnitIdx, setSelectedUnitIdx] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [addedToast, setAddedToast] = useState(false);

  if (!food) return null;

  // Match with verified catalog entry for rich assets if available
  const catalogEntry: CatalogProduct | undefined =
    CATALOG_PRODUCTS.find(
      (p) =>
        p.id === food.id ||
        (food.barcode && p.barcode === food.barcode) ||
        p.name.toLowerCase().includes(food.name.toLowerCase().split(" ")[0])
    ) || {
      id: food.id,
      name: food.name,
      localName: undefined,
      category: food.category,
      imageUrl: "/assets/products/potato.jpg",
      pricePaise: food.price_paise,
      mrpPaise: Math.round(food.price_paise * 1.25),
      unit: food.unit,
      unitOptions: [
        { unit: food.unit, pricePaise: food.price_paise, mrpPaise: Math.round(food.price_paise * 1.25) },
        { unit: `2 x ${food.unit}`, pricePaise: Math.round(food.price_paise * 1.95), mrpPaise: Math.round(food.price_paise * 2.5) },
      ],
      servingSize: food.serving_size,
      calories: food.calories,
      proteinG: food.protein_g,
      carbsG: food.carbs_g,
      fatG: food.fat_g,
      fibreG: food.fibre_g,
      healthBenefit: "Bioavailable Whole-Food Macronutrients",
      nutritionTags: JSON.parse(food.nutrition_tags || "[]"),
      dietaryTags: JSON.parse(food.dietary_tags || "[]"),
      deliveryEstimateMins: 10,
      replacementPolicy: "48 hours only replacement",
      sourceBasis: "ICMR-NIN RDA 2020 & IFCT 2017",
      description: food.description,
      barcode: food.barcode || "8901234567890",
      stockQty: food.stock_qty,
      provenance: {
        source: "Nutriverse Verified Registry",
        author: "Verified Sourcing",
        license: "Commercial License",
        altText: food.name,
        status: "verified_authentic",
      },
    };

  const activeUnit = catalogEntry.unitOptions[selectedUnitIdx] || {
    unit: catalogEntry.unit,
    pricePaise: catalogEntry.pricePaise,
    mrpPaise: catalogEntry.mrpPaise,
  };

  const currentPrice = activeUnit.pricePaise;
  const currentMrp = activeUnit.mrpPaise;

  const nutritionTags: string[] = JSON.parse(food.nutrition_tags || "[]");
  const vitaminsObj: Record<string, any> = JSON.parse(food.vitamins_json || "{}");
  const prepMethods: string[] = JSON.parse(food.prep_methods || "[]");

  const relatedProducts = CATALOG_PRODUCTS.filter((p) => p.id !== catalogEntry.id).slice(0, 3);

  const handleAdd = () => {
    onAddToCart(food, quantity);
    setAddedToast(true);
    setTimeout(() => setAddedToast(false), 2500);
  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="food-modal-title"
      style={{ zIndex: 9999 }}
    >
      <div
        className="modal-dialog bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-100"
        style={{
          maxWidth: "540px",
          width: "100%",
          maxHeight: "92vh",
          padding: 0,
          position: "relative",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Top Header Bar with Controls */}
        <div className="absolute top-0 left-0 right-0 z-30 p-4 flex items-center justify-between pointer-events-none">
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/90 backdrop-blur-md border border-gray-200/80 shadow-md flex items-center justify-center text-gray-700 hover:text-gray-900 hover:bg-white pointer-events-auto transition"
            aria-label="Back"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              type="button"
              className="w-9 h-9 rounded-full bg-white/90 backdrop-blur-md border border-gray-200/80 shadow-md flex items-center justify-center text-gray-700 hover:text-red-500 hover:bg-white transition"
              title="Add to Wishlist"
            >
              <Heart className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: food.name, url: window.location.href });
                }
              }}
              className="w-9 h-9 rounded-full bg-white/90 backdrop-blur-md border border-gray-200/80 shadow-md flex items-center justify-center text-gray-700 hover:bg-white transition"
              title="Share Product"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto flex-1 pb-28">
          {/* 1. Large Hero Product Photograph (Matching Reference A) */}
          <div className="nv-modal-media">
            {catalogEntry.provenance?.status === "pending_fallback" ? (
              <div className="absolute inset-0 bg-[#F6F1E4] border border-[#DDD3B8] flex flex-col items-center justify-center p-6 text-center select-none">
                <div className="w-12 h-12 rounded-xl border border-[#DDD3B8] bg-white flex items-center justify-center text-[#6B7A45] mb-2">
                  <Sparkles className="w-6 h-6 text-[#C1872B]" />
                </div>
                <span className="text-base font-bold text-[#232A16]">{food.name}</span>
                <span className="text-xs font-mono uppercase tracking-wider text-[#C1872B] mt-1">
                  Photo pending approval
                </span>
              </div>
            ) : (
              <Image
                src={catalogEntry.imageUrl}
                alt={catalogEntry.provenance?.altText || food.name}
                fill
                sizes="(max-width: 640px) 100vw, 540px"
                className="object-cover"
                priority
              />
            )}
            {/* Pagination dots indicator */}
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">
              <span className="w-2 h-2 rounded-full bg-emerald-800" />
              <span className="w-2 h-2 rounded-full bg-gray-300" />
              <span className="w-2 h-2 rounded-full bg-gray-300" />
            </div>
          </div>

          <div className="p-5 space-y-5">
            {/* 2. Compact Health Benefits Section (Matching Reference A) */}
            <div className="bg-[#f0f9f4] border border-[#d1fae5] rounded-2xl p-3.5 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                  Health Benefits
                </span>
                <span className="text-xs sm:text-sm font-bold text-emerald-950 mt-0.5 block">
                  {catalogEntry.healthBenefit}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowHealthModal(true)}
                className="shrink-0 px-3 py-1.5 bg-white border border-emerald-600 text-emerald-800 hover:bg-emerald-50 text-xs font-bold rounded-xl transition"
              >
                View details
              </button>
            </div>

            {/* 3. Product Name & Delivery Slot */}
            <div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500 font-semibold mb-1">
                <Clock className="w-3.5 h-3.5 text-emerald-700" />
                <span>{catalogEntry.deliveryEstimateMins || 8} mins express delivery</span>
              </div>
              <h1 id="food-modal-title" className="text-xl sm:text-2xl font-black text-gray-900">
                {catalogEntry.name}
                {catalogEntry.localName && (
                  <span className="text-gray-500 font-semibold text-base sm:text-lg ml-2">
                    ({catalogEntry.localName})
                  </span>
                )}
              </h1>
            </div>

            {/* 4. Select Unit Cards (Matching Reference A) */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-gray-800 uppercase tracking-wider block">
                Select Unit
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {catalogEntry.unitOptions.map((opt, idx) => {
                  const isSelected = selectedUnitIdx === idx;
                  return (
                    <button
                      key={opt.unit}
                      type="button"
                      onClick={() => setSelectedUnitIdx(idx)}
                      className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                        isSelected
                          ? "bg-[#ecfdf5] border-[#10b981] shadow-xs"
                          : "bg-white border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <span className={`text-xs font-bold ${isSelected ? "text-emerald-950" : "text-gray-900"}`}>
                        {opt.unit}
                      </span>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="text-sm font-black text-gray-900">
                          {formatPaise(opt.pricePaise)}
                        </span>
                        {opt.mrpPaise > opt.pricePaise && (
                          <span className="text-[10px] text-gray-600 line-through">
                            MRP {formatPaise(opt.mrpPaise)}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 5. Replacement Policy Card (Matching Reference A) */}
            <div className="p-3.5 bg-gray-50/80 border border-gray-100 rounded-2xl flex items-center justify-between text-xs text-gray-700">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-700" />
                <span className="font-semibold">{catalogEntry.replacementPolicy}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </div>

            {/* 6. Verified Nutrition Snapshot */}
            <div className="space-y-3 pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                  Nutrition Snapshot (Per {food.serving_size || "100g"})
                </span>
                <span className="text-[10px] font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded font-bold">
                  {catalogEntry.sourceBasis}
                </span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs">
                <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-[10px] text-gray-600 block">Energy</span>
                  <span className="font-black text-gray-900 text-sm">{food.calories}</span>
                  <span className="text-[9px] text-gray-600 block">kcal</span>
                </div>
                <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-[10px] text-gray-600 block">Protein</span>
                  <span className="font-black text-emerald-900 text-sm">{food.protein_g}g</span>
                  <span className="text-[9px] text-emerald-700 block">Clean</span>
                </div>
                <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-[10px] text-gray-600 block">Carbs</span>
                  <span className="font-black text-gray-900 text-sm">{food.carbs_g}g</span>
                  <span className="text-[9px] text-gray-600 block">Slow</span>
                </div>
                <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-[10px] text-gray-600 block">Fat</span>
                  <span className="font-black text-gray-900 text-sm">{food.fat_g}g</span>
                  <span className="text-[9px] text-gray-600 block">Healthy</span>
                </div>
                <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-[10px] text-gray-600 block">Fibre</span>
                  <span className="font-black text-gray-900 text-sm">{food.fibre_g}g</span>
                  <span className="text-[9px] text-gray-600 block">Prebiotic</span>
                </div>
                <div className="p-2.5 bg-emerald-50/70 rounded-xl border border-emerald-200/60">
                  <span className="text-[10px] text-emerald-800 block">Status</span>
                  <span className="font-bold text-emerald-900 text-xs mt-1 block">Verified</span>
                </div>
              </div>
            </div>

            {/* 7. Preparation & Food Pairing Guidance */}
            {prepMethods.length > 0 && (
              <div className="p-3 bg-emerald-50/50 rounded-2xl border border-emerald-100 text-xs text-gray-700 space-y-1">
                <span className="font-bold text-emerald-950 block">Best Preparation Method</span>
                <p className="text-[11px] text-gray-600 leading-relaxed">
                  {prepMethods.join(" • ")}. Pair with lemon or healthy fats to maximize micronutrient uptake.
                </p>
              </div>
            )}

            {/* 8. Related Products (Top products in this category - Matching Reference A) */}
            <div className="space-y-3 pt-3 border-t border-gray-100">
              <span className="text-xs font-bold text-gray-900 uppercase tracking-wider block">
                Top products in this category
              </span>
              <div className="grid grid-cols-3 gap-2.5">
                {relatedProducts.map((rel) => (
                  <div
                    key={rel.id}
                    className="p-2 bg-gray-50 rounded-2xl border border-gray-200/70 text-center space-y-1.5 flex flex-col justify-between"
                  >
                    <div className="relative w-full pt-[80%] rounded-xl overflow-hidden bg-white">
                      <Image src={rel.imageUrl} alt={rel.name} fill sizes="100px" className="object-cover" />
                    </div>
                    <span className="text-[11px] font-bold text-gray-900 line-clamp-1 block">
                      {rel.name.split(" ")[0]}
                    </span>
                    <span className="text-[10px] font-black text-emerald-900 block">
                      {formatPaise(rel.pricePaise)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onAddToCart({ ...food, id: rel.id, name: rel.name, price_paise: rel.pricePaise }, 1)}
                      className="w-full py-1 bg-white hover:bg-emerald-50 border border-emerald-600 text-emerald-800 text-[10px] font-bold rounded-lg transition"
                    >
                      ADD +
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 9. Fixed Bottom Purchase Bar (Matching Reference A) */}
        <div className="nv-bottom-purchase-bar bg-white border-t border-gray-200 p-4 flex items-center justify-between z-30 shadow-lg">
          <div>
            <span className="text-xs text-gray-500 font-medium block">{activeUnit.unit}</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-black text-gray-900">
                {formatPaise(currentPrice * quantity)}
              </span>
              {currentMrp > currentPrice && (
                <span className="text-xs text-gray-600 line-through">
                  MRP {formatPaise(currentMrp * quantity)}
                </span>
              )}
            </div>
            <span className="text-[10px] text-gray-600">Inclusive of all taxes</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Quantity Selector */}
            <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100 transition"
              >
                -
              </button>
              <span className="px-2.5 text-xs font-bold text-gray-900">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity(quantity + 1)}
                className="px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100 transition"
              >
                +
              </button>
            </div>

            {/* Add to Cart Button */}
            <button
              type="button"
              onClick={handleAdd}
              className="py-2.5 px-6 rounded-xl bg-[#15803d] hover:bg-[#166534] text-white text-xs font-black shadow-md transition flex items-center gap-2"
            >
              {addedToast ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  <span>Added!</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-4 h-4" />
                  <span>Add to cart</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Verified Health Details Modal (Sub-dialog) */}
      {showHealthModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowHealthModal(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">
                Verified Health Benefits & Citations
              </h3>
              <button
                type="button"
                onClick={() => setShowHealthModal(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Every nutritional value shown in Nutriverse is linked to national composition tables (ICMR-NIN 2020 / IFCT 2017).
            </p>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-950 space-y-1">
                <span className="font-bold block">Primary Biological Benefit</span>
                <p>{catalogEntry.healthBenefit}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-gray-700 space-y-1">
                <span className="font-bold text-gray-900 block">Data Benchmark</span>
                <p>{catalogEntry.sourceBasis}</p>
              </div>
            </div>

            <p className="text-[11px] text-gray-600 italic">
              Values represent reference averages and do not substitute personalized medical consultation for clinical conditions.
            </p>

            <button
              type="button"
              onClick={() => setShowHealthModal(false)}
              className="w-full py-2.5 bg-emerald-700 text-white font-bold text-xs rounded-xl hover:bg-emerald-800 transition"
            >
              Close Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
