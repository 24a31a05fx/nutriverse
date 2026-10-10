"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShoppingBag,
  Trash2,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  ChevronLeft,
  Package,
} from "lucide-react";
import { useNutriverse } from "@/components/NutriverseProvider";
import { api, money } from "@/lib/api";

export default function CartPageClient() {
  const router = useRouter();
  const { cart, refreshCart, currentUser, setAuthModalOpen, handleRemoveFromCart } = useNutriverse();

  const handleRemove = async (itemId: string) => {
    try {
      await handleRemoveFromCart(itemId);
    } catch (err: any) {
      alert(err?.message || "Failed to remove item");
    }
  };

  const hasItems = cart && cart.items.length > 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 animate-in fade-in">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/explore"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 hover:text-emerald-950 transition mb-2"
          >
            <ChevronLeft className="w-4 h-4" /> Continue Shopping
          </Link>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2.5">
            <ShoppingBag className="w-6 h-6 text-emerald-700" /> Your Nutrition Bag
          </h1>
        </div>

        {hasItems && (
          <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
            {cart.items.reduce((s, i) => s + i.quantity, 0)} items
          </span>
        )}
      </div>

      {!hasItems ? (
        <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center shadow-sm space-y-4">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <h2 className="text-base font-bold text-gray-900">Your bag is currently empty</h2>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Discover macro and micronutrient dense whole foods or select a tailored Calin Pack bundle.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              href="/explore"
              className="px-5 py-2.5 rounded-full bg-emerald-800 text-white text-xs font-bold shadow-md hover:bg-emerald-900 transition"
            >
              Explore Foods
            </Link>
            <Link
              href="/packs"
              className="px-5 py-2.5 rounded-full bg-emerald-50 text-emerald-900 text-xs font-bold border border-emerald-200 hover:bg-emerald-100 transition"
            >
              Calin Packs
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Items List */}
          <div className="md:col-span-8 bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Bag Items ({cart.items.length})
            </h2>

            <div className="divide-y divide-gray-100">
              {cart.items.map((item) => (
                <div
                  key={item.id}
                  className="py-4 flex items-center justify-between gap-4 first:pt-0 last:pb-0"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-gray-900">{item.name}</span>
                      <span className="text-[10px] font-bold uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        {item.item_type}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {money(item.unit_price_inr)} × {item.quantity} {item.unit || "unit"}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="font-black text-sm text-gray-900">{money(item.total_inr)}</span>
                    <button
                      type="button"
                      onClick={() => handleRemove(item.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded-full hover:bg-red-50 transition"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bill Summary & Proceed */}
          <div className="md:col-span-4 bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-5">
            <h2 className="text-sm font-bold text-gray-900">Order Summary</h2>

            <div className="space-y-2.5 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>Items Subtotal:</span>
                <span className="font-bold text-gray-900">{money(cart.subtotal_inr)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Delivery (Vijayawada):</span>
                {cart.delivery_fee_inr === 0 ? (
                  <span className="font-bold text-emerald-700">FREE</span>
                ) : (
                  <span className="font-bold text-gray-900">{money(cart.delivery_fee_inr)}</span>
                )}
              </div>
              {cart.subtotal_inr < 800 && (
                <p className="text-[10px] text-emerald-800 bg-emerald-50/70 p-2 rounded-xl">
                  Add {money(800 - cart.subtotal_inr)} more for free express 15–30 min delivery!
                </p>
              )}
              <div className="pt-3 border-t border-gray-100 flex justify-between text-sm">
                <span className="font-black text-gray-900">Total Payable:</span>
                <span className="font-black text-emerald-950">{money(cart.total_inr)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (!currentUser) {
                  router.push("/checkout");
                  setAuthModalOpen(true);
                } else {
                  router.push("/checkout");
                }
              }}
              className="w-full py-3.5 px-6 rounded-2xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold shadow-lg shadow-emerald-900/20 transition flex items-center justify-center gap-2"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
