"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Menu, X, ArrowRight, Sparkles } from "lucide-react";

interface NavbarProps {
  onExploreClick?: () => void;
}

export default function Navbar({ onExploreClick }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { label: "Home", href: "#hero" },
    { label: "The Problem", href: "#problem" },
    { label: "Our Solution", href: "#solution" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "Calin Packs", href: "#calin-packs" },
    { label: "Key Benefits", href: "#benefits" },
    { label: "App Preview", href: "#app-preview" },
    { label: "Our Mission", href: "#mission" },
    { label: "Contact", href: "#contact" },
  ];

  const handleLinkClick = (href: string) => {
    setMobileOpen(false);
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <header className={`navbar-wrap ${scrolled ? "navbar-scrolled" : ""}`}>
      <div className="container">
        <nav className="navbar" aria-label="Main Navigation">
          <a
            href="#hero"
            className="brand-link"
            onClick={(e) => {
              e.preventDefault();
              handleLinkClick("#hero");
            }}
          >
            <div className="brand-logo-img" style={{ position: "relative", width: 40, height: 40, overflow: "hidden" }}>
              <Image
                src="/assets/nutriverse-logo.jpeg"
                alt="Nutriverse Logo"
                fill
                sizes="40px"
                style={{ objectFit: "cover" }}
                priority
              />
            </div>
            <span>Nutriverse</span>
            <span className="brand-badge">Early Concept</span>
          </a>

          {/* Desktop Navigation */}
          <ul className="nav-links">
            {navLinks.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  className="nav-link"
                  onClick={(e) => {
                    e.preventDefault();
                    handleLinkClick(link.href);
                  }}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          {/* Action Button & Mobile Toggle */}
          <div className="nav-actions">
            <button
              onClick={() => {
                if (onExploreClick) onExploreClick();
                else handleLinkClick("#calin-packs");
              }}
              className="btn btn-primary btn-sm"
              aria-label="Explore Nutriverse"
            >
              <span>Explore Nutriverse</span>
              <ArrowRight size={15} />
            </button>

            <button
              className="mobile-toggle"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </nav>
      </div>

      {/* Mobile Drawer */}
      <div
        className={`mobile-drawer-backdrop ${mobileOpen ? "open" : ""}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />
      <div className={`mobile-drawer ${mobileOpen ? "open" : ""}`} role="dialog" aria-modal="true" aria-label="Mobile Navigation">
        <div className="mobile-drawer-header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ position: "relative", width: 34, height: 34, borderRadius: 8, overflow: "hidden" }}>
              <Image
                src="/assets/nutriverse-logo.jpeg"
                alt="Nutriverse Logo"
                fill
                sizes="34px"
                style={{ objectFit: "cover" }}
              />
            </div>
            <strong style={{ fontSize: "1.2rem", color: "var(--forest-900)" }}>Nutriverse</strong>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            style={{ padding: "0.5rem", color: "var(--charcoal-600)" }}
            aria-label="Close menu"
          >
            <X size={22} />
          </button>
        </div>

        <ul className="mobile-nav-links">
          {navLinks.map((link) => (
            <li key={link.label}>
              <a
                href={link.href}
                className="mobile-nav-link"
                onClick={(e) => {
                  e.preventDefault();
                  handleLinkClick(link.href);
                }}
              >
                <span>{link.label}</span>
                <ArrowRight size={16} style={{ color: "var(--muted)" }} />
              </a>
            </li>
          ))}
        </ul>

        <div style={{ marginTop: "auto", paddingTop: "1.5rem" }}>
          <button
            onClick={() => {
              setMobileOpen(false);
              handleLinkClick("#calin-packs");
            }}
            className="btn btn-secondary btn-lg"
            style={{ width: "100%" }}
          >
            <Sparkles size={18} />
            <span>Explore Calin Packs</span>
          </button>
          <p style={{ fontSize: "0.75rem", color: "var(--muted)", textAlign: "center", marginTop: "0.85rem" }}>
            Nutrition-First Grocery Platform · Early Concept
          </p>
        </div>
      </div>
    </header>
  );
}
