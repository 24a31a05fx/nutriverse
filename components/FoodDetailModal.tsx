"use client";

import { useState } from "react";
import {
  X,
  Plus,
  Minus,
  ShoppingBag,
  Sparkles,
  Flame,
  Check,
  AlertCircle,
  Clock,
  ShieldCheck,
  ChefHat,
  Info,
} from "lucide-react";
import { Food, Recipe, money } from "../lib/api";

interface FoodDetailModalProps {
  food: Food | null;
  onClose: () => void;
  onAddToCart: (food: Food, quantity: number) => void;
  recipes?: Recipe[];
  onOpenRecipe?: (recipe: Recipe) => void;
}

export default function FoodDetailModal({
  food,
  onClose,
  onAddToCart,
  recipes = [],
  onOpenRecipe,
}: FoodDetailModalProps) {
  const [quantity, setQuantity] = useState(1);

  if (!food) return null;

  const nutritionTags: string[] = JSON.parse(food.nutrition_tags || "[]");
  const vitaminsObj: Record<string, any> = JSON.parse(food.vitamins_json || "{}");
  const prepMethods: string[] = JSON.parse(food.prep_methods || "[]");
  const dietaryTags: string[] = JSON.parse(food.dietary_tags || "[]");

  // Format nutrient label
  const formatKey = (key: string) => {
    return key
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const handleAdd = () => {
    onAddToCart(food, quantity);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="food-modal-title">
      <div
        className="modal-dialog"
        style={{ maxWidth: "720px", padding: "clamp(1.5rem, 3.5vw, 2.5rem)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close-btn" onClick={onClose} aria-label="Close food details">
          <X size={20} />
        </button>

        {/* Header row */}
        <div style={{ display: "flex", gap: "1.25rem", alignItems: "flex-start", marginBottom: "1.5rem" }}>
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "18px",
              background: "var(--cream-soft)",
              border: "1px solid var(--border-light)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "2.5rem",
              flexShrink: 0,
            }}
          >
            {food.emoji || "🥗"}
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.35rem" }}>
              <span className="brand-badge">{food.category}</span>
              {food.stock_qty > 0 ? (
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "var(--green-600)",
                    background: "var(--green-50)",
                    padding: "0.15rem 0.6rem",
                    borderRadius: "var(--radius-pill)",
                  }}
                >
                  ✓ In Stock ({food.stock_qty} available)
                </span>
              ) : (
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "#dc2626",
                    background: "#fef2f2",
                    padding: "0.15rem 0.6rem",
                    borderRadius: "var(--radius-pill)",
                  }}
                >
                  Out of Stock
                </span>
              )}
              {food.barcode && (
                <span style={{ fontSize: "0.72rem", color: "var(--muted)", padding: "0.15rem 0.5rem" }}>
                  Code: {food.barcode}
                </span>
              )}
            </div>

            <h2 id="food-modal-title" style={{ fontSize: "1.85rem", color: "var(--forest-950)", lineHeight: 1.15 }}>
              {food.name}
            </h2>
            <p style={{ color: "var(--charcoal-600)", fontSize: "0.95rem", margin: "0.25rem 0 0.5rem" }}>
              {food.description}
            </p>
            <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--forest-900)" }}>
              {money(food.price_inr)} <small style={{ fontSize: "0.85rem", color: "var(--muted)", fontWeight: 500 }}>/ {food.unit}</small>
            </div>
          </div>
        </div>

        {/* Nutritional Breakdown Matrix */}
        <div
          style={{
            background: "var(--cream-bg)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border-light)",
            padding: "1.25rem",
            marginBottom: "1.5rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.85rem" }}>
            <strong style={{ fontSize: "0.95rem", color: "var(--forest-950)" }}>
              Nutrition Intelligence Breakdown
            </strong>
            <span style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 600 }}>
              Reference Quantity: {food.serving_size}
            </span>
          </div>

          {/* Primary Macro Cards Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.5rem", marginBottom: "1rem" }}>
            <div style={{ background: "#ffffff", padding: "0.75rem", borderRadius: "10px", textAlign: "center", border: "1px solid var(--border-subtle)" }}>
              <span style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>Energy</span>
              <strong style={{ display: "block", fontSize: "1.1rem", color: "var(--forest-900)" }}>{food.calories}</strong>
              <small style={{ fontSize: "0.7rem", color: "var(--muted)" }}>kcal</small>
            </div>

            <div style={{ background: "#ffffff", padding: "0.75rem", borderRadius: "10px", textAlign: "center", border: "1px solid var(--border-subtle)" }}>
              <span style={{ fontSize: "0.7rem", color: "var(--green-600)", textTransform: "uppercase", fontWeight: 700 }}>Protein</span>
              <strong style={{ display: "block", fontSize: "1.1rem", color: "var(--green-600)" }}>{food.protein_g}</strong>
              <small style={{ fontSize: "0.7rem", color: "var(--muted)" }}>grams</small>
            </div>

            <div style={{ background: "#ffffff", padding: "0.75rem", borderRadius: "10px", textAlign: "center", border: "1px solid var(--border-subtle)" }}>
              <span style={{ fontSize: "0.7rem", color: "#d97706", textTransform: "uppercase", fontWeight: 700 }}>Carbs</span>
              <strong style={{ display: "block", fontSize: "1.1rem", color: "#d97706)" }}>{food.carbs_g}</strong>
              <small style={{ fontSize: "0.7rem", color: "var(--muted)" }}>grams</small>
            </div>

            <div style={{ background: "#ffffff", padding: "0.75rem", borderRadius: "10px", textAlign: "center", border: "1px solid var(--border-subtle)" }}>
              <span style={{ fontSize: "0.7rem", color: "#e07a5f", textTransform: "uppercase", fontWeight: 700 }}>Fats</span>
              <strong style={{ display: "block", fontSize: "1.1rem", color: "#e07a5f" }}>{food.fat_g}</strong>
              <small style={{ fontSize: "0.7rem", color: "var(--muted)" }}>grams</small>
            </div>

            <div style={{ background: "#ffffff", padding: "0.75rem", borderRadius: "10px", textAlign: "center", border: "1px solid var(--border-subtle)" }}>
              <span style={{ fontSize: "0.7rem", color: "var(--forest-800)", textTransform: "uppercase", fontWeight: 700 }}>Fiber</span>
              <strong style={{ display: "block", fontSize: "1.1rem", color: "var(--forest-800)" }}>{food.fibre_g}</strong>
              <small style={{ fontSize: "0.7rem", color: "var(--muted)" }}>grams</small>
            </div>
          </div>

          {/* Micronutrients Pill List */}
          {Object.keys(vitaminsObj).length > 0 && (
            <div>
              <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--forest-900)", display: "block", marginBottom: "0.4rem" }}>
                Identified Micronutrients & Active Compounds:
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                {Object.entries(vitaminsObj).map(([k, v]) => (
                  <span
                    key={k}
                    style={{
                      fontSize: "0.75rem",
                      padding: "0.25rem 0.6rem",
                      borderRadius: "6px",
                      background: "#ffffff",
                      border: "1px solid var(--border-light)",
                      color: "var(--charcoal-700)",
                    }}
                  >
                    <strong>{formatKey(k)}:</strong> {String(v)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Preparation Methods & Storage Guidance */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
          <div style={{ background: "var(--paper)", border: "1px solid var(--border-light)", padding: "1rem", borderRadius: "var(--radius-md)" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--forest-900)", display: "block", marginBottom: "0.35rem" }}>
              🍳 Recommended Preparation Methods:
            </span>
            <ul style={{ listStyle: "none", fontSize: "0.825rem", color: "var(--charcoal-600)", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              {prepMethods.map((m) => (
                <li key={m} style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                  <Check size={13} style={{ color: "var(--green-500)" }} />
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          </div>

          <div style={{ background: "var(--paper)", border: "1px solid var(--border-light)", padding: "1rem", borderRadius: "var(--radius-md)" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--forest-900)", display: "block", marginBottom: "0.35rem" }}>
              📦 Storage & Shelf-Life:
            </span>
            <p style={{ fontSize: "0.825rem", color: "var(--charcoal-600)", lineHeight: 1.5, margin: 0 }}>
              {food.storage_info}
            </p>
          </div>
        </div>

        {/* Ingredients & Dietary Tags */}
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "0.825rem", color: "var(--charcoal-700)", marginBottom: "0.5rem" }}>
            <strong>Ingredients:</strong> {food.ingredients || food.name}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
            {dietaryTags.map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: "0.725rem",
                  fontWeight: 700,
                  padding: "0.2rem 0.6rem",
                  borderRadius: "var(--radius-pill)",
                  background: "var(--cream-soft)",
                  color: "var(--forest-800)",
                }}
              >
                ✓ {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Quantity Selector & Add to Bag Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: "1.25rem",
            borderTop: "1px solid var(--border-light)",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          {/* Quantity Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--charcoal-700)" }}>
              Quantity:
            </span>
            <div style={{ display: "flex", alignItems: "center", border: "1.5px solid var(--border-light)", borderRadius: "var(--radius-pill)", background: "#ffffff" }}>
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                style={{ padding: "0.4rem 0.8rem", border: "none", background: "none", cursor: "pointer", color: "var(--forest-900)" }}
                aria-label="Decrease quantity"
              >
                <Minus size={14} />
              </button>
              <span style={{ minWidth: "24px", textAlign: "center", fontWeight: 700, fontSize: "0.95rem" }}>
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(Math.min(food.stock_qty, quantity + 1))}
                style={{ padding: "0.4rem 0.8rem", border: "none", background: "none", cursor: "pointer", color: "var(--forest-900)" }}
                aria-label="Increase quantity"
              >
                <Plus size={14} />
              </button>
            </div>
            <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--forest-900)" }}>
              = {money(food.price_inr * quantity)}
            </span>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button className="btn btn-outline btn-sm" onClick={onClose}>
              Back to Catalog
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleAdd}
              disabled={food.stock_qty <= 0}
            >
              <ShoppingBag size={16} />
              <span>Add to Bag</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
