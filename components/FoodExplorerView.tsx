"use client";

import { useState, useEffect } from "react";
import {
  Search,
  Filter,
  Sparkles,
  ArrowUpDown,
  ShoppingBag,
  Eye,
  Check,
  Flame,
  Zap,
  Info,
} from "lucide-react";
import { Food, api, formatPaise, money } from "../lib/api";
import FoodDetailModal from "./FoodDetailModal";

interface FoodExplorerViewProps {
  onAddToCart: (food: Food, quantity?: number) => void;
}

export default function FoodExplorerView({ onAddToCart }: FoodExplorerViewProps) {
  const [foods, setFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedNutrientTag, setSelectedNutrientTag] = useState<string>("all");
  const [selectedConventionalCategory, setSelectedConventionalCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("name");
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);

  const nutrientFilters = [
    { id: "all", label: "All Whole Foods" },
    { id: "protein_rich", label: "🌱 Protein-Rich" },
    { id: "carb_rich", label: "🍠 Complex Carbs" },
    { id: "fat_sources", label: "🥑 Healthy Fats" },
    { id: "fiber_rich", label: "🌾 High Fiber" },
    { id: "iron_rich", label: "⚡ Iron-Dense" },
    { id: "vitamin_sources", label: "🫐 Vitamin Power" },
    { id: "mineral_sources", label: "✨ Minerals" },
  ];

  // Fetch foods with active filters
  const loadFoods = async () => {
    setLoading(true);
    try {
      let queryUrl = `/foods?sort_by=${sortBy}`;
      if (search.trim()) queryUrl += `&q=${encodeURIComponent(search.trim())}`;
      if (selectedNutrientTag !== "all") queryUrl += `&nutrition_tag=${selectedNutrientTag}`;
      if (selectedConventionalCategory !== "all") queryUrl += `&category=${encodeURIComponent(selectedConventionalCategory)}`;

      const data = await api<Food[]>(queryUrl);
      setFoods(data);
    } catch (err) {
      console.error("Error loading food explorer catalog:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFoods();
  }, [search, selectedNutrientTag, selectedConventionalCategory, sortBy]);

  // Extract unique conventional categories
  const conventionalCategories = [
    "all",
    "Legumes & Pulses",
    "Leafy Greens",
    "Tubers & Roots",
    "Dairy & Probiotics",
    "Grains & Pseudocereals",
    "Berries & Fruits",
    "Nuts & Seeds",
    "Healthy Oils & Fats",
    "Cruciferous & Greens",
  ];

  return (
    <section className="section section-cream" style={{ paddingTop: "2.5rem" }}>
      <div className="container">
        {/* Explorer Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem", marginBottom: "2rem" }}>
          <div>
            <span className="section-tag">
              <Sparkles size={14} />
              <span>Nutrition-First Food Explorer</span>
            </span>
            <h1 style={{ fontSize: "clamp(2rem, 3.5vw, 2.75rem)", color: "var(--forest-950)", margin: "0.25rem 0 0.5rem" }}>
              Explore Food by Nutritional Purpose.
            </h1>
            <p style={{ color: "var(--charcoal-600)", fontSize: "1.05rem", maxWidth: "680px" }}>
              Filter by biological contribution — bioavailable protein, plant iron, slow-burn complex carbs,
              or dietary fiber — rather than conventional store aisles.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--muted)", fontWeight: 600 }}>Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                padding: "0.55rem 0.95rem",
                borderRadius: "var(--radius-pill)",
                border: "1.5px solid var(--border-light)",
                background: "#ffffff",
                color: "var(--forest-900)",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <option value="name">Name (A-Z)</option>
              <option value="protein">Highest Protein</option>
              <option value="calories">Highest Energy (kcal)</option>
              <option value="price_asc">Price (Low to High)</option>
              <option value="price_desc">Price (High to Low)</option>
            </select>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div
          style={{
            background: "#ffffff",
            padding: "1.25rem",
            borderRadius: "var(--radius-xl)",
            border: "1.5px solid var(--border-light)",
            boxShadow: "var(--shadow-sm)",
            marginBottom: "2rem",
          }}
        >
          {/* Top Search & Conventional Category row */}
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "1rem", marginBottom: "1rem" }}>
            <div style={{ position: "relative" }}>
              <Search size={18} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
              <input
                type="text"
                placeholder="Search food by name, ingredient (e.g. chickpeas, iron, omega-3, quinoa)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.75rem 1rem 0.75rem 2.75rem",
                  borderRadius: "var(--radius-pill)",
                  border: "1.5px solid var(--border-light)",
                  fontSize: "0.925rem",
                  outline: "none",
                }}
              />
            </div>

            <div>
              <select
                value={selectedConventionalCategory}
                onChange={(e) => setSelectedConventionalCategory(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.75rem 1rem",
                  borderRadius: "var(--radius-pill)",
                  border: "1.5px solid var(--border-light)",
                  backgroundColor: "#ffffff",
                  fontSize: "0.925rem",
                  color: "var(--charcoal-800)",
                  cursor: "pointer",
                }}
              >
                {conventionalCategories.map((c) => (
                  <option key={c} value={c}>
                    {c === "all" ? "All Grocery Categories" : c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Nutrient Category Filter Pills */}
          <div>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
              Target Nutrient Contribution (Foods can belong to multiple nutrients):
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem" }}>
              {nutrientFilters.map((f) => {
                const isActive = selectedNutrientTag === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setSelectedNutrientTag(f.id)}
                    style={{
                      padding: "0.45rem 0.95rem",
                      borderRadius: "var(--radius-pill)",
                      fontSize: "0.825rem",
                      fontWeight: 700,
                      border: "1px solid",
                      borderColor: isActive ? "var(--forest-800)" : "var(--border-light)",
                      backgroundColor: isActive ? "var(--forest-800)" : "var(--cream-bg)",
                      color: isActive ? "#ffffff" : "var(--charcoal-700)",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Results Counter & Multi-Nutrient Clarification */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <span style={{ fontSize: "0.9rem", color: "var(--charcoal-600)", fontWeight: 600 }}>
            Showing <strong>{foods.length}</strong> nutrient-verified whole foods
          </span>
          <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
            ✦ Values indexed per reference serving
          </span>
        </div>

        {/* Foods Grid */}
        {loading ? (
          <div style={{ padding: "4rem 0", textAlign: "center", color: "var(--muted)" }}>
            <Sparkles size={32} style={{ animation: "float 2s infinite ease-in-out", margin: "0 auto 1rem", color: "var(--green-500)" }} />
            <p>Loading nutrition catalog from database...</p>
          </div>
        ) : foods.length === 0 ? (
          <div
            style={{
              padding: "4rem 2rem",
              textAlign: "center",
              background: "#ffffff",
              borderRadius: "var(--radius-xl)",
              border: "1.5px dashed var(--border-light)",
            }}
          >
            <Info size={36} style={{ color: "var(--muted)", margin: "0 auto 12px" }} />
            <h3 style={{ fontSize: "1.25rem", color: "var(--forest-950)", marginBottom: "0.5rem" }}>
              No foods match your selected filter criteria
            </h3>
            <p style={{ color: "var(--charcoal-600)", fontSize: "0.9rem", marginBottom: "1.25rem" }}>
              Try clearing your search query or selecting a broader nutrient filter.
            </p>
            <button
              onClick={() => {
                setSearch("");
                setSelectedNutrientTag("all");
                setSelectedConventionalCategory("all");
              }}
              className="btn btn-outline btn-sm"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "1.5rem",
            }}
          >
            {foods.map((food) => {
              const tags: string[] = JSON.parse(food.nutrition_tags || "[]");
              return (
                <article
                  key={food.id}
                  style={{
                    background: "var(--paper)",
                    border: "1.5px solid var(--border-light)",
                    borderRadius: "var(--radius-xl)",
                    padding: "1.5rem",
                    display: "flex",
                    flexDirection: "column",
                    boxShadow: "var(--shadow-sm)",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-4px)";
                    e.currentTarget.style.boxShadow = "var(--shadow-md)";
                    e.currentTarget.style.borderColor = "var(--green-400)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "var(--shadow-sm)";
                    e.currentTarget.style.borderColor = "var(--border-light)";
                  }}
                >
                  {/* Top Emoji & Category tag */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                    <div
                      style={{
                        width: "54px",
                        height: "54px",
                        borderRadius: "14px",
                        background: "var(--cream-soft)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "2rem",
                      }}
                    >
                      {food.emoji || "🥗"}
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <span className="brand-badge" style={{ fontSize: "0.68rem" }}>
                        {food.category}
                      </span>
                      <small style={{ display: "block", color: "var(--muted)", fontSize: "0.72rem", marginTop: "2px" }}>
                        {food.stock_qty > 0 ? `${food.stock_qty} in stock` : "Out of stock"}
                      </small>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3 style={{ fontSize: "1.2rem", color: "var(--forest-950)", marginBottom: "0.35rem" }}>
                    {food.name}
                  </h3>
                  <p style={{ fontSize: "0.85rem", color: "var(--charcoal-600)", lineHeight: 1.5, marginBottom: "1rem", minHeight: "38px" }}>
                    {food.description}
                  </p>

                  {/* Key Nutrient Highlights Matrix */}
                  <div
                    style={{
                      background: "var(--cream-bg)",
                      borderRadius: "10px",
                      padding: "0.65rem 0.85rem",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "1rem",
                      fontSize: "0.8rem",
                    }}
                  >
                    <div>
                      <span style={{ color: "var(--muted)", display: "block", fontSize: "0.68rem" }}>Energy</span>
                      <strong style={{ color: "var(--forest-900)" }}>{food.calories} kcal</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--muted)", display: "block", fontSize: "0.68rem" }}>Protein</span>
                      <strong style={{ color: "var(--green-600)" }}>{food.protein_g}g</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--muted)", display: "block", fontSize: "0.68rem" }}>Fiber</span>
                      <strong style={{ color: "var(--forest-800)" }}>{food.fibre_g}g</strong>
                    </div>
                  </div>

                  {/* Multi-nutrient badges */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginBottom: "1.25rem" }}>
                    {tags.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          padding: "0.15rem 0.5rem",
                          borderRadius: "4px",
                          backgroundColor: "var(--green-50)",
                          color: "var(--forest-800)",
                        }}
                      >
                        ✓ {t.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>

                  {/* Price & Actions Row */}
                  <div
                    style={{
                      marginTop: "auto",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingTop: "1rem",
                      borderTop: "1px solid var(--border-subtle)",
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: "1.2rem", color: "var(--forest-900)" }}>
                        {formatPaise(food.price_paise)}
                      </strong>
                      <span style={{ fontSize: "0.75rem", color: "var(--muted)", marginLeft: "4px" }}>
                        /{food.unit}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: "0.4rem" }}>
                      <button
                        onClick={() => setSelectedFood(food)}
                        style={{
                          padding: "0.45rem 0.65rem",
                          borderRadius: "var(--radius-pill)",
                          border: "1px solid var(--border-light)",
                          background: "#ffffff",
                          color: "var(--forest-900)",
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                        title="Inspect nutrition details"
                      >
                        <Eye size={14} />
                        <span>Inspect</span>
                      </button>

                      <button
                        onClick={() => onAddToCart(food, 1)}
                        disabled={food.stock_qty <= 0}
                        style={{
                          padding: "0.45rem 0.85rem",
                          borderRadius: "var(--radius-pill)",
                          border: "none",
                          background: "var(--forest-800)",
                          color: "#ffffff",
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                        title="Add 1 to shopping bag"
                      >
                        <ShoppingBag size={14} />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Product Detail Modal */}
      <FoodDetailModal
        food={selectedFood}
        onClose={() => setSelectedFood(null)}
        onAddToCart={onAddToCart}
      />
    </section>
  );
}
