"use client";

import { useState } from "react";
import Image from "next/image";
import { Sparkles, Check, ArrowRight, ShieldAlert, HeartHandshake, Eye } from "lucide-react";
import PackDetailModal, { PackDetail } from "./PackDetailModal";

const packTiers: PackDetail[] = [
  {
    id: "basic",
    name: "Basic",
    tag: "Everyday Foundation",
    description: "A simple introduction to nutrition-focused food bundles designed for foundational nourishment.",
    targetAudience: "College students, young adults, and beginners seeking wholesome everyday groceries without complexity.",
    illustrativeItems: [
      "Protein-rich Chickpeas & Legumes",
      "Fresh Dark Leafy Greens (Spinach)",
      "Wholesome Rolled Oats",
      "Seasonal Citrus Fruits",
      "Essential Raw Seeds (Sunflower)",
      "Cold-Milled Flax Meal"
    ],
    nutritionalFocus: ["Baseline Energy", "Plant Protein Starter", "Dietary Fiber"],
    customizationNote: "Illustrative concept bundle focusing on affordable, staple nutrient-dense pantry and produce staples."
  },
  {
    id: "minimal-plus",
    name: "Minimal Plus",
    tag: "Most Popular Concept",
    description: "An expanded food bundle with more variety, balanced energy sources, and versatile ingredients.",
    targetAudience: "Working professionals and active individuals managing a busy schedule while staying nutritionally balanced.",
    illustrativeItems: [
      "Everything in Basic, plus:",
      "Organic Quinoa & Ancient Grains",
      "Probiotic Greek Yoghurt / Plant Curd",
      "Tender Curly Kale & Sweet Potatoes",
      "Antioxidant Berry Assortment",
      "Raw Whole Almonds & Walnuts"
    ],
    nutritionalFocus: ["Sustained Energy", "Gut & Microbiome Support", "Antioxidant Rich"],
    customizationNote: "Illustrative concept bundle designed to support diverse weekday meal prep with minimal kitchen time."
  },
  {
    id: "premium",
    name: "Premium",
    tag: "Maximum Variety",
    description: "A broader food bundle with additional variety, diverse nutrient profiles, and customization possibilities.",
    targetAudience: "Fitness enthusiasts, athletes, and wellness seekers who want deep nutritional density and curated variety.",
    illustrativeItems: [
      "Everything in Minimal Plus, plus:",
      "Cold-Pressed Extra Virgin Essentials",
      "Specialty Microgreens & Sprouts",
      "Artisanal Nut & Seed Butters",
      "Chia & Hemp Superseed Blend",
      "Diverse Seasonal Exotic Produce"
    ],
    nutritionalFocus: ["Peak Athletic Recovery", "Micronutrient Diversity", "Omega-3 Density"],
    customizationNote: "Illustrative concept bundle highlighting future modular curation and artisanal nutrient sources."
  }
];

interface CalinPacksProps {
  onInquire: () => void;
}

