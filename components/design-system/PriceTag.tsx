import React from "react";

export interface PriceTagProps {
  pricePaise: number;
  mrpPaise?: number;
  unit?: string;
  showTaxNote?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Format integer paise into Indian Rupee display (e.g. 2900 -> ₹29, 3350 -> ₹33.50)
 */
export function formatInrPaise(paise: number): string {
  const rupees = paise / 100;
  return Number.isInteger(rupees)
    ? `₹${rupees.toLocaleString("en-IN")}`
    : `₹${rupees.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const PriceTag: React.FC<PriceTagProps> = ({
  pricePaise,
  mrpPaise,
  unit,
  showTaxNote = false,
  size = "md",
  className = "",
}) => {
  const hasDiscount = mrpPaise !== undefined && mrpPaise > pricePaise;

  const sizeClasses = {
    sm: {
      price: "text-xs font-bold",
      mrp: "text-[11px]",
      unit: "text-[11px]",
      tax: "text-[9px]",
    },
    md: {
      price: "text-sm font-black",
      mrp: "text-xs",
      unit: "text-xs",
      tax: "text-[10px]",
    },
    lg: {
      price: "text-lg font-black",
      mrp: "text-sm",
      unit: "text-xs",
      tax: "text-[11px]",
    },
  }[size];

  return (
    <div className={`inline-flex flex-col ${className}`}>
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <span className={`${sizeClasses.price} text-[#232A16]`}>
          {formatInrPaise(pricePaise)}
        </span>
        {hasDiscount && (
          <span className={`${sizeClasses.mrp} text-[#6B7A45] line-through font-medium`}>
            {formatInrPaise(mrpPaise!)}
          </span>
        )}
        {unit && (
          <span className={`${sizeClasses.unit} text-[#6B7A45] font-normal`}>
            / {unit}
          </span>
        )}
      </div>
      {showTaxNote && (
        <span className={`${sizeClasses.tax} text-[#6B7A45] mt-0.5`}>
          Incl. all taxes
        </span>
      )}
    </div>
  );
};
