"use client";

import { useState } from "react";
import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import Problem from "../components/Problem";
import Solution from "../components/Solution";
import HowItWorks from "../components/HowItWorks";
import CalinPacks from "../components/CalinPacks";
import Benefits from "../components/Benefits";
import AppPreview from "../components/AppPreview";
import Mission from "../components/Mission";
import CtaSection from "../components/CtaSection";
import ContactAndFooter from "../components/ContactAndFooter";
import InteractiveCalculatorModal from "../components/InteractiveCalculatorModal";
import { Calculator } from "lucide-react";

export default function Home() {
  const [calcModalOpen, setCalcModalOpen] = useState(false);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div style={{ minHeight: "100vh", position: "relative" }}>
      {/* 1. Navigation Bar */}
      <Navbar onExploreClick={() => scrollTo("calin-packs")} />

      <main id="main-content">
        {/* 2. Hero Section */}
        <Hero
          onExplorePacks={() => scrollTo("calin-packs")}
          onHowItWorks={() => scrollTo("how-it-works")}
        />

        {/* 3. The Problem */}
        <Problem />

        {/* 4. Our Solution */}
        <Solution />

        {/* 5. How It Works */}
        <HowItWorks />

        {/* 6. Calin Packs — Our Unique Offering */}
        <CalinPacks onInquire={() => scrollTo("contact")} />

        {/* 7. Key Benefits */}
        <Benefits />

        {/* 8. App Experience Preview */}
        <AppPreview />

        {/* 9. Our Mission */}
        <Mission onJoinMission={() => scrollTo("contact")} />

        {/* 10. Call to Action */}
        <CtaSection
          onContactClick={() => scrollTo("contact")}
          onExploreClick={() => scrollTo("calin-packs")}
        />

        {/* 11. Contact and Footer */}
        <ContactAndFooter />
      </main>

      {/* Floating Interactive Tool Trigger */}
      <button
        onClick={() => setCalcModalOpen(true)}
        style={{
          position: "fixed",
          bottom: "24px",
          left: "24px",
          zIndex: 90,
          background: "var(--forest-800)",
          color: "#ffffff",
          padding: "10px 18px",
          borderRadius: "var(--radius-pill)",
          boxShadow: "0 8px 24px rgba(17, 26, 20, 0.2)",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "0.85rem",
          fontWeight: 600,
          border: "1px solid rgba(255, 255, 255, 0.2)",
          transition: "transform 0.2s ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
        aria-label="Calculate daily nutrition needs"
      >
        <Calculator size={16} />
        <span>Try Nutrition Estimator</span>
      </button>

      {/* Interactive Estimator Modal */}
      <InteractiveCalculatorModal
        isOpen={calcModalOpen}
        onClose={() => setCalcModalOpen(false)}
        onSelectPack={() => scrollTo("calin-packs")}
      />
    </div>
  );
}
