"use client";

import { Sparkles, BarChart2, ScanLine, UtensilsCrossed, Bot, Check, Info } from "lucide-react";

export default function Solution() {
  const solutions = [
    {
      icon: BarChart2,
      title: "Explore Food Based on Nutritional Value",
      status: "Core Architecture",
      statusType: "ready",
      description:
        "Flip traditional grocery shopping on its head. Filter foods by bioavailable protein density, iron content, dietary fiber, vitamins, or low glycemic impact rather than arbitrary supermarket aisles.",
      chips: ["Macro filters", "Target nutrients", "Whole-food database"],
    },
    {
      icon: Sparkles,
      title: "Understand Calories & Nutrient Info Visually",
      status: "Core Architecture",
      statusType: "ready",
      description:
        "No more cryptic percentages or fine print. Nutriverse translates complex scientific nutrition facts into clean, color-coded visual charts that show exactly how each food contributes to your daily goals.",
      chips: ["Visual macro splits", "Zero jargon", "Transparent data"],
    },
    {
      icon: ScanLine,
      title: "Scan Product Barcodes or QR Codes",
      status: "Proposed Platform Capability",
      statusType: "concept",
      description:
        "Scan packaged food items in physical stores using your mobile camera or code reader. Instantly retrieve the food's genuine nutritional breakdown, additive warnings, and cleaner alternatives.",
      chips: ["Camera scanner", "Additive alerts", "Instant lookup"],
    },
    {
      icon: UtensilsCrossed,
      title: "Discover Recipes & Preparation Methods",
      status: "Platform Feature",
      statusType: "ready",
      description:
        "Good food requires mindful preparation. Access step-by-step cooking techniques, storage tips, and flavor pairings engineered to preserve heat-sensitive nutrients and make whole foods delicious.",
      chips: ["Nutrient-retaining prep", "Quick bowls", "Storage guides"],
    },
    {
      icon: Bot,
      title: "Receive AI-Powered Food Suggestions",
      status: "Proposed Platform Capability",
      statusType: "concept",
      description:
        "Our intelligent nutrition engine (Nourish AI) interprets your lifestyle, workout rhythm, and dietary restrictions to recommend weekly grocery items and balanced Calin Packs that suit your routine.",
      chips: ["Smart recommendations", "Habit adaptation", "Catalog grounded"],
    },
  ];

  return (
    <section id="solution" className="section section-cream" aria-labelledby="solution-heading">
      <div className="container">
        <div className="section-header">
          <span className="section-tag">
            <Sparkles size={14} />
            <span>The Nutriverse Paradigm</span>
          </span>
          <h2 id="solution-heading" className="section-title">
            Meet Nutriverse — A Smarter Way to Choose Food.
          </h2>
          <p className="section-subtitle">
            We reorganize food around human biology instead of retail shelves, giving you the
            transparency and tools to make informed grocery choices with confidence.
          </p>
        </div>

        <div className="solution-grid">
          {solutions.map((sol, index) => {
            const Icon = sol.icon;
            const isFeatured = index === 0;
            return (
              <div
                key={sol.title}
                className={`solution-card ${isFeatured ? "featured" : ""}`}
              >
                <span
                  className={`solution-tag-pill ${
                    sol.statusType === "concept" ? "concept" : ""
                  }`}
                >
                  {sol.status}
                </span>

                <div className="solution-icon-wrap">
                  <Icon size={26} />
                </div>

                <h3 className="solution-title">{sol.title}</h3>
                <p className="solution-text">{sol.description}</p>

                <div className="solution-badge-list">
                  {sol.chips.map((chip) => (
                    <span key={chip} className="solution-chip">
                      <Check size={12} style={{ display: "inline", marginRight: 4, color: "var(--green-500)" }} />
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Prototype Transparency Notice */}
        <div
          style={{
            marginTop: "3rem",
            padding: "1rem 1.5rem",
            borderRadius: "var(--radius-md)",
            backgroundColor: "var(--gold-50)",
            border: "1px solid rgba(217, 119, 6, 0.2)",
            display: "flex",
            alignItems: "center",
            gap: "0.85rem",
            fontSize: "0.85rem",
            color: "#92400e",
          }}
          role="note"
        >
          <Info size={18} style={{ flexShrink: 0 }} />
          <span>
            <strong>Transparency Notice:</strong> Features labeled as <em>Proposed Platform Capability</em> (such as camera barcode scanning and the interactive AI assistant) represent planned platform features currently under prototype design and testing.
          </span>
        </div>
      </div>
    </section>
  );
}
