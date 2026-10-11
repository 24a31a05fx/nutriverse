"use client";

import React from "react";
import { ArrowRight, Sparkles, Compass, CheckCircle2, ShieldCheck, Zap, Activity, Barcode, BookOpen, Layers, Heart, Scale } from "lucide-react";
import Image from "next/image";
import { formatPaise } from "@/lib/api";

interface StorefrontViewProps {
  onNavigateTab: (tab: string) => void;
  onOpenOnboarding: () => void;
}

export const StorefrontView: React.FC<StorefrontViewProps> = ({ onNavigateTab, onOpenOnboarding }) => {
  return (
    <div className="space-y-16 pb-16">
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#faf7f0] to-white pt-10 pb-16 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-12 gap-12 items-center">
          {/* Left Text Column */}
          <div className="lg:col-span-7 space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-900 text-xs font-bold rounded-full uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-emerald-700" /> Nutrition-First Grocery Store
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-900 text-xs font-bold rounded-full">
                Live Venture Prototype
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 tracking-tight leading-[1.1]">
              Don&apos;t Just Eat. <span className="text-emerald-700 underline decoration-emerald-300">Understand</span> Your Nutrition.
            </h1>

            <p className="text-base sm:text-lg text-gray-600 leading-relaxed max-w-xl">
              Traditional grocery stores organize food by aisles like grains, dairy, and snacks. Nutriverse organizes food by <strong>biological contribution</strong>: high-density proteins, bioavailable minerals, sulforaphane, and micronutrients.
            </p>

            {/* Main Action Group */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => onNavigateTab("explorer")}
                className="px-6 py-3.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-900/10 hover:shadow-emerald-900/20 transition flex items-center gap-2 group"
              >
                <span>Explore Foods by Nutrient</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => onNavigateTab("packs")}
                className="px-6 py-3.5 bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 font-bold text-sm rounded-xl shadow-sm transition flex items-center gap-2"
              >
                <span>Calin Packs</span>
              </button>

              <button
                type="button"
                onClick={onOpenOnboarding}
                className="px-5 py-3.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold text-sm rounded-xl transition flex items-center gap-2"
              >
                <Activity className="w-4 h-4 text-amber-700" />
                <span>Calculate My BMR</span>
              </button>
            </div>

            {/* Value Indicators */}
            <div className="pt-4 grid grid-cols-3 gap-4 border-t border-gray-100 text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Zero Fake Nutrient Claims</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Mifflin–St Jeor Calorie Math</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Nutritionist Guidance Review</span>
              </div>
            </div>
          </div>

          {/* Right Hero Visual Card */}
          <div className="lg:col-span-5">
            <div className="relative p-6 bg-gradient-to-br from-emerald-900 to-teal-950 text-white rounded-3xl shadow-2xl border border-emerald-800/40 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-emerald-800/80">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-xs font-bold tracking-wider uppercase text-emerald-300">Live Nutritional Matrix</span>
                </div>
                <span className="text-[11px] font-mono text-emerald-400 bg-emerald-900/80 px-2 py-0.5 rounded">
                  Calin Bio-Index v2.0
                </span>
              </div>

              <div className="space-y-3">
                <div className="bg-emerald-950/60 p-3.5 rounded-2xl border border-emerald-800/50 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-emerald-300 block">Baseline Energy Requirement</span>
                    <span className="text-lg font-black text-white">2,050 kcal/day</span>
                  </div>
                  <span className="text-2xl">⚡</span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-emerald-950/40 p-3 rounded-xl border border-emerald-800/40">
                    <span className="text-emerald-400 text-[10px] uppercase font-bold block">Iron Density</span>
                    <span className="font-bold text-white">8.6 mg / day</span>
                    <span className="text-[10px] text-emerald-300 block mt-0.5">+ Lemon Pairing</span>
                  </div>
                  <div className="bg-emerald-950/40 p-3 rounded-xl border border-emerald-800/40">
                    <span className="text-emerald-400 text-[10px] uppercase font-bold block">Protein Target</span>
                    <span className="font-bold text-white">72g Clean Macro</span>
                    <span className="text-[10px] text-emerald-300 block mt-0.5">Bioavailable</span>
                  </div>
                </div>

                <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-[11px] text-emerald-200 leading-relaxed">
                  &quot;Food is biochemical information. When you choose by nutrient rather than brand packaging, your cells get precisely what they require.&quot;
                </div>
              </div>

              <button
                type="button"
                onClick={() => onNavigateTab("scanner")}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold text-xs rounded-xl shadow transition flex items-center justify-center gap-1.5"
              >
                <Barcode className="w-4 h-4" /> Try Live Optical Barcode Scanner
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. FIVE CONNECTED PILLARS GRID */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-10 space-y-2">
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider bg-emerald-50 px-3 py-1 rounded-full">
            Complete Ecosystem
          </span>
          <h2 className="text-3xl font-bold text-gray-900">Five Connected Activities In One Store</h2>
          <p className="text-xs sm:text-sm text-gray-600">
            Nutriverse integrates nutrition science with grocery purchasing so you never have to guess what to buy.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Card 1 */}
          <div
            onClick={onOpenOnboarding}
            className="p-5 bg-white hover:bg-emerald-50/30 rounded-2xl border border-gray-100 hover:border-emerald-300 shadow-sm transition cursor-pointer space-y-3 group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Activity className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">1. Individual Needs</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Mifflin–St Jeor mathematical estimation calibrated for age, sex, weight, and activity.
            </p>
            <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
              Calculate <ArrowRight className="w-3 h-3" />
            </span>
          </div>

          {/* Card 2 */}
          <div
            onClick={() => onNavigateTab("explorer")}
            className="p-5 bg-white hover:bg-emerald-50/30 rounded-2xl border border-gray-100 hover:border-emerald-300 shadow-sm transition cursor-pointer space-y-3 group"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Compass className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">2. Nutrient Explorer</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Discover groceries by protein, complex carbs, healthy fats, fiber, vitamins, and minerals.
            </p>
            <span className="text-[11px] font-bold text-blue-700 flex items-center gap-1">
              Explore Catalog <ArrowRight className="w-3 h-3" />
            </span>
          </div>

          {/* Card 3 */}
          <div
            onClick={() => onNavigateTab("scanner")}
            className="p-5 bg-white hover:bg-emerald-50/30 rounded-2xl border border-gray-100 hover:border-emerald-300 shadow-sm transition cursor-pointer space-y-3 group"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Barcode className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">3. Barcode Scanner</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Verify composition, bioavailability, and storage methods instantly via EAN lookup.
            </p>
            <span className="text-[11px] font-bold text-amber-700 flex items-center gap-1">
              Scan Code <ArrowRight className="w-3 h-3" />
            </span>
          </div>

          {/* Card 4 */}
          <div
            onClick={() => onNavigateTab("recipes")}
            className="p-5 bg-white hover:bg-emerald-50/30 rounded-2xl border border-gray-100 hover:border-emerald-300 shadow-sm transition cursor-pointer space-y-3 group"
          >
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center group-hover:scale-110 transition-transform">
              <BookOpen className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">4. Bio-Recipes</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Cooking techniques that preserve sulforaphane, omega-3, and mineral absorption.
            </p>
            <span className="text-[11px] font-bold text-teal-700 flex items-center gap-1">
              View Recipes <ArrowRight className="w-3 h-3" />
            </span>
          </div>

          {/* Card 5 */}
          <div
            onClick={() => onNavigateTab("packs")}
            className="p-5 bg-white hover:bg-purple-50/30 rounded-2xl border border-gray-100 hover:border-purple-300 shadow-sm transition cursor-pointer space-y-3 group"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">5. Calin Packs</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Curated food bundles built around verified weekly nutritional needs with customization.
            </p>
            <span className="text-[11px] font-bold text-purple-700 flex items-center gap-1">
              Build Pack <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </div>
      </section>

      {/* 3. CALIN PACKS SHOWCASE BANNER */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950 text-white rounded-3xl p-8 sm:p-12 shadow-2xl relative overflow-hidden space-y-8">
          <div className="max-w-xl space-y-3">
            <span className="px-3 py-1 bg-purple-900/60 text-purple-300 text-xs font-bold rounded-full uppercase tracking-wider border border-purple-700/50">
              Central Differentiating Feature
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold">Calin Packs: Curated Whole-Food Bundles</h2>
            <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
              Say goodbye to random grocery guessing. Calin Packs deliver complete synergistic food packages calibrated for baseline macros, micronutrients, and general nutritional wellness.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/10 space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase text-emerald-400">Basic Tier</span>
                <h3 className="text-xl font-bold">Calin Basic Pack</h3>
                <span className="text-2xl font-black text-white">{formatPaise(69900)} <span className="text-xs text-gray-300 font-normal">/ week</span></span>
                <p className="text-xs text-gray-300">
                  Staple legumes, rolled oats, and spinach for daily essential vitality.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab("packs")}
                className="w-full py-2.5 bg-white text-gray-900 font-bold text-xs rounded-xl hover:bg-emerald-50 transition"
              >
                Customize Basic Pack
              </button>
            </div>

            <div className="bg-white/15 backdrop-blur-md p-6 rounded-2xl border border-purple-400/30 space-y-4 flex flex-col justify-between relative shadow-lg">
              <span className="absolute -top-3 right-4 bg-purple-500 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Most Popular
              </span>
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase text-purple-300">Minimal Plus Tier</span>
                <h3 className="text-xl font-bold">Calin Minimal Plus</h3>
                <span className="text-2xl font-black text-white">{formatPaise(109900)} <span className="text-xs text-gray-300 font-normal">/ week</span></span>
                <p className="text-xs text-gray-300">
                  Expanded baseline with blueberries, Greek yoghurt, and complete quinoa proteins.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab("packs")}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl transition"
              >
                Customize Minimal Plus
              </button>
            </div>

            <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/10 space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase text-amber-300">Premium Tier</span>
                <h3 className="text-xl font-bold">Calin Premium Pack</h3>
                <span className="text-2xl font-black text-white">{formatPaise(169900)} <span className="text-xs text-gray-300 font-normal">/ week</span></span>
                <p className="text-xs text-gray-300">
                  Maximum micronutrient density, cold-pressed oils, California almonds, and sulforaphane greens.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab("packs")}
                className="w-full py-2.5 bg-white text-gray-900 font-bold text-xs rounded-xl hover:bg-emerald-50 transition"
              >
                Customize Premium Pack
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
