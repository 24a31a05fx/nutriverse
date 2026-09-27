const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("nutriverse_token") : null;
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.detail ?? "Request failed");
  return response.json() as Promise<T>;
}

export const money = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;
