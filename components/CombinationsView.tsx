"use client";

import { useState, useEffect } from "react";
import {
  Layers,
  Plus,
  Trash2,
  Sparkles,
  ShoppingBag,
  Flame,
  CheckCircle2,
  Info,
  ArrowRight,
} from "lucide-react";
import { Food, api, money } from "../lib/api";

interface CombinationsViewProps {
  allFoods: Food[];
  onAddMultipleToCart: (items: Array<{ food: Food; quantity: number }>) => void;
}

export default function CombinationsView({ allFoods, onAddMultipleToCart }: CombinationsViewProps) {
  // Selected items with quantities: list of { food: Food, quantity: number }
  const [comboItems, setComboItems] = useState<Array<{ food: Food; quantity: number }>>([]);
  const [calculationResult, setCalculationResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Default initial pair: Sprouted Chickpeas + Baby Spinach (Classic Iron + Folate booster)
  useEffect(() => {
    if (allFoods.length >= 2 && comboItems.length === 0) {
      const f1 = allFoods.find((f) => f.name.includes("Chickpeas")) || allFoods[0];
      const f2 = allFoods.find((f) => f.name.includes("Spinach")) || allFoods[1];
      setComboItems([
        { food: f1, quantity: 1 },
        { food: f2, quantity: 1 },
      ]);
    }
  }, [allFoods]);

  // Recalculate whenever comboItems changes
  useEffect(() => {
    if (comboItems.length === 0) {
      setCalculationResult(null);
      return;
    }

    const runCalc = async () => {
      setLoading(true);
      try {
        const payload = {
          items: comboItems.map((ci) => ({ food_id: ci.food.id, quantity: ci.quantity })),
        };
        const result = await api<any>("/combinations/calculate", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setCalculationResult(result);
      } catch (err) {
        console.error("Error calculating food combination:", err);
      } finally {
        setLoading(false);
      }
    };

    runCalc();
  }, [comboItems]);

  const addFoodToCombo = (food: Food) => {
    const existing = comboItems.find((ci) => ci.food.id === food.id);
    if (existing) {
      setComboItems(
        comboItems.map((ci) =>
          ci.food.id === food.id ? { ...ci, quantity: ci.quantity + 1 } : ci
        )
      );
    } else {
      setComboItems([...comboItems, { food, quantity: 1 }]);
    }
  };

  const removeFoodFromCombo = (foodId: string) => {
    setComboItems(comboItems.filter((ci) => ci.food.id !== foodId));
  };

  const updateQuantity = (foodId: string, qty: number) => {
    if (qty <= 0) {
      removeFoodFromCombo(foodId);
    } else {
      setComboItems(
        comboItems.map((ci) =>
          ci.food.id === foodId ? { ...ci, quantity: qty } : ci
        )
      );
    }
  };

  const handleAddComboToBag = () => {
    if (comboItems.length === 0) return;
    onAddMultipleToCart(comboItems);
    setMessage(`Added ${comboItems.length} combination foods to your shopping bag!`);
    setTimeout(() => setMessage(""), 3000);
  };

  return (
    <section className="section section-cream" style={{ paddingTop: "2.5rem" }}>
      <div className="container">
        {/* Header */}
        <div className="section-header">
          <span className="section-tag">
            <Layers size={14} />
            <span>Interactive Food Combinations</span>
          </span>
          <h1 style={{ fontSize: "clamp(2rem, 3.8vw, 3rem)", color: "var(--forest-950)", margin: "0.25rem 0 0.75rem" }}>
            Build & Balance Your Food Combinations
          </h1>
          <p className="section-subtitle">
            Certain foods are biologically more powerful when eaten together. Pair iron-dense legumes
            with Vitamin C greens, or complex carbs with healthy fats for sustained daily energy.
          </p>
        </div>

        {message && (
          <div
            style={{
              padding: "1rem",
              background: "var(--forest-800)",
              color: "#ffffff",
              borderRadius: "var(--radius-pill)",
              textAlign: "center",
              marginBottom: "2rem",
              fontWeight: 700,
            }}
          >
            ✓ {message}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "2.5rem" }}>
          {/* Left Column: Assembled Combination Plate */}
          <div>
            <div
              style={{
                background: "#ffffff",
                borderRadius: "var(--radius-xl)",
                border: "1.5px solid var(--border-light)",
                padding: "2rem",
                boxShadow: "var(--shadow-md)",
                marginBottom: "2rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                <h3 style={{ fontSize: "1.35rem", color: "var(--forest-950)" }}>
                  Your Combination Plate ({comboItems.length} Items)
                </h3>
                {comboItems.length > 0 && (
                  <button
                    onClick={() => setComboItems([])}
                    style={{ fontSize: "0.8rem", color: "var(--muted)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                  >
                    Clear All
                  </button>
                )}
              </div>

              {comboItems.length === 0 ? (
                <div style={{ padding: "3rem 1rem", textAlign: "center", color: "var(--muted)" }}>
                  <p>Your combination plate is currently empty.</p>
                  <p style={{ fontSize: "0.85rem" }}>Click foods from the catalog on the right to start building your combination.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.75rem" }}>
                  {comboItems.map(({ food, quantity }) => (
                    <div
                      key={food.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0.85rem 1rem",
                        background: "var(--cream-bg)",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-light)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <span style={{ fontSize: "1.5rem" }}>{food.emoji || "🥗"}</span>
                        <div>
                          <strong style={{ fontSize: "0.95rem", color: "var(--forest-950)", display: "block" }}>
                            {food.name}
                          </strong>
                          <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                            {food.category} · {money(food.price_inr)} / {food.unit}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--border-light)", borderRadius: "var(--radius-pill)", background: "#ffffff" }}>
                          <button
                            onClick={() => updateQuantity(food.id, quantity - 1)}
                            style={{ padding: "0.25rem 0.6rem", border: "none", background: "none", cursor: "pointer" }}
                          >
                            -
                          </button>
                          <span style={{ fontSize: "0.85rem", fontWeight: 700, padding: "0 4px" }}>{quantity}</span>
                          <button
                            onClick={() => updateQuantity(food.id, quantity + 1)}
                            style={{ padding: "0.25rem 0.6rem", border: "none", background: "none", cursor: "pointer" }}
                          >
                            +
                          </button>
                        </div>

                        <strong style={{ fontSize: "0.95rem", color: "var(--forest-900)", minWidth: "60px", textAlign: "right" }}>
                          {money(food.price_inr * quantity)}
                        </strong>

                        <button
                          onClick={() => removeFoodFromCombo(food.id)}
                          style={{ padding: "0.35rem", border: "none", background: "none", cursor: "pointer", color: "var(--muted)" }}
                          aria-label="Remove item"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Real-time Combination Calculations from Backend */}
              {calculationResult && (
                <div
                  style={{
                    background: "var(--paper)",
                    border: "1.5px solid var(--green-300)",
                    borderRadius: "var(--radius-lg)",
                    padding: "1.25rem",
                    marginBottom: "1.75rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                    <strong style={{ fontSize: "0.9rem", color: "var(--forest-950)" }}>
                      Combined Nutritional Sum:
                    </strong>
                    <span style={{ fontSize: "0.8rem", color: "var(--green-600)", fontWeight: 700 }}>
                      ⚡ Verified by Database
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.5rem", textAlign: "center", marginBottom: "1rem" }}>
                    <div style={{ background: "var(--cream-bg)", padding: "0.5rem", borderRadius: "8px" }}>
                      <span style={{ fontSize: "0.68rem", color: "var(--muted)" }}>Energy</span>
                      <strong style={{ display: "block", fontSize: "1rem" }}>{calculationResult.total_calories} kcal</strong>
                    </div>
                    <div style={{ background: "var(--green-50)", padding: "0.5rem", borderRadius: "8px" }}>
                      <span style={{ fontSize: "0.68rem", color: "var(--green-600)" }}>Protein</span>
                      <strong style={{ display: "block", fontSize: "1rem", color: "var(--green-600)" }}>{calculationResult.total_protein_g}g</strong>
                    </div>
                    <div style={{ background: "var(--cream-bg)", padding: "0.5rem", borderRadius: "8px" }}>
                      <span style={{ fontSize: "0.68rem", color: "var(--muted)" }}>Carbs</span>
                      <strong style={{ display: "block", fontSize: "1rem" }}>{calculationResult.total_carbs_g}g</strong>
                    </div>
                    <div style={{ background: "var(--cream-bg)", padding: "0.5rem", borderRadius: "8px" }}>
                      <span style={{ fontSize: "0.68rem", color: "var(--muted)" }}>Fiber</span>
                      <strong style={{ display: "block", fontSize: "1rem", color: "var(--forest-800)" }}>{calculationResult.total_fibre_g}g</strong>
                    </div>
                  </div>

                  {/* Contributing Nutrients Tag List */}
                  <div>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: "0.35rem" }}>
                      Contributing Biological Nutrients:
                    </span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                      {calculationResult.contributing_nutrients.map((n: string) => (
                        <span
                          key={n}
                          style={{
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            padding: "0.2rem 0.55rem",
                            borderRadius: "var(--radius-pill)",
                            background: "var(--green-100)",
                            color: "var(--forest-800)",
                          }}
                        >
                          ✓ {n.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Add Combination to Bag Button */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "1rem", borderTop: "1px solid var(--border-light)" }}>
                <div>
                  <span style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block" }}>Combination Total:</span>
                  <strong style={{ fontSize: "1.4rem", color: "var(--forest-950)" }}>
                    {money(calculationResult?.total_price_inr || 0)}
                  </strong>
                </div>

                <button
                  onClick={handleAddComboToBag}
                  disabled={comboItems.length === 0}
                  className="btn btn-primary btn-md"
                >
                  <ShoppingBag size={17} />
                  <span>Add Combination to Bag</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Catalog Quick Selector */}
          <div>
            <div
              style={{
                background: "#ffffff",
                borderRadius: "var(--radius-xl)",
                border: "1.5px solid var(--border-light)",
                padding: "1.75rem",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <h3 style={{ fontSize: "1.25rem", color: "var(--forest-950)", marginBottom: "0.5rem" }}>
                Add Foods from Store Catalog
              </h3>
              <p style={{ color: "var(--charcoal-600)", fontSize: "0.85rem", marginBottom: "1.25rem" }}>
                Select foods to add to your plate to balance complementary nutrients:
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "480px", overflowY: "auto" }}>
                {allFoods.map((f) => (
                  <div
                    key={f.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.65rem 0.85rem",
                      background: "var(--cream-bg)",
                      borderRadius: "10px",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                      <span style={{ fontSize: "1.35rem" }}>{f.emoji || "🥗"}</span>
                      <div>
                        <strong style={{ fontSize: "0.875rem", color: "var(--forest-950)", display: "block" }}>
                          {f.name}
                        </strong>
                        <span style={{ fontSize: "0.725rem", color: "var(--muted)" }}>
                          {f.calories} kcal · {f.protein_g}g protein · {money(f.price_inr)}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => addFoodToCombo(f)}
                      style={{
                        padding: "0.35rem 0.65rem",
                        borderRadius: "var(--radius-pill)",
                        border: "1px solid var(--forest-800)",
                        background: "#ffffff",
                        color: "var(--forest-800)",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "2px",
                      }}
                    >
                      <Plus size={13} />
                      <span>Add</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
