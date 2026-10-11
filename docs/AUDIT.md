# NUTRIVERSE CODEBASE AUDIT & TECHNICAL GAP ANALYSIS
**Date:** October 11, 2026  
**Auditor:** Senior Full-Stack Engineer & Technical Lead  
**Scope:** Current codebase (`backend/app/main.py`, `app/page.tsx`, `components/`, `lib/api.ts`, `backend/tests/test_api.py`) vs. Production Quick-Commerce Master Specification.

---

## 1. Executive Summary & Audit Verdict

The current Nutriverse repository is a working prototype with a Next.js 14 frontend and a FastAPI backend communicating over REST with SQLite. While the user-facing interface looks aligned with the brand design system and 12 unit tests pass in pytest, **the codebase is currently structured as an unversioned single-page prototype rather than a production-ready quick-commerce application.**

### Critical Architectural Deficiencies Identified:
1. `[RESOLVED in 1a]` **Single-Page Tab Switcher vs. Real Routing:** The Next.js frontend has zero App Router subroutes. All navigation is state-based (`activeTab = "storefront" | "explorer" | ...`). Deep links (`/explore`, `/food/[id]`, `/p/[barcode]`, `/orders/[id]`) and browser history (back/forward) do not work.
2. `[RESOLVED in 1a.1]` **Simulated Authentication & High-Risk Defaults:** Every unauthenticated visitor is automatically logged in as a demo user (`alex@nutriverse.local`). JWT tokens are stored in `localStorage` without refresh tokens or HttpOnly cookies. Hardcoded seed passwords and 1-click role-switching shortcuts run unconditionally without checking `APP_ENV=development`.
3. `[OPEN - Phase 1b]` **Monetary Integrity (INR vs. Paise):** Prices are stored as integer Rupees (`price_inr = 199`) instead of integer paise (`19900`). This is incompatible with Razorpay, standard Indian payment gateways, and fractional tax/delivery calculations.
4. `[OPEN - Phase 4 & 6]` **Relational Normalization & Heavy JSON Column Anti-Pattern:** Core commerce and nutrition entities (`categories`, `nutrition_tags`, `order_items`, `calin_pack_items`, `addresses`, `allergens`, `delivery_zones`) do not exist as relational tables. Instead, JSON text strings are dumped into `foods.nutrition_tags`, `orders.items_json`, and `calin_pack_tiers.items_json`.
5. `[OPEN - Phase 1b]` **No Database Migrations:** Alembic is not installed or configured. Schema is created imperatively via `Base.metadata.create_all(engine)` on startup.
6. `[DEFERRED - Post-Pilot]` **Rule-Based Mock AI vs. Tool-Calling LLM:** `/api/ai/chat` is a Python `if "iron" in q.lower():` string matcher rather than a tool-calling Claude integration.
7. `[RESOLVED in 1a.1]` **Zero Frontend Automated Tests:** No Playwright e2e test suite exists.
8. `[RESOLVED in 1a.1 (Copy) / OPEN - Phase 3 (Engine)]` **Health Claim & Nutrition Guardrails:** Lacks ICMR-NIN RDA 2020 reference tables, safety floors (<1200 kcal for women / <1500 kcal for men), and guardrails for minors, pregnancy, or declared medical conditions.

---

## 2. Current Architecture Map

### 2.1 Backend Endpoints (`backend/app/main.py`)

