"use client";

import { FileQuestion, Shuffle, Clock, AlertTriangle, ArrowRight } from "lucide-react";

export default function Problem() {
  const problems = [
    {
      number: "01",
      icon: FileQuestion,
      title: "Nutrition labels can be difficult to understand.",
      description:
        "Everyday shoppers are confronted with cryptic E-codes, manipulated serving sizes, and percentage daily values based on generic 2,000 kcal baselines that rarely reflect an individual's actual body requirements.",
      impact: "Result: Impulse buys driven by marketing buzzwords like 'natural' or 'diet' rather than actual nutrient density.",
    },
    {
      number: "02",
      icon: Shuffle,
      title: "Choosing foods that meet individual nutritional needs can be confusing.",
      description:
        "Whether you need bioavailable iron for energy, lean protein for recovery, or prebiotic fiber for digestion, supermarket aisles sort food by factory brand and shelf life, not by what your physiology needs.",
      impact: "Result: Frustrating guesswork and nutrient gaps despite spending significant money on groceries.",
    },
    {
      number: "03",
      icon: Clock,
      title: "Planning balanced meals takes excessive time and effort.",
      description:
        "Busy working professionals, college students, and active gymgoers often lack the hours needed to calculate macros, plan recipes, balance micronutrients, and coordinate perishable groceries each week.",
      impact: "Result: Reliance on fast food, repetitive meals, and expensive grocery waste from unused ingredients.",
    },
  ];

  return (
    <section id="problem" className="section section-soft" aria-labelledby="problem-heading">
      <div className="container">
        <div className="section-header">
          <span className="section-tag amber">
            <AlertTriangle size={14} />
            <span>The Everyday Grocery Dilemma</span>
          </span>
          <h2 id="problem-heading" className="section-title">
            Healthy Eating Shouldn’t Be Complicated.
          </h2>
          <p className="section-subtitle">
            Most grocery stores organize food by category, shelf-life, and brand sponsorships.
            They make it hard to see what your body is actually getting.
          </p>
        </div>

        <div className="problem-grid">
          {problems.map((prob) => {
            const Icon = prob.icon;
            return (
              <article key={prob.number} className="problem-card">
                <div className="problem-number">{prob.number}</div>
                <div className="problem-icon-wrap">
                  <Icon size={26} />
                </div>
                <h3 className="problem-title">{prob.title}</h3>
                <p className="problem-text">{prob.description}</p>
                <div
                  style={{
                    marginTop: "1.25rem",
                    paddingTop: "1rem",
                    borderTop: "1px dashed var(--border-light)",
                    fontSize: "0.825rem",
                    color: "var(--charcoal-700)",
                    fontWeight: 600,
                  }}
                >
                  {prob.impact}
                </div>
              </article>
            );
          })}
        </div>

        {/* Bottom context callout */}
        <div className="problem-quote-strip">
          <div>
            <strong style={{ display: "block", color: "var(--forest-950)", fontSize: "1.1rem" }}>
              Who experiences this most?
            </strong>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.925rem" }}>
              College students managing budgets, busy professionals with tight schedules, and health-conscious consumers trying to eat right.
            </p>
          </div>
          <a
            href="#solution"
            className="btn btn-outline btn-sm"
            style={{ flexShrink: 0 }}
          >
            <span>See How We Fix This</span>
            <ArrowRight size={15} />
          </a>
        </div>
      </div>
    </section>
  );
}
