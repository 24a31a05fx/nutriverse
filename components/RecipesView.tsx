"use client";

import { useState, useEffect } from "react";
import {
  UtensilsCrossed,
  Clock,
  Flame,
  ChefHat,
  ShoppingBag,
  Check,
  Sparkles,
  Info,
  X,
  ArrowRight,
} from "lucide-react";
import { Recipe, Food, api, money } from "../lib/api";
import { DEFAULT_RECIPES } from "../src/data/catalog";

interface RecipesViewProps {
  onAddMultipleToCart: (items: Array<{ food: Food; quantity: number }>) => void;
  allFoods: Food[];
}

export default function RecipesView({ onAddMultipleToCart, allFoods }: RecipesViewProps) {
  const [recipes, setRecipes] = useState<Recipe[]>(DEFAULT_RECIPES);
  const [loading, setLoading] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [addedMessage, setAddedMessage] = useState("");

  useEffect(() => {
    api<Recipe[]>("/recipes")
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setRecipes(data);
        }
      })
      .catch((err) => {
        console.warn("RecipesView: API unavailable, using offline recipes:", err);
      });
  }, []);

  const handleAddAllIngredients = (recipe: Recipe) => {
    const ingredients: Array<{ name: string; qty: string; unit: string }> = JSON.parse(recipe.ingredients_json || "[]");
    const matchedFoodsToAdd: Array<{ food: Food; quantity: number }> = [];

    ingredients.forEach((ing) => {
      const match = allFoods.find((f) => f.name.toLowerCase().includes(ing.name.toLowerCase()) || ing.name.toLowerCase().includes(f.name.toLowerCase()));
      if (match) {
        matchedFoodsToAdd.push({ food: match, quantity: 1 });
      }
    });

    if (matchedFoodsToAdd.length > 0) {
      onAddMultipleToCart(matchedFoodsToAdd);
      setAddedMessage(`Added ${matchedFoodsToAdd.length} recipe ingredients to your shopping bag!`);
      setTimeout(() => setAddedMessage(""), 3000);
    } else {
      alert("Recipe ingredients are being matched with live store inventory.");
    }
  };

  return (
    <section className="section section-cream" style={{ paddingTop: "2.5rem" }}>
      <div className="container">
        {/* Header */}
        <div className="section-header">
          <span className="section-tag">
            <UtensilsCrossed size={14} />
            <span>Nutrient-Retaining Culinary Inspiration</span>
          </span>
          <h1 style={{ fontSize: "clamp(2rem, 3.8vw, 3rem)", color: "var(--forest-950)", margin: "0.25rem 0 0.75rem" }}>
            Recipes & Mindful Preparation
          </h1>
          <p className="section-subtitle">
            How you prepare whole foods changes what your body absorbs. Discover chef-curated meals
            engineered to protect heat-sensitive vitamins and maximize mineral bioavailability.
          </p>
        </div>

        {addedMessage && (
          <div
            style={{
              padding: "1rem 1.5rem",
              background: "var(--forest-800)",
              color: "#ffffff",
              borderRadius: "var(--radius-pill)",
              textAlign: "center",
              marginBottom: "2rem",
              fontWeight: 700,
              boxShadow: "var(--shadow-md)",
            }}
          >
            ✓ {addedMessage}
          </div>
        )}

        {loading ? (
          <div style={{ padding: "4rem 0", textAlign: "center", color: "var(--muted)" }}>
            <p>Loading curated recipes from database...</p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
              gap: "2rem",
            }}
          >
            {recipes.map((recipe) => {
              const ingredients: Array<{ name: string; qty: string; unit: string }> = JSON.parse(recipe.ingredients_json || "[]");
              return (
                <article
                  key={recipe.id}
                  style={{
                    background: "var(--paper)",
                    border: "1.5px solid var(--border-light)",
                    borderRadius: "var(--radius-xl)",
                    padding: "2rem",
                    display: "flex",
                    flexDirection: "column",
                    boxShadow: "var(--shadow-sm)",
                    transition: "transform 0.2s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-4px)")}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                    <div
                      style={{
                        width: "60px",
                        height: "60px",
                        borderRadius: "16px",
                        background: "var(--cream-soft)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "2.2rem",
                      }}
                    >
                      {recipe.emoji || "🍲"}
                    </div>

                    <span className="brand-badge" style={{ fontSize: "0.75rem" }}>
                      {recipe.prep_method}
                    </span>
                  </div>

                  <h3 style={{ fontSize: "1.35rem", color: "var(--forest-950)", marginBottom: "0.5rem" }}>
                    {recipe.name}
                  </h3>
                  <p style={{ fontSize: "0.9rem", color: "var(--charcoal-600)", lineHeight: 1.55, marginBottom: "1.25rem" }}>
                    {recipe.description}
                  </p>

                  {/* Metrics bar */}
                  <div
                    style={{
                      background: "var(--cream-bg)",
                      borderRadius: "10px",
                      padding: "0.75rem",
                      display: "flex",
                      justifyContent: "space-around",
                      fontSize: "0.85rem",
                      marginBottom: "1.25rem",
                      textAlign: "center",
                    }}
                  >
                    <div>
                      <span style={{ fontSize: "0.7rem", color: "var(--muted)", display: "block" }}>Prep Time</span>
                      <strong style={{ color: "var(--forest-900)" }}>{recipe.prep_time_mins} mins</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: "0.7rem", color: "var(--muted)", display: "block" }}>Energy</span>
                      <strong style={{ color: "var(--forest-900)" }}>{recipe.calories} kcal</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: "0.7rem", color: "var(--green-600)", display: "block" }}>Protein</span>
                      <strong style={{ color: "var(--green-600)" }}>{recipe.protein_g}g</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: "0.7rem", color: "var(--muted)", display: "block" }}>Servings</span>
                      <strong style={{ color: "var(--forest-900)" }}>{recipe.servings}</strong>
                    </div>
                  </div>

                  {/* Ingredients Checklist Snippet */}
                  <div style={{ marginBottom: "1.5rem" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)", display: "block", marginBottom: "0.4rem" }}>
                      Key Fresh Ingredients:
                    </span>
                    <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.3rem", fontSize: "0.825rem", color: "var(--charcoal-700)" }}>
                      {ingredients.map((ing, i) => (
                        <li key={i} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          <Check size={14} style={{ color: "var(--green-500)", flexShrink: 0 }} />
                          <span>
                            <strong>{ing.name}</strong> ({ing.qty}{ing.unit})
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ marginTop: "auto", display: "flex", gap: "0.6rem" }}>
                    <button
                      onClick={() => setSelectedRecipe(recipe)}
                      className="btn btn-outline btn-sm"
                      style={{ flex: 1 }}
                    >
                      <ChefHat size={15} />
                      <span>Cooking Steps</span>
                    </button>
                    <button
                      onClick={() => handleAddAllIngredients(recipe)}
                      className="btn btn-primary btn-sm"
                      style={{ flex: 1 }}
                    >
                      <ShoppingBag size={15} />
                      <span>Add Ingredients</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Recipe Steps Modal */}
        {selectedRecipe && (
          <div className="modal-overlay" onClick={() => setSelectedRecipe(null)} role="dialog" aria-modal="true">
            <div className="modal-dialog" style={{ maxWidth: "680px" }} onClick={(e) => e.stopPropagation()}>
              <button className="modal-close-btn" onClick={() => setSelectedRecipe(null)}>
                <X size={20} />
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <span className="section-tag">{selectedRecipe.prep_method}</span>
                <span style={{ fontSize: "0.85rem", color: "var(--muted)", fontWeight: 600 }}>
                  ⏱ {selectedRecipe.prep_time_mins} minutes · {selectedRecipe.calories} kcal / serving
                </span>
              </div>

              <h2 style={{ fontSize: "1.75rem", color: "var(--forest-950)", marginBottom: "0.75rem" }}>
                {selectedRecipe.name}
              </h2>

              <p style={{ color: "var(--charcoal-600)", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: "1.5rem" }}>
                {selectedRecipe.description}
              </p>

              <div style={{ background: "var(--cream-bg)", padding: "1.25rem", borderRadius: "var(--radius-md)", marginBottom: "1.5rem" }}>
                <strong style={{ fontSize: "0.95rem", color: "var(--forest-900)", display: "block", marginBottom: "0.75rem" }}>
                  Step-by-Step Preparation Method:
                </strong>
                <div style={{ whiteSpace: "pre-line", fontSize: "0.9rem", color: "var(--charcoal-800)", lineHeight: 1.7 }}>
                  {selectedRecipe.instructions}
                </div>
              </div>

              <div
                style={{
                  padding: "0.85rem 1rem",
                  background: "var(--green-50)",
                  border: "1px solid var(--green-200)",
                  borderRadius: "var(--radius-md)",
                  fontSize: "0.825rem",
                  color: "var(--forest-900)",
                  marginBottom: "1.5rem",
                }}
              >
                💡 <strong>Nutrient Retention Science:</strong> Prolonged boiling leaches water-soluble Folate and Vitamin C into cooking liquid. Flash steaming or adding greens at the end locks up to 85% of micronutrients in the food.
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button className="btn btn-outline btn-sm" onClick={() => setSelectedRecipe(null)}>
                  Close
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    handleAddAllIngredients(selectedRecipe);
                    setSelectedRecipe(null);
                  }}
                >
                  <ShoppingBag size={16} />
                  <span>Add Ingredients to Bag</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
