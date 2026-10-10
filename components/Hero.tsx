"use client";

import Image from "next/image";
import { ArrowRight, Sparkles, Compass, CheckCircle2, ShieldCheck, Zap } from "lucide-react";

interface HeroProps {
  onExplorePacks: () => void;
  onHowItWorks: () => void;
}

export default function Hero({ onExplorePacks, onHowItWorks }: HeroProps) {
  return (
    <section id="hero" className="hero-section section-cream" aria-label="Hero Section">
      <div className="container">
        <div className="hero-grid">
          {/* Left Column: Copy & CTAs */}
          <div>
            <div className="hero-badge-row">
              <span className="section-tag">
                <Sparkles size={14} />
                <span>Nutrition-First Grocery Platform</span>
              </span>
              <span className="section-tag gold">
                <span>Startup Concept</span>
              </span>
            </div>

            <h1 className="hero-title">
              Don’t Just Eat. <span>Understand</span> Your Nutrition.
            </h1>

            <p className="hero-subtitle">
              Discover smarter food choices with nutrition-focused groceries, personalized food
              suggestions, and convenient Calin Packs designed around your nutritional needs.
            </p>

            <div className="hero-cta-group">
              <button
                onClick={onExplorePacks}
                className="btn btn-primary btn-lg"
                id="hero-cta-packs"
              >
                <span>Explore Calin Packs</span>
                <ArrowRight size={18} />
              </button>

              <button
                onClick={onHowItWorks}
                className="btn btn-outline btn-lg"
                id="hero-cta-how"
              >
                <Compass size={18} />
                <span>Discover How It Works</span>
              </button>
            </div>

            {/* Credibility / Value Pillars */}
            <div className="hero-trust-indicators">
              <div className="trust-item">
                <CheckCircle2 className="trust-icon" />
                <span>Organized by Nutrients, Not Aisles</span>
              </div>
              <div className="trust-item">
                <Zap className="trust-icon" />
                <span>Convenient Calin Packs</span>
              </div>
              <div className="trust-item">
                <ShieldCheck className="trust-icon" />
                <span>Zero Jargon or Hidden Fillers</span>
              </div>
            </div>
          </div>

          {/* Right Column: Visual with interactive badge overlays */}
          <div className="hero-visual-wrapper">
            <div className="hero-main-card">
              <div style={{ position: "relative", width: "100%", aspectRatio: "16/10" }}>
                <Image
                  src="/assets/hero-food.jpg"
                  alt="Fresh wholesome nutrient-rich ingredients: quinoa, kale, avocados, chickpeas, berries"
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 550px"
                  style={{ objectFit: "cover" }}
                />
              </div>
            </div>

            {/* Floating Metric 1 */}
            <div className="floating-badge floating-badge-top" role="complementary" aria-label="Sample food profile">
              <div className="badge-icon-wrap">
                <Sparkles size={20} />
              </div>
              <div>
                <div className="badge-label">Macro Density Score</div>
                <div className="badge-value">94 / 100 · High Iron & Folate</div>
              </div>
            </div>

            {/* Floating Metric 2 */}
            <div className="floating-badge floating-badge-bottom" role="complementary" aria-label="Calin pack highlight">
              <div className="badge-icon-wrap amber">
                <Zap size={20} />
              </div>
              <div>
                <div className="badge-label">Curated Offering</div>
                <div className="badge-value">Calin Pack Bundles Ready</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
