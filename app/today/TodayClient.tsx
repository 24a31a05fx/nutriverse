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
} from "lucide-react";
import { useNutriverse } from "@/components/NutriverseProvider";
import { api, NutritionProfile } from "@/lib/api";

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

  useEffect(() => {
    try {
      const savedTier = localStorage.getItem("nutriverse_active_pack");
      if (savedTier) setActivePackTier(savedTier);
    } catch {}
  }, []);

  const handleRevokeConsent = async () => {
    if (!confirm("Are you sure you want to revoke consent for storing health & biometric data? Your biometric targets will be cleared.")) {
      return;
    }
    setRevoking(true);
    try {
      await api("/profile/revoke-consent", { method: "POST" });
      setRevokeSuccess(true);
      // Refresh profile
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

  if (!sessionReady) {
    return (
      <div className="container py-16 text-center text-sm text-[var(--charcoal-600)]" role="status">
        Checking your nutrition profile…
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

  // Profile status
  const hasConsent = profile && !profile.consent_revoked_at;
  const calorieTarget = profile?.calorie_target || 2050;
  const bmr = profile?.bmr || 1550;
  const activityMultiplier = profile?.activity_level || 1.375;
  const isFloorApplied =
    (profile?.sex === "female" && calorieTarget <= 1200) ||
    (profile?.sex === "male" && calorieTarget <= 1500);

  // Macro calculation based on reference split (20% P, 25% F, 55% C)
  const proteinGrams = Math.round((calorieTarget * 0.2) / 4);
  const fatGrams = Math.round((calorieTarget * 0.25) / 9);
  const carbGrams = Math.round((calorieTarget * 0.55) / 4);

  const hasAllergiesOrConditions =
    profile?.allergies &&
    profile.allergies.toLowerCase() !== "none" &&
    profile.allergies.trim() !== "";

  return (
    <section className="section section-cream py-8">
      <div className="container max-w-5xl space-y-8">
        {/* Header Strip */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-[var(--border-light)]">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--green-100)] text-[var(--green-800)] text-xs font-semibold mb-2">
              <Calendar size={13} />
              <span>Daily Target Dashboard</span>
            </div>
            <h1 style={{ fontSize: "clamp(1.75rem, 3vw, 2.25rem)", color: "var(--forest-950)", margin: 0 }}>
              Today&apos;s Nutrition & Plan
            </h1>
            <p className="text-xs text-[var(--charcoal-600)] mt-1">
              Personalized metabolic targets calculated via Mifflin–St Jeor formula with ICMR physical activity levels.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setOnboardingOpen(true)}
              className="btn btn-outline btn-sm text-xs font-semibold"
            >
              <RotateCcw size={13} className="mr-1.5" />
              Recalculate Targets
            </button>
            <Link href="/packs" className="btn btn-primary btn-sm text-xs font-semibold">
              <Package size={13} className="mr-1.5" />
              Manage Calin Pack
            </Link>
          </div>
        </div>

        {/* Disclaimer Notice Banner */}
        <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/80 text-amber-900 text-xs flex items-start gap-2.5">
          <AlertTriangle size={16} className="shrink-0 text-amber-700 mt-0.5" />
          <div>
            <span className="font-bold">A suggestion, not a medical prescription.</span> Targets are estimates derived from standard population equations and dietary guidelines. Always consult a qualified physician or registered dietitian before undertaking major dietary shifts.
          </div>
        </div>

        {/* Biometrics & Energy Expenditure Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Calorie Target Card */}
          <div className="p-5 rounded-2xl bg-white border border-[var(--border-light)] shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs text-[var(--charcoal-500)]">
              <span>Target Energy</span>
              <Flame size={15} className="text-amber-600" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-[var(--forest-950)] font-display">
                {calorieTarget.toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-[var(--charcoal-600)]">kcal / day</span>
            </div>
            <p className="text-[11px] text-[var(--charcoal-500)]">
              BMR: {bmr} kcal • {activityMultiplier}× PAL factor
            </p>
            {isFloorApplied && (
              <span className="inline-block text-[10px] font-semibold text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded-md">
                Caloric safety floor applied
              </span>
            )}
          </div>

          {/* Protein Target */}
          <div className="p-5 rounded-2xl bg-white border border-[var(--border-light)] shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs text-[var(--charcoal-500)]">
              <span>Protein Target (20%)</span>
              <Activity size={15} className="text-emerald-600" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-[var(--forest-950)] font-display">
                {proteinGrams}
              </span>
              <span className="text-xs font-semibold text-[var(--charcoal-600)]">g / day</span>
            </div>
            <p className="text-[11px] text-[var(--charcoal-500)]">
              Dal, paneer, curd, eggs, nuts & seeds
            </p>
            <span className="inline-block text-[10px] text-[var(--charcoal-500)] bg-[var(--cream-soft)] px-2 py-0.5 rounded-md">
              Pending clinical approval
            </span>
          </div>

          {/* Fats Target */}
          <div className="p-5 rounded-2xl bg-white border border-[var(--border-light)] shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs text-[var(--charcoal-500)]">
              <span>Healthy Fats (25%)</span>
              <Heart size={15} className="text-indigo-600" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-[var(--forest-950)] font-display">
                {fatGrams}
              </span>
              <span className="text-xs font-semibold text-[var(--charcoal-600)]">g / day</span>
            </div>
            <p className="text-[11px] text-[var(--charcoal-500)]">
              Cold-pressed sesame, walnuts, A2 ghee
            </p>
            <span className="inline-block text-[10px] text-[var(--charcoal-500)] bg-[var(--cream-soft)] px-2 py-0.5 rounded-md">
              Pending clinical approval
            </span>
          </div>

          {/* Complex Carbs */}
          <div className="p-5 rounded-2xl bg-white border border-[var(--border-light)] shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs text-[var(--charcoal-500)]">
              <span>Complex Carbs (55%)</span>
              <Sparkles size={15} className="text-amber-600" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-[var(--forest-950)] font-display">
                {carbGrams}
              </span>
              <span className="text-xs font-semibold text-[var(--charcoal-600)]">g / day</span>
            </div>
            <p className="text-[11px] text-[var(--charcoal-500)]">
              Ragi, brown rice, whole lentils
            </p>
            <span className="inline-block text-[10px] text-[var(--charcoal-500)] bg-[var(--cream-soft)] px-2 py-0.5 rounded-md">
              Pending clinical approval
            </span>
          </div>
        </div>

        {/* Nutritionist Review Handoff (if allergies or exclusions declared) */}
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

        {/* Main Content: Active Calin Pack & Whole Food Pillars */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Pack Status Card */}
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

          {/* Daily Whole Food Intake Guidelines */}
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
    </section>
  );
}
