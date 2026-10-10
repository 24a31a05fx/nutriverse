"use client";

import {
  BookOpenCheck,
  CheckCircle,
  Search,
  Sparkles,
  Layers,
  HeartPulse,
  ShieldCheck,
} from "lucide-react";

export default function Benefits() {
  const benefits = [
    {
      icon: BookOpenCheck,
      title: "Better Understanding of Food Nutrition",
      description:
        "Demystify food labels and confusing chemical terms with clear, intuitive visuals that reveal what whole foods actually provide to your body.",
    },
    {
      icon: CheckCircle,
      title: "More Informed Food Choices",
      description:
        "Shop with genuine intention rather than supermarket impulse, aligning your grocery basket with your everyday energy and lifestyle needs.",
    },
    {
      icon: Search,
      title: "Convenient Food Discovery",
      description:
        "Quickly discover nutrient-dense ingredients that meet your exact preferences without sifting through rows of hyper-processed options.",
    },
    {
      icon: Sparkles,
      title: "Recipe & Preparation Inspiration",
      description:
        "Turn raw ingredients into delicious, nourishing meals using simple culinary techniques that preserve essential micronutrients.",
    },
    {
      icon: Layers,
      title: "Easier Exploration of Food Bundles",
      description:
        "Eliminate decision fatigue with curated Calin Pack combinations that provide a balanced assortment of foods for your week.",
    },
    {
      icon: HeartPulse,
      title: "A Personalized Approach to Nutrition",
      description:
        "Embrace a flexible food discovery system centered on your individual lifestyle rhythm rather than rigid, unsustainable diet fads.",
    },
  ];

  return (
    <section id="benefits" className="section section-soft" aria-labelledby="benefits-heading">
      <div className="container">
        <div className="section-header">
          <span className="section-tag">
            <span>Everyday Value</span>
          </span>
          <h2 id="benefits-heading" className="section-title">
            Key Benefits for Your Everyday Life
          </h2>
          <p className="section-subtitle">
            Nutriverse simplifies the path from grocery shopping to wholesome nourishment,
            giving you clarity and confidence in every meal.
          </p>
        </div>

        <div className="benefits-grid">
          {benefits.map((b) => {
            const Icon = b.icon;
            return (
              <div key={b.title} className="benefit-card">
                <div className="benefit-icon-wrap">
                  <Icon size={24} />
                </div>
                <h3 className="benefit-title">{b.title}</h3>
                <p className="benefit-text">{b.description}</p>
              </div>
            );
          })}
        </div>

        {/* Responsible Nutrition & Medical Disclaimer */}
        <div
          style={{
            marginTop: "3rem",
            padding: "1.25rem 1.75rem",
            borderRadius: "var(--radius-lg)",
            backgroundColor: "var(--paper)",
            border: "1px solid var(--border-light)",
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            fontSize: "0.85rem",
            color: "var(--charcoal-600)",
          }}
          role="note"
        >
          <ShieldCheck size={20} style={{ color: "var(--green-500)", flexShrink: 0 }} />
          <span>
            <strong>Health & Accuracy Disclaimer:</strong> Nutriverse is designed for educational nutrition discovery and grocery convenience. It does not provide medical diagnoses, prevent clinical diseases, guarantee weight loss, or substitute for consultation with certified healthcare professionals.
          </span>
        </div>
      </div>
    </section>
  );
}