| Domain | Method & Path | Auth / Role | Current Implementation | Gap / Vulnerability |
| :--- | :--- | :--- | :--- | :--- |
| **System** | `GET /health` | Public | Returns `{"status": "ok"}` | No DB connectivity check |
| **System** | `GET /ready` | Public | Runs `select(User.id).limit(1)` | Basic query; no pool health check |
| **Auth** | `POST /api/auth/register` | Public | Creates user, PBKDF2 hash, returns JWT | No password complexity, no email verification, no rate limit |
| **Auth** | `POST /api/auth/login` | Public | Verifies PBKDF2, returns 120-min JWT | No refresh token, no brute-force rate limit |
| **Auth** | `GET /api/auth/me` | Bearer JWT | Returns current user profile | No session revocation mechanism |
| **Profile** | `POST /api/profile` | Bearer JWT | Computes Mifflin–St Jeor BMR & TDEE | Lacks safety floors, guardrails for minors/pregnancy, ICMR RDA |
| **Profile** | `GET /api/profile` | Bearer JWT | Returns stored user nutrition profile | Incomplete dietary preference taxonomy |
| **Catalog** | `GET /api/foods` | Public | Filter by search query, tag, sort | Queries JSON string in text column; slow at scale |
| **Catalog** | `GET /api/foods/{food_id}` | Public | Returns single food item | Lacks FSSAI, allergens, and ICMR RDA coverage |
| **Catalog** | `GET /api/foods/barcode/{barcode}` | Public | Lookup by EAN barcode | Indexed on `barcode`, but returns single food only |
| **Categories**| `GET /api/categories` | Public | Returns distinct categories & hardcoded tags | Not backed by normalized tables |
| **Recipes** | `GET /api/recipes` | Public | Lists recipes | Ingredients stored as JSON string |
| **Recipes** | `GET /api/recipes/{recipe_id}` | Public | Returns recipe detail | Ingredients not foreign-keyed to foods table |
| **Plate** | `POST /api/combinations/calculate` | Public | Calculates combined nutrition & price | Calculates in Rupees, not paise |
| **Calin Packs**| `GET /api/packs` | Public | Lists 3 tiers (Basic, Minimal Plus, Premium) | Packs are hardcoded seed rows with JSON items |
| **Calin Packs**| `GET /api/packs/{tier}` | Public | Gets single tier | Items stored as JSON string |
| **Calin Packs**| `POST /api/packs/customize` | Public | Recalculates pack price & macros | Arbitrary 15% discount formula; no generator engine |
| **Cart** | `GET /api/cart` | Bearer JWT | Itemized cart for user | Stored in Rupees; free delivery above ₹800 hardcoded |
| **Cart** | `POST /api/cart/items` | Bearer JWT | Add food or pack to cart | No atomic stock reservation |
| **Cart** | `DELETE /api/cart/items/{id}` | Bearer JWT | Remove item from cart | Functional |
| **Checkout**| `POST /api/orders/checkout` | Bearer JWT | Deducts stock, creates order | Ignores `Address` table; saves raw JSON; demo only |
| **Orders** | `GET /api/orders` | Bearer JWT | Returns user orders (or all if admin) | Items unpacked from JSON string |
| **Orders** | `GET /api/orders/{order_id}` | Bearer JWT | Returns order details | Items unpacked from JSON string |
| **Subs** | `GET /api/subscriptions` | Bearer JWT | Lists user subscriptions | Functional prototype |
| **Subs** | `POST /api/subscriptions` | Bearer JWT | Creates recurring pack subscription | No recurring payment tokenization |
| **Subs** | `PUT /api/subscriptions/{id}/status` | Bearer JWT | Pause / Resume / Cancel | Functional |
| **Reviews** | `POST /api/nutritionist/requests` | Bearer JWT | User submits pack review request | Functional |
| **Reviews** | `GET /api/nutritionist/requests` | Bearer JWT | Nutritionist/admin views queue | Functional |
| **Reviews** | `POST /api/nutritionist/requests/{id}/review` | Role: `nutritionist`/`admin` | Nutritionist records advice | Functional |
| **AI** | `POST /api/ai/chat` | Bearer JWT | String-matching response generator | Hardcoded `if/elif` branches; no real LLM or tool-calling |
| **Admin** | `GET /api/admin/stats` | Role: `admin` | Counts, stock <= 40, recent orders | Unindexed queries; no real metrics |
| **Admin** | `PUT /api/admin/orders/{id}/status` | Role: `admin` | Advances status (`placed` -> `delivered`) | Lacks courier/delivery slot integration |
| **Admin** | `POST /api/admin/foods` | Role: `admin` | Creates food item | Inserts JSON strings for tags/prep |

---

### 2.2 Frontend Architecture & Component Map

Current Routing: **Monolithic Single Page Application** in `app/page.tsx` controlled by `activeTab` React state.

```
app/
├── layout.tsx         # Root HTML layout with Google Fonts
├── globals.css        # Vanilla CSS Brand Design System + Utility Polyfills
└── page.tsx           # Monolithic tab container with auto-demo login
```

#### View Components (`components/`):
- `AppHeader.tsx`: Navigation bar with tab buttons, active tab pill, role indicator, cart count.
- `StorefrontView.tsx`: Landing showcase with hero, 5 pillars, and Calin pack cards.
- `FoodExplorerView.tsx`: Catalog with multi-nutrient filter buttons and category dropdown.
- `FoodDetailModal.tsx`: Product detail modal with macro breakdown and Add to Bag.
- `CalinPacksView.tsx`: Calin packs tier selection, customization engine, and subscription trigger.
- `ScannerView.tsx`: HTML5 camera scanner and manual EAN-13 input with test barcodes.
- `RecipesView.tsx`: Recipes cards with preparation methods and "Add Ingredients to Bag".
- `CombinationsView.tsx`: Interactive plate builder with live sum calculation.
- `OnboardingModal.tsx`: Mifflin–St Jeor intake calculator with physical metrics inputs.
- `CartDrawer.tsx`: Slide-out bag with itemized summary, demo address form, and checkout button.
- `CustomerDashboardView.tsx`: Member Hub with intake summary, order history, and active subscriptions.
- `AdminPortalView.tsx`: Operations console with fulfillment dropdown and nutritionist queue.
- `AssistantDrawer.tsx`: Slide-out AI assistant interface.
- `AuthModal.tsx`: Sign in, registration, and 1-click test role switchers.

#### Dead / Legacy Components (Leftover from static landing phase):
- `Hero.tsx`, `Navbar.tsx`, `Problem.tsx`, `Solution.tsx`, `HowItWorks.tsx`, `CalinPacks.tsx`, `Benefits.tsx`, `AppPreview.tsx`, `Mission.tsx`, `CtaSection.tsx`, `ContactAndFooter.tsx`, `InteractiveCalculatorModal.tsx`, `PackDetailModal.tsx`.
*Recommendation:* Archive or remove these dead files during Phase 1 cleanup to prevent confusion.

---

### 2.3 Data Models (`backend/app/main.py`)

