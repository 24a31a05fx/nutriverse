export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api";

export function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)nutriverse_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function ensureCsrfToken(): Promise<string | null> {
  let token = getCsrfToken();
  if (token) return token;
  try {
    const res = await fetch(`${API_URL}/auth/csrf`, {
      method: "GET",
      credentials: "include",
    });
    if (res.ok) {
      const data = await res.json();
      return data.csrf_token || getCsrfToken();
    }
  } catch {
    // best-effort fallback
  }
  return getCsrfToken();
}


export interface User {
  id: string;
  name: string;
  email: string;
  role: "user" | "nutritionist" | "admin";
  created_at?: string;
}

export interface NutritionProfile {
  id?: string;
  user_id?: string;
  age: number;
  sex: "female" | "male";
  height_cm: number;
  weight_kg: number;
  activity_level: number;
  bmr?: number;
  calorie_target: number;
  food_preferences?: string;
  allergies?: string;
  budget_paise?: number;
  goal?: string;
  calculation_version?: string;
  consent_revoked_at?: string | null;
}

export interface Food {
  id: string;
  name: string;
  barcode?: string;
  category: string;
  nutrition_tags: string; // JSON array string
  description: string;
  price_paise: number;
  gst_rate_percent?: number | null;
  unit: string;
  serving_size: string;
  stock_qty: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fibre_g: number;
  vitamins_json: string; // JSON object string
  ingredients: string;
  storage_info: string;
  prep_methods: string; // JSON array string
  dietary_tags: string; // JSON array string
  emoji: string;
  active: boolean;
}

export interface BarcodeNutrient {
  canonical_code: string;
  nutrient_name: string;
  value: number | null;
  unit: string;
  basis: string;
  is_unknown: boolean;
  unknown_reason: string | null;
  verification_status: string;
}

export interface BarcodeProductIdentity {
  id: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  description: string | null;
  serving_size: string;
  serving_quantity: number | null;
  quantity: string | null;
  packaging: string | null;
  countries: string | null;
  ingredients: string | null;
  image_url: string | null;
  price_paise: number | null;
  stock_qty: number;
  emoji: string;
  nutrition_tags?: string[];
  dietary_tags?: string[];
}

export interface ImageProvenance {
  url: string | null;
  source_url: string | null;
  license: string | null;
  license_status: "known" | "unknown" | "no_image";
  contributor: string | null;
  attribution: string;
}

export interface BarcodeSourceInfo {
  name: string;
  record_id: string | null;
  publisher?: string;
  license: string;
  attribution: string;
  retrieval_date?: string | null;
  image_license?: string | null;
  image_attribution?: string | null;
  image_contributor?: string | null;
  image_provenance?: ImageProvenance;
}

export interface BarcodeLookupResponse {
  barcode: string;
  match_type: "local_catalog" | "external_fresh" | "external_cached";
  is_in_catalog: boolean;
  product: BarcodeProductIdentity;
  basis: string;
  nutrients: BarcodeNutrient[];
  source: BarcodeSourceInfo;
  verification_status: string;
  license_attribution: string;
  legal_disclaimer?: string;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  instructions: string;
  prep_method: string;
  prep_time_mins: number;
  servings: number;
  calories: number;
  protein_g: number;
  emoji: string;
  ingredients_json: string;
  active: boolean;
}

export interface CalinPackTier {
  id: string;
  tier: "basic" | "minimal_plus" | "premium";
  name: string;
  base_price_paise: number;
  description: string;
  target_audience: string;
  max_substitutions: number;
  items_json: string;
  active: boolean;
}

export interface CartItemModel {
  id: string;
  item_type: "food" | "pack";
  food_id?: string;
  pack_tier?: string;
  name: string;
  category?: string;
  unit?: string;
  unit_price_paise: number;
  quantity: number;
  total_paise: number;
  customization?: Record<string, any>;
  stock_available?: boolean;
}

export interface CartResponse {
  items: CartItemModel[];
  subtotal_paise: number;
  delivery_fee_paise: number;
  total_paise: number;
}

