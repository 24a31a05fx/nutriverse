"use client";

import React from "react";
import { Compass, Sparkles, Package, ScanLine, ShoppingBag, User } from "lucide-react";
import { ActiveTab } from "./AppHeader";
import { User as UserModel } from "@/lib/api";

interface BottomNavProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  cartCount: number;
  onOpenCart: () => void;
  currentUser: UserModel | null;
  onOpenAuth: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  cartCount,
  onOpenCart,
  currentUser,
  onOpenAuth,
}) => {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200 px-2 py-1.5 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]"
      style={{ paddingBottom: "max(0.375rem, env(safe-area-inset-bottom))" }}
      aria-label="Mobile Bottom Navigation"
    >
      <div className="flex items-center justify-around">
        {/* 1. Storefront */}
        <button
          type="button"
          onClick={() => onTabChange("storefront")}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition ${
            activeTab === "storefront"
              ? "text-[#143e2b] font-bold"
              : "text-gray-500 hover:text-gray-900 font-medium"
          }`}
        >
          <Compass className={`w-5 h-5 ${activeTab === "storefront" ? "text-[#236b48]" : ""}`} />
          <span className="text-[10px] mt-0.5">Shop</span>
        </button>

        {/* 2. Explorer */}
        <button
          type="button"
          onClick={() => onTabChange("explorer")}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition ${
            activeTab === "explorer"
              ? "text-[#143e2b] font-bold"
              : "text-gray-500 hover:text-gray-900 font-medium"
          }`}
        >
          <Sparkles className={`w-5 h-5 ${activeTab === "explorer" ? "text-[#236b48]" : ""}`} />
          <span className="text-[10px] mt-0.5">Nutrients</span>
        </button>

        {/* 3. Calin Packs */}
        <button
          type="button"
          onClick={() => onTabChange("packs")}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition ${
            activeTab === "packs"
              ? "text-[#143e2b] font-bold"
              : "text-gray-500 hover:text-gray-900 font-medium"
          }`}
        >
          <Package className={`w-5 h-5 ${activeTab === "packs" ? "text-[#236b48]" : ""}`} />
          <span className="text-[10px] mt-0.5">Packs</span>
        </button>

        {/* 4. Scanner */}
        <button
          type="button"
          onClick={() => onTabChange("scanner")}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition ${
            activeTab === "scanner"
              ? "text-[#143e2b] font-bold"
              : "text-gray-500 hover:text-gray-900 font-medium"
          }`}
        >
          <ScanLine className={`w-5 h-5 ${activeTab === "scanner" ? "text-[#236b48]" : ""}`} />
          <span className="text-[10px] mt-0.5">Scan</span>
        </button>

        {/* 5. Cart / Bag */}
        <button
          type="button"
          onClick={onOpenCart}
          className="relative flex flex-col items-center justify-center py-1 px-2 rounded-xl text-gray-500 hover:text-gray-900 font-medium transition"
        >
          <div className="relative">
            <ShoppingBag className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-[#236b48] text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-0.5">Bag</span>
        </button>

        {/* 6. Account */}
        <button
          type="button"
          onClick={() => {
            if (currentUser) {
              onTabChange("dashboard");
            } else {
              onOpenAuth();
            }
          }}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition ${
            activeTab === "dashboard"
              ? "text-[#143e2b] font-bold"
              : "text-gray-500 hover:text-gray-900 font-medium"
          }`}
        >
          <User className={`w-5 h-5 ${activeTab === "dashboard" ? "text-[#236b48]" : ""}`} />
          <span className="text-[10px] mt-0.5">{currentUser ? "Account" : "Sign In"}</span>
        </button>
      </div>
    </nav>
  );
};
