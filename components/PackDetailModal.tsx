"use client";

import { X, Sparkles, Check, Info, ArrowRight } from "lucide-react";

export interface PackDetail {
  id: string;
  name: string;
  tag: string;
  description: string;
  targetAudience: string;
  illustrativeItems: string[];
  nutritionalFocus: string[];
  customizationNote: string;
}

interface PackDetailModalProps {
  pack: PackDetail | null;
  onClose: () => void;
  onInquire: () => void;
}

export default function PackDetailModal({ pack, onClose, onInquire }: PackDetailModalProps) {
  if (!pack) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-pack-title">
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
          <X size={20} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <span className="section-tag">{pack.tag}</span>
          <span className="section-tag gold">Concept Preview</span>
        </div>

        <h3 id="modal-pack-title" style={{ fontSize: "1.75rem", marginBottom: "0.5rem", color: "var(--forest-950)" }}>
          {pack.name} Calin Pack
        </h3>

        <p style={{ color: "var(--charcoal-600)", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: "1.5rem" }}>
          {pack.description}
        </p>

        <div style={{ padding: "1rem", backgroundColor: "var(--cream-soft)", borderRadius: "var(--radius-md)", marginBottom: "1.5rem" }}>
          <strong style={{ display: "block", fontSize: "0.85rem", color: "var(--forest-900)", marginBottom: "0.25rem" }}>
            Designed Primarily For:
          </strong>
          <span style={{ fontSize: "0.9rem", color: "var(--charcoal-700)" }}>{pack.targetAudience}</span>
        </div>

        <div style={{ marginBottom: "1.5rem" }}>
          <h4 style={{ fontSize: "1rem", marginBottom: "0.75rem", color: "var(--forest-900)" }}>
            Sample Whole Food Inclusions (Illustrative):
          </h4>
          <ul style={{ listStyle: "none", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            {pack.illustrativeItems.map((item) => (
              <li
                key={item}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontSize: "0.85rem",
                  color: "var(--charcoal-700)",
                  background: "var(--paper)",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-light)",
                }}
              >
                <Check size={14} style={{ color: "var(--green-500)", flexShrink: 0 }} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div style={{ marginBottom: "1.5rem" }}>
          <h4 style={{ fontSize: "1rem", marginBottom: "0.75rem", color: "var(--forest-900)" }}>
            Nutritional Priorities:
          </h4>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {pack.nutritionalFocus.map((focus) => (
              <span
                key={focus}
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  backgroundColor: "var(--green-100)",
                  color: "var(--forest-800)",
                  padding: "0.3rem 0.75rem",
                  borderRadius: "var(--radius-pill)",
                }}
              >
                {focus}
              </span>
            ))}
          </div>
        </div>

        {/* Future Capabilities Note */}
        <div
          style={{
            padding: "0.85rem 1rem",
            borderRadius: "var(--radius-md)",
            backgroundColor: "var(--gold-50)",
            border: "1px solid rgba(217, 119, 6, 0.2)",
            fontSize: "0.8rem",
            color: "#92400e",
            display: "flex",
            alignItems: "flex-start",
            gap: "0.6rem",
            marginBottom: "1.5rem",
          }}
        >
          <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            <strong>Concept Note:</strong> {pack.customizationNote} Personalized nutritionist customization and scheduled weekly subscription delivery are planned features currently in concept review.
          </span>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
          <button className="btn btn-outline btn-sm" onClick={onClose}>
            Close
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              onClose();
              onInquire();
            }}
          >
            <span>Express Early Interest</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