export interface OrderModel {
  id: string;
  user_id?: string;
  status:
    | "placed"
    | "confirmed"
    | "preparing"
    | "out_for_delivery"
    | "delivered"
    | "cancelled"
    | "placed_demo"
    | "preparing_demo"
    | "completed_demo"
    | "cancelled_demo"
    | string;
  subtotal_paise: number;
  delivery_fee_paise: number;
  total_paise: number;
  items: Array<any>;
  delivery_address: Record<string, any>;
  demo_payment: boolean;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionModel {
  id: string;
  pack_tier: string;
  pack_name: string;
  frequency: "weekly" | "bi_weekly" | "monthly";
  status: "active" | "paused" | "cancelled";
  price_per_delivery_paise: number;
  next_delivery_date: string;
  created_at: string;
}

export interface NutritionistRequestModel {
  id: string;
  user_name: string;
  pack_tier: string;
  customer_notes: string;
  status: "pending" | "reviewed";
  guidance_notes?: string;
  nutritionist_name?: string;
  created_at: string;
  reviewed_at?: string;
}

export interface AdminStats {
  counts: {
    products: number;
    orders: number;
    users: number;
    subscriptions: number;
    pending_nutritionist_reviews: number;
  };
  low_stock_alerts: Array<{ name: string; stock: number }>;
  recent_orders: Array<{ id: string; status: string; total_paise: number; created_at: string }>;
}

interface ApiOptions extends RequestInit {
  _isRetry?: boolean;
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  // Double-submit CSRF for mutating operations
  if (["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
    let csrf = getCsrfToken();
    if (!csrf && typeof window !== "undefined") {
      csrf = await ensureCsrfToken();
    }
    if (csrf) {
      headers.set("X-CSRF-Token", csrf);
    }
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: options.credentials ?? "include",
  });

  if (response.status === 401 && !options._isRetry) {
    const isAuthPath = path.startsWith("/auth/login") ||
      path.startsWith("/auth/register") ||
      path.startsWith("/auth/refresh") ||
      path.startsWith("/auth/logout");

    if (!isAuthPath && typeof window !== "undefined") {
      try {
        const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(getCsrfToken() ? { "X-CSRF-Token": getCsrfToken()! } : {}),
          },
        });
        if (refreshRes.ok) {
          return api<T>(path, { ...options, _isRetry: true });
        }
      } catch {
        // Refresh failed, let the 401 fall through
      }
    }
  }

  if (!response.ok) {
    const errorJson = await response.json().catch(() => null);
    throw new Error(errorJson?.detail || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    return await api<User>("/auth/me");
  } catch {
    return null;
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await api<{ status: string }>("/auth/logout", { method: "POST" });
  } catch {
    // best-effort logout
  }
}

export interface AuthConfig {
  app_env: string;
  development: boolean;
  demo_shortcuts_enabled: boolean;
}

export async function getAuthConfig(): Promise<AuthConfig> {
  try {
    return await api<AuthConfig>("/auth/config");
  } catch {
    return {
      app_env: "development",
      development: true,
      demo_shortcuts_enabled: true,
    };
  }
}

export function assertPaise(paise: unknown, label = "price"): number {
  if (typeof paise !== "number" || isNaN(paise) || !Number.isFinite(paise)) {
    throw new Error(`[PriceError] Missing or invalid ${label}: received ${String(paise)}`);
  }
  return paise;
}

export function formatPaise(paise: number): string {
  if (typeof paise !== "number" || isNaN(paise) || !Number.isFinite(paise)) {
    return "[Price Error]";
  }
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: paise % 100 === 0 ? 0 : 2,
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
  }).format(rupees);
}

export const money = formatPaise;


// Phase 5: Deterministic Personalized Nutrition Target Estimation Types
export interface TargetMacroItem {
  target_g_day: number;
  target_kcal_day?: number;
  energy_percentage?: number;
  reference_basis: string;
  amdr_range_g_day?: { min: number; max: number };
  amdr_percentage_range?: string;
  standard_applied?: string;
  floor_applied?: boolean;
  official_reference_g_day?: number;
  planning_floor_g_day?: number;
  planning_floor_applied?: boolean;
  unit?: string;
}

export interface TargetFreshnessInfo {
  is_stale: boolean;
  persisted_calorie_target: number;
  freshly_calculated_daily_energy_target_kcal: number;
  persisted_calculation_version?: string;
  active_engine_version?: string;
  version_matched?: boolean;
  retired_or_unrecognized_version?: boolean;
  note?: string;
}

