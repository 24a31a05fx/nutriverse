"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  api,
  User,
  NutritionProfile,
  Food,
  Recipe,
  CartResponse,
  logoutUser,
} from "@/lib/api";

interface NutriverseContextType {
  currentUser: User | null;
  setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
  profile: NutritionProfile | null;
  setProfile: React.Dispatch<React.SetStateAction<NutritionProfile | null>>;
  cart: CartResponse | null;
  setCart: React.Dispatch<React.SetStateAction<CartResponse | null>>;
  allFoods: Food[];
  allRecipes: Recipe[];
  refreshCatalog: () => Promise<void>;
  refreshCart: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  selectedFood: Food | null;
  setSelectedFood: React.Dispatch<React.SetStateAction<Food | null>>;
  authModalOpen: boolean;
  setAuthModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onboardingOpen: boolean;
  setOnboardingOpen: React.Dispatch<React.SetStateAction<boolean>>;
  cartOpen: boolean;
  setCartOpen: React.Dispatch<React.SetStateAction<boolean>>;
  assistantOpen: boolean;
  setAssistantOpen: React.Dispatch<React.SetStateAction<boolean>>;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleLogout: () => Promise<void>;
  handleAddToCart: (food: Food, quantity?: number) => Promise<void>;
  handleAddPackToCart: (tier: string, packName: string, customization: any) => Promise<void>;
  handleAddMultipleToCart: (items: Array<{ food: Food; quantity: number }>) => Promise<void>;
}

const NutriverseContext = createContext<NutriverseContextType | undefined>(undefined);

export const NutriverseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
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

  const refreshCart = useCallback(async () => {
    try {
      const cartData = await api<CartResponse>("/cart");
      setCart(cartData);
    } catch {
      setCart(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const p = await api<NutritionProfile>("/profile");
      setProfile(p);
    } catch {
      setProfile(null);
    }
  }, []);

  // Initialize Session: check cookie session without forcing auto-login
  useEffect(() => {
    const initSession = async () => {
      try {
        const user = await api<User>("/auth/me");
        if (user) {
          setCurrentUser(user);
          await Promise.all([refreshProfile(), refreshCart()]);
        }
      } catch {
        // Guest mode: unauthenticated users browse freely
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
    router.push("/");
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

  return (
    <NutriverseContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        profile,
        setProfile,
        cart,
        setCart,
        allFoods,
        allRecipes,
        refreshCatalog,
        refreshCart,
        refreshProfile,
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
        handleAddPackToCart,
        handleAddMultipleToCart,
      }}
    >
      {children}
    </NutriverseContext.Provider>
  );
};

export const useNutriverse = () => {
  const context = useContext(NutriverseContext);
  if (!context) {
    throw new Error("useNutriverse must be used within a NutriverseProvider");
  }
  return context;
};
