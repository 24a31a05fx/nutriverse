"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import AppHeader, { ActiveTab } from "@/components/AppHeader";
import { StorefrontView } from "@/components/StorefrontView";
import FoodExplorerView from "@/components/FoodExplorerView";
import CalinPacksView from "@/components/CalinPacksView";
import RecipesView from "@/components/RecipesView";
import CombinationsView from "@/components/CombinationsView";
import { ScannerView } from "@/components/ScannerView";
import { CustomerDashboardView } from "@/components/CustomerDashboardView";
import { AdminPortalView } from "@/components/AdminPortalView";

import FoodDetailModal from "@/components/FoodDetailModal";
import { OnboardingModal } from "@/components/OnboardingModal";
import { CartDrawer } from "@/components/CartDrawer";
import { AssistantDrawer } from "@/components/AssistantDrawer";
import { AuthModal } from "@/components/AuthModal";

import { api, User, NutritionProfile, Food, Recipe, CartResponse, logoutUser } from "@/lib/api";
import { Bot, Sparkles, Heart, Activity } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>("storefront");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<NutritionProfile | null>(null);
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [allFoods, setAllFoods] = useState<Food[]>([]);
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);

  // Modals & Drawers
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Load Catalog Data
  const refreshCatalog = useCallback(async () => {
    try {
      const [foodsData, recipesData] = await Promise.all([
        api<Food[]>("/foods"),
        api<Recipe[]>("/recipes"),
      ]);
      setAllFoods(foodsData);
      setAllRecipes(recipesData);
    } catch (err) {
      console.error("Error loading foods catalog:", err);
    }
  }, []);

  // Load Cart Data
  const refreshCart = useCallback(async () => {
    try {
      const cartData = await api<CartResponse>("/cart");
      setCart(cartData);
    } catch {
      setCart(null);
    }
  }, []);

  // Load User Profile
  const refreshProfile = useCallback(async () => {
    try {
      const p = await api<NutritionProfile>("/profile");
      setProfile(p);
    } catch {
      setProfile(null);
    }
  }, []);

  // Initialize Session: Check cookie session without forced auto-login
  useEffect(() => {
    const initSession = async () => {
      try {
        const user = await api<User>("/auth/me");
        if (user) {
          setCurrentUser(user);
          await Promise.all([refreshProfile(), refreshCart()]);
        }
      } catch {
        // Guest mode: catalog, packs, recipes, combinations, scanner are public
        setCurrentUser(null);
        setProfile(null);
        setCart(null);
      }
    };

    refreshCatalog();
    initSession();
  }, [refreshCatalog, refreshCart, refreshProfile]);

  const handleLogout = async () => {
    await logoutUser();
    setCurrentUser(null);
    setProfile(null);
    setCart(null);
    setActiveTab("storefront");
  };

  const handleAddToCart = async (food: Food, quantity = 1) => {
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    try {
      await api("/cart/items", {
        method: "POST",
        body: JSON.stringify({
          item_type: "food",
          food_id: food.id,
          quantity,
        }),
      });
      await refreshCart();
      setCartOpen(true);
    } catch (err: any) {
      alert(err?.message || "Failed to add food to cart");
    }
  };

  const handleAddPackToCart = async (tier: string, packName: string, customization: any) => {
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    try {
      await api("/cart/items", {
        method: "POST",
        body: JSON.stringify({
          item_type: "pack",
          pack_tier: tier,
          pack_name: packName,
          customization,
          quantity: 1,
        }),
      });
      await refreshCart();
      setCartOpen(true);
    } catch (err: any) {
      alert(err?.message || "Failed to add pack to cart");
    }
  };

  const handleAddMultipleToCart = async (items: Array<{ food: Food; quantity: number }>) => {
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    try {
      for (const item of items) {
        await api("/cart/items", {
          method: "POST",
          body: JSON.stringify({
            item_type: "food",
            food_id: item.food.id,
            quantity: item.quantity,
          }),
        });
      }
      await refreshCart();
      setCartOpen(true);
    } catch (err: any) {
      alert(err?.message || "Failed to add recipe ingredients to bag");
    }
  };

  const cartItemsCount = cart ? cart.items.reduce((acc, it) => acc + it.quantity, 0) : 0;

  return (
    <div className="min-h-screen flex flex-col bg-[#faf7f0] text-[#111a14] selection:bg-emerald-200">
      {/* 1. Master Application Header */}
      <AppHeader
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        currentUser={currentUser}
        cartCount={cartItemsCount}
        onOpenCart={() => setCartOpen(true)}
        onOpenAuth={() => setAuthModalOpen(true)}
        onOpenOnboarding={() => setOnboardingOpen(true)}
        onOpenAssistant={() => setAssistantOpen(true)}
        onLogout={handleLogout}
        mobileOpen={mobileMenuOpen}
        setMobileOpen={setMobileMenuOpen}
      />

      {/* 2. Main View Container (Based on Active Tab) */}
      <main className="flex-1">
        {activeTab === "storefront" && (
          <StorefrontView
            onNavigateTab={(tab) => {
              if (tab === "explorer") router.push("/explore");
              else if (tab === "packs") router.push("/packs");
              else if (tab === "recipes") router.push("/recipes");
              else if (tab === "combinations") router.push("/combinations");
              else if (tab === "scanner") router.push("/scanner");
              else if (tab === "dashboard") router.push("/account");
              else if (tab === "admin") router.push("/admin");
              else {
                setActiveTab(tab as ActiveTab);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
            onOpenOnboarding={() => setOnboardingOpen(true)}
          />
        )}

        {activeTab === "explorer" && (
          <FoodExplorerView
            onAddToCart={handleAddToCart}
          />
        )}

        {activeTab === "packs" && (
          <CalinPacksView
            onAddPackToCart={handleAddPackToCart}
            currentUser={currentUser}
            onOpenAuth={() => setAuthModalOpen(true)}
            onRequestNutritionistReviewSuccess={() => {
              alert("Nutritionist review request submitted! You can track clinical notes in your dashboard.");
              setActiveTab("dashboard");
            }}
          />
        )}

        {activeTab === "recipes" && (
          <RecipesView
            allFoods={allFoods}
            onAddMultipleToCart={handleAddMultipleToCart}
          />
        )}

        {activeTab === "combinations" && (
          <CombinationsView
            allFoods={allFoods}
            onAddMultipleToCart={handleAddMultipleToCart}
          />
        )}

        {activeTab === "scanner" && (
          <ScannerView
            onSelectFood={(food) => setSelectedFood(food)}
            onAddToCart={handleAddToCart}
          />
        )}

        {activeTab === "dashboard" && (
          <CustomerDashboardView
            user={currentUser}
            profile={profile}
            onOpenOnboarding={() => setOnboardingOpen(true)}
            onNavigateTab={(tab) => {
              setActiveTab(tab as ActiveTab);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        )}

        {activeTab === "admin" && (
          <AdminPortalView
            user={currentUser}
            onRefreshGlobal={() => {
              refreshCatalog();
              refreshCart();
            }}
          />
        )}
      </main>

      {/* 3. Floating Assistant Trigger */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          type="button"
          onClick={() => setAssistantOpen(true)}
          className="group flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-emerald-800 to-teal-900 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs rounded-full shadow-xl hover:shadow-2xl transition transform hover:-translate-y-0.5 border border-emerald-600/40"
        >
          <div className="w-6 h-6 rounded-full bg-emerald-400 text-emerald-950 flex items-center justify-center font-bold text-xs shadow-inner">
            <Bot className="w-3.5 h-3.5" />
          </div>
          <span>Ask Nourish AI</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </button>
      </div>

      {/* 4. Global Modals & Drawers */}
      <FoodDetailModal
        food={selectedFood}
        onClose={() => setSelectedFood(null)}
        onAddToCart={handleAddToCart}
        recipes={allRecipes}
        onOpenRecipe={() => {
          setSelectedFood(null);
          setActiveTab("recipes");
        }}
      />

      <OnboardingModal
        isOpen={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
        initialProfile={profile}
        onProfileSaved={(newProfile) => {
          setProfile(newProfile);
          setActiveTab("dashboard");
        }}
      />

      <CartDrawer
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        onRefreshCart={refreshCart}
        onOrderPlaced={() => {
          refreshCart();
          setActiveTab("dashboard");
        }}
      />

      <AssistantDrawer
        isOpen={assistantOpen}
        onClose={() => setAssistantOpen(false)}
        user={currentUser}
      />

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={(user) => {
          setCurrentUser(user);
          refreshProfile();
          refreshCart();
          if (user.role === "admin" || user.role === "nutritionist") {
            setActiveTab("admin");
          } else {
            setActiveTab("dashboard");
          }
        }}
      />

      {/* 5. Comprehensive Application Footer */}
      <footer className="bg-emerald-950 text-white/90 pt-16 pb-12 border-t border-emerald-900/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-12">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
            <div className="col-span-2 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black tracking-tight text-white">Nutriverse</span>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-900/80 px-2 py-0.5 rounded-full uppercase">
                  Nutrition-First
                </span>
              </div>
              <p className="text-xs text-emerald-200/80 leading-relaxed max-w-sm">
                Empowering individuals to understand their nutritional requirements, choose foods by biological contribution, and receive synergistic Calin Packs.
              </p>
              <div className="text-[11px] text-emerald-300 font-mono">
                Mifflin–St Jeor Engine • EAN-13 Scanner • Clinical Triage
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300">Explore</h4>
              <ul className="space-y-2 text-xs text-gray-300">
                <li>
                  <button onClick={() => { setActiveTab("explorer"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="hover:text-white transition">
                    Food Explorer
                  </button>
                </li>
                <li>
                  <button onClick={() => { setActiveTab("packs"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="hover:text-white transition">
                    Calin Packs
                  </button>
                </li>
                <li>
                  <button onClick={() => { setActiveTab("recipes"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="hover:text-white transition">
                    Bio-Recipes
                  </button>
                </li>
                <li>
                  <button onClick={() => { setActiveTab("combinations"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="hover:text-white transition">
                    Combinations
                  </button>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300">Intelligence</h4>
              <ul className="space-y-2 text-xs text-gray-300">
                <li>
                  <button onClick={() => { setActiveTab("scanner"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="hover:text-white transition">
                    Barcode Scanner
                  </button>
                </li>
                <li>
                  <button onClick={() => setOnboardingOpen(true)} className="hover:text-white transition">
                    BMR Calculator
                  </button>
                </li>
                <li>
                  <button onClick={() => setAssistantOpen(true)} className="hover:text-white transition">
                    Nourish AI Chat
                  </button>
                </li>
                <li>
                  <button onClick={() => { setActiveTab("dashboard"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="hover:text-white transition">
                    Member Dashboard
                  </button>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300">Console Roles</h4>
              <ul className="space-y-2 text-xs text-gray-300">
                <li>
                  <button onClick={() => setAuthModalOpen(true)} className="hover:text-white transition">
                    Switch User Role
                  </button>
                </li>
                <li>
                  <button onClick={() => { setActiveTab("admin"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="hover:text-white transition">
                    Admin & Clinical
                  </button>
                </li>
                <li>
                  <span className="text-[11px] text-emerald-400/80">Alex (Customer)</span>
                </li>
                <li>
                  <span className="text-[11px] text-teal-400/80">Dr. Priya (Nutritionist)</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-emerald-900/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-emerald-300/70">
            <p>© {new Date().getFullYear()} Nutriverse Ventures. All rights reserved.</p>
            <p className="text-[11px] max-w-lg text-center sm:text-right">
              Disclaimer: Nutritional metrics are based on scientific equations (Mifflin–St Jeor) and verified whole food composition tables. Not medical diagnoses or clinical prescriptions.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
