"use client";

import React, { useState, useEffect } from "react";
import { User, AdminStats, OrderModel, NutritionistRequestModel, api, formatPaise, money } from "@/lib/api";
import { ShieldCheck, Package, AlertTriangle, Users, Calendar, CheckCircle, RefreshCw, Send, ChevronRight, FileText } from "lucide-react";

interface AdminPortalProps {
  user: User | null;
  onRefreshGlobal?: () => void;
}

export const AdminPortalView: React.FC<AdminPortalProps> = ({ user, onRefreshGlobal }) => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [orders, setOrders] = useState<OrderModel[]>([]);
  const [nutritionistQueue, setNutritionistQueue] = useState<NutritionistRequestModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  // Review submission state
  const [selectedReqId, setSelectedReqId] = useState<string | null>(null);
  const [guidanceText, setGuidanceText] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const fetchAdminData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsData, ordersData, reqsData] = await Promise.all([
        api<AdminStats>("/admin/stats").catch(() => null),
        api<OrderModel[]>("/orders"),
        api<NutritionistRequestModel[]>("/nutritionist/requests"),
      ]);
      if (statsData) setStats(statsData);
      setOrders(ordersData);
      setNutritionistQueue(reqsData);
    } catch (err: any) {
      setError(err?.message || "Failed to load administrative console data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [user]);

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    setUpdatingOrderId(orderId);
    try {
      await api(`/admin/orders/${orderId}/status`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      });
      await fetchAdminData();
      if (onRefreshGlobal) onRefreshGlobal();
    } catch (err: any) {
      alert(err?.message || "Failed to update order status");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleSubmitReview = async (reqId: string) => {
    if (!guidanceText.trim()) return;
    setSubmittingReview(true);
    try {
      await api(`/nutritionist/requests/${reqId}/review`, {
        method: "POST",
        body: JSON.stringify({ guidance_notes: guidanceText.trim() }),
      });
      setGuidanceText("");
      setSelectedReqId(null);
      await fetchAdminData();
    } catch (err: any) {
      alert(err?.message || "Failed to submit nutritionist guidance");
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Admin Header */}
      <div className="bg-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800 text-emerald-400 text-xs font-bold rounded-full mb-3 uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" /> Operations & Nutritionist Console
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold">Nutriverse Control Center</h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mt-1">
            Signed in as <strong>{user?.name}</strong> ({user?.role?.toUpperCase()}). Manage live order lifecycles, stock alerts, and certified nutritionist review queues.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchAdminData}
          className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition flex items-center gap-2 self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh Telemetry
        </button>
      </div>

      {error && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800">
          Notice: {error} (Admin features require administrator or nutritionist credential tokens).
        </div>
      )}

      {/* Stats Counter Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-1">
            <span className="text-xs font-semibold text-gray-600 block">Catalog Foods</span>
            <span className="text-2xl font-black text-gray-900">{stats.counts.products}</span>
            <span className="text-[10px] text-gray-600 block">Verified items</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-1">
            <span className="text-xs font-semibold text-gray-600 block">Total Orders</span>
            <span className="text-2xl font-black text-emerald-700">{stats.counts.orders}</span>
            <span className="text-[10px] text-gray-600 block">Persisted records</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-1">
            <span className="text-xs font-semibold text-gray-600 block">Subscriptions</span>
            <span className="text-2xl font-black text-purple-700">{stats.counts.subscriptions}</span>
            <span className="text-[10px] text-gray-600 block">Active pack schedules</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-1">
            <span className="text-xs font-semibold text-gray-600 block">Nutritionist Queue</span>
            <span className="text-2xl font-black text-teal-700">{stats.counts.pending_nutritionist_reviews}</span>
            <span className="text-[10px] text-gray-600 block">Pending review</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-1">
            <span className="text-xs font-semibold text-gray-600 block">Stock Watch</span>
            <span className="text-2xl font-black text-amber-600">{stats.low_stock_alerts.length}</span>
            <span className="text-[10px] text-amber-600 block">Low stock items</span>
          </div>
        </div>
      )}

      {/* Main Split: Order Lifecycle Management & Nutritionist Queue */}
      <div className="grid lg:grid-cols-12 gap-8 items-start">
        {/* Left: Orders Management */}
        <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                Store Order Fulfillment Pipeline
              </h2>
            </div>
            <span className="text-xs text-gray-600 font-mono">
              {orders.length} Total Orders
            </span>
          </div>

          {orders.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-600">
              No customer orders in database yet.
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="p-4 rounded-2xl border border-gray-100 bg-gray-50/50 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-900">
                          Order #{order.id.slice(0, 8)}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          Demo order only
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-600">
                        Placed {new Date(order.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>

                    {/* Order Status Selector */}
                    <div className="flex items-center gap-2">
                      <select
                        value={order.status}
                        disabled={updatingOrderId === order.id}
                        onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                        className="px-3 py-1.5 text-xs font-bold rounded-xl border border-gray-200 bg-white text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      >
                        <option value="placed_demo">Placed (Demo)</option>
                        <option value="preparing_demo">Preparing (Demo)</option>
                        <option value="completed_demo">Completed (Demo)</option>
                        <option value="cancelled_demo">Cancelled (Demo)</option>
                        <option value="placed">Placed</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="preparing">Preparing</option>
                        <option value="out_for_delivery">Out for Delivery</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                      <span className="text-xs font-bold text-emerald-900">
                        {formatPaise(order.total_paise)}
                      </span>
                    </div>
                  </div>

                  {/* Summary of Items */}
                  <div className="text-[11px] text-gray-700 space-y-1 bg-white p-3 rounded-xl border border-gray-100">
                    <p className="font-semibold text-gray-800">Contents:</p>
                    {order.items.map((it: any, i: number) => (
                      <div key={i} className="flex justify-between text-gray-600">
                        <span>• {it.name} ({it.item_type})</span>
                        <span>Qty: {it.quantity}</span>
                      </div>
                    ))}
                    <div className="pt-1.5 border-t border-gray-100 text-[10px] text-gray-600 flex justify-between">
                      <span>Delivery: {order.delivery_address?.city}, {order.delivery_address?.pincode}</span>
                      <span>Demo Mode</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Nutritionist Review Queue */}
        <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-teal-600" />
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                Nutritionist Review Queue
              </h2>
            </div>
            <span className="text-xs text-teal-700 font-bold bg-teal-50 px-2.5 py-0.5 rounded-full">
              {nutritionistQueue.filter((r) => r.status === "pending").length} Pending
            </span>
          </div>

          {nutritionistQueue.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-600">
              No nutritionist customization requests submitted.
            </div>
          ) : (
            <div className="space-y-4">
              {nutritionistQueue.map((req) => (
                <div
                  key={req.id}
                  className={`p-4 rounded-2xl border transition space-y-3 ${
                    req.status === "pending"
                      ? "border-amber-200 bg-amber-50/30"
                      : "border-gray-100 bg-gray-50/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-gray-900">{req.user_name}</h4>
                      <p className="text-[10px] text-gray-600">Tier: {req.pack_tier.toUpperCase()}</p>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        req.status === "reviewed"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>

                  <p className="text-xs text-gray-700 italic bg-white p-2.5 rounded-xl border border-gray-100">
                    &quot;{req.customer_notes}&quot;
                  </p>

                  {req.status === "reviewed" ? (
                    <div className="p-3 bg-emerald-50/60 rounded-xl text-xs space-y-1 text-emerald-900">
                      <p className="font-semibold text-[11px]">Completed by {req.nutritionist_name}:</p>
                      <p className="text-[11px] text-gray-700">{req.guidance_notes}</p>
                    </div>
                  ) : selectedReqId === req.id ? (
                    <div className="space-y-2 pt-1">
                      <textarea
                        rows={3}
                        value={guidanceText}
                        onChange={(e) => setGuidanceText(e.target.value)}
                        placeholder="Provide evidence-based nutritional guidance and pack adjustments..."
                        className="w-full p-2.5 text-xs rounded-xl border border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedReqId(null);
                            setGuidanceText("");
                          }}
                          className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={submittingReview || !guidanceText.trim()}
                          onClick={() => handleSubmitReview(req.id)}
                          className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition flex items-center gap-1.5"
                        >
                          <Send className="w-3 h-3" />
                          {submittingReview ? "Submitting..." : "Send Nutritional Guidance"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedReqId(req.id);
                        setGuidanceText(
                          `Calin ${req.pack_tier.toUpperCase()} reviewed. Based on your dietary context, pairing with Vitamin C will optimize non-heme iron absorption. All allergens cleared.`
                        );
                      }}
                      className="w-full py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl transition"
                    >
                      Author Guidance Response
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