export interface NutritionTargetResult {
  calculation_id: string;
  timestamp: string;
  method: {
    identifier: string;
    name: string;
    version: string;
    citation: string;
    equation_formula: string;
    applicable_population: string;
  };
  inputs: {
    age_years: number;
    sex: "female" | "male";
    height: { value: number; unit: string; normalized_cm: number };
    weight: { value: number; unit: string; normalized_kg: number };
    activity_level: { name: string; pal_multiplier: number; description: string };
    goal: { name: string; energy_adjustment_kcal: number; description: string };
    optional_dietary?: { allergies: string; food_preferences: string };
  };
  biometric_indicators: {
    bmi: number;
    bmi_classification: string;
    screening_note?: string;
  };
  energy_targets: {
    bmr_kcal_day: number;
    tdee_kcal_day: number;
    raw_daily_target_kcal: number;
    daily_energy_target_kcal: number;
    safety_floor_applied: boolean;
    safety_floor_threshold_kcal: number;
    guardrail_applied?: boolean;
    guardrail_threshold_kcal?: number;
    guardrail_type?: string;
    guardrail_basis?: string;
  };
  macronutrient_targets: {
    protein: TargetMacroItem;
    fat: TargetMacroItem;
    carbohydrates: TargetMacroItem;
    dietary_fiber: TargetMacroItem;
    macro_energy_accounting?: {
      total_reported_macro_kcal_day: number;
      daily_energy_target_kcal: number;
      discrepancy_kcal: number;
      accounting_disclosure?: string;
    };
  };
  warnings: string[];
  assumptions_and_limitations: string[];
  disclaimer: string;
}

export interface NutritionTargetInput {
  age: number;
  sex: "female" | "male";
  height: number;
  height_unit?: "cm" | "m" | "in" | "ft_in";
  weight: number;
  weight_unit?: "kg" | "lbs";
  activity_level: string | number;
  goal?: string;
  method?: string;
  optional_allergies?: string;
  optional_preferences?: string;
}

export interface SavedNutritionTargetProfile {
  profile_id: string;
  user_id: string;
  updated_at: string | null;
  consent_revoked_at: string | null;
  persisted_snapshot?: {
    calorie_target: number;
    bmr: number;
    calculation_version: string;
    saved_at: string | null;
  };
  target_freshness?: TargetFreshnessInfo;
  saved_inputs: {
    age: number;
    sex: string;
    height_cm: number;
    weight_kg: number;
    activity_level: number;
    goal: string;
    food_preferences: string;
    allergies: string;
    budget_paise: number;
    calculation_version?: string;
    persisted_calorie_target?: number;
    persisted_bmr?: number;
  };
  estimate: NutritionTargetResult;
}

