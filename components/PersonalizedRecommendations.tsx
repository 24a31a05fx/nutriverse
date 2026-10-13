"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Sparkles,
  Activity,
  Flame,
  Heart,
  ShieldCheck,
  AlertTriangle,
  Info,
  CheckCircle2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  BookOpen,
  Filter,
} from "lucide-react";
import {
  getPersonalizedRecommendations,
  RecommendationsResponse,
  RecommendedFood,
  formatPaise,
} from "@/lib/api";

const CLINICAL_DISCLAIMER =
  "Nutriverse food recommendations are informational and educational estimates derived from " +
  "verified food composition tables and standard dietary planning formulas. They are not intended " +
  "as clinical diagnoses, medical advice, disease treatment, or dietary prescriptions. " +
  "Consult a qualified healthcare provider or registered dietitian before making significant dietary changes.";

interface PersonalizedRecommendationsProps {
  hasConsent: boolean;
  isStaleTarget?: boolean;
  onOpenAuthModal?: () => void;
}

const SUPPORTED_NUTRIENTS: Array<{
  id: "protein" | "dietary_fiber" | "energy" | "fat" | "carbohydrates";
  label: string;
  unit: string;
  icon: React.ElementType;
  colorClass: string;
}> = [
  { id: "protein", label: "Protein", unit: "g", icon: Activity, colorClass: "emerald" },
  { id: "dietary_fiber", label: "Dietary Fibre", unit: "g", icon: Sparkles, colorClass: "amber" },
  { id: "energy", label: "Energy", unit: "kcal", icon: Flame, colorClass: "orange" },
  { id: "fat", label: "Healthy Fats", unit: "g", icon: Heart, colorClass: "indigo" },
  { id: "carbohydrates", label: "Complex Carbs", unit: "g", icon: BookOpen, colorClass: "teal" },
];