```mermaid
erDiagram
    users ||--o| nutrition_profiles : has
    users ||--o{ cart_items : owns
    users ||--o{ orders : places
    users ||--o{ addresses : saves
    users ||--o{ subscriptions : subscribes
    users ||--o{ nutritionist_review_requests : requests
    foods ||--o{ cart_items : contains
    
    users {
        string id PK
        string name
        string email UK
        string password_hash
        string role
        datetime created_at
    }
    
    nutrition_profiles {
        string id PK
        string user_id FK
        int age
        string sex
        float height_cm
        float weight_kg
        float activity_level
        int calorie_target
        int bmr
        text food_preferences
        text allergies
        int budget_inr
        string goal
    }
    
    foods {
        string id PK
        string name
        string barcode UK
        string category
        text nutrition_tags "JSON array"
        int price_inr "Rupees NOT paise"
        string unit
        string serving_size
        int stock_qty
        float calories
        float protein_g
        float carbs_g
        float fat_g
        float fibre_g
        text vitamins_json "JSON dict"
        text prep_methods "JSON array"
        text dietary_tags "JSON array"
    }

    orders {
        string id PK
        string user_id FK
        string status
        int subtotal_inr "Rupees NOT paise"
        int delivery_fee_inr
        int total_inr
        text items_json "JSON array"
        text delivery_address_json "JSON dict"
        bool demo_payment
    }
```

---

## 3. Deep Dive Findings

### 3.1 Routing & Deep Linking (Frontend)
- **Status:** FAIL.
- **Details:** The app is a single-page tab switcher (`activeTab` state in `app/page.tsx`). There are no App Router routes (`/explore`, `/food/[id]`, `/p/[barcode]`, `/packs`, `/packs/[tier]`, `/cart`, `/checkout`, `/account`, `/orders`, `/orders/[id]`, `/admin/*`, `/nutritionist/*`).
- **Consequences:**
  - Scanning a QR code on physical packaging cannot deep-link to `/p/[barcode]`.
  - Refreshing the page or using the browser back button loses the user's place.
  - Sharing links to specific food items or recipes is impossible.

### 3.2 Authentication & Simulation Analysis
- **Status:** HIGH RISK / SIMULATED.
- **Details:**
  1. **Auto-Login Bypass (`app/page.tsx:86-107`):** When anyone opens the site without a token, the frontend silently calls `/api/auth/login` with hardcoded credentials for `alex@nutriverse.local` and stores the resulting JWT. The app cannot be experienced as a true guest.
  2. **1-Click Hardcoded Logins (`components/AuthModal.tsx:64-94`):** Buttons for Alex, Dr. Priya, and Store Admin execute login using hardcoded email and password strings embedded directly in the frontend bundle.
  3. **Hardcoded Database Seed (`backend/app/main.py:440-466`):** On startup, `seed_initial_data()` creates three test accounts with hardcoded passwords (`Customer123!`, `Nutritionist123!`, `AdminPass123!`). There is no environment guard checking `APP_ENV == "development"`.
  4. **Token Security:** Tokens are stored in browser `localStorage`. No HttpOnly cookie is set. No refresh token flow exists. JWT expiration is a static 120 minutes.
  5. **Password Security:** Password hashing uses `pbkdf2_sha256` instead of `bcrypt`. Password validation only checks length $\ge 8$, allowing weak passwords like `password` or `12345678`.

### 3.3 Monetary Units & Currency Precision
- **Status:** FAIL.
- **Details:**
  - All price fields in the database are integers representing **whole Indian Rupees** (`price_inr`, `base_price_inr`, `subtotal_inr`, `delivery_fee_inr`, `total_inr`).
  - Standard payment gateways (Razorpay, Stripe) and quick-commerce platforms require **integer paise** (1 INR = 100 paise) to handle exact calculations, GST, platform fees, and coupon discounts without rounding errors.
  - No GST tax calculation or line-item tax breakdown exists.

### 3.4 Data Model Normalization vs. JSON Anti-Pattern
- **Status:** HIGH TECHNICAL DEBT.
- **Details:**
  - `Food.nutrition_tags`: Stored as `json.dumps(["protein_rich", "iron_rich"])`. Filtering requires JSON deserialization in Python memory or slow `LIKE '%tag%'` queries.
  - `Order.items_json`: Order items are serialized as JSON strings in the order row. There is no `order_items` table with historical price/nutrient snapshots, making order reporting and inventory reconciliation difficult.
  - `Order.delivery_address_json`: Address is serialized as JSON in the order row. The existing `Address` table is completely bypassed.
  - Missing entities required for a Blinkit-style grocery platform:
    - `categories` (hierarchical grocery categories)
    - `nutrition_tags` (many-to-many relationship with foods)
    - `delivery_zones` (pincodes, serviceability, minimum order, delivery fees)
    - `delivery_slots` (time windows, capacity)
    - `payments` (order ID, gateway, payment status, transaction reference)
    - `inventory_movements` (stock reservation, deduction, returns)
    - `allergens` & `food_allergens`
    - `nutrient_reference` (ICMR-NIN RDA 2020 reference data)
    - `product_labels` (FSSAI license, batch number, shelf life, storage)

### 3.5 Database Migrations & Database Engine
- **Status:** FAIL.
- **Details:**
  - Alembic is neither installed in `backend/requirements.txt` nor initialized in the project.
  - Tables are created via `Base.metadata.create_all(engine)` in `main.py:229`. Altering any model breaks existing databases.
  - The application defaults to SQLite (`sqlite:///./nutriverse.db`). PostgreSQL is referenced in `docker-compose.yml`, but `psycopg2` / `psycopg` is not in `backend/requirements.txt`.

### 3.6 Nutrition Engine & Scientific Rigor
- **Status:** PARTIAL / LACKS GUARDRAILS.
- **Details:**
  - BMR calculation correctly uses the Mifflin–St Jeor equation in `main.py:976`.
  - TDEE correctly multiplies BMR by activity multipliers ($1.2$ to $1.9$).
  - **Missing Elements:**
    1. No safety floors: Does not prevent recommendations below 1,200 kcal/day (women) or 1,500 kcal/day (men).
    2. No guardrails: Allows minors (<18), pregnant/lactating women, and individuals with declared conditions to generate computed diet plans without age-appropriate warnings or medical disclaimers.
    3. Lacks ICMR-NIN RDA 2020 reference tables: Cannot calculate micronutrient coverage % (Iron, Calcium, Vitamin C, Vitamin A, Folate, Zinc).
    4. Health claims: Some components reference "cellular longevity" or "clinical triage" instead of compliant "nutritionist review" and "estimated guidance" terminology.

