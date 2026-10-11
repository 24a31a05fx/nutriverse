"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Heart, Plus, Minus, Check, Sparkles } from "lucide-react";
import { CatalogProduct } from "@/src/data/catalog";
import { formatPaise } from "@/lib/api";

interface ProductCardProps {
  product: CatalogProduct;
  onAddToCart: (product: CatalogProduct, unit: string, qty: number) => void;
  onOpenDetail: (product: CatalogProduct) => void;
  cartQuantity?: number;
  onUpdateQuantity?: (product: CatalogProduct, newQty: number) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onAddToCart,
  onOpenDetail,
  cartQuantity = 0,
  onUpdateQuantity,
}) => {
  const [selectedUnitIndex, setSelectedUnitIndex] = useState(0);
  const [isWishlisted, setIsWishlisted] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const saved = JSON.parse(localStorage.getItem("nutriverse_wishlist") || "[]");
      return saved.includes(product.id);
    } catch {
      return false;
    }
  });
  const [unitDropdownOpen, setUnitDropdownOpen] = useState(false);
  const [imgError, setImgError] = useState(false);

  const currentUnitOption = product.unitOptions && product.unitOptions[selectedUnitIndex]
    ? product.unitOptions[selectedUnitIndex]
    : { unit: product.unit, pricePaise: product.pricePaise, mrpPaise: product.mrpPaise };

  const currentPricePaise = currentUnitOption.pricePaise;
  const currentMrpPaise = currentUnitOption.mrpPaise;

  const discountPercent = currentMrpPaise > currentPricePaise
    ? Math.round(((currentMrpPaise - currentPricePaise) / currentMrpPaise) * 100)
    : 0;

  const toggleWishlist = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !isWishlisted;
    setIsWishlisted(next);
    try {
      const saved: string[] = JSON.parse(localStorage.getItem("nutriverse_wishlist") || "[]");
      const updated = next
        ? [...new Set([...saved, product.id])]
        : saved.filter((id) => id !== product.id);
      localStorage.setItem("nutriverse_wishlist", JSON.stringify(updated));
    } catch {}
  };

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddToCart(product, currentUnitOption.unit, 1);
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onUpdateQuantity) {
      onUpdateQuantity(product, cartQuantity + 1);
    } else {
      onAddToCart(product, currentUnitOption.unit, 1);
    }
  };

  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onUpdateQuantity) {
      onUpdateQuantity(product, Math.max(0, cartQuantity - 1));
    }
  };

  return (
    <div
      onClick={() => onOpenDetail(product)}
      className="nv-grocery-card group cursor-pointer bg-white border border-[#e5dfd5] hover:border-[#236b48] rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between"
      style={{ minWidth: "180px", position: "relative" }}
    >
      {/* Top Media Container */}
      <div className="nv-card-media">
        {/* Veg mark */}
        <div className="absolute top-2.5 left-2.5 z-10">
          <span className="nv-veg-mark" title="100% Vegetarian Whole Food" />
        </div>

        {/* Favorite heart */}
        <button
          type="button"
          onClick={toggleWishlist}
          title={isWishlisted ? "Remove from favorites" : "Save to favorites"}
          className="absolute top-2.5 right-2.5 z-10 w-7 h-7 rounded-full bg-white/90 backdrop-blur-sm border border-gray-100 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-white transition shadow-xs"
        >
          <Heart
            className={`w-4 h-4 ${isWishlisted ? "fill-red-500 text-red-500" : ""}`}
          />
        </button>

        {/* Product Photograph */}
        <div className="absolute inset-0 p-3 flex items-center justify-center">
          <div className="relative w-full h-full rounded-xl overflow-hidden">
            {imgError || product.provenance?.status === "pending_fallback" ? (
              <div className="w-full h-full bg-[#F6F1E4] border border-[#DDD3B8] rounded-xl flex flex-col items-center justify-center p-3 text-center select-none">
                <div className="w-8 h-8 rounded-lg border border-[#DDD3B8] bg-white flex items-center justify-center text-[#6B7A45] mb-1">
                  <Sparkles className="w-4 h-4 text-[#C1872B]" />
                </div>
                <span className="text-[11px] font-bold text-[#232A16] line-clamp-1">{product.name}</span>
                <span className="text-[9px] font-mono uppercase tracking-wider text-[#C1872B] mt-0.5">
                  Photo pending approval
                </span>
              </div>
            ) : (
              <Image
                src={product.imageUrl}
                alt={product.provenance?.altText || product.name}
                fill
                onError={() => setImgError(true)}
                sizes="(max-width: 640px) 180px, 240px"
                className="object-cover group-hover:scale-105 transition-transform duration-300"
              />
            )}
          </div>
        </div>

        {/* Delivery estimate badge */}
        <div className="absolute bottom-2 left-2.5 bg-white/95 backdrop-blur-sm px-2 py-0.5 rounded-md text-[10px] font-bold text-gray-700 shadow-xs flex items-center gap-1 border border-gray-100">
          <span>⚡ {product.deliveryEstimateMins || 10} mins</span>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-3.5 flex flex-col flex-1 justify-between space-y-2.5">
        <div>
          {/* Discount tag */}
          <div className="flex items-center justify-between gap-1 mb-1">
            {discountPercent > 0 ? (
              <span className="nv-discount-badge">{discountPercent}% OFF</span>
            ) : (
              <span className="text-[10px] font-bold uppercase text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded">
                Verified
              </span>
            )}
            <span className="text-[10px] font-mono text-gray-600 truncate max-w-[90px]">
              {product.category}
            </span>
          </div>

          {/* Product Title & Local Name */}
          <h3 className="text-xs sm:text-sm font-bold text-gray-900 leading-snug line-clamp-1 group-hover:text-emerald-900 transition">
            {product.name}
          </h3>
          {product.localName && (
            <p className="text-[11px] text-gray-600 line-clamp-1 font-medium">
              ({product.localName})
            </p>
          )}

          {/* Nutrient Highlight */}
          {product.healthBenefit && (
            <div className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-50/80 px-2 py-0.5 rounded-md border border-emerald-100/60">
              <Sparkles className="w-2.5 h-2.5 shrink-0 text-emerald-600" />
              <span className="truncate">{product.healthBenefit.split("•")[0]}</span>
            </div>
          )}
        </div>

        {/* Pricing, Unit Selector, and Add / Stepper CTA */}
        <div className="pt-2 border-t border-gray-100 space-y-2">
          {/* Unit Selector Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setUnitDropdownOpen(!unitDropdownOpen);
              }}
              className="w-full text-left flex items-center justify-between text-[11px] font-bold text-emerald-800 bg-emerald-50/50 hover:bg-emerald-100/50 px-2 py-1 rounded-md border border-emerald-200/60 transition"
            >
              <span>{currentUnitOption.unit}</span>
              <span className="text-[9px] text-emerald-700">▾</span>
            </button>

            {unitDropdownOpen && product.unitOptions && product.unitOptions.length > 1 && (
              <div
                className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 py-1 text-xs"
                onClick={(e) => e.stopPropagation()}
              >
                {product.unitOptions.map((opt, idx) => (
                  <button
                    key={opt.unit}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedUnitIndex(idx);
                      setUnitDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 flex items-center justify-between text-[11px] hover:bg-emerald-50 transition ${
                      selectedUnitIndex === idx ? "font-bold text-emerald-900 bg-emerald-50/60" : "text-gray-700"
                    }`}
                  >
                    <span>{opt.unit}</span>
                    <span className="font-semibold text-gray-900">{formatPaise(opt.pricePaise)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Pricing & Add Stepper */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-black text-gray-900">
                  {formatPaise(currentPricePaise)}
                </span>
                {currentMrpPaise > currentPricePaise && (
                  <span className="text-[11px] text-gray-600 line-through">
                    {formatPaise(currentMrpPaise)}
                  </span>
                )}
              </div>
              <span className="text-[9px] text-gray-600 block">Incl. all taxes</span>
            </div>

            {/* Quick Add or Quantity Stepper */}
            <div>
              {cartQuantity <= 0 ? (
                <button
                  type="button"
                  onClick={handleAdd}
                  className="nv-quick-add-btn flex items-center gap-1 shadow-xs"
                  title={`Add ${product.name} to cart`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>ADD</span>
                </button>
              ) : (
                <div className="nv-qty-stepper shadow-xs" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={handleDecrement}
                    title="Decrease quantity"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="min-w-[18px] text-center">{cartQuantity}</span>
                  <button
                    type="button"
                    onClick={handleIncrement}
                    title="Increase quantity"
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
