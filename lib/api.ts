export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

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
  price_inr: number;
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
  base_price_inr: number;
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
  unit_price_inr: number;
  quantity: number;
  total_inr: number;
  customization?: Record<string, any>;
  stock_available?: boolean;
}

export interface CartResponse {
  items: CartItemModel[];
  subtotal_inr: number;
  delivery_fee_inr: number;
  total_inr: number;
}

export interface OrderModel {
  id: string;
  user_id?: string;
  status: "placed" | "confirmed" | "preparing" | "out_for_delivery" | "delivered" | "cancelled";
  subtotal_inr: number;
  delivery_fee_inr: number;
  total_inr: number;
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
  price_per_delivery_inr: number;
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
  recent_orders: Array<{ id: string; status: string; total_inr: number; created_at: string }>;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("nutriverse_token") : null;
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!response.ok) {
    const errorJson = await response.json().catch(() => null);
    throw new Error(errorJson?.detail || `Request failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const money = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;
