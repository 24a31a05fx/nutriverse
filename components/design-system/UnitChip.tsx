import React from "react";

export interface UnitChipProps {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  pricePaise?: number;
  className?: string;
}

/**
 * UnitChip
 * Dense, 1px border, 8-10px radius chip for selecting product units / variants.
 * Handles default, hover, focus, selected, and disabled states.
 */
export const UnitChip: React.FC<UnitChipProps> = ({
  label,
  selected = false,
  disabled = false,
  onClick,
  pricePaise,
  className = "",
}) => {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-between gap-1.5 px-2.5 py-1 text-xs rounded-[8px] border transition-colors focus:outline-none focus:ring-2 focus:ring-[#3E4A26]/30 ${
        disabled
          ? "bg-[#F6F1E4]/50 text-[#6B7A45]/40 border-[#DDD3B8]/60 cursor-not-allowed"
          : selected
          ? "bg-[#3E4A26] text-[#F6F1E4] border-[#3E4A26] font-semibold"
          : "bg-white text-[#232A16] border-[#DDD3B8] hover:border-[#6B7A45] hover:bg-[#F6F1E4]/40"
      } ${className}`}
    >
      <span>{label}</span>
      {pricePaise !== undefined && (
        <span
          className={`text-[11px] font-mono ${
            selected ? "text-[#F6F1E4]/90" : "text-[#6B7A45]"
          }`}
        >
          ₹{(pricePaise / 100).toFixed(0)}
        </span>
      )}
    </button>
  );
};
