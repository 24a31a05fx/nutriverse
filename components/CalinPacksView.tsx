"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import {
  Package,
  Sparkles,
  Check,
  ArrowRight,
  ShieldAlert,
  Stethoscope,
  Calendar,
  RotateCcw,
  ShoppingBag,
  SlidersHorizontal,
  Flame,
  Zap,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";
import { CalinPackTier, Food, api, formatPaise, money } from "../lib/api";

interface CalinPacksViewProps {
  onAddPackToCart: (tier: string, packName: string, customization: any) => void;
  currentUser: any;
  onOpenAuth: () => void;
  onRequestNutritionistReviewSuccess?: () => void;
}

export default function CalinPacksView({
  onAddPackToCart,
  currentUser,
  onOpenAuth,
  onRequestNutritionistReviewSuccess,
}: CalinPacksViewProps) {
  const [tiers, setTiers] = useState<CalinPackTier[]>([]);
  const [allFoods, setAllFoods] = useState<Food[]>([]);
  const [selectedTierId, setSelectedTierId] = useState<string>("minimal_plus");
  const [customizing, setCustomizing] = useState(false);
  const [selectedFoodIds, setSelectedFoodIds] = useState<string[]>([]);
  const [customizedData, setCustomizedData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Modals for Subscription and Nutritionist Review
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [subFrequency, setSubFrequency] = useState<"weekly" | "bi_weekly" | "monthly">("weekly");
  const [subMessage, setSubMessage] = useState<string>("");

  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);

  // Load tiers and catalog foods
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tiersData, foodsData] = await Promise.all([
          api<CalinPackTier[]>("/packs"),
          api<Food[]>("/foods"),
        ]);
        setTiers(tiersData);
        setAllFoods(foodsData);

        // Pre-select foods for active tier
        const active = tiersData.find((t) => t.tier === "minimal_plus") || tiersData[0];
        if (active) {
          const defaultItems: Array<{ food_name: string }> = JSON.parse(active.items_json || "[]");
          const matchedIds = foodsData
            .filter((f) => defaultItems.some((di) => di.food_name.toLowerCase() === f.name.toLowerCase()))
            .map((f) => f.id);
          setSelectedFoodIds(matchedIds);
        }
      } catch (err) {
        console.error("Error loading Calin pack tiers:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const activeTier = tiers.find((t) => t.tier === selectedTierId) || tiers[0];

  // When switching tiers, reset customization
  const handleSelectTier = (tierId: string) => {
    setSelectedTierId(tierId);
    setCustomizing(false);
    const tier = tiers.find((t) => t.tier === tierId);
    if (tier && allFoods.length > 0) {
      const defaultItems: Array<{ food_name: string }> = JSON.parse(tier.items_json || "[]");
      const matchedIds = allFoods
        .filter((f) => defaultItems.some((di) => di.food_name.toLowerCase() === f.name.toLowerCase()))
        .map((f) => f.id);
      setSelectedFoodIds(matchedIds);
      recalculateCustomization(tierId, matchedIds);
    }
  };

  // Recalculate pack nutrition and price from backend
  const recalculateCustomization = async (tier: string, fids: string[]) => {
    try {
      const result = await api<any>("/packs/customize", {
        method: "POST",
        body: JSON.stringify({ tier, selected_food_ids: fids }),
      });
      setCustomizedData(result);
    } catch (err) {
      console.error("Error recalculating pack:", err);
    }
  };

  // Toggle item in customizer
  const toggleFoodItem = (foodId: string) => {
    let nextIds: string[];
    if (selectedFoodIds.includes(foodId)) {
      if (selectedFoodIds.length <= 4) {
        alert("A Calin Pack requires at least 4 nutrient-dense whole foods.");
        return;
      }
      nextIds = selectedFoodIds.filter((id) => id !== foodId);
    } else {
      nextIds = [...selectedFoodIds, foodId];
    }
    setSelectedFoodIds(nextIds);
    recalculateCustomization(selectedTierId, nextIds);
  };

  // Handle Add to Cart
  const handleAddCustomizedToCart = () => {
    if (!activeTier) return;
    const finalPrice = customizedData?.customized_price_paise ?? (customizedData?.customized_price_inr ? customizedData.customized_price_inr * 100 : activeTier.base_price_paise);
    const customization = {
      tier: activeTier.tier,
      selected_foods: customizedData?.selected_foods || [],
      nutrition_summary: customizedData?.nutrition_summary || {},
      item_count: selectedFoodIds.length,
      price_paise: finalPrice,
    };
    onAddPackToCart(activeTier.tier, activeTier.name, customization);
  };

  // Create Subscription
  const handleCreateSubscription = async () => {
    if (!currentUser) {
      setSubModalOpen(false);
      onOpenAuth();
      return;
    }
    try {
      const res = await api<any>("/subscriptions", {
        method: "POST",
        body: JSON.stringify({ pack_tier: selectedTierId, frequency: subFrequency }),
      });
      setSubMessage(res.message);
      setTimeout(() => {
        setSubModalOpen(false);
        setSubMessage("");
      }, 2500);
    } catch (err: any) {
      alert(err.message || "Could not create subscription");
    }
  };

  // Submit Nutritionist Review Request
  const handleSubmitReviewRequest = async () => {
    if (!currentUser) {
      setReviewModalOpen(false);
      onOpenAuth();
      return;
    }
    if (!reviewNotes.trim() || reviewNotes.trim().length < 5) {
      alert("Please provide at least 5 characters explaining your dietary guidance goals.");
      return;
    }
    setReviewSubmitting(true);
    try {
      await api<any>("/nutritionist/requests", {
        method: "POST",
        body: JSON.stringify({ pack_tier: selectedTierId, customer_notes: reviewNotes.trim() }),
      });
      setReviewSuccess(true);
      if (onRequestNutritionistReviewSuccess) onRequestNutritionistReviewSuccess();
      setTimeout(() => {
        setReviewModalOpen(false);
        setReviewSuccess(false);
        setReviewNotes("");
      }, 2200);
    } catch (err: any) {
      alert(err.message || "Could not submit review request");
    } finally {
      setReviewSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "6rem 0", textAlign: "center", color: "var(--muted)" }}>
        <Package size={36} style={{ animation: "float 2s infinite ease-in-out", margin: "0 auto 1rem", color: "var(--green-500)" }} />
        <p>Loading calibrated Calin Pack tiers...</p>
      </div>
    );
  }

  return (
    <section className="section section-cream" style={{ paddingTop: "2.5rem" }}>
      <div className="container">
        {/* Header */}
        <div className="section-header" style={{ marginBottom: "2.5rem" }}>
          <span className="section-tag">
            <Sparkles size={14} />
            <span>The Core Offering</span>
          </span>
          <h1 style={{ fontSize: "clamp(2rem, 3.8vw, 3rem)", color: "var(--forest-950)", margin: "0.25rem 0 0.75rem" }}>
            Calin Packs — Your Weekly Nutrition, Simplified.
          </h1>
          <p className="section-subtitle">
            Calin Packs bring together different foods in convenient packages designed around customers’ nutritional
            requirements. Choose a tier, personalize inclusions, subscribe, or request professional nutritionist verification.
          </p>
        </div>

        {/* Tier Selector Navigation Pills */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "0.75rem",
            marginBottom: "2.5rem",
            flexWrap: "wrap",
          }}
        >
          {tiers.map((t) => {
            const isSelected = t.tier === selectedTierId;
            return (
              <button
                key={t.id}
                onClick={() => handleSelectTier(t.tier)}
                style={{
                  padding: "0.85rem 1.75rem",
                  borderRadius: "var(--radius-pill)",
                  fontWeight: 700,
                  fontSize: "1rem",
                  border: "2px solid",
                  borderColor: isSelected ? "var(--forest-800)" : "var(--border-light)",
                  backgroundColor: isSelected ? "var(--forest-800)" : "#ffffff",
                  color: isSelected ? "#ffffff" : "var(--charcoal-800)",
                  boxShadow: isSelected ? "0 8px 24px rgba(24, 67, 47, 0.2)" : "var(--shadow-xs)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <span>{t.name}</span>
                <span
                  style={{
                    marginLeft: "8px",
                    fontSize: "0.85rem",
                    color: isSelected ? "var(--green-200)" : "var(--green-600)",
                  }}
                >
                  {formatPaise(t.base_price_paise ?? (t.base_price_inr ? t.base_price_inr * 100 : 0))}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active Tier Showcase Card */}
        {activeTier && (
          <div
            style={{
              background: "#ffffff",
              borderRadius: "var(--radius-xl)",
              border: "1.5px solid var(--border-light)",
              boxShadow: "var(--shadow-lg)",
              padding: "clamp(1.5rem, 4vw, 3rem)",
              marginBottom: "3rem",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "clamp(2rem, 4vw, 3.5rem)" }}>
              {/* Left Column: Inclusions & Live Customizer */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.5rem" }}>
                  <span className="section-tag" style={{ margin: 0 }}>
                    {activeTier.tier.replace(/_/g, " ").toUpperCase()} TIER
                  </span>
                  <span style={{ fontSize: "0.85rem", color: "var(--muted)", fontWeight: 600 }}>
                    Up to {activeTier.max_substitutions} permitted food substitutions
                  </span>
                </div>

                <h2 style={{ fontSize: "2rem", color: "var(--forest-950)", marginBottom: "0.5rem" }}>
                  {activeTier.name}
                </h2>
                <p style={{ color: "var(--charcoal-600)", fontSize: "1rem", lineHeight: 1.6, marginBottom: "1.5rem" }}>
                  {activeTier.description}
                </p>

                {/* Target Audience callout */}
                <div
                  style={{
                    padding: "0.85rem 1.15rem",
                    backgroundColor: "var(--cream-bg)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-light)",
                    marginBottom: "1.75rem",
                    fontSize: "0.875rem",
                    color: "var(--charcoal-700)",
                  }}
                >
                  <strong>Designed For:</strong> {activeTier.target_audience}
                </div>

                {/* Customizer Toggle */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <strong style={{ fontSize: "1.1rem", color: "var(--forest-950)" }}>
                    {customizing ? "Customize Bundle Inclusions" : "Pack Contents & Proportions"}
                  </strong>
                  <button
                    onClick={() => {
                      setCustomizing(!customizing);
                      if (!customizing) {
                        recalculateCustomization(selectedTierId, selectedFoodIds);
                      }
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      padding: "0.45rem 0.85rem",
                      borderRadius: "var(--radius-pill)",
                      border: "1.5px solid var(--green-400)",
                      backgroundColor: customizing ? "var(--green-50)" : "transparent",
                      color: "var(--forest-800)",
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <SlidersHorizontal size={15} />
                    <span>{customizing ? "Done Customizing" : "Swap & Personalize Foods"}</span>
                  </button>
                </div>

                {/* If NOT customizing: Display current items list */}
                {!customizing ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginBottom: "1.75rem" }}>
                    {(customizedData?.selected_foods || allFoods.filter((f) => selectedFoodIds.includes(f.id))).map((item: any) => (
                      <div
                        key={item.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.6rem",
                          padding: "0.65rem 0.85rem",
                          borderRadius: "var(--radius-sm)",
                          backgroundColor: "var(--cream-bg)",
                          border: "1px solid var(--border-subtle)",
                          fontSize: "0.875rem",
                        }}
                      >
                        <Check size={16} style={{ color: "var(--green-500)", flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, color: "var(--forest-900)" }}>{item.name}</span>
                        <span style={{ fontSize: "0.75rem", color: "var(--muted)", marginLeft: "auto" }}>{item.unit}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Customization interactive checklist */
                  <div
                    style={{
                      maxHeight: "320px",
                      overflowY: "auto",
                      padding: "0.75rem",
                      border: "1.5px solid var(--green-200)",
                      borderRadius: "var(--radius-md)",
                      marginBottom: "1.75rem",
                      background: "var(--green-50)",
                    }}
                  >
                    <p style={{ fontSize: "0.8rem", color: "var(--forest-800)", margin: "0 0 0.5rem" }}>
                      Select whole foods to include in your {activeTier.name} (Minimum 4 items required):
                    </p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                      {allFoods.map((f) => {
                        const isChecked = selectedFoodIds.includes(f.id);
                        return (
                          <button
                            key={f.id}
                            onClick={() => toggleFoodItem(f.id)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.5rem",
                              padding: "0.5rem 0.75rem",
                              borderRadius: "8px",
                              backgroundColor: isChecked ? "#ffffff" : "rgba(255, 255, 255, 0.4)",
                              border: "1px solid",
                              borderColor: isChecked ? "var(--green-500)" : "transparent",
                              textAlign: "left",
                              cursor: "pointer",
                              fontSize: "0.825rem",
                            }}
                          >
                            <input type="checkbox" checked={isChecked} readOnly style={{ pointerEvents: "none" }} />
                            <span style={{ fontWeight: isChecked ? 700 : 500, color: "var(--charcoal-900)" }}>{f.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Macro Nutrition Summary Banner */}
                {customizedData?.nutrition_summary && (
                  <div
                    style={{
                      background: "var(--paper)",
                      padding: "1rem",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-light)",
                      display: "flex",
                      justifyContent: "space-around",
                      marginBottom: "1.5rem",
                      fontSize: "0.85rem",
                      textAlign: "center",
                    }}
                  >
                    <div>
                      <span style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase" }}>Energy Est.</span>
                      <strong style={{ display: "block", color: "var(--forest-900)", fontSize: "1.1rem" }}>
                        {customizedData.nutrition_summary.total_calories} kcal
                      </strong>
                    </div>
                    <div>
                      <span style={{ fontSize: "0.7rem", color: "var(--green-600)", textTransform: "uppercase" }}>Protein</span>
                      <strong style={{ display: "block", color: "var(--green-600)", fontSize: "1.1rem" }}>
                        {customizedData.nutrition_summary.total_protein_g}g
                      </strong>
                    </div>
                    <div>
                      <span style={{ fontSize: "0.7rem", color: "var(--forest-800)", textTransform: "uppercase" }}>Fiber</span>
                      <strong style={{ display: "block", color: "var(--forest-800)", fontSize: "1.1rem" }}>
                        {customizedData.nutrition_summary.total_fibre_g}g
                      </strong>
                    </div>
                    <div>
                      <span style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase" }}>Total Items</span>
                      <strong style={{ display: "block", color: "var(--forest-950)", fontSize: "1.1rem" }}>
                        {selectedFoodIds.length} foods
                      </strong>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Pricing, Checkout CTA, Subscription & Nutritionist Actions */}
              <div
                style={{
                  background: "var(--cream-bg)",
                  borderRadius: "var(--radius-xl)",
                  border: "1.5px solid var(--border-light)",
                  padding: "clamp(1.5rem, 3vw, 2.25rem)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <span style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Pack Valuation
                  </span>
                  <div style={{ margin: "0.5rem 0 1.25rem" }}>
                    <strong style={{ fontSize: "2.5rem", color: "var(--forest-950)", fontWeight: 800 }}>
                      {formatPaise(customizedData?.customized_price_paise ?? (customizedData?.customized_price_inr ? customizedData.customized_price_inr * 100 : (activeTier.base_price_paise ?? (activeTier.base_price_inr ? activeTier.base_price_inr * 100 : 0))))}
                    </strong>
                    <span style={{ fontSize: "0.95rem", color: "var(--muted)", marginLeft: "6px" }}>
                      / weekly delivery
                    </span>
                  </div>

                  <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.65rem", marginBottom: "1.75rem", fontSize: "0.875rem", color: "var(--charcoal-700)" }}>
                    <li style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Check size={16} style={{ color: "var(--green-500)" }} />
                      <span>{selectedFoodIds.length} nutrient-dense whole foods included</span>
                    </li>
                    <li style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Check size={16} style={{ color: "var(--green-500)" }} />
                      <span>Eco-friendly kraft packaging + cool insulation</span>
                    </li>
                    <li style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Check size={16} style={{ color: "var(--green-500)" }} />
                      <span>Free delivery on all weekly Calin Pack orders</span>
                    </li>
                    <li style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Check size={16} style={{ color: "var(--green-500)" }} />
                      <span>Pause or skip upcoming deliveries anytime</span>
                    </li>
                  </ul>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {/* Primary Add Pack to Cart */}
                  <button
                    onClick={handleAddCustomizedToCart}
                    className="btn btn-primary btn-lg"
                    style={{ width: "100%" }}
                  >
                    <ShoppingBag size={18} />
                    <span>Add {activeTier.name} to Bag</span>
                  </button>

                  {/* Recurring Subscription Trigger */}
                  <button
                    onClick={() => setSubModalOpen(true)}
                    className="btn btn-secondary btn-sm"
                    style={{ width: "100%" }}
                  >
                    <Calendar size={16} />
                    <span>Set Up Recurring Subscription</span>
                  </button>

                  {/* Nutritionist Review Request Trigger */}
                  <button
                    onClick={() => setReviewModalOpen(true)}
                    className="btn btn-outline btn-sm"
                    style={{ width: "100%" }}
                  >
                    <Stethoscope size={16} />
                    <span>Request Nutritionist Review</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Subscription Modal */}
        {subModalOpen && (
          <div className="modal-overlay" onClick={() => setSubModalOpen(false)} role="dialog" aria-modal="true">
            <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close-btn" onClick={() => setSubModalOpen(false)}>
                <X size={20} />
              </button>

              <span className="section-tag">
                <Calendar size={14} />
                <span>Stateful Subscription Engine</span>
              </span>
              <h3 style={{ fontSize: "1.6rem", color: "var(--forest-950)", margin: "0.5rem 0" }}>
                Subscribe to {activeTier?.name}
              </h3>
              <p style={{ color: "var(--charcoal-600)", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
                Automate your weekly nourishment rhythm. Subscriptions can be paused, modified, or skipped anytime in your customer dashboard.
              </p>

              {subMessage ? (
                <div style={{ padding: "1.25rem", background: "var(--green-50)", borderRadius: "var(--radius-md)", border: "1px solid var(--green-200)", textAlign: "center" }}>
                  <CheckCircle2 size={36} style={{ color: "var(--green-500)", margin: "0 auto 8px" }} />
                  <strong style={{ color: "var(--forest-950)" }}>{subMessage}</strong>
                </div>
              ) : (
                <div>
                  <div style={{ marginBottom: "1.25rem" }}>
                    <label className="form-label">Delivery Schedule Frequency:</label>
                    <select
                      className="form-control"
                      value={subFrequency}
                      onChange={(e) => setSubFrequency(e.target.value as any)}
                    >
                      <option value="weekly">Every Week (Recommended · {formatPaise(0)} delivery fee)</option>
                      <option value="bi_weekly">Every 2 Weeks (Bi-weekly)</option>
                      <option value="monthly">Monthly Recurring (4-week interval)</option>
                    </select>
                  </div>

                  <div style={{ padding: "0.85rem 1rem", background: "var(--cream-bg)", borderRadius: "var(--radius-md)", fontSize: "0.825rem", color: "var(--charcoal-700)", marginBottom: "1.5rem" }}>
                    ✦ <strong>Demo Mode Subscription:</strong> No real payment card will be charged. The scheduled order will be recorded in your dashboard with state management (Active / Paused / Cancelled).
                  </div>

                  <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                    <button className="btn btn-outline btn-sm" onClick={() => setSubModalOpen(false)}>
                      Cancel
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={handleCreateSubscription}>
                      Confirm Subscription
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Nutritionist Review Request Modal */}
        {reviewModalOpen && (
          <div className="modal-overlay" onClick={() => setReviewModalOpen(false)} role="dialog" aria-modal="true">
            <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close-btn" onClick={() => setReviewModalOpen(false)}>
                <X size={20} />
              </button>

              <span className="section-tag gold">
                <Stethoscope size={14} />
                <span>Professional Review Workflow</span>
              </span>
              <h3 style={{ fontSize: "1.6rem", color: "var(--forest-950)", margin: "0.5rem 0" }}>
                Request Nutritionist Pack Review
              </h3>
              <p style={{ color: "var(--charcoal-600)", fontSize: "0.9rem", marginBottom: "1.25rem" }}>
                Have a certified nutritionist review this {activeTier?.name} against your individual profile and health targets.
              </p>

              {reviewSuccess ? (
                <div style={{ padding: "1.5rem", background: "var(--green-50)", borderRadius: "var(--radius-md)", border: "1px solid var(--green-200)", textAlign: "center" }}>
                  <CheckCircle2 size={40} style={{ color: "var(--green-500)", margin: "0 auto 8px" }} />
                  <strong style={{ display: "block", fontSize: "1.1rem", color: "var(--forest-950)" }}>
                    Guidance Request Submitted!
                  </strong>
                  <p style={{ fontSize: "0.85rem", color: "var(--charcoal-600)", margin: "4px 0 0" }}>
                    Dr. Priya Nair will review your notes and post recommendations in your Customer Dashboard.
                  </p>
                </div>
              ) : (
                <div>
                  <div style={{ marginBottom: "1.25rem" }}>
                    <label className="form-label" htmlFor="review-notes-input">
                      Specific Questions or Guidance Focus:
                    </label>
                    <textarea
                      id="review-notes-input"
                      className="form-control"
                      rows={4}
                      placeholder="e.g. Please verify if this pack has sufficient plant protein and iron for my 5-day strength training routine..."
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                    />
                  </div>

                  <div style={{ padding: "0.75rem 1rem", background: "var(--cream-bg)", borderRadius: "var(--radius-md)", fontSize: "0.8rem", color: "var(--charcoal-600)", marginBottom: "1.5rem" }}>
                    ✦ By submitting, you grant permission for the assigned nutritionist to inspect your calculated calorie target and food preferences to evaluate this pack.
                  </div>

                  <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                    <button className="btn btn-outline btn-sm" onClick={() => setReviewModalOpen(false)}>
                      Cancel
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={handleSubmitReviewRequest}
                      disabled={reviewSubmitting}
                    >
                      {reviewSubmitting ? "Submitting..." : "Submit for Professional Review"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