export default function CalinPacks({ onInquire }: CalinPacksProps) {
  const [selectedPack, setSelectedPack] = useState<PackDetail | null>(null);

  return (
    <section id="calin-packs" className="section section-cream" aria-labelledby="calin-packs-heading">
      <div className="container">
        {/* Prominent Header */}
        <div className="section-header">
          <span className="section-tag">
            <Sparkles size={14} />
            <span>Our Signature Innovation</span>
          </span>
          <h2 id="calin-packs-heading" className="section-title">
            Your Nutrition. Simplified into One Pack.
          </h2>
          <p className="section-subtitle">
            Calin Packs bring together different foods in convenient packages designed around
            customers’ nutritional requirements. No more hunting through aisles — just balanced nourishment in a box.
          </p>
        </div>

        {/* Featured Showcase Box with Generated Curated Packaging Photo */}
        <div className="packs-hero-box">
          <div className="packs-hero-grid">
            <div>
              <span
                style={{
                  display: "inline-block",
                  padding: "0.3rem 0.85rem",
                  borderRadius: "var(--radius-pill)",
                  backgroundColor: "rgba(255, 255, 255, 0.15)",
                  color: "#dcf2e3",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: "1rem",
                }}
              >
                The Calin Pack Experience
              </span>
              <h3 style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)", color: "#ffffff", marginBottom: "1rem" }}>
                Curated Whole Foods, Grouped with Nutritional Purpose.
              </h3>
              <p style={{ color: "rgba(250, 247, 240, 0.9)", fontSize: "1.05rem", lineHeight: 1.65, marginBottom: "1.75rem" }}>
                Each Calin Pack is designed around a transparent dietary intention: pairing whole grains,
                fresh produce, and healthy fats that work together to nourish your body throughout the week.
              </p>
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                <button
                  onClick={() => setSelectedPack(packTiers[1])}
                  className="btn btn-white btn-sm"
                  id="btn-discover-packs"
                >
                  <Eye size={16} />
                  <span>Discover Calin Packs</span>
                </button>
                <button
                  onClick={onInquire}
                  className="btn btn-white-outline btn-sm"
                >
                  <span>Join Early Access</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>

            <div className="packs-hero-img-wrap">
              <div style={{ position: "relative", width: "100%", aspectRatio: "4/3" }}>
                <Image
                  src="/assets/calin-pack.jpg"
                  alt="Nutriverse Calin Pack grocery box filled with fresh greens, grains, lentils and fresh produce"
                  fill
                  sizes="(max-width: 1024px) 100vw, 500px"
                  style={{ objectFit: "cover" }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 3 Illustrative Pack Categories */}
        <div className="packs-grid">
          {packTiers.map((tier) => {
            const isPopular = tier.id === "minimal-plus";
            return (
              <article
                key={tier.id}
                className={`pack-card ${isPopular ? "popular" : ""}`}
              >
                {isPopular && <div className="pack-badge-top">Most Popular Concept</div>}

                <div style={{ marginBottom: "1rem" }}>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: isPopular ? "var(--green-500)" : "var(--muted)",
                    }}
                  >
                    {tier.tag}
                  </span>
                  <h3 className="pack-tier-name">{tier.name}</h3>
                </div>

                <p className="pack-tier-subtitle">{tier.description}</p>

                <div
                  style={{
                    padding: "0.85rem 1rem",
                    backgroundColor: "var(--cream-soft)",
                    borderRadius: "var(--radius-md)",
                    marginBottom: "1.5rem",
                  }}
                >
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--forest-900)", display: "block" }}>
                    Ideal Audience:
                  </span>
                  <p style={{ fontSize: "0.825rem", color: "var(--charcoal-700)", margin: 0 }}>
                    {tier.targetAudience}
                  </p>
                </div>

                <div style={{ marginBottom: "1rem" }}>
                  <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--forest-900)", textTransform: "uppercase" }}>
                    Sample Food Highlights:
                  </span>
                </div>

                <ul className="pack-features-list">
                  {tier.illustrativeItems.slice(0, 4).map((item) => (
                    <li key={item} className="pack-feature-item">
                      <Check className="pack-feature-icon" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => setSelectedPack(tier)}
                  className={`btn ${isPopular ? "btn-secondary" : "btn-outline"}`}
                  style={{ width: "100%", marginTop: "auto" }}
                >
                  <span>Explore {tier.name} Concept</span>
                  <ArrowRight size={15} />
                </button>

                <p className="pack-disclaimer-note">
                  Concept specification · Pricing & quantities subject to pilot rollout
                </p>
              </article>
            );
          })}
        </div>

        {/* Future Capabilities & Accuracy Disclaimer */}
        <div
          style={{
            marginTop: "3.5rem",
            padding: "1.5rem 2rem",
            backgroundColor: "var(--paper)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border-light)",
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: "1.25rem",
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              backgroundColor: "var(--gold-100)",
              color: "#92400e",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <ShieldAlert size={24} />
          </div>
          <div>
            <strong style={{ display: "block", color: "var(--forest-950)", fontSize: "0.95rem" }}>
              Planned Future Capabilities & Accuracy Notice
            </strong>
            <p style={{ fontSize: "0.875rem", color: "var(--charcoal-600)", margin: "0.25rem 0 0" }}>
              The pack categories displayed above represent illustrative concept designs. They do not constitute
              finalized product specifications or commercial commitments. Personalized nutritionist customization
              and scheduled recurring subscription delivery are potential future features under platform roadmap planning.
            </p>
          </div>
        </div>
      </div>

      {/* Modal for In-depth Pack Details */}
      <PackDetailModal
        pack={selectedPack}
        onClose={() => setSelectedPack(null)}
        onInquire={onInquire}
      />
    </section>
  );
}
