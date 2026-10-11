"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Lock, Mail, ArrowRight, Eye, EyeOff, AlertCircle, Sparkles, CheckCircle2 } from "lucide-react";
import { api, User, getAuthConfig, AuthConfig } from "@/lib/api";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);

  useEffect(() => {
    getAuthConfig().then(setAuthConfig).catch(() => {});
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await api<any>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      router.push(redirectUrl);
    } catch (err: any) {
      setError(err?.message || "Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (userEmail: string, userPass: string) => {
    setLoading(true);
    setError(null);
    try {
      await api<any>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: userEmail, password: userPass }),
      });
      router.push(redirectUrl);
    } catch (err: any) {
      setError(err?.message || "Quick sign in failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf7f0] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-flex items-center gap-2 mb-4">
          <div className="relative w-10 h-10 rounded-xl overflow-hidden shadow-xs">
            <Image
              src="/assets/nutriverse-logo.jpeg"
              alt="Nutriverse"
              fill
              className="object-cover"
              priority
            />
          </div>
          <span className="text-2xl font-black text-[#143e2b] tracking-tight">Nutriverse</span>
        </Link>
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
          Welcome back
        </h1>
        <p className="mt-1 text-xs text-gray-600">
          Sign in to access your nutritional targets, bag, and orders
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-xl border border-gray-100 rounded-3xl sm:px-10 space-y-5">
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Dev Quick Credentials */}
          {authConfig?.demo_shortcuts_enabled && (
            <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-700" /> Dev Seed Shortcuts (Local Testing)
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleQuickLogin("alex@nutriverse.local", "Customer123!")}
                  className="p-2 bg-white hover:bg-emerald-100 border border-emerald-200 rounded-xl text-center transition"
                >
                  <span className="text-[11px] font-bold text-gray-900 block">Alex</span>
                  <span className="text-[10px] text-gray-600 block">Customer</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin("dr.priya@nutriverse.local", "Nutritionist123!")}
                  className="p-2 bg-white hover:bg-teal-100 border border-teal-200 rounded-xl text-center transition"
                >
                  <span className="text-[11px] font-bold text-gray-900 block">Dr. Priya</span>
                  <span className="text-[10px] text-gray-600 block">Nutritionist</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin("admin@nutriverse.local", "AdminPass123!")}
                  className="p-2 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-center transition"
                >
                  <span className="text-[11px] font-bold text-gray-900 block">Admin</span>
                  <span className="text-[10px] text-gray-600 block">Operations</span>
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-800 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#236b48] focus:border-transparent outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-800 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#236b48] focus:border-transparent outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#236b48] hover:bg-[#1a5338] disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <span>Signing in...</span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="text-center pt-3 border-t border-gray-100 text-xs text-gray-600">
            Don&apos;t have an account yet?{" "}
            <Link
              href={`/signup?redirect=${encodeURIComponent(redirectUrl)}`}
              className="text-[#236b48] font-bold hover:underline"
            >
              Create customer account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs">Loading sign-in...</div>}>
      <LoginContent />
    </Suspense>
  );
}
