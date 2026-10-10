"use client";

import Image from "next/image";
import {
  ShoppingBag,
  User,
  Sparkles,
  ScanLine,
  Compass,
  Package,
  UtensilsCrossed,
  Layers,
  Menu,
  X,
  Shield,
  Stethoscope,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { User as UserModel } from "../lib/api";

export type ActiveTab =
  | "storefront"
  | "explorer"
  | "packs"
  | "recipes"
  | "combinations"
  | "scanner"
  | "assistant"
  | "dashboard"
  | "admin";

interface AppHeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  currentUser: UserModel | null;
  cartCount: number;
  onOpenCart: () => void;
  onOpenAuth: () => void;
  onOpenOnboarding: () => void;
  onOpenAssistant: () => void;
  onLogout: () => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export default function AppHeader({
  activeTab,
  onTabChange,
  currentUser,
  cartCount,
  onOpenCart,
  onOpenAuth,
  onOpenOnboarding,
  onOpenAssistant,
  onLogout,
  mobileOpen,
  setMobileOpen,
}: AppHeaderProps) {
  const navTabs: Array<{ id: ActiveTab; label: string; icon: any }> = [
    { id: "storefront", label: "Storefront", icon: Compass },
    { id: "explorer", label: "Food Explorer", icon: Sparkles },
    { id: "packs", label: "Calin Packs", icon: Package },
    { id: "recipes", label: "Recipes & Prep", icon: UtensilsCrossed },
    { id: "combinations", label: "Combinations", icon: Layers },
    { id: "scanner", label: "Scanner", icon: ScanLine },
  ];

  return (
    <header className="navbar-wrap navbar-scrolled" style={{ position: "sticky", top: 0, zIndex: 120 }}>
      <div className="container">
        <nav className="navbar" aria-label="Main Store Navigation">
          {/* Logo */}
          <button
            onClick={() => onTabChange("storefront")}
            className="brand-link"
            style={{ display: "flex", alignItems: "center", gap: "0.75rem", background: "none", border: "none", cursor: "pointer" }}
          >
            <div style={{ position: "relative", width: 38, height: 38, borderRadius: 10, overflow: "hidden" }}>
              <Image
                src="/assets/nutriverse-logo.jpeg"
                alt="Nutriverse Logo"
                fill
                sizes="38px"
                style={{ objectFit: "cover" }}
                priority
              />
            </div>
            <div style={{ textAlign: "left" }}>
              <span style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--forest-950)", letterSpacing: "-0.02em" }}>
                Nutriverse
              </span>
              <span style={{ display: "block", fontSize: "0.68rem", color: "var(--green-600)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Nutrition-First Grocery
              </span>
            </div>
          </button>

          {/* Center Tabs Navigation */}
          <div className="nav-links" style={{ display: "flex", gap: "0.5rem" }}>
            {navTabs.map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => onTabChange(t.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.45rem",
                    padding: "0.55rem 0.95rem",
                    borderRadius: "var(--radius-pill)",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    background: isActive ? "var(--forest-800)" : "transparent",
                    color: isActive ? "#ffffff" : "var(--charcoal-700)",
                    transition: "all 0.15s ease",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <Icon size={16} />
                  <span>{t.label}</span>
                </button>
              );
            })}

            {/* Admin or Nutritionist portal quick tab */}
            {(currentUser?.role === "admin" || currentUser?.role === "nutritionist") && (
              <button
                onClick={() => onTabChange("admin")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.45rem",
                  padding: "0.55rem 0.95rem",
                  borderRadius: "var(--radius-pill)",
                  fontSize: "0.875rem",
                  fontWeight: 700,
                  background: activeTab === "admin" ? "var(--gold-500)" : "var(--gold-100)",
                  color: activeTab === "admin" ? "#ffffff" : "#92400e",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {currentUser.role === "admin" ? <Shield size={16} /> : <Stethoscope size={16} />}
                <span>{currentUser.role === "admin" ? "Admin Portal" : "Nutritionist Queue"}</span>
              </button>
            )}
          </div>

          {/* Right Action Icons: Nourish AI, Cart, User / Account */}
          <div className="nav-actions" style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {/* Ask AI button */}
            <button
              onClick={onOpenAssistant}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.45rem",
                padding: "0.5rem 0.9rem",
                borderRadius: "var(--radius-pill)",
                backgroundColor: "var(--green-50)",
                border: "1px solid var(--green-200)",
                color: "var(--forest-800)",
                fontSize: "0.85rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
              title="Open Nourish AI Assistant"
            >
              <Sparkles size={15} style={{ color: "var(--green-600)" }} />
              <span className="hide-on-mobile">Ask AI</span>
            </button>

            {/* Cart Button */}
            <button
              onClick={onOpenCart}
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: "0.45rem",
                padding: "0.55rem 1rem",
                borderRadius: "var(--radius-pill)",
                backgroundColor: "var(--forest-850)",
                color: "#ffffff",
                border: "none",
                fontWeight: 600,
                fontSize: "0.875rem",
                cursor: "pointer",
              }}
              aria-label={`Shopping Cart with ${cartCount} items`}
            >
              <ShoppingBag size={17} />
              <span className="hide-on-mobile">Bag</span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: "20px",
                  height: "20px",
                  padding: "0 6px",
                  borderRadius: "10px",
                  backgroundColor: "var(--green-500)",
                  color: "#ffffff",
                  fontSize: "0.75rem",
                  fontWeight: 800,
                }}
              >
                {cartCount}
              </span>
            </button>

            {/* User Profile / Login */}
            {currentUser ? (
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <button
                  onClick={() => onTabChange("dashboard")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.45rem 0.85rem",
                    borderRadius: "var(--radius-pill)",
                    backgroundColor: activeTab === "dashboard" ? "var(--green-100)" : "var(--cream-soft)",
                    color: "var(--forest-900)",
                    border: "1px solid var(--border-light)",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                  title="Open Customer Dashboard"
                >
                  <User size={16} />
                  <span>{currentUser.name.split(" ")[0]}</span>
                  {currentUser.role !== "user" && (
                    <span
                      style={{
                        fontSize: "0.65rem",
                        padding: "1px 6px",
                        borderRadius: "8px",
                        backgroundColor: currentUser.role === "admin" ? "#fef3c7" : "#dcfce7",
                        color: currentUser.role === "admin" ? "#92400e" : "#166534",
                        textTransform: "uppercase",
                      }}
                    >
                      {currentUser.role}
                    </span>
                  )}
                </button>

                <button
                  onClick={onLogout}
                  style={{
                    padding: "0.5rem",
                    borderRadius: "50%",
                    background: "transparent",
                    color: "var(--charcoal-500)",
                    border: "none",
                    cursor: "pointer",
                  }}
                  title="Sign Out"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={onOpenAuth}
                  className="btn btn-outline btn-sm"
                  style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}
                >
                  <span>Sign In</span>
                </button>
                <button
                  onClick={onOpenOnboarding}
                  className="btn btn-primary btn-sm"
                  style={{ padding: "0.5rem 1.1rem", fontSize: "0.85rem" }}
                >
                  <span>Get Started</span>
                </button>
              </div>
            )}

            {/* Mobile Hamburger Menu Toggle */}
            <button
              className="mobile-toggle"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle navigation menu"
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
      <div className={`mobile-drawer ${mobileOpen ? "open" : ""}`} role="dialog" aria-modal="true">
        <div className="mobile-drawer-header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ position: "relative", width: 34, height: 34, borderRadius: 8, overflow: "hidden" }}>
              <Image src="/assets/nutriverse-logo.jpeg" alt="Nutriverse" fill style={{ objectFit: "cover" }} />
            </div>
            <strong style={{ fontSize: "1.1rem", color: "var(--forest-950)" }}>Nutriverse</strong>
          </div>
          <button onClick={() => setMobileOpen(false)} style={{ border: "none", background: "none", cursor: "pointer" }}>
            <X size={22} />
          </button>
        </div>

        <ul className="mobile-nav-links" style={{ listStyle: "none" }}>
          {navTabs.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <li key={t.id}>
                <button
                  onClick={() => {
                    onTabChange(t.id);
                    setMobileOpen(false);
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.75rem 0",
                    border: "none",
                    background: "none",
                    textAlign: "left",
                    fontSize: "1.05rem",
                    fontWeight: isActive ? 800 : 600,
                    color: isActive ? "var(--green-600)" : "var(--charcoal-800)",
                    cursor: "pointer",
                  }}
                >
                  <Icon size={20} />
                  <span>{t.label}</span>
                </button>
              </li>
            );
          })}

          {currentUser && (
            <li>
              <button
                onClick={() => {
                  onTabChange("dashboard");
                  setMobileOpen(false);
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.75rem 0",
                  border: "none",
                  background: "none",
                  textAlign: "left",
                  fontSize: "1.05rem",
                  fontWeight: 700,
                  color: "var(--forest-900)",
                  cursor: "pointer",
                }}
              >
                <User size={20} />
                <span>My Dashboard & Orders</span>
              </button>
            </li>
          )}

          {(currentUser?.role === "admin" || currentUser?.role === "nutritionist") && (
            <li>
              <button
                onClick={() => {
                  onTabChange("admin");
                  setMobileOpen(false);
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.75rem 0",
                  border: "none",
                  background: "none",
                  textAlign: "left",
                  fontSize: "1.05rem",
                  fontWeight: 700,
                  color: "#92400e",
                  cursor: "pointer",
                }}
              >
                <Shield size={20} />
                <span>{currentUser.role === "admin" ? "Admin Operations" : "Nutritionist Review Queue"}</span>
              </button>
            </li>
          )}
        </ul>

        <div style={{ marginTop: "auto", paddingTop: "1.5rem", borderTop: "1px solid var(--border-subtle)" }}>
          {currentUser ? (
            <div>
              <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: "0 0 0.5rem" }}>
                Signed in as <strong>{currentUser.name}</strong> ({currentUser.email})
              </p>
              <button
                onClick={() => {
                  onLogout();
                  setMobileOpen(false);
                }}
                className="btn btn-outline btn-sm"
                style={{ width: "100%" }}
              >
                <LogOut size={16} />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <button
                onClick={() => {
                  onOpenAuth();
                  setMobileOpen(false);
                }}
                className="btn btn-outline"
                style={{ width: "100%" }}
              >
                Sign In / Demo Login
              </button>
              <button
                onClick={() => {
                  onOpenOnboarding();
                  setMobileOpen(false);
                }}
                className="btn btn-primary"
                style={{ width: "100%" }}
              >
                Create Profile & Needs
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
