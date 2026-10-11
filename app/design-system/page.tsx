"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  FibreIcon,
  VitaminsIcon,
  ProteinIcon,
  HealthyFatsIcon,
  MineralsIcon,
  CarbohydratesIcon,
  PriceTag,
  DiscountRibbon,
  UnitChip,
  VegDot,
  NutrientBadge,
  QtyStepper,
  EmptyState,
  ErrorState,
  PageSkeleton,
  NutrientPanel,
  TierCard,
  CartSummary,
  OrderTimeline,
  ProductCard,
} from "@/components/design-system";
import { ArrowLeft, Check, Sparkles, RefreshCw } from "lucide-react";

export default function DesignSystemPage() {
  const [stepperVal, setStepperVal] = useState(2);
  const [selectedUnit, setSelectedUnit] = useState("1 kg");
  const [selectedTier, setSelectedTier] = useState<"basic" | "minimal_plus" | "premium">("minimal_plus");
  const [interactiveCartQty, setInteractiveCartQty] = useState(1);
  const [activeTimelineStatus, setActiveTimelineStatus] = useState<
    "placed_demo" | "preparing_demo" | "completed_demo" | "cancelled_demo"
  >("preparing_demo");

  return (
    <div className="min-h-screen bg-[#F6F1E4] text-[#232A16] font-sans antialiased pb-20">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-[#DDD3B8] px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#3E4A26] hover:text-[#232A16] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Store
            </Link>
            <span className="text-[#DDD3B8]">|</span>
            <span className="font-heading text-sm font-bold text-[#232A16]">
              Nutriverse Brand Design System (Phase 1)
            </span>
          </div>

          <span className="px-2.5 py-1 text-[11px] font-mono font-semibold rounded-[6px] bg-[#3E4A26]/10 text-[#3E4A26] border border-[#3E4A26]/20">
            Viewport: 375px & 1280px verified
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-12">
        {/* Intro */}
        <section className="space-y-2 border-b border-[#DDD3B8] pb-6">
          <h1 className="font-heading text-2xl sm:text-3xl font-black text-[#232A16]">
            Nutriverse Design System & Primitives
          </h1>
          <p className="text-xs sm:text-sm text-[#6B7A45] max-w-2xl leading-relaxed">
            Standard design tokens, typography, line icons, and retail UI components. 
            Dense layout rhythm (8px), 8–10px radii, 1px borders, Fraunces serif headings, Figtree UI body, and authentic whole-food palettes.
          </p>
        </section>

        {/* 1. Brand Tokens & Color Palette */}
        <section className="space-y-4">
          <h2 className="font-heading text-lg font-bold text-[#232A16] flex items-center gap-2">
            <span>1. Brand Tokens & Palette</span>
            <span className="text-xs font-normal text-[#6B7A45] font-sans">
              (Forest, Sage, Mustard, Cream, Ink, Line)
            </span>
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            <div className="p-3 rounded-[10px] bg-[#3E4A26] text-[#F6F1E4] border border-[#3E4A26]">
              <span className="text-[10px] font-mono opacity-80 block">#3E4A26</span>
              <span className="text-xs font-bold block mt-1">Forest</span>
              <span className="text-[10px] opacity-70">Primary Brand</span>
            </div>

            <div className="p-3 rounded-[10px] bg-[#6B7A45] text-[#F6F1E4] border border-[#6B7A45]">
              <span className="text-[10px] font-mono opacity-80 block">#6B7A45</span>
              <span className="text-xs font-bold block mt-1">Sage</span>
              <span className="text-[10px] opacity-70">Supporting & Muted</span>
            </div>

            <div className="p-3 rounded-[10px] bg-[#C1872B] text-white border border-[#C1872B]">
              <span className="text-[10px] font-mono opacity-80 block">#C1872B</span>
              <span className="text-xs font-bold block mt-1">Mustard</span>
              <span className="text-[10px] opacity-70">Accent & Attention</span>
            </div>

            <div className="p-3 rounded-[10px] bg-[#F6F1E4] text-[#232A16] border border-[#DDD3B8]">
              <span className="text-[10px] font-mono opacity-80 block">#F6F1E4</span>
              <span className="text-xs font-bold block mt-1">Cream</span>
              <span className="text-[10px] opacity-70">Warm App Canvas</span>
            </div>

            <div className="p-3 rounded-[10px] bg-[#232A16] text-[#F6F1E4] border border-[#232A16]">
              <span className="text-[10px] font-mono opacity-80 block">#232A16</span>
              <span className="text-xs font-bold block mt-1">Ink</span>
              <span className="text-[10px] opacity-70">Deep Typographic Ink</span>
            </div>

            <div className="p-3 rounded-[10px] bg-white text-[#232A16] border border-[#DDD3B8]">
              <span className="text-[10px] font-mono opacity-80 block">#DDD3B8</span>
              <span className="text-xs font-bold block mt-1">Line</span>
              <span className="text-[10px] opacity-70">1px Border Rule</span>
            </div>
          </div>
        </section>

        {/* 2. Custom Line Icons */}
        <section className="space-y-4">
          <h2 className="font-heading text-lg font-bold text-[#232A16]">
            2. Six Custom Line SVG Icons
          </h2>
          <p className="text-xs text-[#6B7A45]">
            Custom stroke line art (1.75px stroke-width, no gradients, no emoji icons) for the core nutrient classes.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            <div className="p-4 rounded-[10px] border border-[#DDD3B8] bg-white flex flex-col items-center text-center space-y-2">
              <FibreIcon size={28} className="text-[#3E4A26]" />
              <span className="text-xs font-bold text-[#232A16]">Fibre</span>
              <span className="text-[10px] text-[#6B7A45]">Grain & stalk</span>
            </div>

            <div className="p-4 rounded-[10px] border border-[#DDD3B8] bg-white flex flex-col items-center text-center space-y-2">
              <VitaminsIcon size={28} className="text-[#3E4A26]" />
              <span className="text-xs font-bold text-[#232A16]">Vitamins</span>
              <span className="text-[10px] text-[#6B7A45]">Citrus bio-ring</span>
            </div>

            <div className="p-4 rounded-[10px] border border-[#DDD3B8] bg-white flex flex-col items-center text-center space-y-2">
              <ProteinIcon size={28} className="text-[#3E4A26]" />
              <span className="text-xs font-bold text-[#232A16]">Protein</span>
              <span className="text-[10px] text-[#6B7A45]">Legume pod & nodes</span>
            </div>

            <div className="p-4 rounded-[10px] border border-[#DDD3B8] bg-white flex flex-col items-center text-center space-y-2">
              <HealthyFatsIcon size={28} className="text-[#3E4A26]" />
              <span className="text-xs font-bold text-[#232A16]">Healthy Fats</span>
              <span className="text-[10px] text-[#6B7A45]">Botanical droplet</span>
            </div>

            <div className="p-4 rounded-[10px] border border-[#DDD3B8] bg-white flex flex-col items-center text-center space-y-2">
              <MineralsIcon size={28} className="text-[#3E4A26]" />
              <span className="text-xs font-bold text-[#232A16]">Minerals</span>
              <span className="text-[10px] text-[#6B7A45]">Crystal lattice</span>
            </div>

            <div className="p-4 rounded-[10px] border border-[#DDD3B8] bg-white flex flex-col items-center text-center space-y-2">
              <CarbohydratesIcon size={28} className="text-[#3E4A26]" />
              <span className="text-xs font-bold text-[#232A16]">Carbohydrates</span>
              <span className="text-[10px] text-[#6B7A45]">Slow-release matrix</span>
            </div>
          </div>
        </section>

        {/* 3. Small Primitives: VegDot, PriceTag, DiscountRibbon, UnitChip, QtyStepper */}
        <section className="space-y-4">
          <h2 className="font-heading text-lg font-bold text-[#232A16]">
            3. Micro-Primitives & State Matrix
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* VegDot & PriceTag & DiscountRibbon */}
            <div className="p-4 rounded-[10px] border border-[#DDD3B8] bg-white space-y-4">
              <h3 className="font-heading text-sm font-bold text-[#232A16] border-b border-[#DDD3B8] pb-2">
                VegDot & PriceTag & DiscountRibbon
              </h3>

              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <span className="text-xs text-[#6B7A45] w-28">VegDot Sizes:</span>
                  <div className="flex items-center gap-3">
                    <VegDot size="sm" />
                    <VegDot size="md" />
                    <VegDot size="lg" />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-xs text-[#6B7A45] w-28">PriceTag (sm/md/lg):</span>
                  <div className="flex items-center gap-3 flex-wrap">
                    <PriceTag pricePaise={2900} mrpPaise={3500} unit="1 kg" size="sm" />
                    <PriceTag pricePaise={8900} mrpPaise={11000} unit="500 g" size="md" showTaxNote />
                    <PriceTag pricePaise={125000} mrpPaise={150000} size="lg" />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-xs text-[#6B7A45] w-28">DiscountRibbon:</span>
                  <div className="flex items-center gap-3">
                    <DiscountRibbon pricePaise={2900} mrpPaise={3500} format="percent" />
                    <DiscountRibbon pricePaise={2900} mrpPaise={3500} format="amount" />
                    <span className="text-[11px] text-[#6B7A45] italic">
                      (mrp ≤ price renders null per rule)
                    </span>
                    <DiscountRibbon pricePaise={3500} mrpPaise={3500} />
                  </div>
                </div>
              </div>
            </div>

            {/* UnitChip & QtyStepper States */}
            <div className="p-4 rounded-[10px] border border-[#DDD3B8] bg-white space-y-4">
              <h3 className="font-heading text-sm font-bold text-[#232A16] border-b border-[#DDD3B8] pb-2">
                UnitChip & QtyStepper (States: Default, Active, Disabled)
              </h3>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <span className="text-xs text-[#6B7A45] block">UnitChips (Interactive):</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {["500 g", "1 kg", "2 x 1 kg", "5 kg bag"].map((u) => (
                      <UnitChip
                        key={u}
                        label={u}
                        selected={selectedUnit === u}
                        onClick={() => setSelectedUnit(u)}
                      />
                    ))}
                    <UnitChip label="10 kg sack" disabled />
                  </div>
                </div>

                <div className="space-y-1.5 pt-2">
                  <span className="text-xs text-[#6B7A45] block">QtyStepper (Interactive + Boundary):</span>
                  <div className="flex items-center gap-4 flex-wrap">
                    <QtyStepper
                      value={stepperVal}
                      onChange={setStepperVal}
                      min={1}
                      max={8}
                      size="md"
                    />
                    <QtyStepper
                      value={1}
                      onChange={() => {}}
                      min={1}
                      size="sm"
                    />
                    <QtyStepper
                      value={0}
                      onChange={() => {}}
                      disabled
                      size="sm"
                    />
                    <span className="text-[11px] text-[#6B7A45]">
                      Current: <strong>{stepperVal}</strong> (min 1, max 8)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. NutrientBadges */}
        <section className="space-y-4">
          <h2 className="font-heading text-lg font-bold text-[#232A16]">
            4. NutrientBadges (Verified & Not-Verified States)
          </h2>

          <div className="p-4 rounded-[10px] border border-[#DDD3B8] bg-white flex flex-wrap gap-2">
            <NutrientBadge type="protein" label="High Protein" value="8.6g" verified={true} />
            <NutrientBadge type="fibre" label="Dietary Fibre" value="6.4g" verified={true} />
            <NutrientBadge type="minerals" label="Bioavailable Iron" value="2.8mg" verified={true} />
            <NutrientBadge type="vitamins" label="Vitamin B Complex" verified={true} />
            <NutrientBadge type="fats" label="Cold-Pressed MUFA" value="14.2g" verified={true} />
            <NutrientBadge type="carbs" label="Low GI Starch" verified={false} />
          </div>
        </section>

        {/* 5. ProductCard Variants: rail, compact, list */}
        <section className="space-y-4">
          <h2 className="font-heading text-lg font-bold text-[#232A16]">
            5. ProductCard Presentations (Rail, Compact, List)
          </h2>
          <p className="text-xs text-[#6B7A45]">
            Shows real photo, name, Telugu/Hindi local name, price tag, discount ribbon (only if mrp &gt; price), veg dot, unit selector, and photo fallback when image is pending approval.
          </p>

          <div className="space-y-6">
            {/* Horizontal Rail */}
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#6B7A45] mb-2 block">
                Rail Variant (Scrollable shelf items)
              </span>
              <div className="flex gap-4 overflow-x-auto pb-3">
                <ProductCard
                  id="demo-potato"
                  variant="rail"
                  name="Fresh Farm Potatoes"
                  localName="Bangala Dumpa / Aloo"
                  category="Fresh Produce"
                  imageUrl="/assets/products/potato.jpg"
                  pricePaise={2900}
                  mrpPaise={3500}
                  unit="1 kg"
                  nutrientHighlight={{ label: "Complex Carb", value: "17g", type: "carbs", verified: true }}
                  quantityInCart={interactiveCartQty}
                  onUpdateQuantity={setInteractiveCartQty}
                />
                <ProductCard
                  id="demo-chickpeas"
                  variant="rail"
                  name="Sprouted Desi Chickpeas"
                  localName="Mola Katti Chenagalu"
                  category="Pulses & Legumes"
                  imageUrl="/assets/products/chickpeas.jpg"
                  pricePaise={8900}
                  mrpPaise={11000}
                  unit="500 g"
                  nutrientHighlight={{ label: "Plant Protein", value: "8.6g", type: "protein", verified: true }}
                />
                <ProductCard
                  id="demo-ragi"
                  variant="rail"
                  name="Finger Millet (Ragulu)"
                  localName="Ragi Whole Grain"
                  category="Millets"
                  imageUrl=""
                  imageApprovalStatus="pending"
                  pricePaise={6500}
                  unit="1 kg"
                  nutrientHighlight={{ label: "Calcium Dense", value: "344mg", type: "minerals", verified: true }}
                />
                <ProductCard
                  id="demo-pumpkin"
                  variant="rail"
                  name="Pumpkin (Gummadikaya)"
                  localName="Yellow Pumpkin"
                  category="Fresh Produce"
                  imageUrl=""
                  imageApprovalStatus="pending"
                  pricePaise={4200}
                  unit="1 kg"
                  inStock={false}
                />
              </div>
            </div>

            {/* Compact Grid Variant */}
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#6B7A45] mb-2 block">
                Compact Grid Variant (Store / Explorer catalog)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <ProductCard
                  id="demo-card-1"
                  variant="compact"
                  name="Sprouted Desi Chickpeas"
                  localName="Mola Katti Chenagalu"
                  category="Pulses"
                  imageUrl="/assets/products/chickpeas.jpg"
                  pricePaise={8900}
                  mrpPaise={11000}
                  unit="500 g"
                  unitOptions={[
                    { unit: "500 g", pricePaise: 8900, mrpPaise: 11000 },
                    { unit: "1 kg", pricePaise: 16900, mrpPaise: 21000 },
                  ]}
                  nutrientHighlight={{ label: "High Protein", value: "8.6g", type: "protein", verified: true }}
                />

                <ProductCard
                  id="demo-card-2"
                  variant="compact"
                  name="Finger Millet Flour"
                  localName="Ragi Pindi"
                  category="Millets"
                  imageUrl=""
                  imageApprovalStatus="pending"
                  pricePaise={6500}
                  unit="1 kg"
                  nutrientHighlight={{ label: "High Fibre", value: "11.2g", type: "fibre", verified: true }}
                />

                <ProductCard
                  id="demo-card-3"
                  variant="compact"
                  name="Desi Cow Ghee"
                  localName="Aavu Neyyi"
                  category="Dairy & Healthy Fats"
                  imageUrl=""
                  imageApprovalStatus="pending"
                  pricePaise={62000}
                  mrpPaise={70000}
                  unit="500 ml"
                  nutrientHighlight={{ label: "Healthy Fats", value: "99.5g", type: "fats", verified: true }}
                />
              </div>
            </div>

            {/* List Row Variant */}
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#6B7A45] mb-2 block">
                List Variant (Cart & Search results)
              </span>
              <div className="space-y-2">
                <ProductCard
                  id="demo-list-1"
                  variant="list"
                  name="Fresh Farm Potatoes"
                  localName="Bangala Dumpa"
                  category="Produce"
                  imageUrl="/assets/products/potato.jpg"
                  pricePaise={2900}
                  mrpPaise={3500}
                  unit="1 kg"
                  nutrientHighlight={{ label: "Starch", value: "17g", type: "carbs", verified: true }}
                  quantityInCart={1}
                />
                <ProductCard
                  id="demo-list-2"
                  variant="list"
                  name="Pumpkin (Gummadikaya)"
                  localName="Yellow Pumpkin"
                  category="Produce"
                  imageUrl=""
                  imageApprovalStatus="pending"
                  pricePaise={4200}
                  unit="1 kg"
                  inStock={false}
                />
              </div>
            </div>
          </div>
        </section>

        {/* 6. NutrientPanel */}
        <section className="space-y-4">
          <h2 className="font-heading text-lg font-bold text-[#232A16]">
            6. NutrientPanel (Source-Referenced Breakdown)
          </h2>
          <p className="text-xs text-[#6B7A45]">
            DATA RULE: Values only with source_reference, source_basis, verification_status. Missing value = &quot;Not verified&quot;, never zero, never invented.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <NutrientPanel
              basis="Per 100g edible portion"
              sourceReference="IFCT 2017 (T142) • ICMR-NIN National Institute of Nutrition"
              sourceBasis="Laboratory Food Composition Assay"
              verificationStatus="verified"
              verifiedBy="ICMR-NIN 2017 Standard"
              calories={364}
              nutrients={[
                { key: "protein", label: "Protein", amount: 19.3, unit: "g", rdaPercent: 36, verified: true, type: "protein" },
                { key: "carbs", label: "Available Carbohydrates", amount: 60.9, unit: "g", verified: true, type: "carbs" },
                { key: "fibre", label: "Total Dietary Fibre", amount: 17.4, unit: "g", rdaPercent: 58, verified: true, type: "fibre" },
                { key: "fats", label: "Total Fat", amount: 6.0, unit: "g", verified: true, type: "fats" },
                { key: "iron", label: "Iron (Fe)", amount: 6.2, unit: "mg", rdaPercent: 33, verified: true, type: "minerals" },
                { key: "folate", label: "Total Folates", amount: 216, unit: "µg", rdaPercent: 72, verified: true, type: "vitamins" },
              ]}
            />

            <NutrientPanel
              basis="Per 100g unverified sample"
              sourceReference="Pending Lab Submission"
              sourceBasis="Unverified farmer sample"
              verificationStatus="unverified"
              calories={null}
              nutrients={[
                { key: "protein", label: "Protein", amount: null, unit: "g", verified: false, type: "protein" },
                { key: "fibre", label: "Dietary Fibre", amount: null, unit: "g", verified: false, type: "fibre" },
                { key: "zinc", label: "Zinc (Zn)", amount: null, unit: "mg", verified: false, type: "minerals" },
              ]}
            />
          </div>
        </section>

        {/* 7. TierCard */}
        <section className="space-y-4">
          <h2 className="font-heading text-lg font-bold text-[#232A16]">
            7. TierCard (Calin Pack Tiers with Indicative Price)
          </h2>
          <p className="text-xs text-[#6B7A45]">
            Labeled strictly with &quot;Indicative price&quot; per client-demo MVP requirements.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <TierCard
              tier="basic"
              title="Basic Pack"
              subtitle="Essential Nutritional Foundation"
              indicativePriceRange="₹600–₹800"
              description="Whole-food daily essentials covering basic protein and energy baselines."
              features={[
                "Unpolished millets & pulses",
                "Essential seasonal root crops",
                "Whole grains baseline",
              ]}
              selected={selectedTier === "basic"}
              onSelect={() => setSelectedTier("basic")}
            />

            <TierCard
              tier="minimal_plus"
              title="Minimal Plus"
              subtitle="Targeted Micronutrient Density"
              indicativePriceRange="₹800–₹1,200"
              description="Fortified whole-food staples rich in iron, zinc, folates, and slow-release fibres."
              features={[
                "Sprouted pulses (high bioavailability)",
                "Cold-pressed single-seed oils",
                "High-fibre ancient millets",
                "Micronutrient-rich farm greens",
              ]}
              selected={selectedTier === "minimal_plus"}
              onSelect={() => setSelectedTier("minimal_plus")}
            />

            <TierCard
              tier="premium"
              title="Premium Pack"
              subtitle="Artisanal & Bioactive Whole Foods"
              indicativePriceRange="₹1,500–₹1,800"
              description="Curated single-origin grains, A2 dairy staples, and wild cold-pressed seeds."
              features={[
                "A2 bilona cultured cow ghee",
                "Unpasteurized native wild honey",
                "Sprouted heirloom ragi & foxtail",
                "Single-estate nuts & seeds",
              ]}
              selected={selectedTier === "premium"}
              onSelect={() => setSelectedTier("premium")}
            />
          </div>
        </section>

        {/* 8. CartSummary & OrderTimeline */}
        <section className="space-y-4">
          <h2 className="font-heading text-lg font-bold text-[#232A16]">
            8. CartSummary & OrderTimeline (Demo Labels Only)
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <CartSummary
              subtotalPaise={11800}
              deliveryFeePaise={0}
              discountPaise={2100}
              totalPaise={11800}
              onCheckout={() => alert("Demo checkout triggered.")}
            />

            <div className="space-y-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-[#6B7A45]">Select Timeline State:</span>
                {(["placed_demo", "preparing_demo", "completed_demo", "cancelled_demo"] as const).map(
                  (st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setActiveTimelineStatus(st)}
                      className={`px-2 py-1 text-[11px] rounded-[6px] border ${
                        activeTimelineStatus === st
                          ? "bg-[#3E4A26] text-white border-[#3E4A26]"
                          : "bg-white text-[#232A16] border-[#DDD3B8]"
                      }`}
                    >
                      {st}
                    </button>
                  )
                )}
              </div>

              <OrderTimeline
                orderId="nv-demo-849102"
                status={activeTimelineStatus}
                createdAt={new Date().toISOString()}
              />
            </div>
          </div>
        </section>

        {/* 9. Feedback States: EmptyState, ErrorState, PageSkeleton */}
        <section className="space-y-4">
          <h2 className="font-heading text-lg font-bold text-[#232A16]">
            9. Application Feedback & Lifecycle States
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EmptyState
              title="No whole foods found"
              description="Try adjusting your nutrient group filter or searching by an Indian staple name (e.g. Ragi, Chenagalu)."
              actionLabel="Reset Filters"
              onAction={() => alert("Filters reset")}
            />

            <div className="space-y-3">
              <ErrorState
                title="Catalog Fetch Interrupted"
                message="Unable to verify server-side nutrient totals. Check network connectivity."
                errorCode="ERR_OFFLINE_503"
                onRetry={() => alert("Retrying...")}
              />

              <div className="rounded-[10px] border border-[#DDD3B8] bg-white p-4 space-y-2">
                <span className="text-xs font-bold text-[#232A16] block">
                  PageSkeleton Primitive Preview
                </span>
                <PageSkeleton variant="rail" count={2} />
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
