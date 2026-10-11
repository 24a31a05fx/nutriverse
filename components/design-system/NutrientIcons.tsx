import React from "react";

export interface NutrientIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
}

/**
 * 6 Custom Line Icons for Nutriverse Nutrient System
 * Pure line art (stroke-based, 1.5px crisp lines, no shadows or gradients)
 * Representing: Fibre, Vitamins, Protein, Healthy Fats, Minerals, Carbohydrates
 */

// 1. Fibre: Dietary whole grains, plant fiber stalks and bran structure
export const FibreIcon: React.FC<NutrientIconProps> = ({ size = 20, className = "", ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {/* Stalk and branching grain husks */}
    <path d="M12 22V7" />
    <path d="M12 17c-2.5-1-4-3.5-4-6.5a4 4 0 0 1 4-3.5" />
    <path d="M12 13c2.5-1 4-3.5 4-6.5a4 4 0 0 0-4-3.5" />
    <path d="M12 8c-2-1-3-2.5-3-4.5a3 3 0 0 1 3-2.5" />
    <path d="M12 4c2-1 3-2 3-3" />
  </svg>
);

// 2. Vitamins: Bioactive citrus cross-section and micronutrient ring
export const VitaminsIcon: React.FC<NutrientIconProps> = ({ size = 20, className = "", ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {/* Outer citrus rind */}
    <circle cx="12" cy="12" r="9.5" />
    {/* Inner pulp core */}
    <circle cx="12" cy="12" r="2.5" />
    {/* Radiating segment dividers */}
    <line x1="12" y1="2.5" x2="12" y2="9.5" />
    <line x1="12" y1="14.5" x2="12" y2="21.5" />
    <line x1="2.5" y1="12" x2="9.5" y2="12" />
    <line x1="14.5" y1="12" x2="21.5" y2="12" />
    <line x1="5.28" y1="5.28" x2="10.23" y2="10.23" />
    <line x1="13.77" y1="13.77" x2="18.72" y2="18.72" />
    <line x1="5.28" y1="18.72" x2="10.23" y2="13.77" />
    <line x1="13.77" y1="10.23" x2="18.72" y2="5.28" />
  </svg>
);

// 3. Protein: Plant legume pod / paired amino acid peptide bond structure
export const ProteinIcon: React.FC<NutrientIconProps> = ({ size = 20, className = "", ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {/* Legume pod outline */}
    <path d="M4 19C4 19 6 6 19 4C19 4 17 17 4 19Z" />
    {/* Internal pulse seeds / nitrogenous amino nodes */}
    <circle cx="9" cy="13" r="1.75" />
    <circle cx="13" cy="9" r="1.75" />
    {/* Linking stem */}
    <path d="M19 4l2-2" />
    <path d="M4 19l-2 2" />
  </svg>
);

// 4. Healthy Fats: Cold-pressed botanical oil droplet / lipid ester
export const HealthyFatsIcon: React.FC<NutrientIconProps> = ({ size = 20, className = "", ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {/* Pure droplet contour */}
    <path d="M12 2.5C12 2.5 5 11 5 15.5C5 19.09 8.13 22 12 22C15.87 22 19 19.09 19 15.5C19 11 12 2.5 12 2.5Z" />
    {/* Internal botanical leaf vein indicating unrefined plant lipid */}
    <path d="M12 9v9" />
    <path d="M12 13c1.5-.75 2.5-2 2.5-3.5" />
    <path d="M12 16c-1.5-.75-2.5-2-2.5-3.5" />
  </svg>
);

// 5. Minerals: Crystalline mineral polygon / bio-element lattice
export const MineralsIcon: React.FC<NutrientIconProps> = ({ size = 20, className = "", ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {/* Faceted crystalline geometric silhouette */}
    <polygon points="6,3 18,3 22,9 12,21 2,9" />
    {/* Internal refraction lines */}
    <line x1="2" y1="9" x2="22" y2="9" />
    <line x1="6" y1="3" x2="12" y2="21" />
    <line x1="18" y1="3" x2="12" y2="21" />
    <line x1="12" y1="9" x2="12" y2="21" />
  </svg>
);

// 6. Carbohydrates: Slow-release complex grain spikelet / energy matrix
export const CarbohydratesIcon: React.FC<NutrientIconProps> = ({ size = 20, className = "", ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {/* Hexagonal molecular energy ring / complex polysaccharide matrix */}
    <path d="M12 2.5l7 4v9l-7 4-7-4v-9l7-4z" />
    {/* Internal bio-energy bonds */}
    <path d="M12 2.5v9" />
    <path d="M12 11.5l7-4" />
    <path d="M12 11.5l-7-4" />
    <circle cx="12" cy="11.5" r="1.5" />
  </svg>
);