export async function calculateNutritionTargets(
  input: NutritionTargetInput
): Promise<NutritionTargetResult> {
  return await api<NutritionTargetResult>("/nutrition-targets/calculate", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getSavedNutritionTargets(): Promise<SavedNutritionTargetProfile> {
  return await api<SavedNutritionTargetProfile>("/nutrition-targets/me");
}

export async function saveNutritionTargets(
  input: NutritionTargetInput & {
    consent_given: boolean;
    food_preferences?: string;
    allergies?: string;
    budget_paise?: number;
  }
): Promise<{ message: string; saved_inputs: any; estimate: NutritionTargetResult }> {
  return await api<{ message: string; saved_inputs: any; estimate: NutritionTargetResult }>(
    "/nutrition-targets/me",
    {
      method: "PUT",
      body: JSON.stringify(input),
    }
  );
}

export async function deleteSavedNutritionTargets(): Promise<{ message: string; deleted: boolean }> {
  return await api<{ message: string; deleted: boolean }>("/nutrition-targets/me", {
    method: "DELETE",
  });
}


// Phase 6.0: Personalized Nutrition Recommendations Types & Client
export interface RecommendationPortion {
  mass_g: number;
  food_state: string;
  portion_type: "documented_serving" | "standardized_comparison_100g" | "explicit_override" | string;
  is_standardized_100g_fallback: boolean;
  serving_size_catalog_raw?: string;
  basis: string;
  basis_notes: string;
  edible_weight_assumption?: string;
}

export interface NutrientContribution {
  target_nutrient: string;
  canonical_code: string;
  nutrient_name: string;
  amount: number;
  unit: string;
  user_target: number;
  target_contribution_pct: number;
  remaining_target: number;
  uncovered_target_difference?: number;
  portion_energy_kcal: number | null;
  nutrient_density?: number | null;
  nutrient_density_per_100kcal: number | null;
  density_label?: string | null;
  verification_status: string;
}

export interface RecommendationSourceProvenance {
  source_record_id: string;
  external_id: string;
  external_name: string;
  data_source_name: string;
  publisher: string;
  license: string;
  license_url: string | null;
  retrieval_date: string | null;
  analytical_basis?: string;
  scholarly_citation?: string | null;
  copyright_notice?: string | null;
}

export interface DataCompleteness {
  total_tracked: number;
  known_count: number;
  unknown_count: number;
  completeness_ratio: number;
}

export interface RecommendedFood {
  food_id: string;
  food_name: string;
  category: string;
  emoji: string;
  price_paise: number;
  portion: RecommendationPortion;
  nutrient_contribution: NutrientContribution;
  explanation: string;
  source_provenance: RecommendationSourceProvenance[];
  data_completeness: DataCompleteness;
}

export interface RecommendationsResponse {
  engine_version: string;
  timestamp: string;
  user_id?: string;
  profile_id?: string;
  target_nutrient: {
    query_key: string;
    canonical_code: string;
    name: string;
    unit: string;
    user_target: number;
    reference_standard: string;
  };
  query_parameters: {
    limit: number;
    portion_override_g: number | null;
    strict_verified: boolean;
    food_state: string;
    declared_allergies: string;
  };
  counts: {
    total_active_foods_evaluated: number;
    eligible_candidates_found: number;
    recommendations_returned: number;
    excluded_count: number;
  };
  ranking_semantics?: {
    primary_criterion: string;
    secondary_criterion: string;
    tertiary_criterion: string;
    disclaimer: string;
  };
  target_comparison_disclosure?: string;
  recommendations: RecommendedFood[];
  excluded_candidates_summary?: Array<{
    food_id: string;
    food_name: string;
    reason: string;
  }>;
  excluded_candidates?: Array<{
    food_id: string;
    food_name: string;
    reason: string;
  }>;
  warnings: string[];
  disclaimer: string;
  target_freshness?: TargetFreshnessInfo | null;
}

export interface RecommendationQueryOptions {
  target_nutrient?: "protein" | "dietary_fiber" | "energy" | "fat" | "carbohydrates" | string;
  limit?: number;
  portion_override_g?: number;
  strict_verified?: boolean;
  food_state?: "raw" | "cooked";
}

export async function getPersonalizedRecommendations(
  options: RecommendationQueryOptions = {}
): Promise<RecommendationsResponse> {
  const params = new URLSearchParams();
  if (options.target_nutrient) params.set("target_nutrient", options.target_nutrient);
  if (options.limit !== undefined) params.set("limit", String(options.limit));
  if (options.portion_override_g !== undefined) params.set("portion_override_g", String(options.portion_override_g));
  if (options.strict_verified !== undefined) params.set("strict_verified", String(options.strict_verified));
  if (options.food_state) params.set("food_state", options.food_state);

  const qs = params.toString();
  const endpoint = `/recommendations/me${qs ? `?${qs}` : ""}`;
  return await api<RecommendationsResponse>(endpoint);
}

export async function calculateStatelessRecommendations(
  payload: {
    target_nutrient: string;
    age: number;
    sex: string;
    height: number;
    height_unit?: string;
    weight: number;
    weight_unit?: string;
    activity_level: string | number;
    goal?: string;
    method?: string;
    optional_allergies?: string;
    limit?: number;
    portion_override_g?: number;
    strict_verified?: boolean;
    food_state?: string;
  }
): Promise<RecommendationsResponse> {
  return await api<RecommendationsResponse>("/recommendations/calculate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// Daily Food Intake Logging & Nutrition Summary
export interface DailyFoodLogItem {
  id: string;
  date: string;
  food_id?: string | null;
  food_name: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  quantity: number;
  unit: string;
  mass_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fibre_g: number;
  nutrients_json: string;
  source_basis: string;
  data_completeness: string;
  created_at: string;
}

export interface DailyNutritionSummary {
  date: string;
  items: DailyFoodLogItem[];
  consumed_totals: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fibre_g: number;
  };
  target_totals?: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fibre_g: number;
  } | null;
  remaining?: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fibre_g: number;
  } | null;
  progress_percentage?: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fibre_g: number;
  } | null;
  data_completeness_notes: string[];
}

export interface LogFoodInput {
  food_id?: string;
  food_name?: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  quantity: number;
  unit: string;
  food_state?: string;
  date?: string;
}

export async function getFoods(): Promise<Food[]> {
  return api<Food[]>("/foods");
}

export async function getDailyNutritionSummary(date: string): Promise<DailyNutritionSummary> {
  return api<DailyNutritionSummary>(`/nutrition/daily-log?date=${encodeURIComponent(date)}`);
}

export async function logDailyFood(input: LogFoodInput): Promise<DailyFoodLogItem> {
  return api<DailyFoodLogItem>("/nutrition/daily-log", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function deleteDailyFood(logId: string): Promise<{ message: string; deleted_id: string }> {
  return api<{ message: string; deleted_id: string }>(`/nutrition/daily-log/${encodeURIComponent(logId)}`, {
    method: "DELETE",
  });
}


