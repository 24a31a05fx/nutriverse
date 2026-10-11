import React from "react";
import { Plus, Minus } from "lucide-react";

export interface QtyStepperProps {
  value: number;
  onChange: (newVal: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
  ariaLabel?: string;
}

/**
 * QtyStepper
 * Accessible quantity stepper control with min/max boundary protection.
 * Follows dense 8px rhythm, 8-10px radius, 1px border.
 */
export const QtyStepper: React.FC<QtyStepperProps> = ({
  value,
  onChange,
  min = 0,
  max = 99,
  disabled = false,
  size = "md",
  className = "",
  ariaLabel = "Quantity",
}) => {
  const isSm = size === "sm";

  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || value <= min) return;
    onChange(value - 1);
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || value >= max) return;
    onChange(value + 1);
  };

  return (
    <div
      className={`inline-flex items-center rounded-[8px] border border-[#3E4A26] bg-[#3E4A26] text-[#F6F1E4] select-none ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      } ${className}`}
      role="group"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        disabled={disabled || value <= min}
        onClick={handleDecrement}
        className={`flex items-center justify-center transition-colors hover:bg-[#6B7A45] active:bg-[#232A16] disabled:opacity-40 disabled:hover:bg-transparent ${
          isSm ? "w-6 h-6" : "w-7 h-7"
        }`}
        aria-label="Decrease quantity"
      >
        <Minus className={isSm ? "w-3 h-3" : "w-3.5 h-3.5"} />
      </button>

      <span
        className={`font-mono font-bold text-center ${
          isSm ? "min-w-[20px] text-xs" : "min-w-[24px] text-xs"
        }`}
        aria-live="polite"
      >
        {value}
      </span>

      <button
        type="button"
        disabled={disabled || value >= max}
        onClick={handleIncrement}
        className={`flex items-center justify-center transition-colors hover:bg-[#6B7A45] active:bg-[#232A16] disabled:opacity-40 disabled:hover:bg-transparent ${
          isSm ? "w-6 h-6" : "w-7 h-7"
        }`}
        aria-label="Increase quantity"
      >
        <Plus className={isSm ? "w-3 h-3" : "w-3.5 h-3.5"} />
      </button>
    </div>
  );
};