### 3.7 AI Assistant ("Nourish") Implementation
- **Status:** MOCK / SIMULATED.
- **Details:**
  - `POST /api/ai/chat` in `main.py:1701` inspects user input using primitive substring checks:
    ```python
    if "iron" in q_lower: ...
    elif "protein" in q_lower: ...
    elif "calin pack" in q_lower: ...
    ```
  - It does NOT connect to Claude or any LLM.
  - It does not use function/tool-calling over DB tools (`search_foods`, `get_food`, `get_recipe`, `get_user_targets`, `build_basket_summary`).
  - It lacks prompt-injection resistance, per-user rate limiting, and conversational context retention.

### 3.8 Security & Reliability
- **Status:** HIGH RISK.
- **Details:**
  1. **Rate Limiting:** None. No protection against credential stuffing, checkout flooding, or AI endpoint exhaustion.
  2. **CORS:** Parses comma-separated `ALLOWED_ORIGINS` from env, but lacks origin regex validation or strict production defaults.
  3. **Error Handling:** Returns default FastAPI tracebacks without structured logging or request correlation IDs.
  4. **Health Check:** `/health` does not verify database connectivity; `/ready` only runs a simple query without connection pooling checks.
  5. **Secrets:** Default JWT secret in code (`change-this-in-production-long-secure-key`).

### 3.9 Test Coverage & Verification Integrity
- **Status:** PARTIAL (Backend Only).
- **Backend Tests:** 12 tests in `backend/tests/test_api.py` run against SQLite and pass.
- **Untested Areas:**
  - Pincode serviceability & delivery slot assignment.
  - Razorpay webhook verification and payment idempotency.
  - Concurrent checkout inventory reservation.
  - Multi-tier Calin Pack generator satisfying hard allergen constraints and $\ge 90\%$ calorie coverage.
  - Token refresh, cookie rotation, and unauthorized role access.
- **Frontend Tests:** **Zero.** No Playwright, Jest, or Vitest tests exist. There is no `npm run test:e2e` script.

---

## 4. Prioritized Gap List vs. Master Specification (Superseded Plan)

```mermaid
gantt
    title Nutriverse Upgrade Roadmap
    dateFormat  X
    axisFormat Phase %d
    section Foundation
    Phase 1 : Hardening & Routing       :active, p1, 0, 1
    Phase 2 : Data Model & Migrations   :p2, 1, 2
    section Core Intelligence
    Phase 3 : Scientific Nutrition Engine :p3, 2, 3
    Phase 4 : Catalog & Scanner         :p4, 3, 4
    Phase 5 : Calin Pack Generator      :p5, 4, 5
    section Commerce & AI
    Phase 6 : Blinkit Commerce Flow     :p6, 5, 6
    Phase 7 : Tool-Calling Claude AI    :p7, 6, 7
    Phase 8 : Admin & Nutritionist      :p8, 7, 8
    section Delivery
    Phase 9 : QA, Playwright & Deploy   :p9, 8, 9
```

### Prioritized Gap Breakdown:

1. **Phase 1 — Foundation Hardening**
   - Implement real Next.js App Router pages: `/`, `/explore`, `/food/[id]`, `/p/[barcode]`, `/packs`, `/packs/[tier]`, `/recipes`, `/cart`, `/checkout`, `/account`, `/orders`, `/orders/[id]`, `/admin/*`, `/nutritionist/*`.
   - Implement real auth: Short-lived access JWT + HttpOnly refresh token cookie, bcrypt hashing, password policy, role guards.
   - Restrict seed passwords and 1-click test role logins to `APP_ENV=development`.
   - Remove auto-login from `page.tsx`.
   - Setup Alembic migrations with PostgreSQL driver (`psycopg`).
   - Convert all prices to integer paise. Add database indexes.
   - Install and configure Playwright (`npm run test:e2e`). Add rate limiting (slowapi) and structured logging.

2. **Phase 2 — Data Model Upgrade**
   - Normalize `addresses`, `delivery_zones`, `delivery_slots`, `order_items`, `payments`, `inventory_movements`, `categories`, `nutrition_tags`, `allergens`, `food_allergens`, `nutrient_reference` (ICMR-NIN RDA 2020), `calin_pack_items`, `product_labels`.
   - Write Alembic migrations ensuring existing data is preserved.

3. **Phase 3 — Nutrition Engine**
   - Build `backend/app/nutrition/` pure module with Mifflin–St Jeor BMR, TDEE multipliers, goal adjustments with safety floors (>1200 kcal women / >1500 kcal men).
   - Integrate ICMR-NIN RDA 2020 macro & micronutrient reference values.
   - Implement mandatory safety guardrails for minors, pregnancy, and declared medical conditions.
   - Implement `coverage(basket, profile)` function.
   - Unit test with worked reference cases (e.g., 30M, 75kg, 175cm, moderate activity $\rightarrow$ BMR 1,698.75, TDEE 2,633 kcal).

