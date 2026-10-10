"use client";

import { useState, FormEvent } from "react";
import { ArrowRight, Mail, CheckCircle2, Sparkles, MessageSquare } from "lucide-react";

interface CtaSectionProps {
  onContactClick: () => void;
  onExploreClick: () => void;
}

export default function CtaSection({ onContactClick, onExploreClick }: CtaSectionProps) {
  const [email, setEmail] = useState("");
  const [persona, setPersona] = useState("College Student / Young Adult");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@") || !email.includes(".")) {
      setError("Please provide a valid email address.");
      return;
    }
    setError("");
    setSubmitted(true);
  };

  return (
    <section className="section section-cream" aria-labelledby="cta-heading">
      <div className="container">
        <div className="cta-banner">
          <div className="cta-content">
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.35rem 0.95rem",
                backgroundColor: "rgba(255, 255, 255, 0.15)",
                color: "#dcf2e3",
                borderRadius: "var(--radius-pill)",
                fontSize: "0.8125rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: "1.25rem",
              }}
            >
              <Sparkles size={14} />
              <span>Join the Nutriverse Journey</span>
            </span>

            <h2 id="cta-heading" className="cta-title">
              Ready to Make Smarter Food Choices?
            </h2>

            <p className="cta-text">
              Discover a new way to understand nutrition and explore food that fits your needs.
              Sign up to stay updated on our upcoming pilots, sample tastings, and Calin Pack releases.
            </p>

            {/* Early-stage Interest / Waitlist Form */}
            <div className="cta-form-wrap">
              {submitted ? (
                <div
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    color: "var(--forest-900)",
                    padding: "1.25rem",
                    borderRadius: "var(--radius-md)",
                    textAlign: "center",
                  }}
                  role="status"
                >
                  <CheckCircle2 size={32} style={{ color: "var(--green-500)", margin: "0 auto 8px" }} />
                  <strong style={{ display: "block", fontSize: "1.1rem" }}>
                    Thank you for your early interest!
                  </strong>
                  <p style={{ fontSize: "0.875rem", color: "var(--charcoal-600)", margin: "4px 0 0" }}>
                    We’ve recorded <strong>{email}</strong> ({persona}). You will be among the first to hear when our pilot launches in your area.
                  </p>
                  <button
                    onClick={() => {
                      setSubmitted(false);
                      setEmail("");
                    }}
                    style={{
                      marginTop: "10px",
                      fontSize: "0.8rem",
                      color: "var(--forest-800)",
                      textDecoration: "underline",
                      fontWeight: 600,
                    }}
                  >
                    Submit another response
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} noValidate>
                  <div style={{ marginBottom: "0.75rem", textAlign: "left" }}>
                    <label
                      htmlFor="interest-persona"
                      style={{
                        display: "block",
                        fontSize: "0.8rem",
                        color: "rgba(255, 255, 255, 0.9)",
                        fontWeight: 600,
                        marginBottom: "4px",
                      }}
                    >
                      I describe myself primarily as:
                    </label>
                    <select
                      id="interest-persona"
                      value={persona}
                      onChange={(e) => setPersona(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.75rem 1rem",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid rgba(255, 255, 255, 0.3)",
                        backgroundColor: "#ffffff",
                        color: "var(--charcoal-900)",
                        fontSize: "0.9rem",
                        fontFamily: "var(--font-body)",
                      }}
                    >
                      <option value="College Student / Young Adult">College Student / Young Adult</option>
                      <option value="Busy Working Professional">Busy Working Professional</option>
                      <option value="Fitness Enthusiast / Gymgoer">Fitness Enthusiast / Gymgoer</option>
                      <option value="Health-Conscious Shopper">Health-Conscious Consumer</option>
                      <option value="Investor / Startup Partner">Investor / Potential Partner</option>
                    </select>
                  </div>

                  <div className="cta-form-row">
                    <input
                      type="email"
                      className="cta-input"
                      placeholder="Enter your email address..."
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      aria-label="Email address for early access"
                      required
                    />
                    <button type="submit" className="btn btn-secondary btn-sm" style={{ padding: "0.85rem 1.5rem" }}>
                      <span>Notify Me</span>
                      <ArrowRight size={16} />
                    </button>
                  </div>

                  {error && (
                    <p style={{ color: "#fca5a5", fontSize: "0.825rem", marginTop: "0.5rem", textAlign: "left" }}>
                      {error}
                    </p>
                  )}

                  <p
                    style={{
                      fontSize: "0.75rem",
                      color: "rgba(250, 247, 240, 0.7)",
                      marginTop: "0.75rem",
                      textAlign: "left",
                    }}
                  >
                    ✦ Early-stage concept waitlist · No spam, ever · Unsubscribe anytime.
                  </p>
                </form>
              )}
            </div>

            {/* Bottom Two Primary Buttons */}
            <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={onContactClick} className="btn btn-white btn-lg" id="btn-cta-contact">
                <MessageSquare size={18} />
                <span>Get in Touch</span>
              </button>

              <button onClick={onExploreClick} className="btn btn-white-outline btn-lg" id="btn-cta-explore">
                <span>Explore Nutriverse</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
