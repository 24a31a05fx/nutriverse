"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Package,
  Clock,
  CheckCircle2,
  ChevronLeft,
  Truck,
  MapPin,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { OrderModel, api, formatPaise, money } from "@/lib/api";

const statusSteps = [
  { id: "placed", label: "Order Placed" },
  { id: "confirmed", label: "Confirmed" },
  { id: "preparing", label: "In Prep" },
  { id: "out_for_delivery", label: "Out for Delivery" },
  { id: "delivered", label: "Delivered" },
];

export default function OrderDetailClient({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<OrderModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrder = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api<OrderModel>(`/orders/${orderId}`);
        setOrder(data);
      } catch (err: any) {
        setError(err?.message || "Order not found or access unauthorized.");
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [orderId]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center text-xs text-gray-400">
        Loading live tracking details...
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
        <h2 className="text-base font-bold text-gray-900">Order Tracking Unavailable</h2>
        <p className="text-xs text-gray-500">{error || "Could not retrieve order details."}</p>
        <Link
          href="/orders"
          className="inline-flex px-5 py-2.5 rounded-full bg-emerald-800 text-white text-xs font-bold"
        >
          Back to Orders
        </Link>
      </div>
    );
  }

  const currentStepIdx = statusSteps.findIndex((s) => s.id === order.status);
  const address = order.delivery_address || {};

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 animate-in fade-in">
      <div>
        <Link
          href="/orders"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 hover:text-emerald-950 transition mb-2"
        >
          <ChevronLeft className="w-4 h-4" /> Back to All Orders
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-black text-gray-900">
              Order #{order.id.slice(0, 8)}
            </h1>
            <p className="text-xs text-gray-500">
              Placed on {new Date(order.created_at).toLocaleString("en-IN", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          </div>
          <span className="self-start sm:self-auto px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wider">
            {order.status.replace(/_/g, " ")}
          </span>
        </div>
      </div>

      {/* Progress Pipeline */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-2">
          <Truck className="w-4 h-4 text-emerald-600" /> Fulfillment Timeline (Vijayawada Express 15–30m)
        </h2>

        <div className="grid grid-cols-5 gap-2 text-center">
          {statusSteps.map((step, idx) => {
            const isCompleted = idx <= currentStepIdx;
            const isCurrent = idx === currentStepIdx;
            return (
              <div key={step.id} className="space-y-2">
                <div
                  className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center text-xs font-bold transition shadow-sm ${
                    isCompleted
                      ? "bg-emerald-800 text-white"
                      : "bg-gray-100 text-gray-400"
                  } ${isCurrent ? "ring-4 ring-emerald-200" : ""}`}
                >
                  {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                </div>
                <span
                  className={`text-[10px] sm:text-xs block font-bold ${
                    isCompleted ? "text-emerald-950" : "text-gray-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Itemized Order List */}
        <div className="md:col-span-7 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-gray-900">
            Package Contents ({order.items?.length || 0} items)
          </h2>

          <div className="divide-y divide-gray-100">
            {order.items?.map((it: any, idx: number) => (
              <div key={idx} className="py-3 flex justify-between items-center text-xs first:pt-0 last:pb-0">
                <div>
                  <span className="font-bold text-gray-900 block">{it.name}</span>
                  <span className="text-[10px] text-gray-500">
                    Qty: {it.quantity} • {formatPaise(it.unit_price_paise ?? (it.unit_price_inr ? it.unit_price_inr * 100 : 0))} each
                  </span>
                </div>
                <span className="font-bold text-gray-900">
                  {formatPaise((it.unit_price_paise ?? (it.unit_price_inr ? it.unit_price_inr * 100 : 0)) * it.quantity)}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-gray-100 space-y-1.5 text-xs text-gray-600">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-bold text-gray-900">{formatPaise(order.subtotal_paise ?? (order.subtotal_inr ? order.subtotal_inr * 100 : 0))}</span>
            </div>
            <div className="flex justify-between">
              <span>Delivery Fee:</span>
              <span className="font-bold text-emerald-700">
                {(order.delivery_fee_paise === 0 || order.delivery_fee_inr === 0) ? "FREE" : formatPaise(order.delivery_fee_paise ?? (order.delivery_fee_inr ? order.delivery_fee_inr * 100 : 0))}
              </span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-gray-100">
              <span className="font-black text-gray-900">Total Paid:</span>
              <span className="font-black text-emerald-950">{formatPaise(order.total_paise ?? (order.total_inr ? order.total_inr * 100 : 0))}</span>
            </div>
          </div>
        </div>

        {/* Delivery Address Card */}
        <div className="md:col-span-5 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-3 text-xs">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-600" /> Delivery Destination
          </h2>

          <div className="space-y-1 text-gray-600">
            <p className="font-bold text-gray-900">{address.full_name || "Customer"}</p>
            <p>{address.phone}</p>
            <p>{address.street}</p>
            <p>
              {address.city}, {address.state} — {address.pincode}
            </p>
          </div>

          <div className="pt-3 border-t border-gray-100 text-[11px] text-emerald-800 bg-emerald-50/60 p-3 rounded-2xl">
            <strong>Demonstration Dispatch:</strong> Our electric rider fleet dispatches from the Vijayawada fulfillment micro-hub.
          </div>
        </div>
      </div>
    </div>
  );
}
