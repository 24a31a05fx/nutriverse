import React from "react";
import { CheckCircle2, AlertCircle, Info, ShieldCheck } from "lucide-react";
import {
  FibreIcon,
  VitaminsIcon,
  ProteinIcon,
  HealthyFatsIcon,
  MineralsIcon,
  CarbohydratesIcon,
} from "./NutrientIcons";

export interface NutrientItem {
  key: string;
  label: string;
  amount?: number | null;
  unit: string;
  rdaPercent?: number | null;
  verified: boolean;
  type?: "protein" | "carbs" | "fats" | "fibre" | "vitamins" | "minerals";
}

export interface NutrientPanelProps {
  basis?: string; // e.g. "Per 100g edible portion"
  selectedUnit?: string; // e.g. "1 kg pack"
  sourceReference?: string; // e.g. "IFCT 2017 (T142) • ICMR-NIN"
  sourceBasis?: string; // e.g. "Laboratory Chemical Assay"
  verificationStatus?: "verified" | "unverified" | "pending_review";
  verifiedBy?: string;
  verifiedAt?: string;
  nutrients: NutrientItem[];
  calories?: number | null;
  className?: string;
}

/**
 * NutrientPanel
 * Authoritative nutrition breakdown component.
 * DATA RULE: Missing value = "Not verified", never zero, never invented.
 * Follows 1px border, 8-10px radius, Fraunces/Figtree typography.
 */
export const NutrientPanel: React.FC<NutrientPanelProps> = ({
  basis = "Per 100g edible portion",
  selectedUnit,
  sourceReference = "IFCT 2017 (ICMR-NIN)",
  sourceBasis = "Raw whole-food sample assay",
  verificationStatus = "verified",
  verifiedBy = "ICMR-NIN Reference Standard",
  verifiedAt,
  nutrients,
  calories,
  className = "",
}) => {
  const isVerified = verificationStatus === "verified";

  return (
    <div
      className={`rounded-[10px] border border-[#DDD3B8] bg-white p-4 space-y-4 ${className}`}
    >
      {/* Header: Basis, selected unit, verification chip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#DDD3B8]">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7A45] block">
            Nutritional Composition
          </span>
          <h4 className="font-heading text-sm font-bold text-[#232A16]">
            {basis}
            {selectedUnit && (
              <span className="text-xs font-normal text-[#6B7A45]">
                {" "}
                (scaled for {selectedUnit})
              </span>
            )}
          </h4>
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          {isVerified ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[11px] font-semibold bg-[#3E4A26]/10 text-[#3E4A26] border border-[#3E4A26]/20">
              <CheckCircle2 className="w-3 h-3 text-[#3E4A26]" />
              <span>Verified Data</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[11px] font-semibold bg-[#C1872B]/10 text-[#C1872B] border border-[#C1872B]/30">
              <AlertCircle className="w-3 h-3 text-[#C1872B]" />
              <span>Not verified</span>
            </span>
          )}
        </div>
      </div>

      {/* Calories Callout if available */}
      {calories !== undefined && (
        <div className="flex items-center justify-between p-2.5 rounded-[8px] bg-[#F6F1E4] border border-[#DDD3B8]">
          <span className="text-xs font-semibold text-[#232A16]">Energy</span>
          <span className="font-mono text-sm font-bold text-[#232A16]">
            {calories !== null ? `${calories} kcal` : "Not verified"}
          </span>
        </div>
      )}

      {/* Nutrient items grid / table */}
      <div className="space-y-1.5">
        {nutrients.map((item) => {
          const hasValue = item.amount !== null && item.amount !== undefined;

          return (
            <div
              key={item.key}
              className="flex items-center justify-between py-1.5 px-2 rounded-[6px] hover:bg-[#F6F1E4]/50 transition-colors text-xs"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-[#232A16]">{item.label}</span>
                {item.rdaPercent !== null && item.rdaPercent !== undefined && (
                  <span className="text-[10px] text-[#6B7A45] font-mono">
                    {item.rdaPercent}% RDA
                  </span>
                )}
              </div>

              <div>
                {hasValue && item.verified ? (
                  <span className="font-mono font-semibold text-[#232A16]">
                    {item.amount}{item.unit}
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-[#C1872B] italic">
                    Not verified
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sourcing and Scientific Provenance Footnote */}
      <div className="pt-3 border-t border-[#DDD3B8] text-[11px] text-[#6B7A45] space-y-1 bg-[#F6F1E4]/40 p-2.5 rounded-[8px]">
        <div className="flex items-start gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#3E4A26] shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-[#232A16]">Source Citation:</p>
            <p className="font-mono text-[10px] text-[#232A16]">{sourceReference}</p>
            <p className="text-[10px] text-[#6B7A45]">Basis: {sourceBasis}</p>
            {verifiedAt && (
              <p className="text-[10px] text-[#6B7A45]">Verified: {verifiedAt}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
