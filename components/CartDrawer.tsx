"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Trash2, ShoppingBag, ArrowRight, ShieldCheck, CheckCircle2, Truck, AlertCircle, RefreshCw } from "lucide-react";
import { CartResponse, CartItemModel, api, formatPaise, money } from "@/lib/api";
import { useNutriverse } from "@/components/NutriverseProvider";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartResponse | null;
  onRefreshCart: () => void;
  onOrderPlaced: (orderId: string) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  cart,
  onRefreshCart,
  onOrderPlaced,
}) => {
  const router = useRouter();
  const { currentUser, setAuthModalOpen, handleRemoveFromCart } = useNutriverse();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderConfirmation, setOrderConfirmation] = useState<any | null>(null);

  // Checkout address form state
  const [fullName, setFullName] = useState("Alex Mercer");
  const [phone, setPhone] = useState("+91 98765 43210");
  const [street, setStreet] = useState("Flat 402, Green Glen Layout, Outer Ring Road");
  const [city, setCity] = useState("Bengaluru");
  const [state, setState] = useState("Karnataka");
  const [pincode, setPincode] = useState("560103");
  const [notes, setNotes] = useState("Please leave at security front desk if unavailable.");

  if (!isOpen) return null;

  const handleRemove = async (itemId: string) => {
    try {
      await handleRemoveFromCart(itemId);
      onRefreshCart();
    } catch (err: any) {
      setError(err?.message || "Failed to remove item.");
    }
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        address: {
          full_name: fullName,
          phone,
          street,
          city,
          state,
          pincode,
        },
        delivery_notes: notes,
      };

      const result = await api<any>("/orders/checkout", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setOrderConfirmation(result);
      onRefreshCart();
      onOrderPlaced(result.order_id);
    } catch (err: any) {
      setError(err?.message || "Checkout failed. Please verify stock availability.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="drawer-overlay fixed inset-0 z-50 overflow-hidden bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-content w-screen max-w-md bg-white shadow-2xl flex flex-col border-l border-gray-100">
          {/* Header */}
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-white/95">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-emerald-600" />
              <h2 className="text-base font-bold text-gray-900">Your Nutrition Bag</h2>
              {cart && cart.items.length > 0 && (
                <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
                  {cart.items.reduce((s, i) => s + i.quantity, 0)} items
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {orderConfirmation ? (
              /* Order Confirmation Screen */
              <div className="py-8 text-center space-y-5 animate-in fade-in">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full">
                    Demonstration Order Confirmed
                  </span>
                  <h3 className="text-xl font-bold text-gray-900 mt-2">Order #{orderConfirmation.order_id.slice(0, 8)}</h3>
                  <p className="text-xs text-gray-600 mt-1 max-w-xs mx-auto">
                    Persisted in the database. Delivery partner dispatch queued under Demonstration fulfillment pipeline.
                  </p>
                </div>

                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 text-left text-xs space-y-2">
                  <div className="flex justify-between text-gray-600">
                    <span>Order Status:</span>
                    <span className="font-semibold text-emerald-700 uppercase">{orderConfirmation.status}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Total Amount:</span>
                    <span className="font-bold text-gray-900">{formatPaise(orderConfirmation.total_paise)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Delivery Address:</span>
                    <span className="font-medium text-gray-800">{orderConfirmation.delivery_address.city}, {orderConfirmation.delivery_address.pincode}</span>
                  </div>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-left text-[11px] text-blue-800 space-y-1">
                  <p className="font-semibold">Live Status Tracking Active:</p>
                  <p>
                    You can inspect and track this order in your <strong>Customer Dashboard</strong>. Store administrators can also update this order in the <strong>Admin Portal</strong>.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setOrderConfirmation(null);
                    setIsCheckingOut(false);
                    onClose();
                  }}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow transition"
                >
                  View In Customer Dashboard
                </button>
              </div>
            ) : isCheckingOut ? (
              /* Demonstration Checkout Form */
              <form onSubmit={handleCheckoutSubmit} className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                  <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                    Demonstration Delivery Address
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsCheckingOut(false)}
                    className="text-xs text-emerald-700 hover:underline"
                  >
                    Back to Bag
                  </button>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Recipient Name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Contact Phone</label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Street Address</label>
                  <input
                    type="text"
                    required
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">City</label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-gray-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">State</label>
                    <input
                      type="text"
                      required
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-gray-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">Pincode</label>
                    <input
                      type="text"
                      required
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-gray-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Delivery Instructions</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200"
                  />
                </div>

                {/* Demonstration Notice */}
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-950">
                    <ShieldCheck className="w-4 h-4 text-amber-600" /> Demonstration Checkout Mode
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Zero payment gateway credentials requested. When you click below, this order will be saved directly into the PostgreSQL/SQLite database with state &quot;placed&quot;.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-md transition flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Persisting Order...
                    </>
                  ) : (
                    <>Confirm & Place Demo Order ({cart ? formatPaise(cart.total_paise) : "—"})</>
                  )}
                </button>
              </form>
            ) : (
              /* Itemized Cart View */
              <>
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                    {error}
                  </div>
                )}

                {(!cart || cart.items.length === 0) ? (
                  <div className="py-24 text-center space-y-3">
                    <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto" />
                    <p className="text-sm font-semibold text-gray-900">Your bag is currently empty</p>
                    <p className="text-xs text-gray-600 max-w-xs mx-auto">
                      Explore our nutrition categories, build a Calin Pack, or scan foods to start filling your bag.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cart.items.map((item) => (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-xl border border-gray-100 hover:border-gray-200 bg-gray-50/50 flex items-start justify-between gap-3 transition"
                      >
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-1.5">
                            {item.item_type === "pack" ? (
                              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                                Calin Pack
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                                {item.category || "Grocery"}
                              </span>
                            )}
                          </div>
                          <h4 className="text-xs font-bold text-gray-900">{item.name}</h4>
                          <p className="text-[11px] text-gray-600">
                            Qty: {item.quantity} × {formatPaise(item.unit_price_paise)}
                          </p>
                          {item.customization && item.customization.tier && (
                            <p className="text-[10px] text-purple-700 italic">
                              Customized tier with {item.customization.item_count || "curated"} foods
                            </p>
                          )}
                        </div>

                        <div className="text-right space-y-2">
                          <span className="text-xs font-bold text-gray-900 block">
                            {formatPaise(item.total_paise)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemove(item.id)}
                            className="text-gray-400 hover:text-red-600 transition p-1"
                            title="Remove"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Drawer Footer / Totals */}
          {cart && cart.items.length > 0 && !orderConfirmation && !isCheckingOut && (
            <div className="p-6 border-t border-gray-100 bg-gray-50/50 space-y-4">
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>Bag Subtotal:</span>
                  <span className="font-semibold text-gray-900">{formatPaise(cart.subtotal_paise)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span className="flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5" /> Delivery:
                  </span>
                  <span className="font-semibold text-gray-900">
                    {cart.delivery_fee_paise === 0 ? "FREE" : formatPaise(cart.delivery_fee_paise)}
                  </span>
                </div>
                <div className="pt-2 border-t border-gray-200 flex justify-between text-sm font-bold text-gray-900">
                  <span>Total Payable:</span>
                  <span className="text-emerald-700">{formatPaise(cart.total_paise)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!currentUser) {
                    onClose();
                    router.push("/checkout");
                    setAuthModalOpen(true);
                  } else {
                    setIsCheckingOut(true);
                  }
                }}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-md transition flex items-center justify-center gap-2"
              >
                Proceed to Checkout <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