export const PersonalizedRecommendations: React.FC<PersonalizedRecommendationsProps> = ({
  hasConsent,
  isStaleTarget = false,
  onOpenAuthModal,
}) => {
  const [selectedNutrient, setSelectedNutrient] = useState<
    "protein" | "dietary_fiber" | "energy" | "fat" | "carbohydrates"
  >("protein");
  const [strictVerified, setStrictVerified] = useState<boolean>(true);
  const [data, setData] = useState<RecommendationsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showExcluded, setShowExcluded] = useState<boolean>(false);
  const [expandedProvenanceId, setExpandedProvenanceId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (!hasConsent) {
      setLoading(false);
      setData(null);
      return;
    }

    async function loadRecs() {
      setLoading(true);
      setError(null);
      try {
        const res = await getPersonalizedRecommendations({
          target_nutrient: selectedNutrient,
          limit: 6,
          strict_verified: strictVerified,
          food_state: "raw",
        });
        if (isMounted) {
          setData(res);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || "Failed to load nutrition recommendations.");
          setData(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadRecs();
    return () => {
      isMounted = false;
    };
  }, [hasConsent, selectedNutrient, strictVerified]);

  if (!hasConsent) {
    return (
      <div className="p-6 rounded-2xl bg-amber-50/70 border border-amber-200 text-center space-y-3">
        <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
          <ShieldCheck size={20} />
        </div>
        <h3 className="text-base font-bold text-amber-950 m-0">
          Personalized Recommendations Require Biometric Consent
        </h3>
        <p className="text-xs text-amber-800 max-w-lg mx-auto">
          Nutriverse strictly complies with privacy standards. To receive food suggestions matched against your personal metabolic target, please establish your targets and authorize biometric data storage.
        </p>
        <div className="pt-1">
          <Link href="/targets" className="btn btn-primary btn-sm text-xs font-semibold">
            Configure Targets & Consent
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" id="personalized-recommendations-section">
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[var(--border-light)]">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[11px] font-semibold mb-1">
            <Sparkles size={12} />
            <span>Deterministic Target Engine</span>
          </div>
          <h2 className="text-xl font-bold text-[var(--forest-950)] m-0">
            Personalized Food Recommendations
          </h2>
          <p className="text-xs text-[var(--charcoal-600)] mt-0.5">
            Traceable whole foods ranked by verified contribution to your daily target.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Strict verification mode switch */}
          <button
            type="button"
            onClick={() => setStrictVerified(!strictVerified)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
              strictVerified
                ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                : "bg-white border-gray-300 text-gray-700"
            }`}
            title="When active, only foods with peer-reviewed laboratory reference records (ICMR-NIN IFCT 2017) are recommended."
          >
            <ShieldCheck size={14} className={strictVerified ? "text-emerald-700" : "text-gray-400"} />
            <span>{strictVerified ? "Strict Verified Records" : "All Catalog Records"}</span>
          </button>
        </div>
      </div>

      {/* Target Nutrient Selector Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {SUPPORTED_NUTRIENTS.map((nut) => {
          const Icon = nut.icon;
          const isSelected = selectedNutrient === nut.id;
          return (
            <button
              key={nut.id}
              type="button"
              onClick={() => setSelectedNutrient(nut.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                isSelected
                  ? "bg-[var(--forest-900)] text-white shadow-xs"
                  : "bg-white border border-[var(--border-light)] text-[var(--charcoal-700)] hover:bg-[var(--cream-soft)]"
              }`}
            >
              <Icon size={14} />
              <span>{nut.label}</span>
            </button>
          );
        })}
      </div>

      {/* Target Metadata Banner */}
      {data?.target_nutrient && (
        <div className="p-4 rounded-2xl bg-white border border-[var(--border-light)] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <div className="text-[var(--charcoal-500)] text-[11px]">
              Daily Target Objective ({data.target_nutrient.name})
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black text-[var(--forest-950)] font-display">
                {data.target_nutrient.user_target} {data.target_nutrient.unit}
              </span>
              <span className="text-[11px] text-[var(--charcoal-600)]">
                • {data.target_nutrient.reference_standard}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-[var(--charcoal-600)]">
            <span className="px-2 py-1 rounded-md bg-[var(--cream-soft)] border border-[var(--border-light)]">
              Evaluated: <strong>{data.counts.total_active_foods_evaluated}</strong> catalog items
            </span>
            <span className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-900 font-semibold border border-emerald-200">
              Matches: <strong>{data.counts.recommendations_returned}</strong> verified foods
            </span>
          </div>
        </div>
      )}

      {/* Warnings & Stale Target Alerts */}
      {(isStaleTarget || (data?.warnings && data.warnings.length > 0)) && (
        <div className="space-y-2">
          {isStaleTarget && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs flex items-start gap-2.5">
              <AlertTriangle size={15} className="shrink-0 text-amber-700 mt-0.5" />
              <div>
                <strong>Target Freshness Warning:</strong> Your personal nutrition targets were calculated over 90 days ago or differ from the current calculation baseline. We recommend visiting <Link href="/targets" className="underline font-semibold">Target Settings</Link> to recalculate fresh targets.
              </div>
            </div>
          )}
          {data?.warnings?.map((warn, i) => (
            <div
              key={i}
              className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs flex items-start gap-2.5"
            >
              <AlertTriangle size={15} className="shrink-0 text-amber-700 mt-0.5" />
              <span>{warn}</span>
            </div>
          ))}
        </div>
      )}

      {/* Deterministic Ranking Semantics & Objective Boundaries Disclosure */}
      {data?.ranking_semantics && (
        <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 text-[11px] text-emerald-950 space-y-1.5">
          <div className="font-bold flex items-center gap-1.5 text-emerald-900">
            <Info size={13} className="shrink-0 text-emerald-700" />
            <span>Deterministic Ranking Rules (No Algorithmic Health Scores)</span>
          </div>
          <p className="m-0 leading-relaxed text-emerald-900">
            {data.ranking_semantics.disclaimer}
          </p>
          <div className="text-[10px] text-emerald-800 pt-0.5 flex flex-wrap gap-x-4 gap-y-1">
            <span><strong>1. Primary:</strong> {data.ranking_semantics.primary_criterion}</span>
            <span><strong>2. Secondary:</strong> {data.ranking_semantics.secondary_criterion}</span>
            <span><strong>3. Tie-breaker:</strong> {data.ranking_semantics.tertiary_criterion}</span>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" role="status" aria-busy="true">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="p-5 rounded-2xl bg-white border border-[var(--border-light)] shadow-xs animate-pulse space-y-3"
            >
              <div className="h-6 w-32 bg-gray-200 rounded" />
              <div className="h-4 w-48 bg-gray-100 rounded" />
              <div className="h-10 bg-gray-50 rounded" />
              <div className="h-4 w-full bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="p-6 rounded-2xl bg-red-50 border border-red-200 text-center space-y-2">
          <AlertTriangle size={20} className="text-red-700 mx-auto" />
          <h3 className="text-sm font-bold text-red-950 m-0">Unable to Compute Recommendations</h3>
          <p className="text-xs text-red-800 max-w-md mx-auto">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && data && data.recommendations.length === 0 && (
        <div className="p-8 rounded-2xl bg-white border border-[var(--border-light)] text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center mx-auto">
            <Filter size={18} />
          </div>
          <h3 className="text-base font-bold text-[var(--forest-950)] m-0">
            No Verified Foods Met Current Recommendation Criteria
          </h3>
          <p className="text-xs text-[var(--charcoal-600)] max-w-lg mx-auto leading-relaxed">
            Nutriverse prohibits inventing synthetic food records or converting missing values into zero.
            {strictVerified
              ? " In strict mode, only foods with peer-reviewed laboratory verification (ICMR-NIN IFCT 2017) are considered. Try toggling off strict mode to view all catalog entries or check your declared allergen exclusions."
              : " No catalog items currently possess reliable data for this nutrient without conflicting with your declared allergens."}
          </p>
        </div>
      )}

      {/* Recommendations Cards Grid */}
      {!loading && !error && data && data.recommendations.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {data.recommendations.map((rec) => {
            const contrib = rec.nutrient_contribution;
            const portion = rec.portion;
            const isProvOpen = expandedProvenanceId === rec.food_id;
            const primarySource = rec.source_provenance[0];

            return (
              <div
                key={rec.food_id}
                className="p-5 rounded-2xl bg-white border border-[var(--border-light)] shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between space-y-4"
              >
                {/* Food Header */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl" role="img" aria-label={rec.food_name}>
                        {rec.emoji}
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-[var(--forest-950)] m-0 line-clamp-1">
                          {rec.food_name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          <span className="text-[10px] text-[var(--charcoal-500)] font-medium">
                            {rec.category}
                          </span>
                          {portion.is_standardized_100g_fallback ? (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 text-[9px] font-semibold"
                              title="This food lacks an unambiguous mass-based serving size; values are calculated per 100 g standardized reference baseline, NOT a verified typical single-meal serving."
                            >
                              <Info size={10} className="text-amber-700" />
                              100 g Reference Baseline (Not a typical serving)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px] font-medium">
                              Serving: {portion.mass_g}g ({portion.food_state})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 shrink-0">
                      {contrib.target_contribution_pct}% Target
                    </span>
                  </div>

                  {/* Contribution Visual Progress */}
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[11px] font-semibold text-[var(--charcoal-700)]">
                      <span>
                        +{contrib.amount} {contrib.unit} {contrib.nutrient_name}
                      </span>
                      <span
                        className="text-[var(--charcoal-500)] text-[10px]"
                        title="Uncovered balance of daily target before other meals. Daily nutrition is distributed across all meals; no single food is expected or intended to fulfill 100% of daily intake."
                      >
                        Uncovered balance: {contrib.uncovered_target_difference ?? contrib.remaining_target} {contrib.unit}
                      </span>
                    </div>

                    <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full transition-all"
                        style={{ width: `${Math.min(100, contrib.target_contribution_pct)}%` }}
                      />
                    </div>
                    <div className="text-[9px] text-[var(--charcoal-400)] italic">
                      Single food portion contribution • Whole-day nutrition requires varied meals
                    </div>
                  </div>

                  {/* Density & Energy Metrics */}
                  <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                    <div className="p-2 rounded-xl bg-[var(--cream-soft)] border border-[var(--border-light)]">
                      <div className="text-[10px] text-[var(--charcoal-500)]">Portion Energy</div>
                      <div className="font-bold text-[var(--forest-950)]">
                        {contrib.portion_energy_kcal !== null ? `${contrib.portion_energy_kcal} kcal` : "Unanalyzed"}
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-[var(--cream-soft)] border border-[var(--border-light)]">
                      <div className="text-[10px] text-[var(--charcoal-500)]">Nutrient Density</div>
                      <div className="font-bold text-[var(--forest-950)]">
                        {contrib.nutrient_density !== null && contrib.nutrient_density !== undefined
                          ? `${contrib.nutrient_density} ${contrib.density_label || `${contrib.unit}/100 kcal`}`
                          : "N/A"}
                      </div>
                    </div>
                  </div>

                  {/* Explanation Sentence */}
                  <p className="text-[11px] text-[var(--charcoal-600)] leading-relaxed m-0 pt-1">
                    {rec.explanation}
                  </p>
                </div>

                {/* Card Footer: Provenance & Actions */}
                <div className="space-y-2 pt-2 border-t border-[var(--border-light)]">
                  <div className="flex items-center justify-between text-[10px] text-[var(--charcoal-500)]">
                    <span className="inline-flex items-center gap-1 text-emerald-800 font-semibold">
                      <CheckCircle2 size={11} className="text-emerald-600" />
                      {contrib.verification_status === "verified_reference"
                        ? "Verified Reference"
                        : "Source Reported"}
                    </span>

                    {primarySource && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedProvenanceId(isProvOpen ? null : rec.food_id)
                        }
                        className="inline-flex items-center gap-1 text-xs text-[var(--charcoal-600)] hover:text-[var(--forest-900)] font-medium underline"
                      >
                        <span>Provenance</span>
                        {isProvOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    )}
                  </div>

                  {/* Expandable Provenance Details */}
                  {isProvOpen && primarySource && (
                    <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[10px] space-y-1 text-gray-700 animate-fadeIn">
                      <div>
                        <strong>Source:</strong> {primarySource.data_source_name} ({primarySource.publisher})
                      </div>
                      <div>
                        <strong>Record ID:</strong> {primarySource.external_id} • {primarySource.external_name}
                      </div>
                      {primarySource.analytical_basis && (
                        <div>
                          <strong>Analytical Basis:</strong> {primarySource.analytical_basis}
                        </div>
                      )}
                      {portion.edible_weight_assumption && (
                        <div>
                          <strong>Edible Basis:</strong> {portion.edible_weight_assumption}
                        </div>
                      )}
                      {portion.basis_notes && (
                        <div>
                          <strong>Portion Basis:</strong> {portion.basis_notes}
                        </div>
                      )}
                      <div>
                        <strong>License / Terms:</strong> {primarySource.license}
                      </div>
                      {primarySource.copyright_notice && (
                        <div className="text-gray-500">
                          <strong>Copyright:</strong> {primarySource.copyright_notice}
                        </div>
                      )}
                      {primarySource.scholarly_citation && (
                        <div className="text-gray-500 italic pt-0.5">
                          <strong>Citation:</strong> {primarySource.scholarly_citation}
                        </div>
                      )}
                    </div>
                  )}

                  {/* View Food Details Link */}
                  <div className="pt-1 flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--forest-950)]">
                      {formatPaise(rec.price_paise)}
                    </span>
                    <Link
                      href={`/food/${rec.food_id}`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[var(--green-700)] hover:text-[var(--forest-900)] hover:underline"
                    >
                      <span>View Food Details</span>
                      <ExternalLink size={12} />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Excluded Candidates Disclosure */}
      {!loading && data && data.excluded_candidates_summary && data.excluded_candidates_summary.length > 0 && (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowExcluded(!showExcluded)}
            className="text-xs text-[var(--charcoal-500)] hover:text-[var(--charcoal-800)] flex items-center gap-1.5 font-medium underline"
          >
            <Info size={13} />
            <span>
              {showExcluded
                ? "Hide candidate exclusion transparency audit"
                : `View why ${data.counts.excluded_count} candidate foods were excluded (allergen conflicts, unverified status, or missing data)`}
            </span>
          </button>

          {showExcluded && (
            <div className="mt-3 p-4 rounded-2xl bg-white border border-[var(--border-light)] space-y-2 text-xs">
              <div className="font-bold text-[var(--forest-950)]">
                Exclusion Transparency Audit Log (Sample)
              </div>
              <p className="text-[11px] text-[var(--charcoal-600)] m-0">
                Nutriverse strictly excludes candidate foods that lack peer-reviewed reference measurements, conflict with declared allergies, or omit the target nutrient.
              </p>
              <ul className="space-y-1.5 pt-1 text-[11px] text-[var(--charcoal-700)] list-disc pl-4">
                {data.excluded_candidates_summary.map((exc, idx) => (
                  <li key={idx}>
                    <strong>{exc.food_name}:</strong> {exc.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Target Comparison Boundaries Disclosure */}
      {data?.target_comparison_disclosure && (
        <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-200 text-[11px] text-blue-950 space-y-1 leading-relaxed">
          <div className="font-bold flex items-center gap-1.5 text-blue-900">
            <Info size={13} className="shrink-0 text-blue-700" />
            <span>Daily Intake & Dietary Diversity Boundaries</span>
          </div>
          <p className="m-0">{data.target_comparison_disclosure}</p>
        </div>
      )}

      {/* Non-Clinical Medical Disclaimer */}
      <div className="p-4 rounded-2xl bg-[var(--cream-soft)] border border-[var(--border-light)] text-[11px] text-[var(--charcoal-600)] space-y-1 leading-relaxed">
        <div className="font-bold text-[var(--forest-950)] flex items-center gap-1.5">
          <Info size={13} className="text-emerald-800 shrink-0" />
          <span>Clinical & Educational Disclosure</span>
        </div>
        <p className="m-0">{data?.disclaimer || CLINICAL_DISCLAIMER}</p>
      </div>
    </div>
  );
};
