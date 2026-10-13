"use client";

import React, { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import AppHeader, { ActiveTab } from "@/components/AppHeader";
import { StorefrontView } from "@/components/StorefrontView";

const tabLoading = () => (
  <div className="container py-12 text-center text-sm text-gray-500" role="status">
    Loading…
  </div>
);

const FoodExplorerView = dynamic(() => import("@/components/FoodExplorerView"), {
  loading: tabLoading,
});
const CalinPacksView = dynamic(() => import("@/components/CalinPacksView"), {
  loading: tabLoading,
});
const RecipesView = dynamic(() => import("@/components/RecipesView"), {
  loading: tabLoading,
});
const CombinationsView = dynamic(() => import("@/components/CombinationsView"), {
  loading: tabLoading,
});
const ScannerView = dynamic(
  () => import("@/components/ScannerView").then((module) => module.ScannerView),
  { loading: tabLoading },
);
const CustomerDashboardView = dynamic(
  () =>
    import("@/components/CustomerDashboardView").then(
      (module) => module.CustomerDashboardView,
    ),
  { loading: tabLoading },
);
const AdminPortalView = dynamic(
  () => import("@/components/AdminPortalView").then((module) => module.AdminPortalView),
  { loading: tabLoading },
);

import FoodDetailModal from "@/components/FoodDetailModal";
import { OnboardingModal } from "@/components/OnboardingModal";
import { CartDrawer } from "@/components/CartDrawer";
import { AssistantDrawer } from "@/components/AssistantDrawer";
import { AuthModal } from "@/components/AuthModal";
import { useNutriverse } from "@/components/NutriverseProvider";
import { LocationModal, DeliveryLocation, DEFAULT_LOCATION } from "@/components/LocationModal";
import { BottomNav } from "@/components/BottomNav";

import { api, User, NutritionProfile, Food, Recipe, CartResponse, logoutUser } from "@/lib/api";
import { CatalogProduct } from "@/src/data/catalog";
import { Bot, Sparkles, Heart, Activity } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>("storefront");
  const {
    currentUser,
    setCurrentUser,
    profile,
    setProfile,
    cart,
    allFoods,
    allRecipes,
    refreshCatalog,
    refreshCart,
    refreshProfile,
    handleLogout,
    authModalOpen,
    setAuthModalOpen,
    cartOpen,
    setCartOpen,
    assistantOpen,
    setAssistantOpen,
    onboardingOpen,
    setOnboardingOpen,
  } = useNutriverse();

  // Search & Location & Wishlist
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<DeliveryLocation>(() => {
    if (typeof window === "undefined") return DEFAULT_LOCATION;
    try {
      const saved = localStorage.getItem("nutriverse_location");
      return saved ? JSON.parse(saved) : DEFAULT_LOCATION;
    } catch {
      return DEFAULT_LOCATION;
    }
  });
  const [wishlistCount, setWishlistCount] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    try {
      const saved = JSON.parse(localStorage.getItem("nutriverse_wishlist") || "[]");
      return saved.length;
    } catch {
      return 0;
    }
  });

  // Modals & Drawers
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Sync wishlist updates from localStorage
  const refreshWishlistCount = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = JSON.parse(localStorage.getItem("nutriverse_wishlist") || "[]");
      setWishlistCount(saved.length);
    } catch {
      setWishlistCount(0);
    }
  }, []);

  useEffect(() => {
    const handleStorageChange = () => {
      refreshWishlistCount();
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [refreshWishlistCount]);

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

  const handleAddCatalogProductToCart = async (product: CatalogProduct, unit: string, qty: number) => {
    // Try to find matching food in allFoods by barcode, id, or name prefix
    const matched = allFoods.find(
      (f) =>
        f.id === product.id ||
        (product.barcode && f.barcode === product.barcode) ||
        f.name.toLowerCase().includes(product.name.toLowerCase().split(" ")[0])
    );
    if (matched) {
      await handleAddToCart(matched, qty);
    } else {
      const synthesizedFood: Food = {
        id: product.id,
        name: product.name,
        barcode: product.barcode,
        category: product.category,
        description: product.description,
        price_paise: product.pricePaise,
        unit: product.unit,
        serving_size: product.servingSize,
        stock_qty: product.stockQty || 100,
        calories: product.calories,
        protein_g: product.proteinG,
        carbs_g: product.carbsG,
        fat_g: product.fatG,
        fibre_g: product.fibreG,
        vitamins_json: JSON.stringify({}),
        ingredients: product.description,
        storage_info: "Keep in cool, dry place.",
        prep_methods: JSON.stringify(["Fresh Consumption", "Steamed"]),
        dietary_tags: JSON.stringify(product.dietaryTags || ["Vegetarian"]),
        emoji: "🥗",
        active: true,
        nutrition_tags: JSON.stringify(product.nutritionTags || []),
      };
      await handleAddToCart(synthesizedFood, qty);
    }
  };

  const handleOpenCatalogProductDetail = (product: CatalogProduct) => {
    const matched = allFoods.find(
      (f) =>
        f.id === product.id ||
        (product.barcode && f.barcode === product.barcode) ||
        f.name.toLowerCase().includes(product.name.toLowerCase().split(" ")[0])
    );
    if (matched) {
      setSelectedFood(matched);
    } else {
      const synthesizedFood: Food = {
        id: product.id,
        name: product.name,
        barcode: product.barcode,
        category: product.category,
        description: product.description,
        price_paise: product.pricePaise,
        unit: product.unit,
        serving_size: product.servingSize,
        stock_qty: product.stockQty || 100,
        calories: product.calories,
        protein_g: product.proteinG,
        carbs_g: product.carbsG,
        fat_g: product.fatG,
        fibre_g: product.fibreG,
        vitamins_json: JSON.stringify({}),
        ingredients: product.description,
        storage_info: "Keep in cool, dry place.",
        prep_methods: JSON.stringify(["Fresh Consumption", "Steamed"]),
        dietary_tags: JSON.stringify(product.dietaryTags || ["Vegetarian"]),
        emoji: "🥗",
        active: true,
        nutrition_tags: JSON.stringify(product.nutritionTags || []),
      };
      setSelectedFood(synthesizedFood);
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

  const handleSelectLocation = (loc: DeliveryLocation) => {
    setSelectedLocation(loc);
    try {
      localStorage.setItem("nutriverse_location", JSON.stringify(loc));
    } catch {}
  };

  const cartItemsCount = cart ? cart.items.reduce((acc, it) => acc + it.quantity, 0) : 0;
  const cartTotalPaise = cart ? cart.total_paise : 0;

  return (
    <div className="nv-app min-h-screen flex flex-col bg-[#faf7f0] text-[#111a14] selection:bg-emerald-200">
      {/* 1. Master Application Header (Matching Reference B) */}
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
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={(q) => {
          setSearchQuery(q);
          if (activeTab !== "storefront") {
            setActiveTab("storefront");
          }
        }}
        selectedLocation={selectedLocation}
        onOpenLocationModal={() => setLocationModalOpen(true)}
        wishlistCount={wishlistCount}
        onOpenWishlist={() => {
          setActiveTab("explorer");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />

      {/* 2. Main View Container (Based on Active Tab) */}
      <main className="flex-1">
        {activeTab === "storefront" && (
          <StorefrontView
            onNavigateTab={(tab) => {
              if (tab === "explorer") {
                setActiveTab("explorer");
                window.scrollTo({ top: 0, behavior: "smooth" });
              } else if (tab === "packs") {
                setActiveTab("packs");
                window.scrollTo({ top: 0, behavior: "smooth" });
              } else if (tab === "recipes") {
                setActiveTab("recipes");
                window.scrollTo({ top: 0, behavior: "smooth" });
              } else if (tab === "combinations") {
                setActiveTab("combinations");
                window.scrollTo({ top: 0, behavior: "smooth" });
              } else if (tab === "scanner") {
                setActiveTab("scanner");
                window.scrollTo({ top: 0, behavior: "smooth" });
              } else if (tab === "dashboard") {
                setActiveTab("dashboard");
                window.scrollTo({ top: 0, behavior: "smooth" });
              } else if (tab === "admin") {
                setActiveTab("admin");
                window.scrollTo({ top: 0, behavior: "smooth" });
              } else {
                setActiveTab(tab as ActiveTab);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
            onOpenOnboarding={() => setOnboardingOpen(true)}
            onAddToCart={handleAddCatalogProductToCart}
            onOpenDetail={handleOpenCatalogProductDetail}
            cartItems={cart?.items || []}
            cartTotalPaise={cartTotalPaise}
            onOpenCart={() => setCartOpen(true)}
            searchFilter={searchQuery}
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
              alert("Nutritionist review request submitted! You can track nutritionist guidance in your dashboard.");
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
      <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-30">
        <button
          type="button"
          onClick={() => setAssistantOpen(true)}
          className="nv-assistant-trigger group flex items-center gap-2 px-3.5 py-2.5 sm:px-4 sm:py-3 bg-gradient-to-r from-emerald-800 to-teal-900 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs rounded-full shadow-xl hover:shadow-2xl transition transform hover:-translate-y-0.5 border border-emerald-600/40"
        >
          <div className="w-5 h-5 rounded-full bg-emerald-400 text-emerald-950 flex items-center justify-center font-bold text-xs shadow-inner">
            <Bot className="w-3 h-3" />
          </div>
          <span className="hidden sm:inline">Ask Nourish AI</span>
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

      <LocationModal
        isOpen={locationModalOpen}
        onClose={() => setLocationModalOpen(false)}
        currentLocation={selectedLocation}
        onSelectLocation={handleSelectLocation}
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
          setAuthModalOpen(false);
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

      {/* 5. Mobile Bottom Navigation (Matching Reference B) */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        cartCount={cartItemsCount}
        onOpenCart={() => setCartOpen(true)}
        currentUser={currentUser}
        onOpenAuth={() => setAuthModalOpen(true)}
      />

      {/* 6. Comprehensive Application Footer */}
      <footer className="nv-app-footer bg-[#0c281c] text-white/90 pt-16 pb-24 md:pb-12 border-t border-[#1b4d36]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
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
                Mifflin–St Jeor Engine • EAN-13 Scanner • ICMR-NIN 2020 RDA
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300">Shop & Explore</h4>
              <ul className="space-y-2 text-xs text-gray-300">
                <li>
                  <button onClick={() => { setActiveTab("storefront"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="hover:text-white transition cursor-pointer">
                    Grocery Storefront
                  </button>
                </li>
                <li>
                  <button onClick={() => { setActiveTab("explorer"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="hover:text-white transition cursor-pointer">
                    Nutrient Explorer
                  </button>
                </li>
                <li>
                  <button onClick={() => { setActiveTab("packs"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="hover:text-white transition cursor-pointer">
                    Calin Packs
                  </button>
                </li>
                <li>
                  <button onClick={() => { setActiveTab("recipes"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="hover:text-white transition cursor-pointer">
                    Bio-Recipes
                  </button>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300">Nutrition Tools</h4>
              <ul className="space-y-2 text-xs text-gray-300">
                <li>
                  <button onClick={() => { setActiveTab("scanner"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="hover:text-white transition cursor-pointer">
                    Barcode Scanner
                  </button>
                </li>
                <li>
                  <button onClick={() => setOnboardingOpen(true)} className="hover:text-white transition cursor-pointer">
                    BMR Calculator
                  </button>
                </li>
                <li>
                  <button onClick={() => setAssistantOpen(true)} className="hover:text-white transition cursor-pointer">
                    Ask Nourish AI
                  </button>
                </li>
                <li>
                  <button onClick={() => { setActiveTab("dashboard"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="hover:text-white transition cursor-pointer">
                    My Account
                  </button>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300">Service Area</h4>
              <ul className="space-y-2 text-xs text-gray-300">
                <li className="text-[11px] text-emerald-200">
                  ⚡ Vijayawada Express Zone (520001–520015)
                </li>
                <li className="text-[11px] text-emerald-300/80">
                  Bengaluru Standard Zone (560001–560105)
                </li>
                <li className="pt-2">
                  <button
                    onClick={() => setLocationModalOpen(true)}
                    className="text-xs text-amber-300 hover:text-amber-200 font-semibold underline cursor-pointer"
                  >
                    Change Delivery Area
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-emerald-900/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-emerald-300/70">
            <p>© {new Date().getFullYear()} Nutriverse Ventures. All rights reserved.</p>
            <p className="text-[11px] max-w-lg text-center sm:text-right">
              Disclaimer: Nutritional metrics are based on scientific equations (Mifflin–St Jeor) and verified whole food composition tables (IFCT 2017 & ICMR-NIN 2020). Not medical diagnoses or medical prescriptions.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