4. **Phase 4 — Catalog, Search & Scanner**
   - Seed 150+ authentic Indian food items (IFCT 2017 / USDA) with FSSAI tags, storage, and preparation methods.
   - Implement 4 nutritional shelves (carbs, proteins, healthy fats, vitamins & minerals).
   - Full-text search with typo tolerance and nutrient/budget filters.
   - Scanner with optical camera, manual EAN-13 entry, printable QR label generator for admins, deep-linking to `/p/[barcode]`.

5. **Phase 5 — Calin Packs Engine**
   - Build pack generator: maps calorie/macro targets, duration (1, 3, 7 days), budget, and tier to concrete in-stock baskets.
   - Enforce hard allergen constraints.
   - Build substitution engine maintaining equal-or-better nutrient coverage.
   - Implement subscription state transitions and nutritionist review requests.

6. **Phase 6 — Commerce Flow (Blinkit-Style)**
   - Pincode serviceability check for Vijayawada pilot (e.g. 520001–520015).
   - Delivery slot selection and capacity tracking.
   - Razorpay test integration (UPI, Cards) + Cash on Delivery; signature verification webhooks.
   - Atomic inventory reservation at checkout with release on cancellation.
   - Order lifecycle tracking with live updates.

7. **Phase 7 — AI Assistant ("Nourish")**
   - Connect Anthropic Claude API using tool-calling over DB tools (`search_foods`, `get_food`, `get_recipe`, `get_user_targets`, `build_basket_summary`).
   - Implement system prompt guardrails (no medical diagnosis/treatment, disclaimers, allergy compliance, injection protection).
   - Automated tests with mocked LLM tool calls.

8. **Phase 8 — Admin & Nutritionist Portals**
   - Admin: Food CRUD, CSV import, stock management, pack tier config, delivery zones, order pipeline.
   - Nutritionist: Review queue, profile inspection with consent, guidance notes authoring.

9. **Phase 9 — QA, Security, Accessibility & Deploy**
   - Playwright end-to-end tests for the entire customer journey.
   - OWASP security review, accessibility audit (Lighthouse $\ge 85$), Docker production setup.

---

## 5. Phase 0 Audit Conclusion (Historical)

The application provides a solid UI foundation and a clear architectural direction. By addressing the single-page routing constraint, converting currency to paise, introducing normalized database models with Alembic migrations, and replacing simulated auth and mock AI with production-grade implementations, Nutriverse can successfully launch as a nutrition-first quick-commerce platform in Vijayawada.

---

## 6. Phase 1a & 1a.1 Audit Update

### 6.1 Status of Original Audit Findings (B1)

Below is the verified status and commit attribution for the 8 original architectural findings identified during Phase 0:

| # | Finding Description | Current Status | Resolving Commit(s) / Target Phase | Notes & Verification |
|---|---|---|---|---|
| 1 | **Single-Page Tab Switcher vs. Real Routing** | `RESOLVED in 1a` | `4658bfd`, `b47e17a` | Real App Router subroutes (`/explore`, `/food/[id]`, `/p/[barcode]`, `/packs`, `/packs/[tier]`, `/recipes`, `/recipes/[id]`, `/combinations`, `/scanner`, `/cart`, `/checkout`, `/account`, `/orders`, `/orders/[id]`, `/admin`, `/nutritionist`) implemented with `AppShell`, Next.js rewrites, dynamic SEO metadata, and browser history preservation. Verified via Playwright. |
| 2 | **Simulated Authentication & High-Risk Defaults** | `RESOLVED in 1a.1` | `7a611be`, `a2006b0`, `7ee4058`, `80ccce7` | Automatic demo login removed from `app/page.tsx`. Guests browse freely. Bcrypt password hashing (`$2b$`), 15-minute access JWT, 7-day HttpOnly `nutriverse_refresh` cookies, double-submit CSRF protection (`nutriverse_csrf` + `X-CSRF-Token`), token family revocation on reuse detection (`family_id`), fail-safe production default (`APP_ENV=production` when unset), and strict refusal to start if `JWT_SECRET` is insecure, missing, or <32 characters outside development. Client guest cart merges server-side on login. |
| 3 | **Monetary Integrity (INR vs. Paise)** | `OPEN` | Planned for **Phase 1b** | Storing all currency amounts as integer paise (`amount_paise = 19900` for ₹199.00) across DB columns, API payloads, discount rules, delivery charges, and Razorpay integrations. |
| 4 | **Relational Normalization & Heavy JSON Columns** | `OPEN` | Planned for **Phase 4 & Phase 6** | Relational schemas for categories, nutritional tags, normalized order items, delivery zones, allergen matrices, and variant relationships. |
| 5 | **No Database Migrations (Alembic)** | `OPEN` | Planned for **Phase 1b** | Alembic migration baseline, PostgreSQL driver configuration, migration scripts, and docker-compose Postgres service. |
| 6 | **Rule-Based Mock AI vs. Tool-Calling LLM** | `DEFERRED` | **Post-Pilot** | Deferred to post-pilot roadmap. Design constraints recorded: Claude tool-calling with strict grounding in retrieved, cited food records and escalation to nutritionist guidance for any clinical questions. |
| 7 | **Zero Frontend Automated Tests** | `RESOLVED in 1a.1` | `b47e17a`, `d7da160` | Comprehensive Playwright test suite established (`npm run test:e2e`). 9/9 automated end-to-end tests covering unauthenticated storefront browsing, catalog exploration, Calin Pack tier displays, packaging QR lookup (`/p/[barcode]`), scanner view, dev shortcuts gating, real member registration + logout + login, guest bag checkout redirect & post-login return, and admin RBAC denial. |
| 8 | **Health Claim & Nutrition Guardrails** | `RESOLVED in 1a.1` (Copy) / `OPEN` (Engine) | `ae5d7fe` (Copy sweep) / Planned for **Phase 3** (Engine) | All medicalized phrasing ("clinical consultation", "cellular longevity", "longevity medicine") removed across UI and backend strings in favor of compliant terms ("nutritionist review", "general nutritional guidance"). Mandatory "estimate, not medical advice" disclaimer added to account calorie summary. Full ICMR-NIN RDA 2020 calculations and safety floors (>1200 kcal women / >1500 kcal men) planned for Phase 3. |

