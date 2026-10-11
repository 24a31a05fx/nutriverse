import React from "react";
import { Check, Sparkles } from "lucide-react";

export interface TierCardProps {
  tier: "basic" | "minimal_plus" | "premium";
  title: string;
  subtitle?: string;
  indicativePriceRange: string; // e.g. "₹600–₹800"
  description: string;
  features: string[];
  selected?: boolean;
  onSelect?: () => void;
  ctaLabel?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * TierCard
 * Calin Pack Tier card adhering to:
 * - "Indicative price" labels per specification
 * - Dense 1px border layout, 8-10px radius
 * - Fraunces heading, Figtree body
 */
export const TierCard: React.FC<TierCardProps> = ({
  tier,
  title,
  subtitle,
  indicativePriceRange,
  description,
  features,
  selected = false,
  onSelect,
  ctaLabel = "Select Pack",
  disabled = false,
  className = "",
}) => {
  const tierBadges = {
    basic: {
      bg: "bg-[#F6F1E4]",
      border: "border-[#DDD3B8]",
      text: "text-[#3E4A26]",
      label: "Essential Balance",
    },
    minimal_plus: {
      bg: "bg-[#3E4A26]/10",
      border: "border-[#3E4A26]/30",
      text: "text-[#3E4A26]",
      label: "Nutrient-Dense Staples",
    },
    premium: {
      bg: "bg-[#C1872B]/10",
      border: "border-[#C1872B]/30",
      text: "text-[#C1872B]",
      label: "Artisanal & Cold-Pressed",
    },
  }[tier];

  return (
    <div
      className={`rounded-[10px] border p-5 flex flex-col justify-between transition-all bg-white ${
        selected
          ? "border-[#3E4A26] ring-2 ring-[#3E4A26]/20"
          : "border-[#DDD3B8] hover:border-[#6B7A45]"
      } ${className}`}
    >
      <div className="space-y-3">
        {/* Tier category chip */}
        <div className="flex items-center justify-between gap-2">
          <span
            className={`inline-block px-2 py-0.5 rounded-[6px] text-[10px] font-bold uppercase tracking-wider border ${tierBadges.bg} ${tierBadges.border} ${tierBadges.text}`}
          >
            {tierBadges.label}
          </span>
          {tier === "minimal_plus" && (
            <span className="text-[10px] font-semibold text-[#3E4A26] flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" /> Most Popular
            </span>
          )}
        </div>

        {/* Title and Subtitle */}
        <div>
          <h3 className="font-heading text-lg font-bold text-[#232A16]">
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs text-[#6B7A45] font-medium mt-0.5">
              {subtitle}
            </p>
          )}
        </div>

        {/* Indicative Price Section */}
        <div className="py-2.5 px-3 rounded-[8px] bg-[#F6F1E4] border border-[#DDD3B8]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7A45] block">
            Indicative price
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="font-mono text-base font-black text-[#232A16]">
              {indicativePriceRange}
            </span>
            <span className="text-[11px] text-[#6B7A45]">/ weekly pack</span>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-[#232A16] leading-relaxed">
          {description}
        </p>

        {/* Feature bullets */}
        <div className="space-y-1.5 pt-2 border-t border-[#DDD3B8]">
          <span className="text-[11px] font-bold text-[#232A16] block mb-1">
            Pack standard includes:
          </span>
          {features.map((feat, idx) => (
            <div key={idx} className="flex items-start gap-2 text-xs text-[#6B7A45]">
              <Check className="w-3.5 h-3.5 text-[#3E4A26] shrink-0 mt-0.5" />
              <span className="leading-tight text-[#232A16]">{feat}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Button */}
      <div className="pt-4 mt-4 border-t border-[#DDD3B8]">
        <button
          type="button"
          disabled={disabled}
          onClick={onSelect}
          className={`w-full py-2.5 px-4 text-xs font-bold rounded-[8px] transition-colors focus:outline-none focus:ring-2 focus:ring-[#3E4A26]/30 ${
            selected
              ? "bg-[#3E4A26] text-[#F6F1E4] hover:bg-[#232A16]"
              : "bg-white text-[#3E4A26] border border-[#3E4A26] hover:bg-[#F6F1E4]"
          } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  );
};
