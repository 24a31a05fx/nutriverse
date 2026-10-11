"use client";

import React, { useState, useEffect } from "react";
import { X, Sparkles, Activity, ShieldCheck, Info, Check, ArrowRight } from "lucide-react";
import { api, NutritionProfile } from "@/lib/api";

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileSaved: (profile: NutritionProfile) => void;
  initialProfile?: NutritionProfile | null;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onProfileSaved,
  initialProfile,
}) => {
  const [age, setAge] = useState<number>(28);
  const [sex, setSex] = useState<"female" | "male">("female");
  const [heightCm, setHeightCm] = useState<number>(168);
  const [weightKg, setWeightKg] = useState<number>(62);
  const [activityLevel, setActivityLevel] = useState<number>(1.375);
  const [foodPreferences, setFoodPreferences] = useState("Vegetarian & Plant-Forward");
  const [allergies, setAllergies] = useState("None");
  const [budgetInr, setBudgetInr] = useState<number>(1500);
  const [goal, setGoal] = useState("Balanced Nutrition & Micronutrient Completeness");
  const [consentGiven, setConsentGiven] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialProfile) {
      setAge(initialProfile.age || 28);
      setSex(initialProfile.sex || "female");
      setHeightCm(initialProfile.height_cm || 168);
      setWeightKg(initialProfile.weight_kg || 62);
      setActivityLevel(initialProfile.activity_level || 1.375);
      if (initialProfile.food_preferences) setFoodPreferences(initialProfile.food_preferences);
      if (initialProfile.allergies) setAllergies(initialProfile.allergies);
      if (initialProfile.budget_inr) setBudgetInr(initialProfile.budget_inr);
      if (initialProfile.goal) setGoal(initialProfile.goal);
    }
  }, [initialProfile]);

  if (!isOpen) return null;

  // Scientific Mifflin–St Jeor Equation
  const bmr = Math.round(
    10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "male" ? 5 : -161)
  );
  const estimatedCalories = Math.round(bmr * activityLevel);

  const activityOptions = [
    { value: 1.2, label: "Sedentary (Desk work, minimal exercise)", multiplier: "1.20×" },
    { value: 1.375, label: "Lightly Active (1–3 days/wk light movement)", multiplier: "1.375×" },
    { value: 1.55, label: "Moderately Active (3–5 days/wk moderate workouts)", multiplier: "1.55×" },
    { value: 1.725, label: "Very Active (6–7 days/wk vigorous athletics)", multiplier: "1.725×" },
    { value: 1.9, label: "Extremely Active (Athletic training or physical labor)", multiplier: "1.90×" },
  ];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consentGiven) {
      setError("Please confirm consent to process voluntary dietary preferences.");
      return;
    }
    setSaving(true);
    setError(null);

    try {
      const payload = {
        age: Number(age),
        sex,
        height_cm: Number(heightCm),
        weight_kg: Number(weightKg),
        activity_level: Number(activityLevel),
        food_preferences: foodPreferences,
        allergies: allergies,
        budget_inr: Number(budgetInr),
        goal: goal,
      };

      const res = await api<any>("/profile", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      onProfileSaved({
        ...payload,
        bmr,
        calorie_target: estimatedCalories,
        calculation_version: res.version || "mifflin-st-jeor-v1",
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to persist nutrition profile to server.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="modal-dialog bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-md px-6 py-5 border-b border-gray-100 flex items-center justify-between z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Personalized Nutrition Engine</h2>
              <p className="text-xs text-gray-600">Scientific Mifflin–St Jeor Baseline & Calin Pack Calibration</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-6">
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
              {error}
            </div>
          )}

          {/* Biological Metric Inputs */}
          <div>
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-3">
              1. Physical Baseline (For Basal Metabolic Rate Calculation)
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Sex for Equation</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSex("female")}
                    className={`py-2 text-xs font-semibold rounded-xl border transition ${
                      sex === "female"
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                        : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    Female (-161 offset)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSex("male")}
                    className={`py-2 text-xs font-semibold rounded-xl border transition ${
                      sex === "male"
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                        : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    Male (+5 offset)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Age (Years)</label>
                <input
                  type="number"
                  min={14}
                  max={100}
                  value={age}
                  onChange={(e) => setAge(Number(e.target.value))}
                  required
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Height (Centimeters)</label>
                <input
                  type="number"
                  min={100}
                  max={230}
                  value={heightCm}
                  onChange={(e) => setHeightCm(Number(e.target.value))}
                  required
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Weight (Kilograms)</label>
                <input
                  type="number"
                  min={30}
                  max={250}
                  value={weightKg}
                  onChange={(e) => setWeightKg(Number(e.target.value))}
                  required
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Activity Multiplier */}
          <div>
            <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-2">
              2. Daily Physical Activity Level
            </label>
            <div className="space-y-2">
              {activityOptions.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center justify-between p-3 rounded-xl border text-xs cursor-pointer transition ${
                    activityLevel === opt.value
                      ? "bg-emerald-50/70 border-emerald-400 text-emerald-950 font-medium"
                      : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="activity"
                      value={opt.value}
                      checked={activityLevel === opt.value}
                      onChange={() => setActivityLevel(opt.value)}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>{opt.label}</span>
                  </div>
                  <span className="font-mono text-gray-600 text-[11px] bg-white px-2 py-0.5 rounded border border-gray-100">
                    {opt.multiplier}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Real-Time Mifflin–St Jeor Calculation Display */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Transparent Mathematical Estimate
              </span>
              <span className="text-[10px] bg-white/80 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                Formula: Mifflin–St Jeor (1990)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-1">
              <div className="bg-white/90 p-3 rounded-xl border border-emerald-100 shadow-sm">
                <span className="text-[11px] text-gray-600 block">Basal Metabolic Rate (BMR)</span>
                <span className="text-xl font-extrabold text-gray-900">{bmr} <span className="text-xs font-normal text-gray-600">kcal/day</span></span>
                <p className="text-[10px] text-gray-600 mt-1">
                  Baseline energy spent at complete rest for vital cellular and organ functions.
                </p>
              </div>

              <div className="bg-white/90 p-3 rounded-xl border border-emerald-100 shadow-sm">
                <span className="text-[11px] text-gray-600 block">Estimated Daily Expenditure (TDEE)</span>
                <span className="text-xl font-extrabold text-emerald-700">{estimatedCalories} <span className="text-xs font-normal text-emerald-700">kcal/day</span></span>
                <p className="text-[10px] text-gray-600 mt-1">
                  BMR ({bmr}) × Activity ({activityLevel}×) for balanced energy equilibrium.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 text-[11px] text-emerald-800 bg-white/60 p-2.5 rounded-xl border border-emerald-100/60">
              <Info className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>
                <strong>Limitation Notice:</strong> This provides an evidence-based guideline for meal planning and Calin Pack sizing. Nutriverse never prescribes crash calorie deficits or medical treatments without qualified healthcare supervision.
              </span>
            </div>
          </div>

          {/* Preferences, Allergies & Goals */}
          <div>
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-3">
              3. Dietary Context & Restrictions
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Dietary Preference</label>
                <select
                  value={foodPreferences}
                  onChange={(e) => setFoodPreferences(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="Vegetarian & Plant-Forward">Vegetarian & Plant-Forward</option>
                  <option value="100% Whole Food Vegan">100% Whole Food Vegan</option>
                  <option value="Flexitarian (Vegetarian + Clean Dairy)">Flexitarian (Vegetarian + Clean Dairy)</option>
                  <option value="Gluten-Sensitive Whole Food">Gluten-Sensitive Whole Food</option>
                  <option value="Omnivore Unprocessed Foods">Omnivore Unprocessed Foods</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Known Allergies / Exclusions</label>
                <input
                  type="text"
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  placeholder="e.g. Peanuts, Lactose, Gluten, Soy (or None)"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Weekly Nutrition Budget (₹)</label>
                <input
                  type="number"
                  min={500}
                  max={10000}
                  step={100}
                  value={budgetInr}
                  onChange={(e) => setBudgetInr(Number(e.target.value))}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Nutrition Objective</label>
                <select
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="Balanced Nutrition & Micronutrient Completeness">Balanced Nutrition & Micronutrients</option>
                  <option value="Cardiovascular Health & Fiber Richness">Cardiovascular Health & Fiber</option>
                  <option value="High-Protein Athletic Recovery">High-Protein Athletic Recovery</option>
                  <option value="Metabolic Energy & Low Sugar Staples">Metabolic Energy & Low Sugar</option>
                </select>
              </div>
            </div>
          </div>

          {/* Privacy & Consent Safeguard */}
          <div className="pt-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={consentGiven}
                onChange={(e) => setConsentGiven(e.target.checked)}
                className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-[11px] text-gray-600 leading-relaxed">
                I consent to storing my voluntary biometric indicators solely to calculate my baseline calorie estimates and tailor Calin Pack product suggestions. My data is private and can be modified or purged at any time in my dashboard.
              </span>
            </label>
          </div>

          {/* Submit Actions */}
          <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 rounded-xl transition"
            >
              Skip for Now
            </button>
            <button
              type="submit"
              disabled={saving || !consentGiven}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-md transition flex items-center gap-2"
            >
              {saving ? "Saving Profile..." : "Save Nutrition Profile"}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
