"use client";

import { useState, FormEvent } from "react";
import Image from "next/image";
import {
  Mail,
  MapPin,
  Send,
  CheckCircle2,
  AlertCircle,
  ArrowUp,
  FileText,
  ShieldCheck,
  X,
  ExternalLink,
} from "lucide-react";

export default function ContactAndFooter() {
  // Form State
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "General Startup Inquiry",
    message: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Legal Modal State
  const [legalModal, setLegalModal] = useState<"privacy" | "terms" | null>(null);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!formData.name.trim()) {
      errs.name = "Full name is required.";
    }
    if (!formData.email.trim()) {
      errs.email = "Email address is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errs.email = "Please enter a valid email address.";
    }
    if (!formData.message.trim()) {
      errs.message = "Message cannot be empty.";
    } else if (formData.message.trim().length < 15) {
      errs.message = "Please provide at least 15 characters so we can understand your inquiry.";
    }
    return errs;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    // Simulate reliable client-side processing
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);
    }, 600);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      {/* Contact Section */}
      <section id="contact" className="section section-soft" aria-labelledby="contact-heading">
        <div className="container">
          <div className="section-header">
            <span className="section-tag">
              <Mail size={14} />
              <span>Get In Touch</span>
            </span>
            <h2 id="contact-heading" className="section-title">
              Let’s Connect & Collaborate
            </h2>
            <p className="section-subtitle">
              Have questions about the Nutriverse concept, interested in pilot partnerships,
              or want to share feedback on our Calin Packs? We would love to hear from you.
            </p>
          </div>

          <div className="contact-grid">
            {/* Left: Contact Info & Placeholders */}
            <div className="contact-info-card">
              <div>
                <h3 style={{ fontSize: "1.5rem", color: "var(--forest-950)", marginBottom: "0.75rem" }}>
                  Nutriverse Innovation Lab
                </h3>
                <p style={{ color: "var(--charcoal-600)", lineHeight: 1.6, marginBottom: "1.75rem" }}>
                  Nutriverse is currently in an early venture development and concept phase.
                  We welcome feedback from nutritionists, culinary partners, students, and potential early users.
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <div className="contact-detail-row">
                  <div className="contact-detail-icon">
                    <Mail size={20} />
                  </div>
                  <div>
                    <span style={{ fontSize: "0.8rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
                      Primary Email [Placeholder]
                    </span>
                    <p style={{ margin: "2px 0 0", fontWeight: 600, color: "var(--forest-900)" }}>
                      contact@nutriverse.example
                    </p>
                    <small style={{ color: "var(--charcoal-500)", fontSize: "0.75rem" }}>
                      (Update with official founders’ contact email)
                    </small>
                  </div>
                </div>

                <div className="contact-detail-row">
                  <div className="contact-detail-icon">
                    <MapPin size={20} />
                  </div>
                  <div>
                    <span style={{ fontSize: "0.8rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
                      Headquarters / Origin [Placeholder]
                    </span>
                    <p style={{ margin: "2px 0 0", fontWeight: 600, color: "var(--forest-900)" }}>
                      Bangalore, Karnataka, India
                    </p>
                    <small style={{ color: "var(--charcoal-500)", fontSize: "0.75rem" }}>
                      (Early-stage startup assignment & prototype hub)
                    </small>
                  </div>
                </div>
              </div>

              {/* Startup Notice Box */}
              <div
                style={{
                  marginTop: "auto",
                  padding: "1.25rem",
                  backgroundColor: "var(--paper)",
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid var(--border-light)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <ShieldCheck size={18} style={{ color: "var(--green-500)" }} />
                  <strong style={{ fontSize: "0.875rem", color: "var(--forest-900)" }}>
                    Early-Stage Venture Concept
                  </strong>
                </div>
                <p style={{ fontSize: "0.825rem", color: "var(--charcoal-600)", margin: 0, lineHeight: 1.5 }}>
                  Nutriverse does not currently possess retail store locations, third-party sales certifications,
                  or medical partnerships. All features and bundle offerings are displayed for concept evaluation.
                </p>
              </div>
            </div>

            {/* Right: Working Contact Form */}
            <div className="contact-form-card">
              <h3 style={{ fontSize: "1.35rem", color: "var(--forest-950)", marginBottom: "0.5rem" }}>
                Send Us a Message
              </h3>
              <p style={{ fontSize: "0.875rem", color: "var(--charcoal-600)", marginBottom: "1.5rem" }}>
                Complete the fields below to submit an inquiry to the Nutriverse founding team.
              </p>

              {submitted ? (
                <div
                  style={{
                    padding: "2rem",
                    backgroundColor: "var(--green-50)",
                    border: "1.5px solid var(--green-200)",
                    borderRadius: "var(--radius-lg)",
                    textAlign: "center",
                  }}
                  role="status"
                >
                  <CheckCircle2 size={44} style={{ color: "var(--green-500)", margin: "0 auto 12px" }} />
                  <h4 style={{ fontSize: "1.25rem", color: "var(--forest-950)", marginBottom: "0.5rem" }}>
                    Message Received Successfully!
                  </h4>
                  <p style={{ fontSize: "0.9rem", color: "var(--charcoal-700)", lineHeight: 1.6, marginBottom: "1rem" }}>
                    Thank you, <strong>{formData.name}</strong>. Your note regarding <em>“{formData.subject}”</em> has been processed locally in this demo environment.
                  </p>

                  <div className="form-demo-banner" style={{ textAlign: "left", marginBottom: "1.25rem" }}>
                    <strong>Developer / Founder Note:</strong> This contact form operates in client-side demonstration mode. To route incoming inquiries to an actual inbox or CRM in production, connect this form handler to your FastAPI backend endpoint (e.g. <code>POST /contact</code>) or an external mail provider such as Resend or Formspree.
                  </div>

                  <button
                    onClick={() => {
                      setSubmitted(false);
                      setFormData({
                        name: "",
                        email: "",
                        subject: "General Startup Inquiry",
                        message: "",
                      });
                    }}
                    className="btn btn-outline btn-sm"
                  >
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} noValidate>
                  <div className="form-group">
                    <label htmlFor="contact-name" className="form-label">
                      Full Name <span style={{ color: "#e07a5f" }}>*</span>
                    </label>
                    <input
                      id="contact-name"
                      type="text"
                      className="form-control"
                      placeholder="e.g. Maya Sharma"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                    {errors.name && <span className="form-error">{errors.name}</span>}
                  </div>

                  <div className="form-group">
                    <label htmlFor="contact-email" className="form-label">
                      Email Address <span style={{ color: "#e07a5f" }}>*</span>
                    </label>
                    <input
                      id="contact-email"
                      type="email"
                      className="form-control"
                      placeholder="e.g. maya@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                    {errors.email && <span className="form-error">{errors.email}</span>}
                  </div>

                  <div className="form-group">
                    <label htmlFor="contact-subject" className="form-label">
                      Subject / Topic of Interest
                    </label>
                    <select
                      id="contact-subject"
                      className="form-control"
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    >
                      <option value="General Startup Inquiry">General Startup Inquiry</option>
                      <option value="Calin Packs Early Feedback">Calin Packs Early Feedback</option>
                      <option value="Student / Campus Pilot Opportunity">Student / Campus Pilot Opportunity</option>
                      <option value="Nutritionist / Dietitian Collaboration">Nutritionist / Dietitian Collaboration</option>
                      <option value="Startup Venture / Assignment Review">Startup Venture / Assignment Review</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="contact-message" className="form-label">
                      Your Message <span style={{ color: "#e07a5f" }}>*</span>
                    </label>
                    <textarea
                      id="contact-message"
                      className="form-control"
                      placeholder="Share your thoughts, suggestions, or questions with the Nutriverse team..."
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      rows={4}
                      required
                    />
                    {errors.message && <span className="form-error">{errors.message}</span>}
                  </div>

                  <div className="form-demo-banner">
                    ✦ <strong>Demo Mode Notice:</strong> Form submissions are validated and confirmed locally. In production, this can be hooked directly to the FastAPI backend or webhook service.
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary btn-lg"
                    style={{ width: "100%", marginTop: "1.25rem" }}
                    disabled={isSubmitting}
                  >
                    <Send size={18} />
                    <span>{isSubmitting ? "Submitting..." : "Send Message to Nutriverse"}</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="site-footer" role="contentinfo">
        <div className="container">
          <div className="footer-top">
            {/* Col 1: Brand & Mission */}
            <div className="footer-brand">
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                <div style={{ position: "relative", width: 36, height: 36, borderRadius: 8, overflow: "hidden" }}>
                  <Image
                    src="/assets/nutriverse-logo.jpeg"
                    alt="Nutriverse Logo"
                    fill
                    sizes="36px"
                    style={{ objectFit: "cover" }}
                  />
                </div>
                <h3 style={{ margin: 0, color: "#ffffff", fontSize: "1.4rem" }}>Nutriverse</h3>
              </div>
              <p style={{ color: "rgba(250, 247, 240, 0.75)", fontSize: "0.9rem", lineHeight: 1.6, maxWidth: 320 }}>
                A nutrition-first grocery platform helping people understand their nutritional needs and make smarter food choices.
              </p>
              <p style={{ color: "rgba(250, 247, 240, 0.5)", fontSize: "0.8rem", marginTop: "1rem" }}>
                Mission: Make nutrition easier to understand, choose, buy, and consume.
              </p>
            </div>

            {/* Col 2: Navigation Links */}
            <div className="footer-col">
              <h4>Platform Concept</h4>
              <ul className="footer-links">
                <li><a href="#hero">Overview</a></li>
                <li><a href="#problem">The Problem</a></li>
                <li><a href="#solution">Our Solution</a></li>
                <li><a href="#how-it-works">How It Works</a></li>
                <li><a href="#calin-packs">Calin Packs</a></li>
              </ul>
            </div>

            {/* Col 3: Innovation & Tech */}
            <div className="footer-col">
              <h4>Experience</h4>
              <ul className="footer-links">
                <li><a href="#benefits">Key Benefits</a></li>
                <li><a href="#app-preview">Mobile App Preview</a></li>
                <li><a href="#mission">Our Mission</a></li>
                <li><a href="#contact">Contact Founding Team</a></li>
              </ul>
            </div>

            {/* Col 4: Transparency & Social Links */}
            <div className="footer-col">
              <h4>Startup Notice</h4>
              <p style={{ fontSize: "0.8rem", color: "rgba(250, 247, 240, 0.65)", lineHeight: 1.5, marginBottom: "1rem" }}>
                Early-stage startup concept. Official social channels will be linked upon public brand launch.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <button
                  onClick={() => setLegalModal("privacy")}
                  style={{ color: "#dcf2e3", fontSize: "0.85rem", textAlign: "left", textDecoration: "underline" }}
                >
                  Privacy Policy (Draft)
                </button>
                <button
                  onClick={() => setLegalModal("terms")}
                  style={{ color: "#dcf2e3", fontSize: "0.85rem", textAlign: "left", textDecoration: "underline" }}
                >
                  Terms of Concept (Draft)
                </button>
              </div>
            </div>
          </div>

          {/* Footer Bottom Bar */}
          <div className="footer-bottom">
            <div>
              © {new Date().getFullYear()} Nutriverse Technologies. All rights reserved. Early-Stage Venture Prototype.
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <span style={{ fontSize: "0.775rem", color: "rgba(250, 247, 240, 0.5)" }}>
                Crafted for healthy, conscious eaters.
              </span>
              <button
                onClick={scrollToTop}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  color: "#ffffff",
                  fontSize: "0.8rem",
                  background: "rgba(255, 255, 255, 0.1)",
                  padding: "0.4rem 0.8rem",
                  borderRadius: "var(--radius-pill)",
                }}
                aria-label="Scroll back to top"
              >
                <span>Back to Top</span>
                <ArrowUp size={14} />
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Privacy Policy & Terms Modal */}
      {legalModal && (
        <div className="modal-overlay" onClick={() => setLegalModal(null)} role="dialog" aria-modal="true">
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setLegalModal(null)} aria-label="Close dialog">
              <X size={20} />
            </button>

            {legalModal === "privacy" ? (
              <div>
                <span className="section-tag">Legal Transparency</span>
                <h3 style={{ fontSize: "1.5rem", color: "var(--forest-950)", margin: "0.5rem 0 1rem" }}>
                  Nutriverse Privacy Policy (Early Concept Draft)
                </h3>
                <div style={{ color: "var(--charcoal-600)", fontSize: "0.875rem", lineHeight: 1.6, maxHeight: "55vh", overflowY: "auto", paddingRight: "0.5rem" }}>
                  <p><strong>1. Information Collection:</strong> When you express interest via our early access form or message us through our contact interface, we collect your provided contact information (name, email, persona category). We do not collect credit cards or sensitive health records.</p>
                  <p style={{ marginTop: "0.75rem" }}><strong>2. Purpose of Use:</strong> Data submitted is solely utilized to assess interest, communicate concept updates, and validate product demand for Nutriverse and our Calin Packs.</p>
                  <p style={{ marginTop: "0.75rem" }}><strong>3. Third-Party Sharing:</strong> We do not sell, rent, or trade your contact details to third-party advertisers or data brokers.</p>
                  <p style={{ marginTop: "0.75rem" }}><strong>4. Data Retention:</strong> You may request deletion of your email address from our early interest list at any time by contacting our founding team placeholder email.</p>
                </div>
              </div>
            ) : (
              <div>
                <span className="section-tag gold">Terms of Concept</span>
                <h3 style={{ fontSize: "1.5rem", color: "var(--forest-950)", margin: "0.5rem 0 1rem" }}>
                  Nutriverse Terms of Concept
                </h3>
                <div style={{ color: "var(--charcoal-600)", fontSize: "0.875rem", lineHeight: 1.6, maxHeight: "55vh", overflowY: "auto", paddingRight: "0.5rem" }}>
                  <p><strong>1. Concept Representation:</strong> The Nutriverse website represents an early-stage startup project, academic prototype, and business proposal. All product listings, mockups, and Calin Pack tiers are conceptual illustrations.</p>
                  <p style={{ marginTop: "0.75rem" }}><strong>2. Non-Commercial Status:</strong> No commercial transactions are currently processed through this landing page. Contact forms and interest registrations reflect non-binding expressions of interest.</p>
                  <p style={{ marginTop: "0.75rem" }}><strong>3. Medical Disclaimer:</strong> Content provided across this platform is for educational and informational food awareness only and is not medical advice.</p>
                </div>
              </div>
            )}

            <div style={{ marginTop: "1.5rem", textAlign: "right" }}>
              <button className="btn btn-primary btn-sm" onClick={() => setLegalModal(null)}>
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
