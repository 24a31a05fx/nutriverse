import React from "react";

export interface VegDotProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  title?: string;
}

/**
 * VegDot
 * Standard Indian food safety green vegetarian symbol:
 * 1px square border with a solid centered green dot.
 */
export const VegDot: React.FC<VegDotProps> = ({
  size = "md",
  className = "",
  title = "100% Vegetarian Whole Food",
}) => {
  const dimensions = {
    sm: "w-3 h-3 p-0.5",
    md: "w-4 h-4 p-0.5",
    lg: "w-5 h-5 p-1",
  }[size];

  const dotDimensions = {
    sm: "w-1.5 h-1.5",
    md: "w-2 h-2",
    lg: "w-2.5 h-2.5",
  }[size];

  return (
    <span
      className={`inline-flex items-center justify-center border border-[#3E4A26] rounded-[3px] bg-white ${dimensions} ${className}`}
      title={title}
      aria-label={title}
    >
      <span className={`rounded-full bg-[#3E4A26] ${dotDimensions}`} />
    </span>
  );
};