---

### 6.2 Decision Record: Stack (B2)

- **Decision:** **KEEP** the existing stack (**Next.js 14 + TypeScript**, **FastAPI**, **SQLAlchemy 2.0**, **Pydantic v2**). Do **NOT** migrate to NestJS, Prisma, or a pnpm monorepo.
- **Reason:** Phase 0 and Phase 1a architectural work is already complete, integrated, and verified by passing test suites (23 pytest tests, 9 Playwright e2e tests). FastAPI auto-generates OpenAPI documentation and is exceptionally well-suited for Python-based nutritional computations, optimization algorithms (Mifflin–St Jeor, ICMR-NIN RDA, Calin pack solver), and data science tasks. A full rewrite to a TypeScript backend would delay shipping customer-facing features without technical justification.
- **Tooling Substitutions:**

| Playbook assumed (TS stack) | Nutriverse uses (Active stack) | Rationale & Status |
|---|---|---|
| NestJS | **FastAPI** | Generates OpenAPI 3.0 automatically, native Pydantic v2 schema validation, high-performance async endpoints. |
| Prisma | **SQLAlchemy 2.0 + Alembic** | Standard Python ORM with type annotations (`Mapped[...]`), declarative models, and robust migration tooling. Baseline planned in Phase 1b. |
| BullMQ | **ARQ (Redis)** | Lightweight, async Python job queue for asynchronous notifications and background tasks when needed. |
| Generated client from NestJS OpenAPI | **`openapi-typescript`** from FastAPI OpenAPI | Automatic client types generated directly from FastAPI's `/openapi.json`. CI pipeline will enforce failure if client types are stale. |
| Jest | **pytest** (backend) + **Playwright** (e2e frontend) | Idiomatic test runners for Python and modern Next.js App Router applications. |
| pnpm monorepo | **Current layout** (Frontend in root, backend in `backend/`) | Clean, decoupled separation of concerns without monorepo orchestration overhead. |

---

### 6.3 Decision Record: Authentication (B3)

- **Decision:** Retain and standardize on **Email + Password authentication** with rotating HttpOnly refresh tokens and double-submit CSRF cookies (`nutriverse_csrf` cookie + `X-CSRF-Token` header).
- **Phone OTP Status:** **DEFERRED** as an optional supplementary authentication channel for post-pilot consideration.
- **Reason:** Phone OTP requires contracting an Indian SMS aggregator, provisioning a DLT (Distributed Ledger Technology) sender entity under TRAI regulations, registering message templates, and paying recurring per-SMS carrier fees. Email + password provides an immediate, zero-marginal-cost, secure authentication foundation suitable for the Vijayawada pilot.

#### 6.3.1 CSRF Protection Architecture & State-Changing Endpoint Matrix (P2 & P3)

- **Mechanism (Double-Submit Cookie Pattern):**
  1. **Token Generation & Issuance:** Unauthenticated and authenticated clients obtain a cryptographically random 256-bit token (`generate_csrf_token()`) via `GET /api/auth/csrf` or upon login/registration. This token is delivered as the `nutriverse_csrf` cookie (`SameSite=Lax`, `path="/"`, `HttpOnly=False` allowing standard client application reads) and returned in JSON response bodies.
  2. **Login & Registration Protection (Login CSRF Neutralization):** In `POST /api/auth/login` and `POST /api/auth/register`, `verify_csrf(request)` is enforced. If the incoming request carries a `nutriverse_csrf` cookie, the client **must** supply a matching `X-CSRF-Token` header. Cross-origin attacker sites cannot read cross-origin cookies or forge standard headers under SameSite browser controls, neutralizing Login CSRF attacks where an attacker forces a victim to authenticate under the attacker's account.
  3. **Authenticated State-Changing Request Validation:** All authenticated mutations (`POST`, `PUT`, `DELETE`, `PATCH`) relying on ambient browser cookies (`nutriverse_access` or `nutriverse_refresh`) execute `verify_csrf(request)` in `current_user` dependency resolution or dedicated endpoint handlers (`/api/auth/refresh`, `/api/auth/logout`). If `nutriverse_csrf` cookie is present, `X-CSRF-Token` header is mandatory and must match the cookie value exactly.
  4. **Native API / Bearer Token Exemption:** Direct API consumers using `Authorization: Bearer <jwt>` are safely exempt because browsers never ambiently attach custom `Authorization` headers on cross-origin requests.
  5. **Exempt Endpoints & Justification:**
     - Safe HTTP methods per RFC 7231 (`GET`, `HEAD`) such as catalog discovery (`/api/foods`, `/api/packs`, `/api/recipes`), health status (`/health`, `/ready`), and read-only profile/cart queries.
     - Pure computational helper endpoints that do not persist data or mutate state:
       - `POST /api/combinations/calculate`: Pure stateless calorie/macro optimization math.
       - `POST /api/packs/customize`: Pure client calculation of bundle customization cost/nutrient variance.
       - `POST /api/ai/chat`: Ephemeral conversational completion without persistent database mutation.
  6. **Covered State-Changing Endpoints:**
     - `/api/auth/register`, `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`
     - `/api/profile` (POST)
     - `/api/cart/items` (POST, DELETE), `/api/cart/merge` (POST)
     - `/api/orders/checkout` (POST)
     - `/api/subscriptions` (POST), `/api/subscriptions/{id}/status` (PUT)
     - `/api/nutritionist/requests` (POST), `/api/nutritionist/requests/{id}/review` (POST)
     - `/api/admin/orders/{id}/status` (PUT), `/api/admin/foods` (POST)

