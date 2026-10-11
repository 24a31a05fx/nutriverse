import React, { useState } from "react";
import Image from "next/image";
import { Plus, ImageOff, Bell } from "lucide-react";
import { VegDot } from "./VegDot";
import { PriceTag } from "./PriceTag";
import { DiscountRibbon } from "./DiscountRibbon";
import { UnitChip } from "./UnitChip";
import { NutrientBadge } from "./NutrientBadge";
import { QtyStepper } from "./QtyStepper";

export interface ProductCardUnitOption {
  unit: string;
  pricePaise: number;
  mrpPaise?: number;
}

export interface ProductCardProps {
  id: string;
  name: string;
  localName?: string;
  category?: string;
  imageUrl?: string;
  imageAlt?: string;
  imageApprovalStatus?: "approved" | "pending" | "fallback";
  pricePaise: number;
  mrpPaise?: number;
  unit?: string;
  unitOptions?: ProductCardUnitOption[];
  nutrientHighlight?: {
    label: string;
    value?: string;
    type?: "protein" | "fibre" | "vitamins" | "fats" | "minerals" | "carbs" | "general";
    verified?: boolean;
  };
  inStock?: boolean;
  stockQty?: number;
  quantityInCart?: number;
  variant?: "rail" | "compact" | "list";
  onAddToCart?: (unit: string, qty: number) => void;
  onUpdateQuantity?: (newQty: number) => void;
  onNotifyMe?: () => void;
  onClick?: () => void;
  className?: string;
}

/**
 * Neutral Branded Fallback Tile
 * Rendered when no approved photo is uploaded or image fails.
 * Clean, line-bordered, with explicit "Pending Approval" or "Nutriverse Sourced" label.
 */
export const ProductImageFallback: React.FC<{ name: string; status?: string }> = ({
  name,
  status = "pending",
}) => (
  <div className="w-full h-full bg-[#F6F1E4] border border-[#DDD3B8] rounded-[8px] flex flex-col items-center justify-center p-3 text-center select-none">
    <div className="w-8 h-8 rounded-[6px] border border-[#DDD3B8] bg-white flex items-center justify-center text-[#6B7A45] mb-1.5">
      <ImageOff className="w-4 h-4" />
    </div>
    <span className="text-[11px] font-bold text-[#232A16] line-clamp-1">{name}</span>
    <span className="text-[9px] font-mono uppercase tracking-wider text-[#C1872B] mt-0.5">
      {status === "pending" ? "Photo pending approval" : "Nutriverse Verified"}
    </span>
  </div>
);

/**
 * ProductCard
 * Core retail catalog component supporting rail, compact, and list presentations.
 * Strictly adheres to 1px line border, 8-10px radius, 12-14px text, no shadows/gradients.
 */
