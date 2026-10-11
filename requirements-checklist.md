# Nutriverse Requirements Checklist & Implementation Tracker

This checklist tracks every requirement from the client brief, PRD, TRD, and Reference Screenshots A & B.

---

## 1. Reference Screenshots Alignment
- [x] **Reference A (Product Detail Page)**
  - [x] Large, authentic product photograph gallery with navigation dots.
  - [x] Compact health-benefits section with "Health Benefits" tag, highlight, and "View details" button.
  - [x] Delivery time estimate (e.g., "8 mins" or slot indicator).
  - [x] Product name and local Indian name (e.g., *Potato (Bangala Dumpa)*).
  - [x] Unit and pack-size selector cards with active highlight, price, and struck MRP.
  - [x] Current price and MRP displayed prominently.
  - [x] Replacement policy info (e.g., "48 hours only replacement" with chevron).
  - [x] Related products carousel from real catalog with quick Add controls.
  - [x] Floating cart summary pill ("View cart / X items >").
  - [x] Fixed bottom purchase bar for mobile/desktop with unit, price, MRP, and "Add to cart" button.
- [x] **Reference B (Home Page)**
  - [x] Delivery slot and location selector bar ("Next slot in 5 hrs • Selected Location...").
  - [x] Prominent search bar with active filter interaction, microphone, and favorites icons.
  - [x] Horizontal category icons/pills covering all 10 taxonomy groups.
  - [x] Visual promotional / seasonal harvest banner.
  - [x] Curated sub-category quick-picks (Festive picks, Daily staples, High protein, Fresh greens).
  - [x] Delivery incentive banner ("Unlock FREE Delivery / Shop for ₹100 more").
  - [x] Product carousels with authentic photos, prices, pack sizes, discount badges, and quick-add controls.
  - [x] Floating bottom cart pill with item count and progress.
  - [x] Bottom navigation bar for mobile shoppers (Home, Categories, Calin Packs, Scanner, Account).

---

## 2. Real Product Images and Data
- [x] Authentic photographs for all grocery products (Unsplash Commercial License & reference extractions).
- [x] Zero AI-generated grocery imagery presented as real photos.
- [x] Image provenance metadata maintained in `src/data/catalog.ts` and `public/assets/products/provenance.json`.
- [x] Traceable nutritional data with serving basis and ICMR-NIN RDA 2020 / IFCT 2017 citations.
- [x] Local names (Telugu / Hindi) for all Indian staples.
- [x] Struck MRP and discount percentages calculated from verified pricing.

---

## 3. Core Nutriverse Business Concept
- [x] **A. Nutrition-First Grocery Store**
  - [x] Browse by conventional grocery categories and nutritional groups (Protein, Carbs, Fats, Vitamins & Minerals).
  - [x] Compare nutrient density across products.
  - [x] Sourced nutrition data with verification badges.
- [x] **B. Product-Linked Nutrition Companion**
  - [x] Nutrition values, serving basis, and verification status on every product.
  - [x] Preparation guidance and recipe pairings.
  - [x] Barcode/QR lookup (`/p/[barcode]`) and manual barcode entry.
  - [x] Honest assistant status banner ("General nutritional guidance grounded in Nutriverse catalog").
- [x] **C. Calin Packs — Core Differentiator**
  - [x] Clear explanation of Calin Pack purpose.
  - [x] Three tiers: Basic (₹600–₹800), Minimal Plus (₹800–₹1,200), Premium (₹1,500–₹1,800).
  - [x] User physical profile inputs with Mifflin–St Jeor BMR and TDEE calculation.
  - [x] Specific grocery items and quantities suggested per tier.
  - [x] Separate display of verified contributions, unmet targets, and unverified data.
  - [x] Item substitution engine maintaining nutrient parity.
  - [x] Add entire pack to shared cart.
  - [x] Nutritionist review request queue with explicit customer confirmation for proposals.

---

## 4. Authentication and Account Experience
- [x] Dedicated `/login` and `/signup` routes.
- [x] Form validation with clear error feedback.
- [x] Password visibility toggles (Show/Hide).
- [x] Safe registration (users cannot self-grant admin or nutritionist roles; always registered as customer `user`).
- [x] HttpOnly cookie session handling and CSRF tokens.
- [x] Logout functionality with state clearing.
- [x] Protected routes for Account, Orders, Admin, and Nutritionist.
- [x] Seamless post-login return-to-previous-page behavior.

---

## 5. Every Button Functional
- [x] Logo / Home navigation.
- [x] Search input, submission, and filter reset.
- [x] Category navigation pills with live filtering.
- [x] Product card clicks open detail page or modal.
- [x] Favorite heart toggle buttons.
- [x] Unit selection dropdowns and selector cards.
- [x] Quantity increment/decrement steppers.
- [x] Add to Cart and Add Pack to Cart.
- [x] Cart drawer open/close and line item removal.
- [x] Proceed to Checkout and Place Demo Order.
- [x] BMR calculator submission and intake updates.
- [x] Pack tier customization and ingredient substitutions.
- [x] Nutritionist review submission and approval confirmation.
- [x] Optical scanner and manual barcode lookup.
- [x] Mobile bottom navigation tabs.

---

## 6. Mobile & Desktop Responsiveness
- [x] 375px mobile width.
- [x] 390px mobile width.
- [x] Tablet viewport (768px).
- [x] Desktop viewport (1280px+).
- [x] Touch-friendly targets and sticky bottom purchase bars respecting safe area insets.

---

## 7. Testing & Verification
- [x] Backend unit & API tests (pytest): 38 passed, 1 skipped.
- [x] TypeScript type checking (`tsc --noEmit`): 0 errors.
- [x] End-to-end Playwright tests (`npm run test:e2e`).
- [x] Visual browser subagent inspection at mobile and desktop.
