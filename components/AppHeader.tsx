"use client";

import React, { useState, useEffect } from "react";
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
  MapPin,
  Clock,
  Search,
  Heart,
  ChevronDown,
} from "lucide-react";
import { User as UserModel } from "../lib/api";
import { DeliveryLocation, DEFAULT_LOCATION } from "./LocationModal";

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
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  onSearchSubmit?: (q: string) => void;
  selectedLocation?: DeliveryLocation;
  onOpenLocationModal?: () => void;
  wishlistCount?: number;
  onOpenWishlist?: () => void;
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
  searchQuery = "",
  onSearchChange,
  onSearchSubmit,
  selectedLocation = DEFAULT_LOCATION,
  onOpenLocationModal,
  wishlistCount = 0,
  onOpenWishlist,
}: AppHeaderProps) {
  const [localSearch, setLocalSearch] = useState(searchQuery);

  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  const navTabs: Array<{ id: ActiveTab; label: string; icon: any }> = [
    { id: "storefront", label: "Store", icon: Compass },
    { id: "explorer", label: "Nutrient Explorer", icon: Sparkles },
    { id: "packs", label: "Calin Packs", icon: Package },
    { id: "recipes", label: "Bio-Recipes", icon: UtensilsCrossed },
    { id: "combinations", label: "Pairings", icon: Layers },
    { id: "scanner", label: "Barcode Scan", icon: ScanLine },
  ];

  const handleSearchFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearchSubmit) {
      onSearchSubmit(localSearch);
    } else if (onSearchChange) {
      onSearchChange(localSearch);
    }
  };

  return (
    <header className="navbar-wrap navbar-scrolled" style={{ position: "sticky", top: 0, zIndex: 120 }}>
      {/* 1. TOP UTILITY STRIP (Reference B: Location & Slot Info) */}
      <div className="bg-[#143e2b] text-[#e8f5ec] text-[11px] sm:text-xs py-1.5 px-3 sm:px-6 border-b border-[#1b4d36]">
        <div className="container max-w-7xl mx-auto flex items-center justify-between gap-2">
          {/* Slot indicator */}
          <div className="flex items-center gap-1.5 font-medium truncate">
            <Clock className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span className="text-amber-200 font-bold">Availability:</span>
            <span className="truncate">Demo catalog</span>
          </div>

          {/* Location button */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onOpenLocationModal}
              className="flex items-center gap-1 hover:text-white transition group cursor-pointer bg-transparent border-none text-inherit text-xs"
              title="Change Delivery Location"
            >
              <MapPin className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span className="font-semibold text-emerald-200 group-hover:text-white">
                {selectedLocation.label}
              </span>
              <span className="text-gray-300 font-mono text-[10px]">
                ({selectedLocation.pincode})
              </span>
              <ChevronDown className="w-3 h-3 text-emerald-300 ml-0.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. MAIN HEADER BAR */}
      <div className="container max-w-7xl mx-auto">
        <nav className="navbar py-2 sm:py-3" aria-label="Main Store Navigation" style={{ minHeight: "64px" }}>
          {/* Logo & Tagline */}
          <button
            onClick={() => onTabChange("storefront")}
            className="brand-link"
            style={{ display: "flex", alignItems: "center", gap: "0.6rem", background: "none", border: "none", cursor: "pointer", textDecoration: "none" }}
          >
            <div style={{ position: "relative", width: 36, height: 36, borderRadius: 10, overflow: "hidden", flexShrink: 0 }}>
              <Image
                src="/assets/nutriverse-logo.jpeg"
                alt="Nutriverse Logo"
                fill
                sizes="36px"
                style={{ objectFit: "cover" }}
                priority
              />
            </div>
            <div style={{ textAlign: "left" }}>
              <span style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--forest-950)", letterSpacing: "-0.02em", display: "block", lineHeight: 1.1 }}>
                Nutriverse
              </span>
              <span style={{ display: "block", fontSize: "0.65rem", color: "var(--green-600)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Nutrition-First Grocery
              </span>
            </div>
          </button>

          {/* Prominent Search Bar (Desktop / Tablet) */}
          <form
            onSubmit={handleSearchFormSubmit}
            className="hidden md:flex flex-1 max-w-md mx-4 relative items-center"
          >
            <input
              type="text"
              value={localSearch}
              onChange={(e) => {
                setLocalSearch(e.target.value);
                if (onSearchChange) onSearchChange(e.target.value);
              }}
              placeholder="Search groceries, dal, millets, vegetables..."
              className="w-full pl-9 pr-16 py-2 bg-[#f4f1eb] hover:bg-white focus:bg-white text-xs sm:text-sm text-gray-800 placeholder-gray-500 rounded-full border border-gray-300 focus:border-[#236b48] focus:ring-2 focus:ring-[#236b48]/20 transition outline-hidden"
            />
            <Search className="w-4 h-4 text-gray-400 absolute left-3 pointer-events-none" />
            <button
              type="submit"
              className="absolute right-1.5 px-3 py-1 bg-[#236b48] hover:bg-[#1a5338] text-white text-[11px] font-bold rounded-full transition"
            >
              Search
            </button>
          </form>

          {/* Center Tabs Navigation (Desktop) */}
          <div className="nav-links hidden lg:flex items-center gap-1">
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
                    gap: "0.35rem",
                    padding: "0.45rem 0.75rem",
                    borderRadius: "var(--radius-pill)",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    background: isActive ? "var(--forest-800)" : "transparent",
                    color: isActive ? "#ffffff" : "var(--charcoal-700)",
                    transition: "all 0.15s ease",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <Icon size={14} />
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
                  gap: "0.35rem",
                  padding: "0.45rem 0.75rem",
                  borderRadius: "var(--radius-pill)",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  background: activeTab === "admin" ? "var(--gold-500)" : "var(--gold-100)",
                  color: activeTab === "admin" ? "#ffffff" : "#92400e",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {currentUser.role === "admin" ? <Shield size={14} /> : <Stethoscope size={14} />}
                <span>{currentUser.role === "admin" ? "Admin" : "Nutritionist"}</span>
              </button>
            )}
          </div>

          {/* Right Action Icons: Favorites, Nourish AI, Cart, User / Account */}
          <div className="nav-actions flex items-center gap-2 sm:gap-3">
            {/* Ask AI button */}
            <button
              onClick={onOpenAssistant}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                padding: "0.45rem 0.75rem",
                borderRadius: "var(--radius-pill)",
                backgroundColor: "var(--green-50)",
                border: "1px solid var(--green-200)",
                color: "var(--forest-800)",
                fontSize: "0.8rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
              title="Open Nourish AI Assistant"
            >
              <Sparkles size={14} style={{ color: "var(--green-600)" }} />
              <span className="hidden sm:inline">Ask AI</span>
            </button>

            {/* Wishlist Button */}
            <button
              type="button"
              onClick={onOpenWishlist || (() => onTabChange("explorer"))}
              className="relative p-2 rounded-full hover:bg-gray-100 text-gray-700 transition"
              title="Saved Foods & Wishlist"
            >
              <Heart className="w-5 h-5 text-gray-700" />
              {wishlistCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {wishlistCount}
                </span>
              )}
            </button>

            {/* Cart Button */}
            <button
              onClick={onOpenCart}
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.45rem 0.85rem",
                borderRadius: "var(--radius-pill)",
                backgroundColor: "#143e2b",
                color: "#ffffff",
                border: "none",
                fontWeight: 700,
                fontSize: "0.82rem",
                cursor: "pointer",
              }}
              aria-label={`Shopping Cart with ${cartCount} items`}
            >
              <ShoppingBag size={16} />
              <span className="hidden sm:inline">Bag</span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: "18px",
                  height: "18px",
                  padding: "0 5px",
                  borderRadius: "9px",
                  backgroundColor: "#2e8555",
                  color: "#ffffff",
                  fontSize: "0.72rem",
                  fontWeight: 800,
                }}
              >
                {cartCount}
              </span>
            </button>

            {/* User Profile / Login */}
            {currentUser ? (
              <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <button
                  onClick={() => onTabChange("dashboard")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    padding: "0.4rem 0.75rem",
                    borderRadius: "var(--radius-pill)",
                    backgroundColor: activeTab === "dashboard" ? "var(--green-100)" : "var(--cream-soft)",
                    color: "var(--forest-900)",
                    border: "1px solid var(--border-light)",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                  title="Open Customer Dashboard"
                >
                  <User size={15} />
                  <span className="hidden sm:inline">{currentUser.name.split(" ")[0]}</span>
                </button>

                <button
                  onClick={onLogout}
                  style={{
                    padding: "0.4rem",
                    borderRadius: "50%",
                    background: "transparent",
                    color: "var(--charcoal-500)",
                    border: "none",
                    cursor: "pointer",
                  }}
                  title="Sign Out"
                >
                  <LogOut size={15} />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAuth}
                className="btn btn-primary btn-sm"
                style={{ padding: "0.45rem 0.9rem", fontSize: "0.82rem" }}
              >
                <span>Sign In</span>
              </button>
            )}

            {/* Mobile Hamburger Menu Toggle */}
            <button
              className="mobile-toggle lg:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle navigation menu"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </nav>

        {/* 3. Mobile Search Row (Reference B) */}
        <div className="md:hidden pb-2.5 pt-0.5 px-1">
          <form onSubmit={handleSearchFormSubmit} className="relative flex items-center">
            <input
              type="text"
              value={localSearch}
              onChange={(e) => {
                setLocalSearch(e.target.value);
                if (onSearchChange) onSearchChange(e.target.value);
              }}
              placeholder="Search groceries, dal, millets, vegetables..."
              className="w-full pl-9 pr-14 py-2 bg-[#f4f1eb] focus:bg-white text-xs text-gray-800 placeholder-gray-500 rounded-xl border border-gray-300 focus:border-[#236b48] outline-hidden shadow-inner"
            />
            <Search className="w-4 h-4 text-gray-400 absolute left-3 pointer-events-none" />
            <button
              type="submit"
              className="absolute right-1 px-2.5 py-1 bg-[#236b48] text-white text-[11px] font-bold rounded-lg"
            >
              Go
            </button>
          </form>
        </div>
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
                <span>{currentUser.role === "admin" ? "Admin Operations" : "Nutritionist Queue"}</span>
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
                Sign In
              </button>
              <button
                onClick={() => {
                  onOpenOnboarding();
                  setMobileOpen(false);
                }}
                className="btn btn-primary"
                style={{ width: "100%" }}
              >
                Calculate Needs & Profile
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