export const ProductCard: React.FC<ProductCardProps> = ({
  id,
  name,
  localName,
  category,
  imageUrl,
  imageAlt,
  imageApprovalStatus = "approved",
  pricePaise,
  mrpPaise,
  unit = "1 unit",
  unitOptions,
  nutrientHighlight,
  inStock = true,
  stockQty = 10,
  quantityInCart = 0,
  variant = "compact",
  onAddToCart,
  onUpdateQuantity,
  onNotifyMe,
  onClick,
  className = "",
}) => {
  const [selectedUnitIdx, setSelectedUnitIdx] = useState(0);
  const [imgError, setImgError] = useState(false);

  const activeOption =
    unitOptions && unitOptions[selectedUnitIdx]
      ? unitOptions[selectedUnitIdx]
      : { unit, pricePaise, mrpPaise };

  const currentPrice = activeOption.pricePaise;
  const currentMrp = activeOption.mrpPaise;

  const showFallback =
    !imageUrl ||
    imgError ||
    imageApprovalStatus === "pending" ||
    imageApprovalStatus === "fallback";

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onAddToCart) {
      onAddToCart(activeOption.unit, 1);
    }
  };

  // --- LIST VARIANT (Dense row) ---
  if (variant === "list") {
    return (
      <div
        onClick={onClick}
        className={`group p-3 rounded-[10px] border border-[#DDD3B8] hover:border-[#6B7A45] bg-white transition-colors cursor-pointer flex items-center justify-between gap-4 ${className}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-16 h-16 rounded-[8px] overflow-hidden relative shrink-0 border border-[#DDD3B8]">
            {showFallback ? (
              <ProductImageFallback name={name} status={imageApprovalStatus} />
            ) : (
              <Image
                src={imageUrl!}
                alt={imageAlt || name}
                fill
                sizes="64px"
                onError={() => setImgError(true)}
                className="object-cover"
              />
            )}
          </div>

          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <VegDot size="sm" />
              <h3 className="font-heading text-xs font-bold text-[#232A16] truncate group-hover:text-[#3E4A26] transition-colors">
                {name}
              </h3>
              {localName && (
                <span className="text-[11px] text-[#6B7A45] truncate">
                  ({localName})
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <PriceTag
                pricePaise={currentPrice}
                mrpPaise={currentMrp}
                unit={activeOption.unit}
                size="sm"
              />
              <DiscountRibbon pricePaise={currentPrice} mrpPaise={currentMrp} />
            </div>

            {nutrientHighlight && (
              <NutrientBadge
                type={nutrientHighlight.type || "general"}
                label={nutrientHighlight.label}
                value={nutrientHighlight.value}
                verified={nutrientHighlight.verified}
                size="sm"
              />
            )}
          </div>
        </div>

        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
          {!inStock ? (
            <button
              type="button"
              onClick={onNotifyMe}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-[8px] border border-[#DDD3B8] text-[#6B7A45] hover:bg-[#F6F1E4] transition-colors"
            >
              <Bell className="w-3 h-3 text-[#C1872B]" />
              <span>Notify me</span>
            </button>
          ) : quantityInCart > 0 ? (
            <QtyStepper
              value={quantityInCart}
              onChange={(q) => onUpdateQuantity && onUpdateQuantity(q)}
              size="sm"
            />
          ) : (
            <button
              type="button"
              onClick={handleAdd}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-[8px] bg-[#3E4A26] text-[#F6F1E4] hover:bg-[#232A16] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>ADD</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // --- RAIL / COMPACT VARIANT ---
  const isRail = variant === "rail";

  return (
    <div
      onClick={onClick}
      className={`group cursor-pointer rounded-[10px] border border-[#DDD3B8] hover:border-[#6B7A45] bg-white transition-colors flex flex-col justify-between overflow-hidden ${
        isRail ? "w-48 shrink-0" : "w-full"
      } ${className}`}
    >
      {/* Top Media Container */}
      <div className="relative w-full h-36 bg-[#F6F1E4] border-b border-[#DDD3B8] overflow-hidden">
        {/* Top-left veg mark */}
        <div className="absolute top-2 left-2 z-10">
          <VegDot size="sm" />
        </div>

        {/* Top-right discount ribbon */}
        {currentMrp && currentMrp > currentPrice && (
          <div className="absolute top-2 right-2 z-10">
            <DiscountRibbon pricePaise={currentPrice} mrpPaise={currentMrp} />
          </div>
        )}

        {/* Product Photograph or Neutral Fallback */}
        <div className="absolute inset-0 flex items-center justify-center p-2">
          {showFallback ? (
            <ProductImageFallback name={name} status={imageApprovalStatus} />
          ) : (
            <Image
              src={imageUrl!}
              alt={imageAlt || name}
              fill
              sizes="(max-width: 640px) 180px, 240px"
              onError={() => setImgError(true)}
              className="object-cover group-hover:scale-105 transition-transform duration-200"
            />
          )}
        </div>

        {/* Availability Badge */}
        {!inStock && (
          <div className="absolute bottom-2 left-2 z-10 px-2 py-0.5 rounded-[4px] bg-[#232A16]/80 text-[#F6F1E4] text-[10px] font-bold">
            Out of stock
          </div>
        )}
      </div>

      {/* Content Details */}
      <div className="p-3 flex flex-col flex-1 justify-between space-y-2">
        <div className="space-y-1">
          {category && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7A45] block">
              {category}
            </span>
          )}

          <h3 className="font-heading text-xs sm:text-sm font-bold text-[#232A16] leading-snug line-clamp-1 group-hover:text-[#3E4A26] transition-colors">
            {name}
          </h3>

          {localName && (
            <p className="text-[11px] text-[#6B7A45] line-clamp-1 font-medium">
              ({localName})
            </p>
          )}

          {nutrientHighlight && (
            <div className="pt-0.5">
              <NutrientBadge
                type={nutrientHighlight.type || "general"}
                label={nutrientHighlight.label}
                value={nutrientHighlight.value}
                verified={nutrientHighlight.verified}
                size="sm"
              />
            </div>
          )}
        </div>

        {/* Unit Selection & Pricing & Add Stepper */}
        <div className="pt-2 border-t border-[#DDD3B8] space-y-2">
          {unitOptions && unitOptions.length > 1 && (
            <div
              className="flex items-center gap-1 overflow-x-auto pb-1"
              onClick={(e) => e.stopPropagation()}
            >
              {unitOptions.map((opt, idx) => (
                <UnitChip
                  key={opt.unit}
                  label={opt.unit}
                  selected={selectedUnitIdx === idx}
                  onClick={() => setSelectedUnitIdx(idx)}
                />
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <PriceTag
              pricePaise={currentPrice}
              mrpPaise={currentMrp}
              unit={unitOptions && unitOptions.length > 1 ? undefined : activeOption.unit}
              showTaxNote={false}
              size="sm"
            />

            <div onClick={(e) => e.stopPropagation()}>
              {!inStock ? (
                <button
                  type="button"
                  onClick={onNotifyMe}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded-[6px] border border-[#DDD3B8] text-[#6B7A45] hover:bg-[#F6F1E4] transition-colors"
                >
                  <Bell className="w-2.5 h-2.5 text-[#C1872B]" />
                  <span>Notify</span>
                </button>
              ) : quantityInCart > 0 ? (
                <QtyStepper
                  value={quantityInCart}
                  onChange={(q) => onUpdateQuantity && onUpdateQuantity(q)}
                  size="sm"
                />
              ) : (
                <button
                  type="button"
                  onClick={handleAdd}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-[6px] bg-[#3E4A26] text-[#F6F1E4] hover:bg-[#232A16] transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  <span>ADD</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
