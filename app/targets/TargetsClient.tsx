"use client";

import React, { useState, useEffect, FormEvent } from "react";
import Link from "next/link";
import {
  Activity,
  Flame,
  Heart,
  Sparkles,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  Trash2,
  RotateCcw,
  Info,
  ArrowRight,
  BookOpen,
  Save,
  Calendar,
  Lock,
} from "lucide-react";
import { useNutriverse } from "@/components/NutriverseProvider";
import {
  NutritionTargetResult,
  NutritionTargetInput,
  SavedNutritionTargetProfile,
  calculateNutritionTargets,
  getSavedNutritionTargets,
  saveNutritionTargets,
  deleteSavedNutritionTargets,
} from "@/lib/api";

export default function TargetsClient() {
  const { currentUser, sessionReady, setAuthModalOpen } = useNutriverse();

  // Loading & Action states
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Saved profile and active estimate
  const [savedProfile, setSavedProfile] = useState<SavedNutritionTargetProfile | null>(null);
  const [activeEstimate, setActiveEstimate] = useState<NutritionTargetResult | null>(null);

  // Form Fields
  const [age, setAge] = useState<string>("28");
  const [sex, setSex] = useState<"female" | "male">("female");
  const [height, setHeight] = useState<string>("168");
  const [heightUnit, setHeightUnit] = useState<"cm" | "m" | "in" | "ft_in">("cm");
  const [weight, setWeight] = useState<string>("62");
  const [weightUnit, setWeightUnit] = useState<"kg" | "lbs">("kg");
  const [activityLevel, setActivityLevel] = useState<string>("lightly_active");
  const [goal, setGoal] = useState<string>("maintain");
  const [method, setMethod] = useState<string>("mifflin_st_jeor");
  const [foodPreferences, setFoodPreferences] = useState<string>("Plant-forward balanced");
  const [allergies, setAllergies] = useState<string>("None");
  const [consentGiven, setConsentGiven] = useState<boolean>(false);

  // Fetch saved targets on mount / user change
  useEffect(() => {
    let isMounted = true;
    async function loadSaved() {
      if (!currentUser) {
        setLoadingInitial(false);
        return;
      }
      setLoadingInitial(true);
      setServerError(null);
      try {
        const saved = await getSavedNutritionTargets();
        if (isMounted && saved) {
          setSavedProfile(saved);
          setActiveEstimate(saved.estimate);
          setIsEditing(false);

          // Populate inputs from saved profile
          if (saved.saved_inputs) {
            setAge(String(saved.saved_inputs.age || 28));
            setSex(saved.saved_inputs.sex === "male" ? "male" : "female");
            setHeight(String(saved.saved_inputs.height_cm || 168));
            setHeightUnit("cm");
            setWeight(String(saved.saved_inputs.weight_kg || 62));
            setWeightUnit("kg");
            if (saved.estimate?.inputs?.activity_level?.name) {
              setActivityLevel(saved.estimate.inputs.activity_level.name);
            }
            if (saved.saved_inputs.goal) {
              setGoal(saved.saved_inputs.goal);
            }
            if (saved.saved_inputs.food_preferences) {
              setFoodPreferences(saved.saved_inputs.food_preferences);
            }
            if (saved.saved_inputs.allergies) {
              setAllergies(saved.saved_inputs.allergies);
            }
            setConsentGiven(true);
          }
        }
      } catch (err: any) {
        // HTTP 404 indicates user has not yet configured profile inputs
        if (isMounted) {
          setSavedProfile(null);
          setActiveEstimate(null);
          setIsEditing(true);
        }
      } finally {
        if (isMounted) setLoadingInitial(false);
      }
    }

    if (sessionReady) {
      loadSaved();
    }
    return () => {
      isMounted = false;
    };
  }, [currentUser, sessionReady]);

  // Client-side input validation helper
  const validateFormInputs = (): { valid: boolean; error?: string } => {
    const ageNum = Number(age);
    if (isNaN(ageNum) || ageNum <= 0) {
      return { valid: false, error: "Please enter a valid age in years." };
    }
    if (ageNum < 18) {
      return {
        valid: false,
        error:
          "Adult predictive equations are validated for ages 18+. Pediatric and adolescent nutrition requires clinical growth charts and monitoring by a licensed healthcare professional.",
      };
    }
    if (ageNum > 100) {
      return { valid: false, error: "Age must be 100 years or younger." };
    }

    const heightNum = Number(height);
    if (isNaN(heightNum) || heightNum <= 0) {
      return { valid: false, error: "Please enter a positive numeric height." };
    }

    const weightNum = Number(weight);
    if (isNaN(weightNum) || weightNum <= 0) {
      return { valid: false, error: "Please enter a positive numeric weight." };
    }

    return { valid: true };
  };

  // Calculate without saving (stateless)
  const handleCalculateOnly = async (e: FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setSuccessMessage(null);

    const validation = validateFormInputs();
    if (!validation.valid) {
      setServerError(validation.error || "Invalid input values.");
      return;
    }

    setSubmitting(true);
    try {
      const inputPayload: NutritionTargetInput = {
        age: Number(age),
        sex,
        height: Number(height),
        height_unit: heightUnit,
        weight: Number(weight),
        weight_unit: weightUnit,
        activity_level: activityLevel,
        goal,
        method,
        optional_allergies: allergies,
        optional_preferences: foodPreferences,
      };

      const result = await calculateNutritionTargets(inputPayload);
      setActiveEstimate(result);
      setSuccessMessage("Target estimate generated successfully. Review below or save to your profile.");
    } catch (err: any) {
      setServerError(err?.message || "Failed to calculate nutrition targets.");
    } finally {
      setSubmitting(false);
    }
  };

  // Save to profile (persisted with explicit consent)
  const handleSaveToProfile = async (e: FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setSuccessMessage(null);

    if (!consentGiven) {
      setServerError("Explicit consent is required to persist personal biometric and dietary data to your profile.");
      return;
    }

    const validation = validateFormInputs();
    if (!validation.valid) {
      setServerError(validation.error || "Invalid input values.");
      return;
    }

    setSubmitting(true);
    try {
      const savePayload = {
        age: Number(age),
        sex,
        height: Number(height),
        height_unit: heightUnit,
        weight: Number(weight),
        weight_unit: weightUnit,
        activity_level: activityLevel,
        goal,
        method,
        food_preferences: foodPreferences,
        allergies,
        consent_given: true,
      };

      const res = await saveNutritionTargets(savePayload);
      setActiveEstimate(res.estimate);
      // Refresh saved profile representation
      try {
        const refreshed = await getSavedNutritionTargets();
        setSavedProfile(refreshed);
      } catch {
        setSavedProfile(null);
      }
      setIsEditing(false);
      setSuccessMessage("Nutrition targets and biometric profile saved successfully.");
    } catch (err: any) {
      setServerError(err?.message || "Failed to persist nutrition profile.");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete saved profile data
  const handleDeleteProfile = async () => {
    setServerError(null);
    setSuccessMessage(null);
    setDeleting(true);
    try {
      await deleteSavedNutritionTargets();
      setSavedProfile(null);
      setActiveEstimate(null);
      setIsEditing(true);
      setShowDeleteConfirm(false);
      setConsentGiven(false);
      setSuccessMessage("Personalized targets and biometric data have been completely deleted.");
    } catch (err: any) {
      setServerError(err?.message || "Failed to delete saved profile data.");
    } finally {
      setDeleting(false);
    }
  };

  if (!sessionReady) {
    return (
      <div className="container py-16 text-center text-sm text-[var(--charcoal-600)]" role="status">
        Checking your session…
      </div>
    );
  }

  if (!currentUser) {
    return (
      <section className="section section-cream py-16">
        <div className="container max-w-xl text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[var(--green-100)] text-[var(--green-800)] flex items-center justify-center mx-auto">
            <Activity size={24} />
          </div>
          <h1 style={{ fontSize: "1.75rem", color: "var(--forest-950)" }}>
            Personalized Nutrition Targets
          </h1>
          <p className="text-sm text-[var(--charcoal-600)] leading-relaxed">
            Please sign in to estimate and manage your evidence-based daily energy expenditure,
            macronutrient distribution targets, and physical activity calibration.
          </p>
          <div className="pt-3">
            <button
              onClick={() => setAuthModalOpen(true)}
              className="btn btn-primary px-6 py-2.5 font-bold"
            >
              Sign In to Calculate Targets
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="section section-cream py-8">
      <div className="container max-w-5xl space-y-8">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-[var(--border-light)]">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--green-100)] text-[var(--green-800)] text-xs font-semibold mb-2">
              <BookOpen size={13} />
              <span>Phase 5 • Scientific Nutrition Intelligence</span>
            </div>
            <h1 style={{ fontSize: "clamp(1.75rem, 3vw, 2.25rem)", color: "var(--forest-950)", margin: 0 }}>
              Personalized Nutrition Target Estimation
            </h1>
            <p className="text-xs text-[var(--charcoal-600)] mt-1 max-w-2xl">
              Deterministic, evidence-based energy and macronutrient calculation using the Mifflin-St Jeor (1990)
              and ICMR-NIN (2020) reference standards. No arbitrary ratios or fabricated numbers.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {savedProfile && !isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="btn btn-outline btn-sm text-xs font-semibold"
                >
                  <RotateCcw size={13} className="mr-1.5" />
                  Edit Inputs & Recalibrate
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="btn btn-sm text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200"
                >
                  <Trash2 size={13} className="mr-1.5" />
                  Delete Saved Data
                </button>
              </>
            ) : (
              <Link href="/today" className="btn btn-outline btn-sm text-xs font-semibold">
                <Calendar size={13} className="mr-1.5" />
                View Daily Targets
              </Link>
            )}
          </div>
        </div>

        {/* Status Alerts */}
        {serverError && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-3">
            <AlertTriangle size={16} className="shrink-0 text-red-600 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold">Estimation Error</span>
              <p>{serverError}</p>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-3">
            <CheckCircle2 size={16} className="shrink-0 text-emerald-600 mt-0.5" />
            <div>
              <span className="font-bold">Success</span>
              <p>{successMessage}</p>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal / Inline Banner */}
        {showDeleteConfirm && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={16} className="shrink-0 text-amber-700 mt-0.5" />
              <div>
                <p className="font-bold">Confirm Deletion of Saved Nutrition Data</p>
                <p className="text-[11px] text-amber-900 mt-0.5">
                  This will permanently remove your stored biometric inputs, energy expenditure, and target estimates
                  from our servers. You can recalculate or recreate them at any time.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteProfile}
                className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Yes, Delete Stored Profile"}
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Saved Profile Summary Banner (when viewing saved state) */}
        {savedProfile && !isEditing && (
          <div className="p-4 rounded-2xl bg-white border border-[var(--border-light)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-emerald-800">
              <ShieldCheck size={16} />
              <span className="font-semibold">
                Saved Target Profile Active (Updated: {new Date(savedProfile.updated_at || "").toLocaleDateString()})
              </span>
            </div>
            <div className="flex items-center gap-3 text-gray-500 text-[11px]">
              <span>Method: {savedProfile.estimate?.method?.name || "Mifflin-St Jeor (1990)"}</span>
              <span>•</span>
              <span>Sex: {savedProfile.saved_inputs?.sex}</span>
              <span>•</span>
              <span>Age: {savedProfile.saved_inputs?.age}y</span>
            </div>
          </div>
        )}

        {/* Stale Profile / Version Mismatch Notice */}
        {savedProfile && !isEditing && savedProfile.target_freshness?.is_stale && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex items-start gap-3">
            <AlertTriangle size={16} className="shrink-0 text-amber-700 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold">Formula Version or Calculation Update Available</span>
              <p className="text-[11px] leading-relaxed text-amber-900">
                Your stored profile target ({savedProfile.target_freshness.persisted_calorie_target} kcal/day) was calculated under version{" "}
                <code className="px-1 py-0.5 rounded bg-amber-100 font-mono text-[10px]">
                  {savedProfile.target_freshness.persisted_calculation_version || "previous"}
                </code>
                . The latest engine recalculates this to {savedProfile.target_freshness.freshly_calculated_daily_energy_target_kcal} kcal/day.
                Click &quot;Edit Inputs &amp; Recalibrate&quot; to update your stored profile.
              </p>
            </div>
          </div>
        )}

        {/* Form Section: Shown when creating new profile or editing */}
        {(isEditing || !savedProfile) && (
          <div className="p-6 rounded-3xl bg-white border border-[var(--border-light)] shadow-xs space-y-6">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-[var(--forest-950)]">
                  {savedProfile ? "Recalibrate Personal Inputs" : "Enter Biometrics & Activity"}
                </h2>
                {savedProfile && (
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="text-xs text-gray-500 hover:text-gray-800 underline"
                  >
                    Cancel Editing
                  </button>
                )}
              </div>
              <p className="text-xs text-[var(--charcoal-500)]">
                All inputs are strictly validated. No missing information is guessed or replaced with arbitrary defaults.
              </p>
            </div>

            <form onSubmit={handleCalculateOnly} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Age */}
                <div className="space-y-1">
                  <label htmlFor="input-age" className="block text-xs font-semibold text-gray-700">
                    Age (years) <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="input-age"
                    type="number"
                    min="18"
                    max="100"
                    step="1"
                    required
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-emerald-600"
                    placeholder="e.g. 28"
                  />
                  <span className="text-[10px] text-gray-500 block">Must be 18–100 (adult equations)</span>
                </div>

                {/* Biological Sex */}
                <div className="space-y-1">
                  <label htmlFor="input-sex" className="block text-xs font-semibold text-gray-700">
                    Biological Sex <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="input-sex"
                    value={sex}
                    onChange={(e) => setSex(e.target.value as "female" | "male")}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-emerald-600 bg-white"
                  >
                    <option value="female">Female (Equation coefficient: -161)</option>
                    <option value="male">Male (Equation coefficient: +5)</option>
                  </select>
                  <span className="text-[10px] text-gray-500 block">Required for metabolic equation baseline</span>
                </div>

                {/* Estimation Method */}
                <div className="space-y-1">
                  <label htmlFor="input-method" className="block text-xs font-semibold text-gray-700">
                    Predictive Reference Method <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="input-method"
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-emerald-600 bg-white"
                  >
                    <option value="mifflin_st_jeor">Mifflin-St Jeor (1990) — Global Predictive REE</option>
                    <option value="icmr_nin_2020">ICMR-NIN (2020) — Indian Reference Adult (-10% M / -9% F adjusted)</option>
                    <option value="schofield_1985">Schofield / FAO/WHO/UNU (1985) — International Weight-based</option>
                  </select>
                  <span className="text-[10px] text-gray-500 block">Documented scientific equations</span>
                </div>

                {/* Height + Unit */}
                <div className="space-y-1">
                  <label htmlFor="input-height" className="block text-xs font-semibold text-gray-700">
                    Height <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="input-height"
                      type="number"
                      step="any"
                      required
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-emerald-600"
                      placeholder="e.g. 168"
                    />
                    <select
                      value={heightUnit}
                      onChange={(e) => setHeightUnit(e.target.value as any)}
                      aria-label="Height unit"
                      className="px-2.5 py-2 rounded-xl border border-gray-200 text-xs font-semibold bg-gray-50"
                    >
                      <option value="cm">cm</option>
                      <option value="m">m</option>
                      <option value="in">in</option>
                    </select>
                  </div>
                  <span className="text-[10px] text-gray-500 block">Normalized internally to centimeters</span>
                </div>

                {/* Weight + Unit */}
                <div className="space-y-1">
                  <label htmlFor="input-weight" className="block text-xs font-semibold text-gray-700">
                    Weight <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="input-weight"
                      type="number"
                      step="any"
                      required
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-emerald-600"
                      placeholder="e.g. 62"
                    />
                    <select
                      value={weightUnit}
                      onChange={(e) => setWeightUnit(e.target.value as any)}
                      aria-label="Weight unit"
                      className="px-2.5 py-2 rounded-xl border border-gray-200 text-xs font-semibold bg-gray-50"
                    >
                      <option value="kg">kg</option>
                      <option value="lbs">lbs</option>
                    </select>
                  </div>
                  <span className="text-[10px] text-gray-500 block">Normalized internally to kilograms</span>
                </div>

                {/* Activity Level */}
                <div className="space-y-1">
                  <label htmlFor="input-activity" className="block text-xs font-semibold text-gray-700">
                    Physical Activity Level (PAL) <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="input-activity"
                    value={activityLevel}
                    onChange={(e) => setActivityLevel(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-emerald-600 bg-white"
                  >
                    <option value="sedentary">Sedentary (PAL 1.20× — Desk work)</option>
                    <option value="lightly_active">Lightly Active (PAL 1.375× — 1–3 d/wk exercise)</option>
                    <option value="moderately_active">Moderately Active (PAL 1.55× — 3–5 d/wk workouts)</option>
                    <option value="very_active">Very Active (PAL 1.725× — 6–7 d/wk athletics)</option>
                    <option value="extra_active">Extremely Active (PAL 1.90× — Heavy physical labor)</option>
                  </select>
                  <span className="text-[10px] text-gray-500 block">FAO/WHO/UNU standard PAL factors</span>
                </div>

                {/* Dietary Goal */}
                <div className="space-y-1">
                  <label htmlFor="input-goal" className="block text-xs font-semibold text-gray-700">
                    Target Goal <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="input-goal"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-emerald-600 bg-white"
                  >
                    <option value="maintain">Maintain Current Weight (±0 kcal/day)</option>
                    <option value="mild_weight_loss">Mild Weight Loss (-300 kcal/day safe deficit)</option>
                    <option value="weight_loss">Moderate Weight Loss (-500 kcal/day deficit)</option>
                    <option value="mild_weight_gain">Gentle Weight Gain (+300 kcal/day surplus)</option>
                    <option value="weight_gain">Weight Gain (+500 kcal/day surplus)</option>
                  </select>
                  <span className="text-[10px] text-gray-500 block">Subject to programmatic software guardrails</span>
                </div>

                {/* Optional Food Preferences */}
                <div className="space-y-1">
                  <label htmlFor="input-prefs" className="block text-xs font-semibold text-gray-700">
                    Food Preferences <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    id="input-prefs"
                    type="text"
                    value={foodPreferences}
                    onChange={(e) => setFoodPreferences(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-emerald-600"
                    placeholder="e.g. Vegetarian, Plant-Forward"
                  />
                  <span className="text-[10px] text-gray-500 block">Does not alter metabolic math</span>
                </div>

                {/* Optional Allergies */}
                <div className="space-y-1">
                  <label htmlFor="input-allergies" className="block text-xs font-semibold text-gray-700">
                    Exclusions / Allergies <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    id="input-allergies"
                    type="text"
                    value={allergies}
                    onChange={(e) => setAllergies(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-emerald-600"
                    placeholder="e.g. Peanuts, Gluten, None"
                  />
                  <span className="text-[10px] text-gray-500 block">Voluntary declaration</span>
                </div>
              </div>

              {/* Explicit Consent Checkbox */}
              <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/60 space-y-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentGiven}
                    onChange={(e) => setConsentGiven(e.target.checked)}
                    className="mt-0.5 rounded border-emerald-400 text-emerald-700 focus:ring-emerald-600"
                  />
                  <span className="text-xs text-emerald-950 leading-relaxed">
                    <span className="font-bold">Explicit Health Data Consent:</span> I voluntarily consent to
                    Nutriverse processing and storing my biometric inputs (age, sex, height, weight, activity level)
                    strictly for calculating personalized energy targets. I understand I can view, recalculate, or
                    delete this stored data at any time.
                  </span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-outline px-5 py-2.5 text-xs font-bold flex items-center gap-2"
                >
                  <Activity size={14} />
                  {submitting ? "Calculating…" : "Calculate On-the-Fly"}
                </button>

                <button
                  type="button"
                  disabled={submitting || !consentGiven}
                  onClick={handleSaveToProfile}
                  className="btn btn-primary px-6 py-2.5 text-xs font-bold flex items-center gap-2 disabled:opacity-50"
                >
                  <Save size={14} />
                  {submitting ? "Saving…" : "Save to My Profile"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Results Presentation Section: Rendered when active estimate exists */}
        {activeEstimate && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Programmatic Guardrail & Clinical Limitation Warnings Callout */}
            {activeEstimate.warnings && activeEstimate.warnings.length > 0 && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-800">
                  <AlertTriangle size={16} />
                  <span>Programmatic Guardrails & Calculation Limitations</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-900">
                  {activeEstimate.warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Core Energy Targets Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Daily Energy Target */}
              <div className="p-5 rounded-3xl bg-gradient-to-br from-emerald-900 to-teal-950 text-white shadow-md space-y-2">
                <div className="flex items-center justify-between text-xs text-emerald-200">
                  <span>Daily Energy Target</span>
                  <Flame size={16} className="text-amber-400" />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black font-display tracking-tight text-white">
                    {Math.round(activeEstimate.energy_targets.daily_energy_target_kcal).toLocaleString()}
                  </span>
                  <span className="text-xs font-semibold text-emerald-200">kcal / day</span>
                </div>
                <p className="text-[11px] text-emerald-100/80">
                  Goal: {activeEstimate.inputs.goal.description}
                </p>
                {(activeEstimate.energy_targets.guardrail_applied || activeEstimate.energy_targets.safety_floor_applied) && (
                  <span className="inline-block text-[10px] font-semibold text-amber-200 bg-amber-900/60 px-2 py-0.5 rounded-md border border-amber-500/40">
                    Guardrail Applied ({activeEstimate.energy_targets.guardrail_threshold_kcal || activeEstimate.energy_targets.safety_floor_threshold_kcal} kcal floor)
                  </span>
                )}
              </div>

              {/* BMR */}
              <div className="p-5 rounded-3xl bg-white border border-[var(--border-light)] shadow-xs space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Basal Metabolic Rate (BMR)</span>
                  <Activity size={16} className="text-emerald-700" />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black font-display text-[var(--forest-950)]">
                    {Math.round(activeEstimate.energy_targets.bmr_kcal_day).toLocaleString()}
                  </span>
                  <span className="text-xs font-semibold text-gray-500">kcal / day</span>
                </div>
                <p className="text-[11px] text-gray-500">
                  Resting baseline expenditure at complete physiological rest
                </p>
              </div>

              {/* TDEE */}
              <div className="p-5 rounded-3xl bg-white border border-[var(--border-light)] shadow-xs space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Daily Expenditure (TDEE)</span>
                  <Sparkles size={16} className="text-indigo-600" />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black font-display text-[var(--forest-950)]">
                    {Math.round(activeEstimate.energy_targets.tdee_kcal_day).toLocaleString()}
                  </span>
                  <span className="text-xs font-semibold text-gray-500">kcal / day</span>
                </div>
                <p className="text-[11px] text-gray-500">
                  BMR × {activeEstimate.inputs.activity_level.pal_multiplier}× PAL factor
                </p>
              </div>

              {/* Biometrics & BMI */}
              <div className="p-5 rounded-3xl bg-white border border-[var(--border-light)] shadow-xs space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Body Mass Index (BMI)</span>
                  <Info size={16} className="text-gray-400" />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black font-display text-[var(--forest-950)]">
                    {activeEstimate.biometric_indicators.bmi.toFixed(1)}
                  </span>
                  <span className="text-xs font-semibold text-gray-500">kg / m²</span>
                </div>
                <p className="text-[11px] text-gray-500">
                  {activeEstimate.biometric_indicators.bmi_classification}
                </p>
                <span className="text-[9px] text-gray-400 block">
                  Statistical screening index (not a medical diagnosis)
                </span>
              </div>
            </div>

            {/* Macronutrient Distribution Card */}
            <div className="p-6 rounded-3xl bg-white border border-[var(--border-light)] shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-[var(--forest-950)]">
                    Evidence-Based Macronutrient Distribution
                  </h3>
                  <p className="text-xs text-gray-500">
                    Calculated via ICMR-NIN 2020 RDA and Acceptable Macronutrient Distribution Ranges (AMDR).
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Target: {Math.round(activeEstimate.energy_targets.daily_energy_target_kcal)} kcal/day
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Protein */}
                <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 space-y-2">
                  <div className="flex items-center justify-between text-xs text-emerald-900 font-semibold">
                    <span>Protein Target</span>
                    <span>{activeEstimate.macronutrient_targets.protein.energy_percentage}% energy</span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-emerald-950 font-display">
                      {activeEstimate.macronutrient_targets.protein.target_g_day}
                    </span>
                    <span className="text-xs font-semibold text-emerald-800">g / day</span>
                  </div>
                  <p className="text-[11px] text-emerald-800">
                    {activeEstimate.macronutrient_targets.protein.reference_basis}
                  </p>
                  <div className="text-[10px] text-emerald-700 bg-white/70 px-2 py-1 rounded-md">
                    AMDR Range: {activeEstimate.macronutrient_targets.protein.amdr_range_g_day?.min}–
                    {activeEstimate.macronutrient_targets.protein.amdr_range_g_day?.max} g/day (10%–35%)
                  </div>
                </div>

                {/* Total Fat */}
                <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-2">
                  <div className="flex items-center justify-between text-xs text-indigo-900 font-semibold">
                    <span>Healthy Fats</span>
                    <span>{activeEstimate.macronutrient_targets.fat.energy_percentage}% energy</span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-indigo-950 font-display">
                      {activeEstimate.macronutrient_targets.fat.target_g_day}
                    </span>
                    <span className="text-xs font-semibold text-indigo-800">g / day</span>
                  </div>
                  <p className="text-[11px] text-indigo-800">
                    {activeEstimate.macronutrient_targets.fat.reference_basis}
                  </p>
                  <div className="text-[10px] text-indigo-700 bg-white/70 px-2 py-1 rounded-md">
                    AMDR Range: {activeEstimate.macronutrient_targets.fat.amdr_range_g_day?.min}–
                    {activeEstimate.macronutrient_targets.fat.amdr_range_g_day?.max} g/day (20%–35%)
                  </div>
                </div>

                {/* Carbohydrates */}
                <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-100 space-y-2">
                  <div className="flex items-center justify-between text-xs text-amber-900 font-semibold">
                    <span>Complex Carbohydrates</span>
                    <span>{activeEstimate.macronutrient_targets.carbohydrates.energy_percentage}% energy</span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-amber-950 font-display">
                      {activeEstimate.macronutrient_targets.carbohydrates.target_g_day}
                    </span>
                    <span className="text-xs font-semibold text-amber-800">g / day</span>
                  </div>
                  <p className="text-[11px] text-amber-800">
                    {activeEstimate.macronutrient_targets.carbohydrates.reference_basis}
                  </p>
                  <div className="text-[10px] text-amber-700 bg-white/70 px-2 py-1 rounded-md">
                    AMDR Range: {activeEstimate.macronutrient_targets.carbohydrates.amdr_range_g_day?.min}–
                    {activeEstimate.macronutrient_targets.carbohydrates.amdr_range_g_day?.max} g/day (45%–65%)
                  </div>
                </div>
              </div>

              {/* Dietary Fiber Callout */}
              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-800">Dietary Fiber Target:</span>
                    <span className="font-bold text-emerald-950">
                      {activeEstimate.macronutrient_targets.dietary_fiber.target_g_day} g/day
                    </span>
                    {(activeEstimate.macronutrient_targets.dietary_fiber.planning_floor_applied || activeEstimate.macronutrient_targets.dietary_fiber.floor_applied) && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-100/80 text-amber-900 text-[10px] font-semibold border border-amber-200">
                        Nutriverse Planning Floor Applied
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 text-[11px] mt-0.5">
                    {activeEstimate.macronutrient_targets.dietary_fiber.reference_basis}
                  </p>
                </div>
              </div>

              {/* Atwater Energy Reconciliation Transparency */}
              {activeEstimate.macronutrient_targets.macro_energy_accounting && (
                <div className="p-3 rounded-xl bg-gray-50/70 border border-gray-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-gray-600">
                  <div>
                    <span className="font-semibold text-gray-800">Atwater Energy Accounting: </span>
                    <span>
                      Sum of reported macros = {activeEstimate.macronutrient_targets.macro_energy_accounting.total_reported_macro_kcal_day} kcal/day
                      (discrepancy from target: {activeEstimate.macronutrient_targets.macro_energy_accounting.discrepancy_kcal} kcal).
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-400">
                    Calculated using standard 4/9/4 kcal/g factors without force-reconciliation.
                  </span>
                </div>
              )}
            </div>

            {/* Formula, Assumptions & Method Details */}
            <div className="p-6 rounded-3xl bg-white border border-[var(--border-light)] shadow-xs space-y-4 text-xs text-gray-600">
              <div className="flex items-center gap-2 text-gray-800 font-bold border-b border-gray-100 pb-2">
                <BookOpen size={15} />
                <span>Methodology & Scientific Reproducibility Metadata</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px]">
                <div className="space-y-1.5">
                  <span className="font-semibold text-gray-700 block">Equation & Citation:</span>
                  <p className="text-gray-600">{activeEstimate.method.name}</p>
                  <p className="text-gray-500 italic">{activeEstimate.method.citation}</p>
                  <p className="font-mono text-[10px] text-gray-700 bg-gray-50 p-2 rounded-lg border border-gray-100">
                    {activeEstimate.method.equation_formula}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <span className="font-semibold text-gray-700 block">Assumptions & Population Constraints:</span>
                  <ul className="list-disc list-inside space-y-1 text-gray-500">
                    {activeEstimate.assumptions_and_limitations.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                  <p className="text-gray-400 pt-1">
                    Calculation ID: <span className="font-mono">{activeEstimate.calculation_id.slice(0, 8)}…</span> •
                    Timestamp: {new Date(activeEstimate.timestamp).toUTCString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Clinical Legal Disclaimer */}
            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/60 text-amber-950 text-xs flex items-start gap-3">
              <AlertTriangle size={16} className="shrink-0 text-amber-700 mt-0.5" />
              <p className="leading-relaxed text-[11px] text-amber-900">{activeEstimate.disclaimer}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
