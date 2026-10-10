"use client";

import { Compass, Scan, BookOpen, PackageCheck, ArrowRight } from "lucide-react";

export default function HowItWorks() {
  const steps = [
    {
      step: "STEP 01",
      icon: Compass,
      title: "Explore Nutrition Options",
      description:
        "Start by setting your lifestyle preferences, daily energy needs, or target nutrients like dietary fiber, plant protein, or iron.",
    },
    {
      step: "STEP 02",
      icon: Scan,
      title: "Scan Barcode or QR Code",
      description:
        "When supported, point your camera at any packaged item to inspect its ingredients, nutritional profile, and clean alternatives.",
    },
    {
      step: "STEP 03",
      icon: BookOpen,
      title: "Discover Prep & Recipes",
      description:
        "Learn how to cook and combine ingredients with chef-curated methods designed to lock in vital micronutrients without losing flavor.",
    },
    {
      step: "STEP 04",
      icon: PackageCheck,
      title: "Choose Calin Packs",
      description:
        "Order balanced, pre-portioned Calin Packs or standalone groceries curated specifically to fuel your weekly nutritional targets.",
    },
  ];

  return (
    <section id="how-it-works" className="section section-soft" aria-labelledby="how-it-works-heading">
      <div className="container">
        <div className="section-header">
          <span className="section-tag">
            <span>Simple 4-Step Journey</span>
          </span>
          <h2 id="how-it-works-heading" className="section-title">
            How Nutriverse Works
          </h2>
          <p className="section-subtitle">
            From discovering what your body needs to having wholesome food ready in your kitchen,
            we make everyday nutrition straightforward and intuitive.
          </p>
        </div>

        <div className="timeline-grid">
          {steps.map((item, index) => {
            const Icon = item.icon;
            return (
              <div key={item.step} className="timeline-card">
                <div className="timeline-step-badge">{item.step}</div>
                <div className="timeline-icon-wrap">
                  <Icon size={24} />
                </div>
                <h3 className="timeline-title">{item.title}</h3>
                <p className="timeline-text">{item.description}</p>
                {index < steps.length - 1 && (
                  <div
                    style={{
                      marginTop: "auto",
                      paddingTop: "1.25rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      color: "var(--muted)",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                    }}
                  >
                    <span>Next step</span>
                    <ArrowRight size={14} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