- **Guest Cart Price & Name Isolation (P3):**
  - **Client Persistence:** Unauthenticated guest cart items in `localStorage` (`nutriverse_guest_cart`) store strictly item identifiers and user quantities: `{ id, item_type, food_id, pack_tier, quantity, customization }`. No product prices, names, units, or categories are persisted in browser storage.
  - **Dynamic Client Resolution:** The frontend resolves food titles and prices dynamically from the active catalog in memory for display purposes only.
  - **Server-Authoritative Cart Merging:** Upon login, the guest items payload is sent to `POST /api/cart/merge`. The server completely ignores any client-supplied `price`, `unit_price_inr`, or `name`. Prices and available inventory stock are resolved authoritatively from the backend database at merge time.

---

### 6.4 Tracked Requirements Borrowed into the Roadmap (B4)

The following core requirements have been incorporated as tracked deliverables across the roadmap:

1. **Server-Authoritative Money:** All prices, GST, discounts, packaging fees, delivery charges, stock quantities, and nutritional totals are calculated and enforced server-side. Client-provided prices are never trusted. All currency is tracked in integer paise (`amount_paise`). *(Phase 1b)*
2. **Checkout & Payments:** Transactional stock reservation with time-based TTL expiry; order-time food and pricing item snapshots; explicit payment/order state machine (`created` $\rightarrow$ `stock_reserved` $\rightarrow$ `payment_pending` $\rightarrow$ `paid` $\rightarrow$ `confirmed` $\rightarrow$ `preparing` $\rightarrow$ `out_for_delivery` $\rightarrow$ `delivered` / `cancelled` / `refunded`); idempotency keys on checkout mutation; Razorpay test-mode integration with server-side HMAC signature verification; raw webhook payload verification; idempotent webhook handling; full refund lifecycle. *(Phase 6)*
3. **Catalog Architecture:** Strict separation between product identity (`FoodProduct`) and purchasable variants (`ProductVariant`); every nutrient value explicitly models unit, reference basis (per 100 g / per 100 ml / per serving), and empirical source citation; missing values are never imputed as zero; PostgreSQL full-text and trigram search; cursor-based pagination; Redis cache with explicit invalidation triggers on inventory/catalog updates. *(Phase 4)*
4. **Physical Packaging & Scanner:** Optical camera stream requested only after explicit user interaction (click/tap); QR code payloads strictly validated and sanitized to Nutriverse packaging format before navigation; manual EAN-13 input fallback; camera media stream immediately stopped on component unmount; public packaging landing at `/p/[barcode]`. *(Phase 5)*
5. **Calin Packs Generator:** Deterministic, versioned packaging algorithm; customer-declared allergens and dietary exclusions enforced as hard non-negotiable constraints; plain-language nutritional explanation provided for every bundle item; modeled intake gaps explicitly presented as nutritional guidance, never clinical deficiencies; infeasible targets receive transparent explanations rather than compromised bundles. *(Phase 7)*
6. **Nutrition Engine & Safety Guardrails:** Hard prohibition on generating personalized targets for minors (<18 years), pregnant/lactating individuals, or declared medical conditions; absolute caloric floors of 1,200 kcal/day (women) and 1,500 kcal/day (men); reference baseline aligned with ICMR-NIN RDA 2020; every numerical output and recommendation labeled with mandatory notice: *"Nutritional estimate for guidance, not medical advice"*; calculation algorithm version recorded with every stored result. *(Phase 3)*
7. **Order Tracking & Lifecycle:** Persisted-state-driven order status (zero fake timer progress simulations); Server-Sent Events (SSE) dispatch with polling fallback; audited administrative state transitions; reorder workflow re-validates current price, live inventory stock, user allergens, and serviceable pincode. *(Phase 8)*
8. **Administrative Governance:** Validation guardrail blocking publication of any food nutrient record missing source citation, measurement unit, reference basis, or verified status; bulk CSV import with pre-commit validation preview and per-row error reporting; immutable audit log for stock adjustments and price changes; controlled, authenticated asset uploads. *(Phase 9)*
9. **Privacy, Compliance & Security:** Full compliance with the Digital Personal Data Protection (DPDP) Act 2023, including explicit user consent capture, personal data access, data export (JSON/CSV), and account deletion; sensitive health profile attributes encrypted at rest with documented key management; strict exclusion of health data, OTPs, or authentication tokens from application logs. *(Phase 12)*
10. **UX Quality & Resilience:** Standardized loading skeletons, empty states, network error banners, and offline fallback states on all views; responsive layout verification across mobile viewports (375px, 390px), tablets, and desktop; keyboard navigation accessibility; Lighthouse mobile performance score $\ge 85$. *(Phase 11)*
11. **Verified Food Data Grounding:** Initial catalog populated with 40–60 verified Indian whole-food staples sourced from Indian Food Composition Tables (IFCT 2017) or USDA FoodData Central, complete with source citations and retrieval timestamps; images exclusively derived from public-domain / Creative Commons sources or owned photography with an explicit license manifest; honest reporting of catalog counts with zero artificial padding. *(Phase 10)*

