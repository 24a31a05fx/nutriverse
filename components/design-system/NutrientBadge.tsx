import {
  FibreIcon,
  VitaminsIcon,
  ProteinIcon,
  HealthyFatsIcon,
  MineralsIcon,
  CarbohydratesIcon,
  NutrientIconProps,
} from "./NutrientIcons";

export type NutrientType =
  | "fibre"
  | "vitamins"
  | "protein"
  | "fats"
  | "minerals"
  | "carbs"
  | "general";

export interface NutrientBadgeProps {
  type?: NutrientType;
  label: string;
  value?: string;
  verified?: boolean;
  size?: "sm" | "md";
  className?: string;
}

const nutrientIconMap: Record<NutrientType, React.FC<NutrientIconProps>> = {
  fibre: FibreIcon,
  vitamins: VitaminsIcon,
  protein: ProteinIcon,
  fats: HealthyFatsIcon,
  minerals: MineralsIcon,
  carbs: CarbohydratesIcon,
  general: FibreIcon,
};

/**
 * NutrientBadge
 * Displays verified nutrient density highlight with custom line icons.
 * Follows dense layout: 8-10px radius, 1px border.
 */
export const NutrientBadge: React.FC<NutrientBadgeProps> = ({
  type = "general",
  label,
  value,
  verified = true,
  size = "md",
  className = "",
}) => {
  const IconComponent = nutrientIconMap[type] || FibreIcon;
  const isSm = size === "sm";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[8px] border font-medium transition-colors ${
        isSm ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
      } ${
        verified
          ? "bg-[#F6F1E4] text-[#232A16] border-[#DDD3B8]"
          : "bg-white text-[#6B7A45] border-dashed border-[#DDD3B8]"
      } ${className}`}
    >
      <IconComponent size={isSm ? 12 : 14} className="text-[#3E4A26] shrink-0" />
      <span className="font-semibold text-[#232A16]">{label}</span>
      {value && <span className="text-[#6B7A45] font-mono">({value})</span>}
      {!verified && (
        <span className="text-[10px] text-[#C1872B] font-semibold italic">
          Not verified
        </span>
      )}
    </span>
  );
};
