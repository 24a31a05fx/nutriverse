"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { User, NutritionProfile, OrderModel, SubscriptionModel, NutritionistRequestModel, api, formatPaise, money } from "@/lib/api";
import { Activity, Package, Calendar, Clock, UserCheck, CheckCircle2, AlertCircle, RefreshCw, ChevronRight, Pause, Play, XCircle } from "lucide-react";

interface CustomerDashboardProps {
  user: User | null;
  profile: NutritionProfile | null;
  onOpenOnboarding: () => void;
  onNavigateTab: (tab: string) => void;
}

export const CustomerDashboardView: React.FC<CustomerDashboardProps> = ({
  user,
  profile,
  onOpenOnboarding,
  onNavigateTab,
}) => {
  const [orders, setOrders] = useState<OrderModel[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionModel[]>([]);
  const [nutritionistRequests, setNutritionistRequests] = useState<NutritionistRequestModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingSubId, setUpdatingSubId] = useState<string | null>(null);
  const [confirmedProposals, setConfirmedProposals] = useState<Record<string, "accepted" | "declined">>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem("nutriverse_nutritionist_decisions");
      if (saved) setConfirmedProposals(JSON.parse(saved));
    } catch {}
  }, []);

  const handleDecision = (id: string, decision: "accepted" | "declined") => {
    const updated = { ...confirmedProposals, [id]: decision };
    setConfirmedProposals(updated);
    try {
      localStorage.setItem("nutriverse_nutritionist_decisions", JSON.stringify(updated));
    } catch {}
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordersData, subsData, reqsData] = await Promise.all([
        api<OrderModel[]>("/orders"),
        api<SubscriptionModel[]>("/subscriptions"),
        api<NutritionistRequestModel[]>("/nutritionist/requests"),
      ]);
      setOrders(ordersData);
      setSubscriptions(subsData);
      setNutritionistRequests(reqsData);
    } catch (err: any) {
      setError(err?.message || "Failed to load customer records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const handleSubStatusChange = async (subId: string, newStatus: "active" | "paused" | "cancelled") => {
    setUpdatingSubId(subId);
    try {
      await api(`/subscriptions/${subId}/status?status_val=${newStatus}`, { method: "PUT" });
      await fetchDashboardData();
    } catch (err: any) {
      alert(err?.message || "Failed to update subscription status");
    } finally {
      setUpdatingSubId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "placed_demo":
      case "placed":
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">Placed (Demo)</span>;
      case "confirmed":
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">Confirmed</span>;
      case "preparing_demo":
      case "preparing":
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">In Prep (Demo)</span>;
      case "out_for_delivery":
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">Out for Delivery</span>;
      case "completed_demo":
      case "delivered":
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Completed (Demo)</span>;
      case "cancelled_demo":
      case "cancelled":
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200">Cancelled (Demo)</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-gray-50 text-gray-700 border border-gray-200">{status}</span>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Welcome & Overview Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-teal-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="inline-block px-3 py-1 bg-emerald-800/80 text-emerald-200 text-xs font-semibold rounded-full uppercase tracking-wider">
              Nutriverse Member Hub
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold">
              Welcome back, {user ? user.name : "Nourished Member"}
            </h1>
            <p className="text-xs sm:text-sm text-emerald-200/90 max-w-xl">
              Track your personalized calorie baseline, active Calin Pack recurring deliveries, demonstration orders, and certified nutritionist notes.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <Link
              href="/today"
              className="px-4 py-2.5 bg-emerald-700/80 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <Calendar className="w-4 h-4 text-emerald-200" />
              Today&apos;s Targets
            </Link>
            <button
              type="button"
              onClick={onOpenOnboarding}
              className="px-4 py-2.5 bg-white text-emerald-900 hover:bg-emerald-50 rounded-xl text-xs font-bold shadow transition flex items-center gap-1.5"
            >
              <Activity className="w-4 h-4 text-emerald-700" />
              {profile ? "Recalibrate Nutrition Profile" : "Complete Profile"}
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab("explorer")}
              className="px-4 py-2.5 bg-emerald-800/70 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              Browse Catalog <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Biometric & Calorie Target Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-1">
          <span className="text-xs font-semibold text-gray-600 block">Estimated Daily Expenditure</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-gray-900">
              {profile ? profile.calorie_target : "2,050"}
            </span>
            <span className="text-xs text-gray-600 font-medium">kcal/day</span>
          </div>
          <p className="text-[11px] text-gray-600">
            {profile ? `BMR: ${profile.bmr} kcal • ${profile.activity_level}× activity` : "Based on default reference profile"}
          </p>
          <span className="inline-block text-[10px] text-amber-800 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-full font-medium mt-1">
            Estimate, not medical advice
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-1">
          <span className="text-xs font-semibold text-gray-600 block">Dietary Preference</span>
          <span className="text-base font-bold text-emerald-900 truncate block">
            {profile?.food_preferences || "Plant-Forward"}
          </span>
          <p className="text-[11px] text-gray-600">
            Exclusions: {profile?.allergies || "None declared"}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-1">
          <span className="text-xs font-semibold text-gray-600 block">Active Subscriptions</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-purple-700">
              {subscriptions.filter((s) => s.status === "active").length}
            </span>
            <span className="text-xs text-gray-600 font-medium">Calin Packs</span>
          </div>
          <p className="text-[11px] text-gray-600">
            Automatic doorstep replenishment
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-1">
          <span className="text-xs font-semibold text-gray-600 block">Nutritionist Guidance</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-teal-700">
              {nutritionistRequests.filter((r) => r.status === "reviewed").length}
            </span>
            <span className="text-xs text-gray-600 font-medium">Reviews</span>
          </div>
          <p className="text-[11px] text-gray-600">
            {nutritionistRequests.filter((r) => r.status === "pending").length} pending nutritionist review
          </p>
        </div>
      </div>

      {/* Main Grid: Orders & Subscriptions */}
      <div className="grid lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Orders History */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-600" />
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                  Demonstration Order History
                </h2>
              </div>
              <button
                type="button"
                onClick={fetchDashboardData}
                className="text-xs text-gray-600 hover:text-emerald-700 flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Refresh
              </button>
            </div>

            {loading && orders.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-600">Loading order records...</div>
            ) : orders.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <Package className="w-10 h-10 text-gray-300 mx-auto" />
                <p className="text-xs font-semibold text-gray-700">No orders placed yet</p>
                <p className="text-[11px] text-gray-600 max-w-xs mx-auto">
                  Add groceries or customize a Calin Pack and test out our demonstration checkout.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((o) => (
                  <div
                    key={o.id}
                    className="p-4 rounded-2xl border border-gray-100 hover:border-gray-200 bg-gray-50/50 space-y-3 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Link href={`/orders/${o.id}`} className="text-xs font-bold text-gray-900 hover:text-emerald-700 underline">
                            Order #{o.id.slice(0, 8)}
                          </Link>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            Demo order only
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-600">
                          {new Date(o.created_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(o.status)}
                        <span className="text-xs font-bold text-gray-900">{formatPaise(o.total_paise)}</span>
                      </div>
                    </div>

                    {/* Items snippet */}
                    <div className="pt-2 border-t border-gray-200/60 text-xs text-gray-700 space-y-1">
                      {o.items.map((it: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-[11px]">
                          <span>
                            {it.name} <span className="text-gray-600">× {it.quantity}</span>
                          </span>
                          <span className="text-gray-600 font-medium">{formatPaise(it.unit_price_paise * it.quantity)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-gray-600 pt-1">
                      <span>Delivery: {o.delivery_address?.city || "Bengaluru"}, {o.delivery_address?.pincode}</span>
                      <span className="font-mono text-emerald-700">DEMO RECORD</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Subscriptions & Nutritionist Guidance */}
        <div className="lg:col-span-5 space-y-6">
          {/* Active Subscriptions Card */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-600" />
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                  Calin Pack Subscriptions
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab("packs")}
                className="text-xs font-semibold text-purple-700 hover:underline"
              >
                + New Pack
              </button>
            </div>

            {subscriptions.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-600 space-y-1">
                <Calendar className="w-8 h-8 text-gray-300 mx-auto" />
                <p className="font-semibold text-gray-700">No recurring bundles active</p>
                <p className="text-[11px]">Subscribe to Basic, Minimal Plus, or Premium for regular delivery.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {subscriptions.map((s) => (
                  <div
                    key={s.id}
                    className="p-3.5 rounded-2xl border border-gray-100 bg-purple-50/20 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-gray-900">{s.pack_name}</h4>
                        <span className="text-[10px] text-purple-700 font-semibold uppercase">
                          {s.frequency.replace("_", " ")} • {formatPaise(s.price_per_delivery_paise)} / delivery
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          s.status === "active"
                            ? "bg-emerald-100 text-emerald-800"
                            : s.status === "paused"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {s.status}
                      </span>
                    </div>

                    <div className="text-[11px] text-gray-600 flex items-center justify-between">
                      <span>Next Dispatch:</span>
                      <span className="font-medium text-gray-800">
                        {new Date(s.next_delivery_date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </div>

                    {/* Subscription Actions */}
                    <div className="pt-2 border-t border-purple-100/80 flex items-center gap-2">
                      {s.status === "active" ? (
                        <button
                          type="button"
                          disabled={updatingSubId === s.id}
                          onClick={() => handleSubStatusChange(s.id, "paused")}
                          className="flex-1 py-1.5 px-2 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-semibold rounded-lg transition flex items-center justify-center gap-1"
                        >
                          <Pause className="w-3 h-3" /> Pause
                        </button>
                      ) : s.status === "paused" ? (
                        <button
                          type="button"
                          disabled={updatingSubId === s.id}
                          onClick={() => handleSubStatusChange(s.id, "active")}
                          className="flex-1 py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-semibold rounded-lg transition flex items-center justify-center gap-1"
                        >
                          <Play className="w-3 h-3" /> Resume
                        </button>
                      ) : null}

                      {s.status !== "cancelled" && (
                        <button
                          type="button"
                          disabled={updatingSubId === s.id}
                          onClick={() => handleSubStatusChange(s.id, "cancelled")}
                          className="flex-1 py-1.5 px-2 bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-700 text-[11px] font-semibold rounded-lg transition flex items-center justify-center gap-1"
                        >
                          <XCircle className="w-3 h-3" /> Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Nutritionist Review Notes */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-teal-600" />
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                  Nutritionist Guidance
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab("packs")}
                className="text-xs font-semibold text-teal-700 hover:underline"
              >
                Request Review
              </button>
            </div>

            {nutritionistRequests.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-600 space-y-1">
                <UserCheck className="w-8 h-8 text-gray-300 mx-auto" />
                <p className="font-semibold text-gray-700">No requests submitted</p>
                <p className="text-[11px]">
                  Request a certified nutritionist review directly when configuring your Calin Pack.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {nutritionistRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-3.5 rounded-2xl border border-gray-100 bg-teal-50/20 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 bg-teal-100/70 px-2 py-0.5 rounded">
                        Tier: {req.pack_tier}
                      </span>
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

                    <p className="text-xs text-gray-700 italic">
                      &quot;{req.customer_notes}&quot;
                    </p>

                    {req.status === "reviewed" && req.guidance_notes ? (
                      <div className="p-3 bg-white rounded-xl border border-teal-200/80 text-xs space-y-2 shadow-sm">
                        <div className="flex items-center gap-1.5 font-bold text-teal-950">
                          <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                          Guidance from {req.nutritionist_name || "Certified Nutritionist"}
                        </div>
                        <p className="text-[11px] text-gray-700 leading-relaxed">
                          {req.guidance_notes}
                        </p>
                        <p className="text-[10px] text-gray-600 pt-0.5">
                          Reviewed on {new Date(req.reviewed_at!).toLocaleDateString("en-IN")}
                        </p>

                        {/* Customer Confirmation Action (Mandatory per PRD) */}
                        <div className="pt-2 border-t border-teal-100">
                          {confirmedProposals[req.id] === "accepted" ? (
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1.5 rounded-lg">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>Confirmed: Nutritionist recommendations applied to your upcoming pack.</span>
                            </div>
                          ) : confirmedProposals[req.id] === "declined" ? (
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-700 bg-gray-50 px-2.5 py-1.5 rounded-lg">
                              <span>Declined: Retained your original customized pack selection.</span>
                            </div>
                          ) : (
                            <div className="space-y-1.5 pt-1">
                              <span className="text-[11px] font-bold text-gray-800 block">
                                Customer Action Required: Confirm or decline proposed changes
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleDecision(req.id, "accepted")}
                                  className="px-3 py-1.5 bg-[#236b48] hover:bg-[#1a5338] text-white text-[11px] font-bold rounded-lg transition shadow-2xs"
                                >
                                  Accept & Apply to Pack
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDecision(req.id, "declined")}
                                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-semibold rounded-lg transition"
                                >
                                  Decline Changes
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg">
                        Currently in queue with Dr. Priya Nair. Review response will appear here once certified.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