---

### 6.5 Revised Roadmap (B5)

*Replaces the previous Phase 1–9 plan (retained above under "Superseded").*

| Order | Phase | Scope |
|---|---|---|
| 1 | **1a.1** | **Completed:** Fail-safe production defaults (`APP_ENV=production`), `JWT_SECRET` safety validation, refresh-token family reuse detection, client guest cart with automatic server merge, Playwright e2e coverage expansion (registration, guest checkout, admin RBAC denial), and compliant copy sweep. |
| 2 | **1b** | **Foundation Hardening:** Alembic migration baseline, integer paise currency conversion, PostgreSQL driver, database indexes, API rate limiting (`slowapi`), Postgres in `docker-compose.yml`, and extended e2e test validation. |
| 3 | **2** | **Design System & Visual Language:** Final brand color palette and typography decisions (colors locked until this phase), design token consolidation, reusable component library. |
| 4 | **3** | **Health Profile & Nutrition Engine:** Mifflin–St Jeor computation, safety floors (>1200 kcal women / >1500 kcal men), ICMR-NIN RDA 2020 reference tables, minor/pregnancy/medical guardrails, versioned calculations. |
| 5 | **4** | **Relational Catalog & Search:** Normalized entities (`Product`, `Variant`, `NutrientValue`), empirical source citations, Postgres full-text & trigram search, cursor pagination, Redis cache with invalidation. |
| 6 | **5** | **Product Detail, Scanner & QR Packaging:** Dedicated product pages (`/food/[id]`), `/p/[barcode]` packaging landing, camera barcode scanner with manual EAN-13 fallback and unmount stream cleanup. |
| 7 | **6** | **Cart, Checkout & Payments:** Vijayawada pincode check, delivery slots, Razorpay test mode (cards/UPI/COD), atomic stock reservation with TTL, server-authoritative money validation, webhook signature verification. |
| 8 | **7** | **Calin Pack Generator:** Deterministic pack generator, hard allergen exclusion rules, intake gap modeling without clinical claims, substitution engine with macro parity. |
| 9 | **8** | **Orders & Live Fulfillment:** Persisted state machine, SSE dispatch updates with polling fallback, validated transitions, reorder stock/allergen re-verification, customer order history. |
| 10 | **9** | **Operations & Admin Console:** Catalog CRUD with citation requirements, CSV import preview with row errors, stock inventory thresholds, audit logging, admin order status dispatch. |
| 11 | **10** | **Seed Data Grounding:** 40–60 verified Indian whole-food staples (IFCT 2017 / USDA), source citations, retrieval dates, licensed image manifests, honest count reporting. |
| 12 | **11** | **UI States, Accessibility & Responsiveness:** Comprehensive loading, empty, and error states; 375px/390px mobile responsiveness; keyboard navigation accessibility; Lighthouse mobile $\ge 85$. |
| 13 | **12** | **Security, Privacy & Performance:** DPDP Act 2023 consent, export, and deletion workflows; health data encryption at rest; audit logging sanitization; security headers and rate limiting. |
| 14 | **13** | **Final Audit & Launch Readiness:** End-to-end verification across catalog, checkout, orders, and admin; deployment validation. |
| **DEFERRED** | **Post-Pilot** | **Post-Pilot Initiatives:** Subscriptions (idempotent, skip/pause-safe recurring orders), AI Assistant (Claude tool-calling restricted to retrieved, cited records with medical escalation), Nutritionist Consultation workflow (private notes with customer confirmation of pack revisions), and Phone OTP (contingent on SMS aggregator and Indian DLT registration). |

#### Recorded Design Constraints for Deferred Capabilities:
- **AI Assistant ("Nourish"):** Must answer exclusively from retrieved, cited catalog and profile records. Must explicitly escalate any clinical or diagnosis inquiries to human healthcare professionals. Never provide medical prescriptions.
- **Subscriptions:** Must implement idempotent, skip/pause-safe recurring schedules with explicit payment authorization tokens, pre-charge notifications, and automatic cancellation on repeated payment failures.
- **Nutritionist Review Workflow:** Nutritionist assessment notes and internal remarks must remain strictly segregated and inaccessible to customer APIs. Any pack modification suggested by a nutritionist requires explicit customer review and acceptance before taking effect.
- **Phone OTP:** Must implement strict rate limiting (e.g. max 3 OTP requests per phone per hour), hash OTP storage with short TTL (5 minutes), and maintain Indian DLT registration records for regulatory audits.

---

### 6.6 Working Agreement (Process) (B6)

To maintain rigorous engineering quality and auditability throughout the project lifecycle:

1. **Branch Hygiene:** Work strictly on dedicated git branches per phase (e.g., `phase-1a`, `phase-1b`). Commit in small, logical steps with descriptive conventional commit messages. Tag before executing risky migrations or schema updates. Never merge to `main` without explicit approval.
2. **Verbatim Command Verification:** Always execute and display real, unedited terminal command output for `pytest`, `npm run test:e2e` (Playwright), builds, and database migrations. Never fabricate test outputs or write "PASSED" without actual process execution.
3. **Transparent Integrations:** Zero simulated or mocked production responses in production paths. Clearly document any missing external credentials (e.g., Razorpay test keys, SMS gateway IDs) with honest status notes.
4. **Phase Stop Points:** Conclude each phase with a comprehensive status report and **STOP**. Do not commence subsequent phases until explicit user approval ("continue") is granted.

