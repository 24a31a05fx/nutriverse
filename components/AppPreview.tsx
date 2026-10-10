"use client";

import { useState } from "react";
import {
  Smartphone,
  ScanLine,
  UtensilsCrossed,
  Bot,
  Package,
  Info,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Flame,
  Zap,
} from "lucide-react";

type AppScreen = "nutrition" | "scanner" | "recipes" | "assistant" | "packs";

export default function AppPreview() {
  const [activeScreen, setActiveScreen] = useState<AppScreen>("nutrition");
  const [scannedItem, setScannedItem] = useState<boolean>(false);
  const [assistantPrompt, setAssistantPrompt] = useState<string>(
    "What are good iron-rich whole foods for college students?"
  );
  const [assistantAnswer, setAssistantAnswer] = useState<string>(
    "Great whole-food iron sources include sprouted chickpeas, spinach cooked with lemon (vitamin C aids absorption), pumpkin seeds, and lentils. A cup of boiled lentils provides ~6.6mg of plant-based iron!"
  );

  const samplePrompts = [
    {
      q: "What are good iron-rich whole foods for college students?",
      a: "Great whole-food iron sources include sprouted chickpeas, spinach cooked with lemon (vitamin C aids absorption), pumpkin seeds, and lentils. A cup of boiled lentils provides ~6.6mg of plant-based iron!",
    },
    {
      q: "Suggest quick high-protein snacks for gym sessions.",
      a: "Look for Greek yoghurt paired with chia seeds, roasted edamame, or peanut butter on whole grain toast. These deliver 15-20g of clean protein with low glycemic impact.",
    },
    {
      q: "How does the Calin Pack Minimal Plus balance my week?",
      a: "The Minimal Plus bundle pairs complex carbohydrates (quinoa, sweet potato) with lean legumes and greens, providing balanced daily fiber (25g+) and sustained energy without heavy meal-prep overhead.",
    },
  ];

  const handlePromptClick = (q: string, a: string) => {
    setAssistantPrompt(q);
    setAssistantAnswer(a);
  };

  return (
    <section id="app-preview" className="section section-cream" aria-labelledby="app-preview-heading">
      <div className="container">
        <div className="section-header">
          <span className="section-tag gold">
            <Smartphone size={14} />
            <span>Interactive Concept Preview</span>
          </span>
          <h2 id="app-preview-heading" className="section-title">
            App Experience Preview
          </h2>
          <p className="section-subtitle">
            Explore our conceptual mobile companion designed to guide your food decisions,
            unpack grocery ingredients, and customize your Calin Packs.
          </p>
        </div>

        <div className="app-preview-container">
          {/* Left Column: Phone Chassis Mockup */}
          <div className="phone-mockup" role="region" aria-label="Nutriverse mobile app mockup">
            <div className="phone-screen">
              {/* Dynamic Island */}
              <div className="phone-island" />

              {/* Status Bar / Header */}
              <div className="phone-header">
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--forest-900)" }}>
                  9:41
                </span>
                <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--forest-800)" }}>
                  Nutriverse Companion
                </span>
                <span style={{ fontSize: "0.7rem", color: "var(--green-500)", fontWeight: 700 }}>
                  Demo
                </span>
              </div>

              {/* Phone Body based on Active Screen */}
              <div className="phone-body">
                {activeScreen === "nutrition" && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                      <span style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
                        Catalog Item
                      </span>
                      <span className="brand-badge" style={{ fontSize: "0.65rem" }}>Score: 94</span>
                    </div>

                    <div style={{ background: "#ffffff", padding: "12px", borderRadius: "14px", border: "1px solid var(--border-light)", marginBottom: "12px" }}>
                      <div style={{ fontSize: "2rem", textAlign: "center", marginBottom: "4px" }}>🥗</div>
                      <h4 style={{ fontSize: "1rem", color: "var(--forest-950)", textAlign: "center" }}>Chickpea Power Bowl</h4>
                      <p style={{ fontSize: "0.75rem", color: "var(--muted)", textAlign: "center", margin: "2px 0 10px" }}>
                        Plant Protein & Bioavailable Iron
                      </p>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "8px" }}>
                        <div style={{ background: "var(--cream-bg)", padding: "8px", borderRadius: "8px", textAlign: "center" }}>
                          <span style={{ fontSize: "0.65rem", color: "var(--muted)" }}>Energy</span>
                          <strong style={{ display: "block", fontSize: "0.95rem", color: "var(--forest-900)" }}>385 kcal</strong>
                        </div>
                        <div style={{ background: "var(--green-50)", padding: "8px", borderRadius: "8px", textAlign: "center" }}>
                          <span style={{ fontSize: "0.65rem", color: "var(--green-600)" }}>Protein</span>
                          <strong style={{ display: "block", fontSize: "0.95rem", color: "var(--green-600)" }}>18.4 g</strong>
                        </div>
                      </div>
                    </div>

                    <div style={{ background: "#ffffff", padding: "12px", borderRadius: "14px", border: "1px solid var(--border-light)" }}>
                      <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--forest-900)", marginBottom: "8px" }}>
                        Key Micronutrient Coverage
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem" }}>
                            <span>Iron</span>
                            <strong>4.2 mg (47%)</strong>
                          </div>
                          <div style={{ height: "4px", background: "var(--cream-soft)", borderRadius: "2px", overflow: "hidden", marginTop: "2px" }}>
                            <div style={{ width: "47%", height: "100%", background: "var(--forest-800)" }} />
                          </div>
                        </div>
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem" }}>
                            <span>Dietary Fiber</span>
                            <strong>11.5 g (46%)</strong>
                          </div>
                          <div style={{ height: "4px", background: "var(--cream-soft)", borderRadius: "2px", overflow: "hidden", marginTop: "2px" }}>
                            <div style={{ width: "46%", height: "100%", background: "var(--green-500)" }} />
                          </div>
                        </div>
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem" }}>
                            <span>Folate</span>
                            <strong>182 mcg (45%)</strong>
                          </div>
                          <div style={{ height: "4px", background: "var(--cream-soft)", borderRadius: "2px", overflow: "hidden", marginTop: "2px" }}>
                            <div style={{ width: "45%", height: "100%", background: "var(--gold-500)" }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeScreen === "scanner" && (
                  <div>
                    <div style={{ textAlign: "center", marginBottom: "10px" }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--forest-900)" }}>
                        Barcode & QR Scanner [Concept]
                      </span>
                    </div>

                    {/* Viewfinder simulation */}
                    <div
                      style={{
                        position: "relative",
                        background: "#0a1910",
                        borderRadius: "16px",
                        height: "170px",
                        overflow: "hidden",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "2px solid rgba(46, 139, 87, 0.4)",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          left: "15%",
                          right: "15%",
                          height: "2px",
                          background: "#2e8b57",
                          boxShadow: "0 0 10px #2e8b57",
                          animation: "laserScan 2.5s infinite ease-in-out",
                        }}
                      />
                      <ScanLine size={44} style={{ color: "rgba(255, 255, 255, 0.6)" }} />
                      <div
                        style={{
                          position: "absolute",
                          bottom: "8px",
                          fontSize: "0.65rem",
                          color: "rgba(255, 255, 255, 0.75)",
                        }}
                      >
                        Align barcode inside frame
                      </div>
                    </div>

                    <button
                      onClick={() => setScannedItem(!scannedItem)}
                      style={{
                        width: "100%",
                        marginTop: "10px",
                        padding: "8px",
                        background: "var(--forest-800)",
                        color: "#fff",
                        borderRadius: "8px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                      }}
                    >
                      {scannedItem ? "Reset Scanner" : "Simulate Code Scan"}
                    </button>

                    {scannedItem && (
                      <div
                        style={{
                          marginTop: "10px",
                          padding: "10px",
                          background: "#fff",
                          borderRadius: "12px",
                          border: "1px solid var(--green-400)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <CheckCircle2 size={16} style={{ color: "var(--green-500)" }} />
                          <strong style={{ fontSize: "0.8rem", color: "var(--forest-900)" }}>
                            Organic Sprouted Lentils
                          </strong>
                        </div>
                        <p style={{ fontSize: "0.7rem", color: "var(--muted)", margin: "4px 0 0" }}>
                          ✓ Zero added sodium · 100% whole grain verified · High zinc
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {activeScreen === "recipes" && (
                  <div>
                    <span style={{ fontSize: "0.7rem", color: "var(--muted)", fontWeight: 700, textTransform: "uppercase" }}>
                      Curated Preparation
                    </span>
                    <h4 style={{ fontSize: "0.95rem", color: "var(--forest-950)", margin: "4px 0 8px" }}>
                      Golden Turmeric & Lentil Bowl
                    </h4>

                    <div style={{ background: "#fff", padding: "10px", borderRadius: "12px", border: "1px solid var(--border-light)", marginBottom: "8px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "var(--muted)", marginBottom: "6px" }}>
                        <span>⏱ 20 mins</span>
                        <span>🔥 420 kcal</span>
                        <span>🌱 22g Protein</span>
                      </div>
                      <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--forest-900)", marginBottom: "4px" }}>
                        Key Ingredients:
                      </div>
                      <p style={{ fontSize: "0.7rem", color: "var(--charcoal-600)", lineHeight: 1.4 }}>
                        Sprouted brown lentils, fresh spinach, cold-pressed olive oil, cracked black pepper (enhances turmeric absorption).
                      </p>
                    </div>

                    <div style={{ background: "var(--green-50)", padding: "8px 10px", borderRadius: "10px", fontSize: "0.7rem", color: "var(--forest-900)" }}>
                      💡 <strong>Nutrient Preservation Tip:</strong> Add baby spinach at the very end of cooking to preserve heat-sensitive Vitamin C and Folate.
                    </div>
                  </div>
                )}

                {activeScreen === "assistant" && (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                      <Sparkles size={14} style={{ color: "var(--green-500)" }} />
                      <strong style={{ fontSize: "0.8rem", color: "var(--forest-900)" }}>
                        Nourish AI [Concept Assistant]
                      </strong>
                    </div>

                    <div
                      style={{
                        background: "#fff",
                        padding: "10px",
                        borderRadius: "12px",
                        border: "1px solid var(--border-light)",
                        marginBottom: "8px",
                      }}
                    >
                      <span style={{ fontSize: "0.65rem", color: "var(--muted)", fontWeight: 700 }}>User Query:</span>
                      <p style={{ fontSize: "0.75rem", color: "var(--forest-900)", margin: "2px 0 6px", fontWeight: 600 }}>
                        “{assistantPrompt}”
                      </p>
                      <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "6px" }}>
                        <span style={{ fontSize: "0.65rem", color: "var(--green-600)", fontWeight: 700 }}>Nourish AI:</span>
                        <p style={{ fontSize: "0.72rem", color: "var(--charcoal-700)", lineHeight: 1.45, marginTop: "2px" }}>
                          {assistantAnswer}
                        </p>
                      </div>
                    </div>

                    <div style={{ fontSize: "0.65rem", color: "var(--muted)", marginBottom: "4px" }}>
                      Click sample question to test:
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      {samplePrompts.map((p, idx) => (
                        <button
                          key={idx}
                          onClick={() => handlePromptClick(p.q, p.a)}
                          style={{
                            textAlign: "left",
                            padding: "5px 8px",
                            background: "var(--cream-bg)",
                            borderRadius: "6px",
                            fontSize: "0.68rem",
                            color: "var(--charcoal-800)",
                            border: "1px solid var(--border-subtle)",
                          }}
                        >
                          → {p.q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {activeScreen === "packs" && (
                  <div>
                    <span style={{ fontSize: "0.7rem", color: "var(--muted)", fontWeight: 700, textTransform: "uppercase" }}>
                      Weekly Bundle Explorer
                    </span>
                    <h4 style={{ fontSize: "0.95rem", color: "var(--forest-950)", margin: "4px 0 8px" }}>
                      Minimal Plus Pack
                    </h4>

                    <div style={{ background: "#fff", padding: "10px", borderRadius: "12px", border: "1px solid var(--border-light)", marginBottom: "8px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                        <span style={{ fontSize: "0.75rem", fontWeight: 700 }}>10 Whole Foods</span>
                        <span className="brand-badge" style={{ fontSize: "0.65rem" }}>Curated</span>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                        {["Organic Quinoa", "Greek Yoghurt", "Tender Kale", "Sweet Potatoes", "Chia Seeds", "Raw Walnuts"].map((f) => (
                          <span
                            key={f}
                            style={{
                              fontSize: "0.65rem",
                              padding: "2px 6px",
                              background: "var(--cream-soft)",
                              borderRadius: "4px",
                              color: "var(--charcoal-700)",
                            }}
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div style={{ background: "var(--green-50)", padding: "8px", borderRadius: "8px", textAlign: "center" }}>
                      <span style={{ fontSize: "0.7rem", color: "var(--forest-900)", fontWeight: 600 }}>
                        Target: Sustained Energy & Plant Protein
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Tab Bar */}
              <div className="phone-nav-tabbar">
                <button
                  className={`phone-tab-btn ${activeScreen === "nutrition" ? "active" : ""}`}
                  onClick={() => setActiveScreen("nutrition")}
                >
                  <Flame size={16} />
                  <span>Nutrition</span>
                </button>
                <button
                  className={`phone-tab-btn ${activeScreen === "scanner" ? "active" : ""}`}
                  onClick={() => setActiveScreen("scanner")}
                >
                  <ScanLine size={16} />
                  <span>Scanner</span>
                </button>
                <button
                  className={`phone-tab-btn ${activeScreen === "recipes" ? "active" : ""}`}
                  onClick={() => setActiveScreen("recipes")}
                >
                  <UtensilsCrossed size={16} />
                  <span>Recipes</span>
                </button>
                <button
                  className={`phone-tab-btn ${activeScreen === "assistant" ? "active" : ""}`}
                  onClick={() => setActiveScreen("assistant")}
                >
                  <Bot size={16} />
                  <span>AI</span>
                </button>
                <button
                  className={`phone-tab-btn ${activeScreen === "packs" ? "active" : ""}`}
                  onClick={() => setActiveScreen("packs")}
                >
                  <Package size={16} />
                  <span>Packs</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Screen Switcher Selector & Explanations */}
          <div>
            <div className="section-header-left">
              <span className="section-tag">
                <span>Interactive Exploration</span>
              </span>
              <h3 style={{ fontSize: "clamp(1.75rem, 2.5vw, 2.35rem)", marginBottom: "1rem" }}>
                Switch Screens to Preview the Flow
              </h3>
              <p style={{ color: "var(--charcoal-600)", fontSize: "1.05rem" }}>
                Select any tab below to load the corresponding prototype view in the simulated mobile device.
              </p>
            </div>

            <div className="screen-tabs-list">
              {[
                {
                  id: "nutrition" as AppScreen,
                  icon: Flame,
                  title: "Food Nutrition Information",
                  subtitle: "Visual breakdown of calories, bioavailable protein, iron, and fiber without confusing jargon.",
                },
                {
                  id: "scanner" as AppScreen,
                  icon: ScanLine,
                  title: "Barcode / QR Scanning [Concept]",
                  subtitle: "Simulate scanning a packaged grocery item to reveal clean ingredients and nutrition verification.",
                },
                {
                  id: "recipes" as AppScreen,
                  icon: UtensilsCrossed,
                  title: "Recipe & Cooking Discovery",
                  subtitle: "Actionable culinary tips designed to preserve nutrients while keeping weeknight prep fast.",
                },
                {
                  id: "assistant" as AppScreen,
                  icon: Bot,
                  title: "AI Food Assistant (Nourish AI) [Concept]",
                  subtitle: "Interactive prototype demonstrating tailored grocery recommendations grounded in whole foods.",
                },
                {
                  id: "packs" as AppScreen,
                  icon: Package,
                  title: "Calin Pack Exploration",
                  subtitle: "Explore weekly food combinations and pre-curated grocery bundles grouped by dietary targets.",
                },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeScreen === tab.id;
                return (
                  <button
                    key={tab.id}
                    className={`screen-tab-card ${isActive ? "active" : ""}`}
                    onClick={() => setActiveScreen(tab.id)}
                    aria-label={`View ${tab.title} mockup`}
                  >
                    <div className="screen-tab-icon">
                      <Icon size={22} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <strong style={{ fontSize: "1.05rem", color: isActive ? "var(--forest-900)" : "inherit" }}>
                          {tab.title}
                        </strong>
                        <ArrowRight size={16} style={{ color: isActive ? "var(--green-500)" : "var(--muted)" }} />
                      </div>
                      <p style={{ fontSize: "0.875rem", color: "var(--charcoal-600)", margin: "0.25rem 0 0" }}>
                        {tab.subtitle}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Prototype notice */}
            <div
              style={{
                marginTop: "1.75rem",
                padding: "0.85rem 1.15rem",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--cream-soft)",
                border: "1px dashed var(--border-light)",
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                fontSize: "0.825rem",
                color: "var(--charcoal-600)",
              }}
            >
              <Info size={16} style={{ flexShrink: 0, color: "var(--muted)" }} />
              <span>
                <strong>Sample Data Notice:</strong> The mobile screens above display simulated demonstration data. Functional iOS and Android native apps are part of our upcoming startup rollout.
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
