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
  budget_inr?: number;
  goal?: string;
  calculation_version?: string;
}

export interface Food {
  id: string;
  name: string;
  barcode?: string;
  category: string;
  nutrition_tags: string; // JSON array string
  description: string;
  price_paise: number;
  price_inr?: number;
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
  base_price_inr?: number;
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
  unit_price_inr?: number;
  total_inr?: number;
  customization?: Record<string, any>;
  stock_available?: boolean;
}

export interface CartResponse {
  items: CartItemModel[];
  subtotal_paise: number;
  delivery_fee_paise: number;
  total_paise: number;
  subtotal_inr?: number;
  delivery_fee_inr?: number;
  total_inr?: number;
}

export interface OrderModel {
  id: string;
  user_id?: string;
  status: "placed" | "confirmed" | "preparing" | "out_for_delivery" | "delivered" | "cancelled";
  subtotal_paise: number;
  delivery_fee_paise: number;
  total_paise: number;
  subtotal_inr?: number;
  delivery_fee_inr?: number;
  total_inr?: number;
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
  price_per_delivery_inr?: number;
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
  recent_orders: Array<{ id: string; status: string; total_paise: number; total_inr?: number; created_at: string }>;
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

export function formatPaise(paise: number): string {
  if (typeof paise !== "number" || isNaN(paise)) return "₹0";
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: paise % 100 === 0 ? 0 : 2,
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
  }).format(rupees);
}

export const money = formatPaise;

