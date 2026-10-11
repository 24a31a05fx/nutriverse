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

interface GuestCartItem {
  id: string;
  item_type: "food" | "pack";
  food_id?: string;
  pack_tier?: string;
  quantity: number;
  customization?: Record<string, any>;
}

function getStoredGuestCart(): GuestCartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("nutriverse_guest_cart");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredGuestCart(items: GuestCartItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("nutriverse_guest_cart", JSON.stringify(items));
  } catch {}
}

function clearStoredGuestCart(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("nutriverse_guest_cart");
  } catch {}
}

const PACK_TIER_META: Record<string, { name: string; price_paise: number }> = {
  basic: { name: "Calin Basic Pack", price_paise: 69900 },
  minimal_plus: { name: "Calin Minimal Plus Pack", price_paise: 109900 },
  premium: { name: "Calin Premium Pack", price_paise: 169900 },
};

function buildCartResponseFromGuestItems(items: GuestCartItem[], catalog: Food[] = []): CartResponse {
  let subtotal = 0;
  const cartItems = items.map((it) => {
    let name = "Grocery Item";
    let category = "Grocery";
    let unit = "1 unit";
    let unit_price = 0;

    if (it.item_type === "pack") {
      const tierMeta = PACK_TIER_META[it.pack_tier || "basic"] || PACK_TIER_META.basic;
      name = tierMeta.name;
      category = "Calin Pack";
      unit = "1 bundle";
      unit_price = tierMeta.price_paise;
    } else if (it.food_id) {
      const food = catalog.find((f) => f.id === it.food_id);
      if (food) {
        name = food.name;
        category = food.category;
        unit = food.unit;
        unit_price = food.price_paise;
      }
    }

    const itemTotal = unit_price * it.quantity;
    subtotal += itemTotal;

    return {
      id: it.id,
      item_type: it.item_type,
      food_id: it.food_id,
      pack_tier: it.pack_tier,
      name,
      category,
      unit,
      unit_price_paise: unit_price,
      quantity: it.quantity,
      total_paise: itemTotal,
      customization: it.customization,
      stock_available: true,
    };
  });

  const delivery_fee = subtotal >= 80000 || subtotal === 0 ? 0 : 4900;
  return {
    items: cartItems,
    subtotal_paise: subtotal,
    delivery_fee_paise: delivery_fee,
    total_paise: subtotal + delivery_fee,
  };
}

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
  handleRemoveFromCart: (itemId: string) => Promise<void>;
  onAuthSuccess: (user: User) => Promise<void>;
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

  const onAuthSuccess = useCallback(async (user: User) => {
    setCurrentUser(user);
    const guestItems = getStoredGuestCart();
    if (guestItems.length > 0) {
      try {
        const payload = {
          items: guestItems.map((it) => ({
            item_type: it.item_type,
            food_id: it.food_id,
            pack_tier: it.pack_tier,
            customization: it.customization,
            quantity: it.quantity,
          })),
        };
        const merged = await api<CartResponse>("/cart/merge", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        clearStoredGuestCart();
        setCart(merged);
      } catch (err) {
        console.error("Failed to merge guest cart on auth:", err);
        await refreshCart();
      }
    } else {
      await refreshCart();
    }
    await refreshProfile();
  }, [refreshCart, refreshProfile]);

  // Initialize Session: check cookie session without forcing auto-login
  useEffect(() => {
    const initSession = async () => {
      try {
        const user = await api<User>("/auth/me");
        if (user) {
          await onAuthSuccess(user);
        }
      } catch {
        // Guest mode: unauthenticated users browse freely
        setCurrentUser(null);
        setProfile(null);
        const stored = getStoredGuestCart();
        setCart(stored.length > 0 ? buildCartResponseFromGuestItems(stored, allFoods) : null);
      }
    };

    refreshCatalog();
    initSession();
  }, [refreshCatalog, onAuthSuccess]);

  // Synchronize guest cart when catalog loads or guest mode is active
  useEffect(() => {
    if (!currentUser) {
      const stored = getStoredGuestCart();
      if (stored.length > 0) {
        setCart(buildCartResponseFromGuestItems(stored, allFoods));
      }
    }
  }, [allFoods, currentUser]);

  const handleLogout = async () => {
    await logoutUser();
    setCurrentUser(null);
    setProfile(null);
    setCart(null);
    clearStoredGuestCart();
    router.push("/");
  };

  const handleAddToCart = async (food: Food, quantity = 1) => {
    if (!currentUser) {
      const currentGuest = getStoredGuestCart();
      const existing = currentGuest.find(
        (it) => it.item_type === "food" && it.food_id === food.id
      );
      let updated: GuestCartItem[];
      if (existing) {
        updated = currentGuest.map((it) =>
          it.food_id === food.id ? { ...it, quantity: it.quantity + quantity } : it
        );
      } else {
        updated = [
          ...currentGuest,
          {
            id: `guest_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            item_type: "food",
            food_id: food.id,
            quantity,
          },
        ];
      }
      saveStoredGuestCart(updated);
      setCart(buildCartResponseFromGuestItems(updated, allFoods));
      setCartOpen(true);
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
      const currentGuest = getStoredGuestCart();
      const existing = currentGuest.find(
        (it) => it.item_type === "pack" && it.pack_tier === tier
      );
      let updated: GuestCartItem[];
      if (existing) {
        updated = currentGuest.map((it) =>
          it.pack_tier === tier ? { ...it, quantity: it.quantity + 1 } : it
        );
      } else {
        updated = [
          ...currentGuest,
          {
            id: `guest_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            item_type: "pack",
            pack_tier: tier,
            quantity: 1,
            customization,
          },
        ];
      }
      saveStoredGuestCart(updated);
      setCart(buildCartResponseFromGuestItems(updated, allFoods));
      setCartOpen(true);
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
      let currentGuest = getStoredGuestCart();
      for (const item of items) {
        const existing = currentGuest.find(
          (it) => it.item_type === "food" && it.food_id === item.food.id
        );
        if (existing) {
          currentGuest = currentGuest.map((it) =>
            it.food_id === item.food.id ? { ...it, quantity: it.quantity + item.quantity } : it
          );
        } else {
          currentGuest.push({
            id: `guest_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            item_type: "food",
            food_id: item.food.id,
            quantity: item.quantity,
          });
        }
      }
      saveStoredGuestCart(currentGuest);
      setCart(buildCartResponseFromGuestItems(currentGuest, allFoods));
      setCartOpen(true);
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

  const handleRemoveFromCart = async (itemId: string) => {
    if (!currentUser || itemId.startsWith("guest_")) {
      const currentGuest = getStoredGuestCart();
      const updated = currentGuest.filter((it) => it.id !== itemId);
      saveStoredGuestCart(updated);
      setCart(buildCartResponseFromGuestItems(updated));
    } else {
      try {
        await api(`/cart/items/${itemId}`, { method: "DELETE" });
        await refreshCart();
      } catch (err: any) {
        console.error("Failed to remove item from cart:", err);
      }
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
        handleRemoveFromCart,
        onAuthSuccess,
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
