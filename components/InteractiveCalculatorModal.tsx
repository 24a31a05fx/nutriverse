"use client";

import { useState, FormEvent } from "react";
import { X, Calculator, Sparkles, Check, Flame, ArrowRight } from "lucide-react";

interface CalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPack: () => void;
}

export default function InteractiveCalculatorModal({
  isOpen,
  onClose,
  onSelectPack,
}: CalculatorModalProps) {
  const [age, setAge] = useState(25);
  const [sex, setSex] = useState<"female" | "male">("female");
  const [height, setHeight] = useState(168);
  const [weight, setWeight] = useState(62);
  const [activity, setActivity] = useState(1.375); // lightly active
  const [result, setResult] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleCalculate = (e: FormEvent) => {
    e.preventDefault();
    // Mifflin-St Jeor Equation
    const bmr = 10 * weight + 6.25 * height - 5 * age + (sex === "male" ? 5 : -161);
    const estimatedDailyCalories = Math.round(bmr * activity);
    setResult(estimatedDailyCalories);
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="calc-modal-title">
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose} aria-label="Close calculator">
          <X size={20} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <span className="section-tag">
            <Calculator size={14} />
            <span>Interactive Tool</span>
          </span>
          <span className="section-tag gold">Baseline Energy Estimator</span>
        </div>

        <h3 id="calc-modal-title" style={{ fontSize: "1.65rem", color: "var(--forest-950)", marginBottom: "0.5rem" }}>
          Estimate Your Nutrition Baseline
        </h3>

        <p style={{ color: "var(--charcoal-600)", fontSize: "0.9rem", lineHeight: 1.5, marginBottom: "1.25rem" }}>
          Use the scientific Mifflin-St Jeor formula to discover your baseline energy requirement and see how Nutriverse groceries match your daily needs.
        </p>

        <form onSubmit={handleCalculate}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label className="form-label" htmlFor="calc-age">Age (years)</label>
              <input
                id="calc-age"
                type="number"
                min="13"
                max="100"
                className="form-control"
                value={age}
                onChange={(e) => setAge(Number(e.target.value))}
                required
              />
            </div>

            <div>
              <label className="form-label" htmlFor="calc-sex">Biological Sex</label>
              <select
                id="calc-sex"
                className="form-control"
                value={sex}
                onChange={(e) => setSex(e.target.value as "female" | "male")}
              >
                <option value="female">Female</option>
                <option value="male">Male</option>
              </select>
            </div>

            <div>
              <label className="form-label" htmlFor="calc-height">Height (cm)</label>
              <input
                id="calc-height"
                type="number"
                min="120"
                max="230"
                className="form-control"
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
                required
              />
            </div>

            <div>
              <label className="form-label" htmlFor="calc-weight">Weight (kg)</label>
              <input
                id="calc-weight"
                type="number"
                min="30"
                max="200"
                className="form-control"
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: "1.25rem" }}>
            <label className="form-label" htmlFor="calc-activity">Typical Daily Activity</label>
            <select
              id="calc-activity"
              className="form-control"
              value={activity}
              onChange={(e) => setActivity(Number(e.target.value))}
            >
              <option value="1.2">Mostly Sedentary (desk work, minimal exercise)</option>
              <option value="1.375">Lightly Active (1-3 days light movement/walking)</option>
              <option value="1.55">Moderately Active (3-5 days workout / brisk activity)</option>
              <option value="1.725">Very Active (6-7 days intense athletics/gym)</option>
            </select>
          </div>

          <button type="submit" className="btn btn-secondary btn-sm" style={{ width: "100%", padding: "0.8rem" }}>
            <Calculator size={16} />
            <span>Calculate Daily Target</span>
          </button>
        </form>

        {result && (
          <div
            style={{
              marginTop: "1.25rem",
              padding: "1.25rem",
              background: "var(--green-50)",
              borderRadius: "var(--radius-lg)",
              border: "1.5px solid var(--green-200)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "0.85rem", color: "var(--forest-800)", fontWeight: 700 }}>
                Estimated Daily Energy Needs:
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "var(--forest-950)", fontSize: "1.35rem", fontWeight: 800 }}>
                <Flame size={20} style={{ color: "var(--green-500)" }} />
                <span>{result.toLocaleString("en-IN")}</span>
                <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>kcal / day</span>
              </div>
            </div>

            <p style={{ fontSize: "0.8rem", color: "var(--charcoal-600)", margin: "0.5rem 0 0.85rem" }}>
              General scientific estimate for planning. A balanced Calin Pack can fulfill 60–75% of your weekday whole-food micronutrient targets.
            </p>

            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  onClose();
                  onSelectPack();
                }}
              >
                <span>View Suitable Calin Packs</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "1rem", textAlign: "center" }}>
          ✦ Nutritional calculation based on Mifflin-St Jeor formula. For educational purposes only.
        </p>
      </div>
    </div>
  );
}
