"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Flame,
  Activity,
  Heart,
  Package,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ArrowRight,
  UserCheck,
  CheckCircle2,
  Calendar,
  Layers,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Utensils,
  Clock,
  Search,
  X,
  Info,
} from "lucide-react";
import { useNutriverse } from "@/components/NutriverseProvider";
import {
  api,
  NutritionProfile,
  getSavedNutritionTargets,
  SavedNutritionTargetProfile,
  DailyNutritionSummary,
  DailyFoodLogItem,
  getDailyNutritionSummary,
  logDailyFood,
  deleteDailyFood,
  Food,
  getFoods,
} from "@/lib/api";
import { PersonalizedRecommendations } from "@/components/PersonalizedRecommendations";

export default function TodayClient() {
  const router = useRouter();
  const {
    currentUser,
    sessionReady,
    profile,
    setProfile,
    setOnboardingOpen,
    setAuthModalOpen,
  } = useNutriverse();

  const [revoking, setRevoking] = useState(false);
  const [revokeSuccess, setRevokeSuccess] = useState(false);
  const [activePackTier, setActivePackTier] = useState<string | null>(null);
  const [savedTargets, setSavedTargets] = useState<SavedNutritionTargetProfile | null>(null);
  const [loadingTargets, setLoadingTargets] = useState(true);

  // Daily Food Log State
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [dailySummary, setDailySummary] = useState<DailyNutritionSummary | null>(null);
  const [loadingDailyLog, setLoadingDailyLog] = useState(false);

  // Log Food Modal State
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [catalogFoods, setCatalogFoods] = useState<Food[]>([]);
  const [foodSearchQuery, setFoodSearchQuery] = useState("");
  const [selectedFoodId, setSelectedFoodId] = useState<string>("");
  const [selectedMealType, setSelectedMealType] = useState<"breakfast" | "lunch" | "dinner" | "snack">("lunch");
  const [portionGrams, setPortionGrams] = useState<number>(100);
  const [foodState, setFoodState] = useState<string>("raw");
  const [submittingLog, setSubmittingLog] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const savedTier = localStorage.getItem("nutriverse_active_pack");
      if (savedTier) setActivePackTier(savedTier);
    } catch {}
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function loadTargets() {
      if (!currentUser) {
        setLoadingTargets(false);
        return;
      }
      try {
        const res = await getSavedNutritionTargets();
        if (isMounted) setSavedTargets(res);
      } catch {
        if (isMounted) setSavedTargets(null);
      } finally {
        if (isMounted) setLoadingTargets(false);
      }
    }
    if (sessionReady) {
      loadTargets();
    }
    return () => {
      isMounted = false;
    };
  }, [currentUser, sessionReady]);

  // Load Daily Food Intake Logs whenever selectedDate or currentUser changes
  useEffect(() => {
    let isMounted = true;
    async function loadLogs() {
      if (!currentUser) {
        setDailySummary(null);
        return;
      }
      setLoadingDailyLog(true);
      try {
        const summary = await getDailyNutritionSummary(selectedDate);
        if (isMounted) setDailySummary(summary);
      } catch {
        if (isMounted) setDailySummary(null);
      } finally {
        if (isMounted) setLoadingDailyLog(false);
      }
    }
    if (sessionReady) {
      loadLogs();
    }
    return () => {
      isMounted = false;
    };
  }, [currentUser, selectedDate, sessionReady]);

  // Load catalog foods when opening the log modal
  const openLogModal = async (initialMealType?: "breakfast" | "lunch" | "dinner" | "snack") => {
    if (initialMealType) setSelectedMealType(initialMealType);
    setIsLogModalOpen(true);
    setLogError(null);
    if (catalogFoods.length === 0) {
      try {
        const foods = await getFoods();
        setCatalogFoods(foods);
        if (foods.length > 0 && !selectedFoodId) {
          setSelectedFoodId(foods[0].id);
        }
      } catch {}
    }
  };

  const handleDateShift = (days: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    setSelectedDate(current.toISOString().split("T")[0]);
  };

  const handleLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFoodId) {
      setLogError("Please select a food to log.");
      return;
    }
    if (portionGrams <= 0) {
      setLogError("Portion size must be greater than 0g.");
      return;
    }

    setSubmittingLog(true);
    setLogError(null);
    try {
      await logDailyFood({
        food_id: selectedFoodId,
        meal_type: selectedMealType,
        quantity: portionGrams,
        unit: "g",
        food_state: foodState,
        date: selectedDate,
      });

      // Refresh daily summary
      const updated = await getDailyNutritionSummary(selectedDate);
      setDailySummary(updated);
      setIsLogModalOpen(false);
      setFoodSearchQuery("");
    } catch (err: any) {
      setLogError(err?.message || "Failed to log food intake.");
    } finally {
      setSubmittingLog(false);
    }
  };

  const handleDeleteFoodLog = async (logId: string) => {
    if (!confirm("Are you sure you want to remove this logged food item?")) return;
    try {
      await deleteDailyFood(logId);
      const updated = await getDailyNutritionSummary(selectedDate);
      setDailySummary(updated);
    } catch (err: any) {
      alert(err?.message || "Failed to delete food log item.");
    }
  };

  const handleRevokeConsent = async () => {
    if (!confirm("Are you sure you want to revoke consent for storing health & biometric data? Your biometric targets will be cleared.")) {
      return;
    }
    setRevoking(true);
    try {
      await api("/profile/revoke-consent", { method: "POST" });
      setRevokeSuccess(true);
      setSavedTargets(null);
      try {
        const updated = await api<NutritionProfile>("/profile");
        setProfile(updated);
      } catch {
        setProfile(null);
      }
    } catch (err: any) {
      alert(err?.message || "Failed to revoke consent.");
    } finally {
      setRevoking(false);
    }
  };

  if (!sessionReady || loadingTargets) {
    return (
      <div className="container py-16 text-center text-sm text-[var(--charcoal-600)]" role="status">
        Loading your verified nutrition targets…
      </div>
    );
  }

  if (!currentUser) {
    return (
      <section className="section section-cream py-16">
        <div className="container max-w-xl text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-[var(--green-100)] text-[var(--green-800)] flex items-center justify-center mx-auto">
            <Activity size={24} />
          </div>
          <h1 style={{ fontSize: "1.75rem", color: "var(--forest-950)" }}>
            Today&apos;s Nutrition Targets
          </h1>
          <p className="text-sm text-[var(--charcoal-600)]">
            Sign in to view your personalized daily calorie expenditure, macro targets, active Calin Pack, and whole food intake guidelines.
          </p>
          <div className="pt-2">
            <button
              onClick={() => setAuthModalOpen(true)}
              className="btn btn-primary"
            >
              Sign In to View Targets
            </button>
          </div>
        </div>
      </section>
    );
  }

  const est = savedTargets?.estimate;
  const hasConsent = Boolean(savedTargets && !savedTargets.consent_revoked_at) || Boolean(profile && !profile.consent_revoked_at);
  const userAllergies = savedTargets?.saved_inputs?.allergies || profile?.allergies || "";
  const hasAllergiesOrConditions = Boolean(userAllergies && userAllergies.toLowerCase() !== "none" && userAllergies.toLowerCase() !== "no");

  const isToday = selectedDate === new Date().toISOString().split("T")[0];

  const meals = [
    { key: "breakfast", label: "Breakfast & Morning", icon: Clock },
    { key: "lunch", label: "Lunch & Midday Meal", icon: Utensils },
    { key: "dinner", label: "Dinner & Evening Plate", icon: Sparkles },
    { key: "snack", label: "Snacks & Nourishment", icon: Heart },
  ] as const;

  const filteredFoods = catalogFoods.filter((f) =>
    f.name.toLowerCase().includes(foodSearchQuery.toLowerCase()) ||
    f.category.toLowerCase().includes(foodSearchQuery.toLowerCase())
  );

  const selectedFoodObj = catalogFoods.find((f) => f.id === selectedFoodId);

  return (
    <section className="section section-cream py-8">
      <div className="container max-w-5xl space-y-8">
        {/* Header Strip with Date Navigation */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-[var(--border-light)]">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--green-100)] text-[var(--green-800)] text-xs font-semibold mb-2">
              <Calendar size={13} />
              <span>Daily Nutrition Dashboard</span>
            </div>
            <h1 style={{ fontSize: "clamp(1.75rem, 3vw, 2.25rem)", color: "var(--forest-950)", margin: 0 }}>
              {isToday ? "Today's Nutrition & Intake" : `Nutrition for ${selectedDate}`}
            </h1>
            <p className="text-xs text-[var(--charcoal-600)] mt-1">
              Deterministic intake tracking against your verified metabolic energy targets.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Date Navigator */}
            <div className="inline-flex items-center gap-1 bg-white border border-[var(--border-light)] rounded-xl p-1 shadow-xs">
              <button
                type="button"
                onClick={() => handleDateShift(-1)}
                className="p-1.5 text-[var(--charcoal-600)] hover:text-[var(--forest-950)] hover:bg-[var(--cream-soft)] rounded-lg transition"
                title="Previous Day"
                aria-label="Previous Day"
              >
                <ChevronLeft size={16} />
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="text-xs font-semibold px-2 py-1 bg-transparent border-0 text-[var(--forest-950)] focus:outline-none cursor-pointer"
              />
              <button
                type="button"
                onClick={() => handleDateShift(1)}
                className="p-1.5 text-[var(--charcoal-600)] hover:text-[var(--forest-950)] hover:bg-[var(--cream-soft)] rounded-lg transition"
                title="Next Day"
                aria-label="Next Day"
              >
                <ChevronRight size={16} />
              </button>
              {!isToday && (
                <button
                  type="button"
                  onClick={() => setSelectedDate(new Date().toISOString().split("T")[0])}
                  className="text-[11px] font-bold px-2 py-1 text-[var(--green-800)] bg-[var(--green-100)] rounded-md hover:bg-[var(--green-200)] transition ml-1"
                >
                  Today
                </button>
              )}
            </div>

            <button
              onClick={() => openLogModal()}
              className="btn btn-primary btn-sm text-xs font-semibold flex items-center gap-1.5 shadow-sm"
            >
              <Plus size={14} />
              Log Food Intake
            </button>
          </div>
        </div>

        {/* Disclaimer Notice Banner */}
        <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/80 text-amber-900 text-xs flex items-start gap-2.5">
          <AlertTriangle size={16} className="shrink-0 text-amber-700 mt-0.5" />
          <div>
            <span className="font-bold">A suggestion, not a medical prescription.</span> Targets are estimates derived from standard population equations and dietary guidelines. Always consult a qualified physician or registered dietitian before undertaking major dietary shifts.
          </div>
        </div>

        {/* Calculation Freshness Notice */}
        {savedTargets?.target_freshness?.is_stale && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="text-amber-700 shrink-0" />
              <span>
                Calculation update available: Stored profile was calculated with an earlier version snapshot.
              </span>
            </div>
            <Link href="/targets" className="btn btn-outline btn-xs text-[11px] shrink-0 font-semibold">
              Recalibrate in Targets
            </Link>
          </div>
        )}

        {/* Consumed vs Target Progress Dashboard */}
        {est ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[var(--forest-950)] flex items-center gap-2 m-0">
                <Flame size={16} className="text-amber-600" />
                <span>Daily Energy & Macronutrient Progress</span>
              </h2>
              {dailySummary && (
                <span className="text-[11px] font-semibold text-[var(--charcoal-600)]">
                  Logged: {dailySummary.items.length} food items
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Energy (Calories) */}
              <div className="p-5 rounded-2xl bg-white border border-[var(--border-light)] shadow-xs space-y-3">
                <div className="flex items-center justify-between text-xs text-[var(--charcoal-500)]">
                  <span>Energy Intake</span>
                  <Flame size={15} className="text-amber-600" />
                </div>
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-[var(--forest-950)] font-display">
                      {dailySummary?.consumed_totals.calories ?? 0}
                    </span>
                    <span className="text-xs font-semibold text-[var(--charcoal-600)]">
                      / {Math.round(est.energy_targets.daily_energy_target_kcal)} kcal
                    </span>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full bg-gray-100 rounded-full h-2 mt-2 overflow-hidden">
                    <div
                      className="bg-amber-500 h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          dailySummary?.progress_percentage?.calories ?? 0
                        )}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-[var(--charcoal-600)] pt-1">
                  <span>
                    {dailySummary?.remaining?.calories
                      ? `${dailySummary.remaining.calories} kcal remaining`
                      : "Target covered"}
                  </span>
                  <span className="font-semibold text-amber-800">
                    {dailySummary?.progress_percentage?.calories ?? 0}%
                  </span>
                </div>
              </div>

              {/* Protein Target */}
              <div className="p-5 rounded-2xl bg-white border border-[var(--border-light)] shadow-xs space-y-3">
                <div className="flex items-center justify-between text-xs text-[var(--charcoal-500)]">
                  <span>Protein Intake</span>
                  <Activity size={15} className="text-emerald-600" />
                </div>
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-[var(--forest-950)] font-display">
                      {dailySummary?.consumed_totals.protein_g ?? 0}g
                    </span>
                    <span className="text-xs font-semibold text-[var(--charcoal-600)]">
                      / {est.macronutrient_targets.protein.target_g_day}g
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 mt-2 overflow-hidden">
                    <div
                      className="bg-emerald-600 h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          dailySummary?.progress_percentage?.protein_g ?? 0
                        )}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-[var(--charcoal-600)] pt-1">
                  <span>
                    {dailySummary?.remaining?.protein_g
                      ? `${dailySummary.remaining.protein_g}g remaining`
                      : "Protein target covered"}
                  </span>
                  <span className="font-semibold text-emerald-800">
                    {dailySummary?.progress_percentage?.protein_g ?? 0}%
                  </span>
                </div>
              </div>

              {/* Fats Target */}
              <div className="p-5 rounded-2xl bg-white border border-[var(--border-light)] shadow-xs space-y-3">
                <div className="flex items-center justify-between text-xs text-[var(--charcoal-500)]">
                  <span>Healthy Fats</span>
                  <Heart size={15} className="text-indigo-600" />
                </div>
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-[var(--forest-950)] font-display">
                      {dailySummary?.consumed_totals.fat_g ?? 0}g
                    </span>
                    <span className="text-xs font-semibold text-[var(--charcoal-600)]">
                      / {est.macronutrient_targets.fat.target_g_day}g
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 mt-2 overflow-hidden">
                    <div
                      className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          dailySummary?.progress_percentage?.fat_g ?? 0
                        )}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-[var(--charcoal-600)] pt-1">
                  <span>
                    {dailySummary?.remaining?.fat_g
                      ? `${dailySummary.remaining.fat_g}g remaining`
                      : "Fats target covered"}
                  </span>
                  <span className="font-semibold text-indigo-800">
                    {dailySummary?.progress_percentage?.fat_g ?? 0}%
                  </span>
                </div>
              </div>

              {/* Complex Carbs & Fiber */}
              <div className="p-5 rounded-2xl bg-white border border-[var(--border-light)] shadow-xs space-y-3">
                <div className="flex items-center justify-between text-xs text-[var(--charcoal-500)]">
                  <span>Complex Carbs & Fiber</span>
                  <Sparkles size={15} className="text-amber-600" />
                </div>
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-[var(--forest-950)] font-display">
                      {dailySummary?.consumed_totals.carbs_g ?? 0}g
                    </span>
                    <span className="text-xs font-semibold text-[var(--charcoal-600)]">
                      / {est.macronutrient_targets.carbohydrates.target_g_day}g
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 mt-2 overflow-hidden">
                    <div
                      className="bg-amber-600 h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          dailySummary?.progress_percentage?.carbs_g ?? 0
                        )}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-[var(--charcoal-600)] pt-1">
                  <span>
                    Fiber: <strong>{dailySummary?.consumed_totals.fibre_g ?? 0}g</strong> / {est.macronutrient_targets.dietary_fiber.target_g_day}g
                  </span>
                  <span className="font-semibold text-amber-800">
                    {dailySummary?.progress_percentage?.carbs_g ?? 0}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 rounded-3xl bg-white border border-[var(--border-light)] text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto">
              <Activity size={24} />
            </div>
            <h2 className="text-xl font-bold text-[var(--forest-950)]">
              No Personalized Targets Configured Yet
            </h2>
            <p className="text-xs text-[var(--charcoal-600)] max-w-md mx-auto leading-relaxed">
              Nutriverse does not invent arbitrary default values. Calculate and establish your authentic daily metabolic targets using the scientific Mifflin–St Jeor formula on our targets portal.
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <Link href="/targets" className="btn btn-primary btn-sm px-6 font-bold flex items-center gap-2">
                Establish Nutrition Targets <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        )}

        {/* Data Completeness & Unknown Values Disclosure Banner */}
        {dailySummary && dailySummary.data_completeness_notes.length > 0 && (
          <div className="p-4 rounded-xl bg-blue-50/80 border border-blue-200 text-blue-900 text-xs flex items-start gap-2.5">
            <Info size={16} className="shrink-0 text-blue-700 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold">Transparent Data Provenance:</span>
              <p className="m-0 leading-relaxed text-[11px] text-blue-800">
                Some logged ingredients contain unverified or unknown micronutrient entries in source tables. Nutriverse strictly distinguishes unknown data from genuine zeros to prevent fabricated precision.
              </p>
            </div>
          </div>
        )}

        {/* Logged Foods by Meal Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[var(--forest-950)] flex items-center gap-2 m-0">
              <Utensils size={18} className="text-[var(--forest-900)]" />
              <span>Logged Foods for {selectedDate}</span>
            </h2>
            <button
              onClick={() => openLogModal()}
              className="btn btn-outline btn-sm text-xs font-semibold flex items-center gap-1.5"
            >
              <Plus size={13} /> Add Food
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {meals.map((meal) => {
              const items = dailySummary?.items.filter((i) => i.meal_type === meal.key) || [];
              const Icon = meal.icon;
              const mealCalories = Math.round(items.reduce((acc, i) => acc + (i.calories || 0), 0));
              const mealProtein = Math.round(items.reduce((acc, i) => acc + (i.protein_g || 0), 0) * 10) / 10;

              return (
                <div
                  key={meal.key}
                  className="p-5 rounded-2xl bg-white border border-[var(--border-light)] shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-[var(--border-light)]">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-[var(--green-100)] text-[var(--green-800)] flex items-center justify-center">
                        <Icon size={14} />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-[var(--forest-950)] m-0">
                          {meal.label}
                        </h3>
                        {items.length > 0 && (
                          <span className="text-[10px] text-[var(--charcoal-500)]">
                            {mealCalories} kcal • {mealProtein}g protein
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openLogModal(meal.key)}
                      className="p-1 rounded-md text-[var(--green-800)] hover:bg-[var(--green-100)] transition"
                      title={`Add item to ${meal.label}`}
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  {items.length === 0 ? (
                    <div className="py-4 text-center text-xs text-[var(--charcoal-500)]">
                      No foods logged for {meal.key} yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="p-2.5 rounded-xl bg-[var(--cream-soft)] border border-[var(--border-light)] flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-[var(--forest-950)] block truncate">
                              {item.food_name}
                            </span>
                            <span className="text-[10px] text-[var(--charcoal-600)] block">
                              {item.mass_g}g • {Math.round(item.calories)} kcal • P: {item.protein_g}g • C: {item.carbs_g}g • F: {item.fat_g}g
                            </span>
                            <span className="inline-block mt-0.5 text-[9px] px-1.5 py-0.5 rounded bg-white text-[var(--charcoal-600)] border border-[var(--border-light)]">
                              {item.source_basis === "verified_ifct_reference" ? "IFCT 2017 Verified" : "Catalog Product"}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteFoodLog(item.id)}
                            className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition shrink-0"
                            title="Remove logged food"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Personalized Nutrition Recommendations Engine (Phase 6.0) */}
        {est && (
          <PersonalizedRecommendations
            hasConsent={hasConsent}
            isStaleTarget={Boolean(savedTargets?.target_freshness?.is_stale)}
            onOpenAuthModal={() => setAuthModalOpen(true)}
          />
        )}

        {/* Nutritionist Review Handoff */}
        {hasAllergiesOrConditions && (
          <div className="p-5 rounded-2xl bg-emerald-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-800 text-emerald-200 text-xs font-semibold">
                <UserCheck size={12} />
                <span>Specialized Dietary Requirement</span>
              </div>
              <h3 className="text-base font-bold text-white m-0">
                Allergies or exclusions detected ({profile?.allergies})
              </h3>
              <p className="text-xs text-emerald-100 max-w-xl">
                Because you declared specific dietary restrictions, our clinical protocol advises having an ICMR-registered dietitian review your Calin Pack before ordering.
              </p>
            </div>
            <Link
              href="/packs"
              className="px-4 py-2 bg-white text-emerald-950 font-bold rounded-xl text-xs hover:bg-emerald-50 transition-colors shrink-0 text-center"
            >
              Request Free Nutritionist Review
            </Link>
          </div>
        )}

        {/* Active Calin Pack & Whole Food Guidelines */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-white border border-[var(--border-light)] shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package size={18} className="text-[var(--forest-900)]" />
                <h3 className="text-sm font-bold text-[var(--forest-950)] m-0">
                  Active Calin Pack
                </h3>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--green-100)] text-[var(--green-800)] font-semibold">
                {activePackTier ? "Configured" : "None Active"}
              </span>
            </div>

            {activePackTier ? (
              <div className="space-y-3">
                <p className="text-xs text-[var(--charcoal-600)]">
                  You have customized a <strong>{activePackTier}</strong> pack. Your weekly replenishment basket is aligned with your metabolic energy profile.
                </p>
                <div className="p-3 rounded-xl bg-[var(--cream-soft)] border border-[var(--border-light)] text-xs text-[var(--charcoal-700)]">
                  <div><strong>Indicative Range:</strong> ₹800 – ₹1,200 / week</div>
                  <div className="mt-1 text-[11px] text-[var(--charcoal-500)]">Includes verified whole dal, millets, seeds, and oils.</div>
                </div>
                <Link
                  href="/packs"
                  className="btn btn-outline btn-sm w-full text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  Modify Pack Items <ArrowRight size={13} />
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-[var(--charcoal-600)]">
                  A Calin Pack delivers pre-portioned, raw whole foods tailored to meet your macro split without ultra-processed fillers.
                </p>
                <div className="p-3 rounded-xl bg-[var(--cream-soft)] border border-[var(--border-light)] text-xs text-[var(--charcoal-700)]">
                  <div><strong>Tier Options:</strong> Basic, Minimal Plus, Premium</div>
                  <div className="mt-1 text-[11px] text-[var(--charcoal-500)]">Indicative pricing from ₹600 to ₹1,800.</div>
                </div>
                <Link
                  href="/packs"
                  className="btn btn-primary btn-sm w-full text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  Build Your Calin Pack <ArrowRight size={13} />
                </Link>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 p-6 rounded-2xl bg-white border border-[var(--border-light)] shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <Layers size={18} className="text-[var(--forest-900)]" />
              <h3 className="text-sm font-bold text-[var(--forest-950)] m-0">
                Daily Whole Food Intake Guidelines
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-[var(--cream-soft)] border border-[var(--border-light)] space-y-1.5">
                <span className="text-xs font-bold text-[var(--forest-950)] block">
                  1. Morning / Break-Fast
                </span>
                <p className="text-[11px] text-[var(--charcoal-600)] m-0 leading-relaxed">
                  Focus on high-fibre complex carbs and clean proteins: Ragi porridge or sprouted moong with soaked walnuts.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[var(--cream-soft)] border border-[var(--border-light)] space-y-1.5">
                <span className="text-xs font-bold text-[var(--forest-950)] block">
                  2. Midday Main Meal
                </span>
                <p className="text-[11px] text-[var(--charcoal-600)] m-0 leading-relaxed">
                  Brown rice or millets paired with nutrient-dense toor/masoor dal and sautéed spinach/methi for bioavailable iron.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[var(--cream-soft)] border border-[var(--border-light)] space-y-1.5">
                <span className="text-xs font-bold text-[var(--forest-950)] block">
                  3. Evening Nourishment
                </span>
                <p className="text-[11px] text-[var(--charcoal-600)] m-0 leading-relaxed">
                  Light whole food plate: pumpkin/gummadikaya subzi, desi curd, and flax seeds for essential omega-3 fats.
                </p>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--charcoal-600)]">
              <span>Goal: <strong>{profile?.goal || "Balanced Nourishment"}</strong></span>
              <span>Diet: <strong>{profile?.food_preferences || "Plant-Forward"}</strong></span>
              <Link href="/explore" className="font-semibold text-[var(--green-700)] hover:underline">
                Browse catalog by nutrient →
              </Link>
            </div>
          </div>
        </div>

        {/* Data Governance & Health Consent Management */}
        <div className="p-5 rounded-2xl bg-white border border-[var(--border-light)] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className={hasConsent ? "text-emerald-700" : "text-gray-400"} />
              <h4 className="text-xs font-bold text-[var(--charcoal-900)] m-0">
                Health & Biometric Data Consent
              </h4>
            </div>
            <p className="text-[11px] text-[var(--charcoal-600)] max-w-xl m-0">
              {hasConsent
                ? "Your biometric measurements are stored encrypted under HIPAA/DPDP privacy principles solely to compute energy expenditure and nutrient requirements."
                : "Consent has been revoked. Biometric records have been redacted from metabolic computations."}
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            {hasConsent && (
              <button
                type="button"
                onClick={handleRevokeConsent}
                disabled={revoking}
                className="btn btn-outline btn-sm text-[11px] text-red-700 border-red-200 hover:bg-red-50"
              >
                {revoking ? "Revoking…" : "Revoke Health Consent"}
              </button>
            )}
            <Link
              href="/privacy"
              className="text-[11px] text-[var(--charcoal-500)] underline hover:text-[var(--charcoal-800)]"
            >
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>

      {/* Log Food Intake Modal */}
      {isLogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-[var(--border-light)] flex flex-col">
            <div className="px-5 py-4 border-b border-[var(--border-light)] flex items-center justify-between bg-[var(--cream-soft)]">
              <h3 className="text-sm font-bold text-[var(--forest-950)] flex items-center gap-2 m-0">
                <Utensils size={16} className="text-[var(--green-800)]" />
                <span>Log Food Intake ({selectedDate})</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsLogModalOpen(false)}
                className="p-1 rounded-md text-[var(--charcoal-500)] hover:text-[var(--forest-950)] hover:bg-white transition"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleLogSubmit} className="p-5 space-y-4">
              {logError && (
                <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200">
                  {logError}
                </div>
              )}

              {/* Meal Type Selection */}
              <div>
                <label className="text-xs font-bold text-[var(--charcoal-700)] block mb-1">
                  Meal Category
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(["breakfast", "lunch", "dinner", "snack"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSelectedMealType(m)}
                      className={`py-1.5 text-xs font-semibold rounded-lg capitalize border transition ${
                        selectedMealType === m
                          ? "bg-[var(--green-800)] text-white border-[var(--green-800)]"
                          : "bg-white text-[var(--charcoal-700)] border-[var(--border-light)] hover:bg-[var(--cream-soft)]"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Food Selection */}
              <div>
                <label className="text-xs font-bold text-[var(--charcoal-700)] block mb-1">
                  Select Food from Catalog
                </label>
                <div className="relative mb-2">
                  <Search size={14} className="absolute left-3 top-2.5 text-[var(--charcoal-400)]" />
                  <input
                    type="text"
                    placeholder="Search verified whole foods..."
                    value={foodSearchQuery}
                    onChange={(e) => setFoodSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-[var(--border-light)] focus:outline-none focus:ring-1 focus:ring-[var(--green-700)]"
                  />
                </div>
                <select
                  value={selectedFoodId}
                  onChange={(e) => setSelectedFoodId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[var(--border-light)] focus:outline-none focus:ring-1 focus:ring-[var(--green-700)] bg-white text-[var(--charcoal-800)]"
                >
                  {filteredFoods.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.category} • {f.calories} kcal/100g)
                    </option>
                  ))}
                </select>
              </div>

              {/* Portion and State */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[var(--charcoal-700)] block mb-1">
                    Portion Size (grams)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="5000"
                    value={portionGrams}
                    onChange={(e) => setPortionGrams(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-[var(--border-light)] focus:outline-none focus:ring-1 focus:ring-[var(--green-700)]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[var(--charcoal-700)] block mb-1">
                    Preparation State
                  </label>
                  <select
                    value={foodState}
                    onChange={(e) => setFoodState(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-[var(--border-light)] focus:outline-none focus:ring-1 focus:ring-[var(--green-700)] bg-white"
                  >
                    <option value="raw">Raw Whole</option>
                    <option value="cooked">Cooked / Boiled</option>
                    <option value="soaked">Soaked / Sprouted</option>
                  </select>
                </div>
              </div>

              {/* Live Preview */}
              {selectedFoodObj && portionGrams > 0 && (
                <div className="p-3 rounded-xl bg-[var(--cream-soft)] border border-[var(--border-light)] text-xs space-y-1">
                  <span className="font-semibold text-[var(--forest-950)] block">
                    Estimated Portion Nutrients ({portionGrams}g):
                  </span>
                  <div className="text-[11px] text-[var(--charcoal-600)] flex flex-wrap gap-x-3 gap-y-0.5">
                    <span>⚡ {Math.round(selectedFoodObj.calories * (portionGrams / 100))} kcal</span>
                    <span>💪 {Math.round(selectedFoodObj.protein_g * (portionGrams / 100) * 10) / 10}g Protein</span>
                    <span>🌾 {Math.round(selectedFoodObj.carbs_g * (portionGrams / 100) * 10) / 10}g Carbs</span>
                    <span>🥑 {Math.round(selectedFoodObj.fat_g * (portionGrams / 100) * 10) / 10}g Fat</span>
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsLogModalOpen(false)}
                  className="btn btn-outline btn-sm text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingLog}
                  className="btn btn-primary btn-sm text-xs font-bold"
                >
                  {submittingLog ? "Recording…" : "Log Food Intake"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
