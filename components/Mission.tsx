"use client";

import Image from "next/image";
import { Heart, Users, Target, Sparkles, ArrowRight } from "lucide-react";

interface MissionProps {
  onJoinMission: () => void;
}

export default function Mission({ onJoinMission }: MissionProps) {
  return (
    <section id="mission" className="section section-soft" aria-labelledby="mission-heading">
      <div className="container">
        <div className="mission-container">
          {/* Left Column: Mission Quote Box & Narrative */}
          <div>
            <span className="section-tag">
              <Heart size={14} />
              <span>Our Guiding Purpose</span>
            </span>

            <h2 id="mission-heading" className="section-title">
              Making Better Food Choices Easier for Everyone.
            </h2>

            <div className="mission-quote-box">
              <div className="mission-quote-content">
                <blockquote className="mission-quote-text">
                  “Our goal is to help people move from simply asking ‘What should I buy?’ to asking
                  ‘What does my body need, and how can I get it?’”
                </blockquote>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: "50%",
                      backgroundColor: "var(--forest-800)",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: "0.9rem",
                    }}
                  >
                    NV
                  </div>
                  <div>
                    <strong style={{ display: "block", color: "var(--forest-950)", fontSize: "0.95rem" }}>
                      Nutriverse Founding Vision
                    </strong>
                    <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                      Nutrition-First Grocery Innovation
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <p style={{ marginTop: "1.75rem", fontSize: "1.05rem", lineHeight: 1.65, color: "var(--charcoal-600)" }}>
              Modern grocery stores were designed for shelf-stability and supply-chain convenience, not
              individual biological vitality. Nutriverse was born out of a desire to bridge the gap between
              agricultural nutrition, food literacy, and everyday consumer convenience.
            </p>

            <div
              style={{
                marginTop: "1.5rem",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: "0.65rem" }}>
                <Target size={18} style={{ color: "var(--green-500)", flexShrink: 0, marginTop: 3 }} />
                <div>
                  <strong style={{ fontSize: "0.9rem", color: "var(--forest-900)" }}>Food Transparency</strong>
                  <p style={{ fontSize: "0.8rem", color: "var(--charcoal-600)", margin: 0 }}>
                    Clear data without hidden additives or misleading marketing.
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: "0.65rem" }}>
                <Users size={18} style={{ color: "var(--green-500)", flexShrink: 0, marginTop: 3 }} />
                <div>
                  <strong style={{ fontSize: "0.9rem", color: "var(--forest-900)" }}>Accessible to All</strong>
                  <p style={{ fontSize: "0.8rem", color: "var(--charcoal-600)", margin: 0 }}>
                    Built for students, working professionals, and growing families.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Warm, Inspiring Kitchen Lifestyle Visual */}
          <div>
            <div className="mission-image-card">
              <div style={{ position: "relative", width: "100%", aspectRatio: "16/10" }}>
                <Image
                  src="/assets/mission-lifestyle.jpg"
                  alt="Mindful meal preparation with fresh colorful vegetables, grains, and wholesome farm produce"
                  fill
                  sizes="(max-width: 1024px) 100vw, 550px"
                  style={{ objectFit: "cover" }}
                />
              </div>
            </div>

            <div
              style={{
                marginTop: "1.25rem",
                padding: "1.25rem",
                backgroundColor: "var(--paper)",
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--border-light)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "1rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <Sparkles size={20} style={{ color: "var(--gold-500)" }} />
                <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--forest-900)" }}>
                  Believe in our mission? Help shape our early roadmap.
                </span>
              </div>
              <button onClick={onJoinMission} className="btn btn-outline btn-sm" style={{ flexShrink: 0 }}>
                <span>Connect With Us</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
