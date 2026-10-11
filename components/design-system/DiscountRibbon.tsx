import React from "react";
import { formatInrPaise } from "./PriceTag";

export interface DiscountRibbonProps {
  pricePaise: number;
  mrpPaise?: number;
  format?: "percent" | "amount";
  className?: string;
}

/**
 * DiscountRibbon
 * Rule: Render ONLY when mrp > price. Otherwise renders nothing.
 * Dense layout, radius 8-10px, 1px border.
 */
export const DiscountRibbon: React.FC<DiscountRibbonProps> = ({
  pricePaise,
  mrpPaise,
  format = "percent",
  className = "",
}) => {
  if (!mrpPaise || mrpPaise <= pricePaise) {
    return null;
  }

  const savingsPaise = mrpPaise - pricePaise;
  const percentOff = Math.round((savingsPaise / mrpPaise) * 100);

  const label =
    format === "percent"
      ? `${percentOff}% OFF`
      : `SAVE ${formatInrPaise(savingsPaise)}`;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide bg-[#C1872B]/10 text-[#C1872B] border border-[#C1872B]/30 rounded-[8px] ${className}`}
    >
      {label}
    </span>
  );
};
