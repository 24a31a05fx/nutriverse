"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Package,
  Clock,
  ChevronRight,
  ShoppingBag,
  CheckCircle2,
  AlertCircle,
  Lock,
} from "lucide-react";
import { useNutriverse } from "@/components/NutriverseProvider";
import { OrderModel, api, money } from "@/lib/api";

export default function OrdersPageClient() {
  const { currentUser, setAuthModalOpen } = useNutriverse();
  const [orders, setOrders] = useState<OrderModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    const fetchOrders = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api<OrderModel[]>("/orders");
        setOrders(data);
      } catch (err: any) {
        setError(err?.message || "Failed to load orders");
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, [currentUser]);

  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-5">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
          <Lock className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">Sign In to View Orders</h1>
        <p className="text-xs text-gray-500">
          Your order history is securely saved under your Nutriverse account.
        </p>
        <button
          type="button"
          onClick={() => setAuthModalOpen(true)}
          className="w-full py-3 rounded-full bg-emerald-800 text-white text-xs font-bold hover:bg-emerald-900 transition shadow-md"
        >
          Sign In
        </button>
      </div>
    );
  }

  const getBadge = (status: string) => {
    switch (status) {
      case "placed":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Placed</span>;
      case "confirmed":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">Confirmed</span>;
      case "preparing":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">In Prep</span>;
      case "out_for_delivery":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">Out for Delivery</span>;
      case "delivered":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Delivered</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-50 text-gray-700 border border-gray-200">{status}</span>;
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 animate-in fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Your Orders</h1>
          <p className="text-xs text-gray-500 mt-1">
            Track past and live nutrition deliveries in Vijayawada.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-xs text-gray-400">Loading order records...</div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center shadow-sm space-y-3">
          <Package className="w-10 h-10 text-gray-400 mx-auto" />
          <h3 className="text-sm font-bold text-gray-900">No orders placed yet</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Place your first nutrition grocery order or customize a weekly Calin Pack.
          </p>
          <Link
            href="/explore"
            className="inline-flex px-5 py-2.5 rounded-full bg-emerald-800 text-white text-xs font-bold mt-2"
          >
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <Link
              key={o.id}
              href={`/orders/${o.id}`}
              className="block p-5 bg-white hover:bg-emerald-50/30 rounded-3xl border border-gray-100 hover:border-emerald-200 transition group shadow-sm"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-gray-900">
                      Order #{o.id.slice(0, 8)}
                    </span>
                    {getBadge(o.status)}
                  </div>
                  <p className="text-xs text-gray-500">
                    {new Date(o.created_at).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })} • {o.items?.length || 0} items
                  </p>
                </div>

                <div className="flex items-center gap-4 justify-between sm:justify-end">
                  <span className="text-sm font-black text-emerald-950">{money(o.total_inr)}</span>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-emerald-700 transition" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
