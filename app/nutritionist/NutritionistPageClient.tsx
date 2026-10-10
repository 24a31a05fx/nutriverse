"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Stethoscope,
  CheckCircle,
  FileText,
  Clock,
  Send,
  AlertCircle,
  User as UserIcon,
  Sparkles,
} from "lucide-react";
import { useNutriverse } from "@/components/NutriverseProvider";
import { NutritionistRequestModel, api } from "@/lib/api";

export default function NutritionistPageClient() {
  const { currentUser, setAuthModalOpen } = useNutriverse();
  const [queue, setQueue] = useState<NutritionistRequestModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedReqId, setSelectedReqId] = useState<string | null>(null);
  const [guidanceText, setGuidanceText] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const fetchQueue = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<NutritionistRequestModel[]>("/nutritionist/requests");
      setQueue(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load review queue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchQueue();
    } else {
      setLoading(false);
    }
  }, [currentUser]);

  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-5 animate-in fade-in">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-teal-50 text-teal-700 flex items-center justify-center">
          <Stethoscope className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">Nutritionist Sign In Required</h1>
        <p className="text-xs text-gray-500">
          Sign in with your Nutritionist credentials to access customer review queues.
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

  const isAuthorized = currentUser.role === "nutritionist" || currentUser.role === "admin";
  if (!isAuthorized) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-5 animate-in fade-in">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-50 text-amber-700 flex items-center justify-center">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">Nutritionist Role Required</h1>
        <p className="text-xs text-gray-500">
          This queue is restricted to verified Nutritionists (e.g. Dr. Priya Nair).
        </p>
        <Link
          href="/"
          className="inline-flex px-5 py-2.5 rounded-full bg-emerald-800 text-white text-xs font-bold"
        >
          Return to Storefront
        </Link>
      </div>
    );
  }

  const handleSubmitReview = async (reqId: string) => {
    if (!guidanceText.trim()) return;
    setSubmittingReview(true);
    try {
      await api(`/nutritionist/requests/${reqId}/review`, {
        method: "POST",
        body: JSON.stringify({ guidance_notes: guidanceText }),
      });
      setSelectedReqId(null);
      setGuidanceText("");
      await fetchQueue();
    } catch (err: any) {
      alert(err?.message || "Failed to submit nutritionist review");
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
            Professional Practice Portal
          </span>
          <h1 className="text-2xl font-black text-gray-900 mt-2 flex items-center gap-2.5">
            <Stethoscope className="w-6 h-6 text-teal-700" /> Nutritionist Review Queue
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Logged in as {currentUser.name} ({currentUser.role}). Review customer dietary notes and deliver evidence-based guidance.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchQueue}
          className="self-start sm:self-auto px-4 py-2 rounded-full bg-white hover:bg-gray-50 border border-gray-200 text-xs font-bold text-gray-700 shadow-sm"
        >
          Refresh Queue
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-xs text-gray-400">Loading review queue...</div>
      ) : queue.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center shadow-sm space-y-3">
          <CheckCircle className="w-10 h-10 text-teal-600 mx-auto" />
          <h3 className="text-sm font-bold text-gray-900">All Consultations Cleared</h3>
          <p className="text-xs text-gray-500">
            No pending Calin Pack customization reviews at this time.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {queue.map((req) => (
            <div
              key={req.id}
              className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs">
                    {req.user_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">{req.user_name}</h3>
                    <p className="text-xs text-gray-500">
                      Tier: <strong className="capitalize">{req.pack_tier}</strong> • Requested{" "}
                      {new Date(req.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <span
                  className={`self-start sm:self-auto px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    req.status === "pending"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {req.status}
                </span>
              </div>

              {/* Customer Request Notes */}
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 text-xs space-y-1">
                <span className="font-bold text-gray-700 block">Customer Dietary Notes:</span>
                <p className="text-gray-600 leading-relaxed">{req.customer_notes}</p>
              </div>

              {/* Existing Guidance or Form */}
              {req.status === "reviewed" ? (
                <div className="p-4 bg-teal-50/70 border border-teal-200/80 rounded-2xl text-xs space-y-1">
                  <span className="font-bold text-teal-900 flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-teal-700" /> Nutritionist Guidance by {req.nutritionist_name}:
                  </span>
                  <p className="text-teal-800 leading-relaxed">{req.guidance_notes}</p>
                </div>
              ) : selectedReqId === req.id ? (
                <div className="space-y-3 pt-2">
                  <textarea
                    rows={3}
                    placeholder="Provide evidence-based nutritional guidance on food swaps, micronutrient ratios, or preparation methods..."
                    value={guidanceText}
                    onChange={(e) => setGuidanceText(e.target.value)}
                    className="w-full p-3.5 text-xs rounded-2xl border border-teal-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedReqId(null);
                        setGuidanceText("");
                      }}
                      className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={submittingReview || !guidanceText.trim()}
                      onClick={() => handleSubmitReview(req.id)}
                      className="flex items-center gap-2 px-5 py-2 rounded-xl bg-teal-800 hover:bg-teal-900 text-white text-xs font-bold shadow-md transition disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" /> Submit Guidance
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedReqId(req.id);
                    setGuidanceText("");
                  }}
                  className="px-4 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-900 text-xs font-bold border border-teal-200 transition"
                >
                  Write Nutritionist Guidance
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
