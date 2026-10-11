"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  MapPin,
  Phone,
  User as UserIcon,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  Lock,
} from "lucide-react";
import { useNutriverse } from "@/components/NutriverseProvider";
import { api, formatPaise, money } from "@/lib/api";

export default function CheckoutPageClient() {
  const router = useRouter();
  const { cart, refreshCart, currentUser, setAuthModalOpen } = useNutriverse();

  const [fullName, setFullName] = useState(currentUser?.name || "Alex Mercer");
  const [phone, setPhone] = useState("+91 98490 12345");
  const [street, setStreet] = useState("Flat 402, Green Meadows, MG Road");
  const [city, setCity] = useState("Vijayawada");
  const [state, setState] = useState("Andhra Pradesh");
  const [pincode, setPincode] = useState("520010");
  const [notes, setNotes] = useState("Please ring doorbell twice.");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (currentUser?.name) {
      setFullName(currentUser.name);
    }
  }, [currentUser]);

  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-5 animate-in fade-in">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
          <Lock className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Sign In Required for Checkout</h1>
          <p className="text-xs text-gray-500 mt-1">
            Please sign in to link your delivery address and track real-time dispatch.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAuthModalOpen(true)}
          className="w-full py-3 rounded-full bg-emerald-800 text-white text-xs font-bold hover:bg-emerald-900 transition shadow-md"
        >
          Sign In / Create Account
        </button>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="text-base font-bold text-gray-900">Your shopping bag is empty</h2>
        <p className="text-xs text-gray-500">Add products or Calin Packs before checkout.</p>
        <Link
          href="/explore"
          className="inline-flex px-5 py-2.5 rounded-full bg-emerald-800 text-white text-xs font-bold"
        >
          Explore Catalog
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        address: {
          label: "Home",
          line1: street,
          street,
          city,
          state,
          postal_code: pincode,
          pincode,
          full_name: fullName,
          phone,
        },
        delivery_notes: notes,
      };

      const result = await api<any>("/orders/checkout", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      await refreshCart();
      router.push(`/orders/${result.order_id}`);
    } catch (err: any) {
      setError(err?.message || "Checkout failed. Please verify stock availability.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 animate-in fade-in">
      <div>
        <Link
          href="/cart"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 hover:text-emerald-950 transition mb-2"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Bag
        </Link>
        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-emerald-700" /> Express Checkout (Vijayawada)
        </h1>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Left Column: Delivery Address Form */}
        <div className="md:col-span-7 bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-600" /> Delivery Address
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Phone Number</label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Street / House / Landmark</label>
            <input
              type="text"
              required
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">City</label>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">State</label>
              <input
                type="text"
                required
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Pincode</label>
              <input
                type="text"
                required
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Delivery Instructions (Optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              placeholder="Gate code, landmark, or delivery preferences"
            />
          </div>
        </div>

        {/* Right Column: Order Review & Payment Mode */}
        <div className="md:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-gray-900">Items Summary</h2>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {cart.items.map((item) => (
                <div key={item.id} className="flex justify-between text-xs py-1 border-b border-gray-50">
                  <span className="text-gray-700">
                    {item.name} × {item.quantity}
                  </span>
                  <span className="font-bold text-gray-900">{formatPaise(item.total_paise)}</span>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-gray-100 space-y-2 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-bold text-gray-900">{formatPaise(cart.subtotal_paise)}</span>
              </div>
              <div className="flex justify-between">
                <span>Delivery:</span>
                <span className="font-bold text-emerald-700">
                  {cart.delivery_fee_paise === 0 ? "FREE" : formatPaise(cart.delivery_fee_paise)}
                </span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-gray-100">
                <span className="font-black text-gray-900">Total Payable:</span>
                <span className="font-black text-emerald-950">{formatPaise(cart.total_paise)}</span>
              </div>
            </div>
          </div>

          <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-3xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-800" />
              <span className="text-xs font-bold text-emerald-950">Payment Mode: Demonstration Gateway</span>
            </div>
            <p className="text-[11px] text-emerald-800 leading-relaxed">
              Order fulfillment is simulated with instant dispatch confirmation. No real credit card charge occurs during local demonstration mode.
            </p>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 px-6 rounded-2xl bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white text-xs font-bold shadow-lg transition flex items-center justify-center gap-2"
            >
              {submitting ? "Placing Order..." : `Confirm & Place Order (${formatPaise(cart.total_paise)})`}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
