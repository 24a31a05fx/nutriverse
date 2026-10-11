"use client";

import React from "react";
import { useRouter, usePathname } from "next/navigation";
import AppHeader, { ActiveTab } from "@/components/AppHeader";
import { useNutriverse } from "@/components/NutriverseProvider";
import FoodDetailModal from "@/components/FoodDetailModal";
import { OnboardingModal } from "@/components/OnboardingModal";
import { CartDrawer } from "@/components/CartDrawer";
import { AssistantDrawer } from "@/components/AssistantDrawer";
import { AuthModal } from "@/components/AuthModal";
import ContactAndFooter from "@/components/ContactAndFooter";

interface AppShellProps {
  children: React.ReactNode;
  activeTabOverride?: ActiveTab;
}

export const AppShell: React.FC<AppShellProps> = ({ children, activeTabOverride }) => {
  const router = useRouter();
  const pathname = usePathname();
  const {
    currentUser,
    setCurrentUser,
    profile,
    setProfile,
    cart,
    refreshCart,
    allFoods,
    allRecipes,
    selectedFood,
    setSelectedFood,
    authModalOpen,
    setAuthModalOpen,
    onboardingOpen,
    setOnboardingOpen,
    cartOpen,
    setCartOpen,
    assistantOpen,
    setAssistantOpen,
    mobileMenuOpen,
    setMobileMenuOpen,
    handleLogout,
    handleAddToCart,
    onAuthSuccess,
  } = useNutriverse();

  const getActiveTab = (): ActiveTab => {
    if (activeTabOverride) return activeTabOverride;
    if (pathname === "/") return "storefront";
    if (pathname.startsWith("/explore") || pathname.startsWith("/food/")) return "explorer";
    if (pathname.startsWith("/packs")) return "packs";
    if (pathname.startsWith("/recipes")) return "recipes";
    if (pathname.startsWith("/combinations")) return "combinations";
    if (pathname.startsWith("/scanner") || pathname.startsWith("/p/")) return "scanner";
    if (pathname.startsWith("/account") || pathname.startsWith("/orders")) return "dashboard";
    if (pathname.startsWith("/admin") || pathname.startsWith("/nutritionist")) return "admin";
    return "storefront";
  };

  const handleTabChange = (tab: ActiveTab) => {
    switch (tab) {
      case "storefront":
        router.push("/");
        break;
      case "explorer":
        router.push("/explore");
        break;
      case "packs":
        router.push("/packs");
        break;
      case "recipes":
        router.push("/recipes");
        break;
      case "combinations":
        router.push("/combinations");
        break;
      case "scanner":
        router.push("/scanner");
        break;
      case "dashboard":
        if (!currentUser) {
          setAuthModalOpen(true);
        } else {
          router.push("/account");
        }
        break;
      case "admin":
        if (currentUser?.role === "nutritionist") {
          router.push("/nutritionist");
        } else {
          router.push("/admin");
        }
        break;
      default:
        router.push("/");
    }
  };

  const cartItemsCount = cart ? cart.items.reduce((acc, it) => acc + it.quantity, 0) : 0;

  return (
    <div className="min-h-screen flex flex-col bg-[#faf8f5] text-[#1c1917]">
      <AppHeader
        activeTab={getActiveTab()}
        onTabChange={handleTabChange}
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

      <main className="flex-1">{children}</main>

      <ContactAndFooter />

      {/* Global Modals & Drawers */}
      <FoodDetailModal
        food={selectedFood}
        onClose={() => setSelectedFood(null)}
        onAddToCart={handleAddToCart}
        recipes={allRecipes}
        onOpenRecipe={(recipe) => {
          setSelectedFood(null);
          router.push(`/recipes/${recipe.id}`);
        }}
      />

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={async (user) => {
          setAuthModalOpen(false);
          await onAuthSuccess(user);
        }}
      />

      <OnboardingModal
        isOpen={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
        initialProfile={profile}
        onProfileSaved={(p) => setProfile(p)}
      />

      <CartDrawer
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        onRefreshCart={refreshCart}
        onOrderPlaced={(orderId) => {
          setCartOpen(false);
          router.push(`/orders/${orderId}`);
        }}
      />

      <AssistantDrawer
        isOpen={assistantOpen}
        onClose={() => setAssistantOpen(false)}
        user={currentUser}
      />
    </div>
  );
};
